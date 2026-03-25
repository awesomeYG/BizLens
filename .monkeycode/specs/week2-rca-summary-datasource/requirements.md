# Week2 需求文档：根因分析引擎增强 + 每日摘要增强 + 真实数据源集成

> 版本：v1.0
> 日期：2026-03-25
> 关联规划：`.monkeycode/docs/product-direction-2026Q2.md` 第七节 Week 3-4
> 状态：待评审

---

## 一、背景与目标

### 1.1 当前状态（Week1 交付物）

Week1 已完成业务健康监控 MVP：
- 基线学习引擎：移动平均算法框架，但 `fetchHistoricalValues` 使用硬编码模拟数据
- 异常检测引擎：统计阈值检测（2 sigma / 3 sigma）+ 沉默期降噪 + IM 推送
- 根因分析引擎：单维度下钻 + 自动发现维度回退，768 行，已对接 `ExecuteQuery` 查询真实数据源
- 每日摘要：仅包含异常列表和健康评分，`Metrics` 字段始终为空数组
- 调度服务：定时任务框架，硬编码 `demo` 租户和 `actualValue = 85000.0`

### 1.2 Week2 目标

将 MVP 升级为 **完整体验版本（V1）**，核心目标：

1. **根因分析引擎增强**：从"单维度下钻"升级为"交叉下钻 + 时间序列 + 关联指标 + AI 假设生成"
2. **每日摘要增强**：从"异常列表"升级为"核心指标速览 + 趋势预测 + 正面/负面趋势 + 结构化推送"
3. **真实数据源集成**：消除所有模拟数据，让基线学习、异常检测、每日摘要全链路对接真实数据源

### 1.3 成功标准

| 指标 | Week1 | Week2 目标 |
|------|-------|-----------|
| 基线数据来源 | 硬编码数组 | 真实数据源查询 |
| 异常检测实际值来源 | 硬编码 85000.0 | 从数据源实时查询 |
| 根因分析维度覆盖 | 单维度下钻 | 交叉下钻（最多 2 级） |
| 根因分析输出 | 贡献因子列表 | 贡献因子 + 时序变化 + 关联指标 + AI 摘要 |
| 每日摘要核心指标 | 空数组 | 从数据源查询 TOP 核心指标实际值 + 环比/同比 |
| 每日摘要趋势预测 | 无 | 基于历史趋势的简单线性预测 |
| 调度服务租户覆盖 | 仅 demo | 所有注册租户 |

---

## 二、功能需求

### REQ-W2-001: 真实数据源集成 -- 基线学习

**EARS 模式**：当系统执行基线学习任务时，系统应从指标关联的真实数据源查询历史数据，计算移动平均基线。

**详细需求**：

1. `BaselineService.fetchHistoricalValues` 应替换模拟数据逻辑：
   - 根据 `metricID` 从 `metrics` 表获取指标定义（`base_table`、`base_field`、`aggregation`）
   - 根据指标关联的数据源，通过 `DataSourceService.ExecuteQuery` 查询历史数据
   - 按 `granularity`（daily/hourly/weekly）聚合历史数据
   - 如果指标或数据源不存在，返回明确的错误信息

2. 查询窗口：
   - daily 粒度：查询最近 `windowDays` 天的每日聚合值
   - hourly 粒度：查询最近 `windowDays * 24` 小时的每小时聚合值
   - weekly 粒度：查询最近 `windowDays / 7` 周的每周聚合值

3. 时间字段自动识别：
   - 优先使用语义层 `dimensions` 表中 `data_type = 'time'` 且 `base_table` 匹配的维度字段
   - 回退策略：扫描表中名为 `created_at`、`order_date`、`date`、`timestamp` 等常见时间字段

**验收条件**：
- 当数据源中有 7 天以上数据时，基线学习能正确计算期望值和标准差
- 当数据源中无数据时，返回 "无历史数据" 错误，不写入空基线
- 支持 MySQL、PostgreSQL、SQLite 三种数据源类型的 SQL 方言差异

---

### REQ-W2-002: 真实数据源集成 -- 异常检测实际值

**EARS 模式**：当调度服务触发异常检测时，系统应从真实数据源查询每个指标的当前值，而非使用硬编码值。

**详细需求**：

1. `SchedulerService.executeHourlyTasks` 应：
   - 查询所有租户（而非硬编码 `demo`）
   - 对每个租户，查询该租户所有 `status = 'active'` 的指标
   - 对每个指标，通过数据源查询当前周期的实际聚合值
   - 调用 `AnomalyService.DetectAnomaly` 进行检测

2. 实际值查询逻辑：
   - 构建 SQL：`SELECT {aggregation}({base_field}) FROM {base_table} WHERE {time_field} >= {period_start}`
   - period_start 取决于检测粒度（hourly: 当前小时开始, daily: 当天 00:00）
   - 如果查询失败或无数据，跳过该指标的检测（不报错）

3. 平台 ID 获取：
   - 从租户的 `im_configs` 中获取所有已启用（`enabled = true`）的平台 ID

**验收条件**：
- 调度服务能遍历多租户多指标执行异常检测
- 异常检测使用的实际值来自真实数据源查询结果
- 单个指标查询失败不影响其他指标的检测

---

### REQ-W2-003: 真实数据源集成 -- 每日摘要指标查询

**EARS 模式**：当系统生成每日摘要时，系统应从真实数据源查询核心指标的当日值、昨日值和同期值，计算环比和同比变化。

**详细需求**：

1. `DailySummaryService.GenerateDailySummary` 中 `Metrics` 字段应包含实际数据：
   - 查询该租户所有 tags 包含 "核心指标" 的指标（或取 `confidence_score` 最高的前 5 个指标）
   - 对每个指标查询：当日值、昨日值、上周同日值（或去年同日值）
   - 计算：环比变化 = (当日值 - 昨日值) / 昨日值
   - 计算：同比变化 = (当日值 - 同期值) / 同期值
   - 确定方向：up / down / stable（变化幅度 < 1% 视为 stable）

2. 查询策略：
   - 当日值：`WHERE {time_field} >= today_start AND {time_field} < today_end`
   - 昨日值：`WHERE {time_field} >= yesterday_start AND {time_field} < yesterday_end`
   - 同期值优先使用上周同日，如数据不足则使用 7 天前

**验收条件**：
- 每日摘要包含至少 1 个核心指标的当日值和变化趋势
- 环比和同比计算正确（除数为零时显示 N/A）
- 未连接数据源的租户生成摘要时优雅降级（显示"暂无数据"）

---

### REQ-W2-004: 根因分析引擎 -- 交叉下钻

**EARS 模式**：当根因分析引擎完成单维度下钻后，系统应对异常贡献最大的维度值进行交叉下钻（结合第二维度），以定位更精确的根因。

**详细需求**：

1. 在现有的单维度下钻之后，增加 Step 2 交叉下钻：
   - 从单维度下钻结果中选出贡献最大的 Top 1 维度及其 Top 1 异常值
   - 将该值作为固定筛选条件，对其他维度再做一次下钻
   - 示例：单维度下钻发现"华东 -52%"，交叉下钻以 `region='华东'` 为条件，按品类再下钻
   - 交叉下钻 SQL：`SELECT {dim2} AS dim_value, {agg}({metric}) FROM {table} WHERE {dim1} = '{topValue}' AND {time_filter} GROUP BY {dim2}`

2. 交叉下钻限制：
   - 最多 1 层交叉下钻（避免查询爆炸）
   - 仅当单维度下钻 Top Contributor 的 `|contribution| > 30%` 时才触发
   - 交叉下钻最多遍历 3 个次要维度

3. 结果整合：
   - `RootCauseResult` 新增 `CrossDrillDowns []CrossDrillDown` 字段
   - `CrossDrillDown` 包含：primaryDimension, primaryValue, secondaryDimension, segments

**验收条件**：
- 当单维度下钻发现明确的高贡献因子时，自动触发交叉下钻
- 交叉下钻结果能精确到"华东 + 数码品类"级别的原因定位
- 交叉下钻查询失败时不影响主流程

---

### REQ-W2-005: 根因分析引擎 -- 时间序列分析

**EARS 模式**：当根因分析引擎执行分析时，系统应查询异常指标在交叉下钻定位的维度组合下的近期时间序列，以确定异常开始的时间点。

**详细需求**：

1. 在交叉下钻之后增加 Step 3 时间序列分析：
   - 对 Top 根因组合（如 region='华东' AND category='数码'），查询最近 7 天每日数据
   - 输出时间序列数组，标注每天是否异常（与 7 天窗口均值对比）
   - 找到"拐点"：第一个连续偏离均值 > 1.5 sigma 的日期

2. 结果结构：
   - `RootCauseResult` 新增 `TimeSeriesAnalysis *TimeSeriesDetail` 字段
   - `TimeSeriesDetail` 包含：`DataPoints []TimePoint`（日期+值+是否异常）、`InflectionDate`（拐点日期）、`DaysSinceStart`（异常持续天数）

**验收条件**：
- 时间序列分析能展示异常开始的时间点
- 拐点检测使用滑动窗口均值 + 标准差判定

---

### REQ-W2-006: 根因分析引擎 -- 关联指标验证

**EARS 模式**：当根因分析引擎完成维度下钻后，系统应检查其他关联指标在同一时间窗口的异常情况，以交叉验证根因假设。

**详细需求**：

1. 在时间序列分析之后增加 Step 4 关联指标验证：
   - 查询同一 `base_table` 下的其他活跃指标
   - 对每个关联指标查询近 1 天 vs 前 7 天均值的变化
   - 标注哪些关联指标也出现异常（变化 > 20%）

2. 结果结构：
   - `RootCauseResult` 新增 `CorrelatedAnomalies []CorrelatedAnomaly` 字段
   - `CorrelatedAnomaly` 包含：metricName, currentValue, baselineValue, changePct, isAnomaly

3. 关联度判定：
   - 如果 >= 2 个关联指标同时异常，提升整体分析置信度 +0.1
   - 如果相关指标变化方向一致（如 GMV 降 + 订单量降），置信度再 +0.05

**验收条件**：
- 能发现并展示同源表的关联指标异常情况
- 关联指标异常能增强根因分析的置信度

---

### REQ-W2-007: 根因分析引擎 -- AI 摘要生成增强

**EARS 模式**：当根因分析引擎完成所有分析步骤后，系统应基于下钻结果、时间序列和关联指标生成结构化的自然语言摘要。

**详细需求**：

1. `generateSummary` 方法增强：
   - 包含"定位"部分：哪个维度组合贡献最大
   - 包含"时间"部分：异常从什么时候开始
   - 包含"关联"部分：其他指标是否也异常
   - 包含"建议"部分：建议用户检查什么

2. 摘要格式示例：
   ```
   [定位] {metricName} 异常主要集中在 {dim1Value}（{dim1Name}），
   交叉分析发现 {dim1Value} + {dim2Value} 贡献了 {contribution}% 的变化。
   [时间] 异常始于 {inflectionDate}（{daysSinceStart} 天前），呈持续 {direction} 趋势。
   [关联] 同期 {correlatedMetric} 也出现 {correlatedChange}% 变化，可能存在关联。
   [建议] 建议重点检查 {dim1Value} 的 {dim2Value} 在近 {daysSinceStart} 天的业务变化。
   ```

**验收条件**：
- 摘要包含定位、时间、关联、建议四个部分
- 摘要语言自然、信息密度高，不超过 200 字

---

### REQ-W2-008: 每日摘要 -- 核心指标速览

**EARS 模式**：当系统生成每日摘要时，系统应展示核心指标的当日值、环比变化和同比变化，以 KPI 卡片形式呈现。

**详细需求**：

1. `SummaryContent` 结构增强：
   - `Metrics []MetricSummary` 包含完整的核心指标数据
   - `MetricSummary` 增加字段：`unit`（单位）、`format`（格式化模式）、`yoyChange`（同比变化）、`trend`（最近 7 天微型趋势数据点）

2. 指标选择策略：
   - 优先选择 tags 包含 "核心指标" 的指标
   - 如果没有标签，按 `confidence_score` 降序取前 5 个
   - 如果没有活跃指标，使用基于 schema 自动检测的候选指标

3. IM 推送中的展示格式：
   ```
   [核心指标速览]
     GMV:     ¥285,000   环比 -5%   同比 +12%
     订单量:   1,234      环比 -3%   同比 +8%
     客单价:   ¥231       环比 -2%   同比 +4%
   ```

**验收条件**：
- 每日摘要包含至少 1 个核心指标的实际值和变化
- IM 推送消息包含格式化的指标速览

---

### REQ-W2-009: 每日摘要 -- 趋势预测

**EARS 模式**：当系统生成每日摘要时，系统应基于最近 7 天的趋势数据生成简单的短期预测（3 天 / 本周），帮助用户预判业务走向。

**详细需求**：

1. 趋势预测算法：
   - 使用最近 7 天数据进行线性回归（最小二乘法）
   - 预测未来 3 天的指标值
   - 计算 R-squared 值作为预测置信度
   - R-squared < 0.5 时标注"趋势不明显，预测仅供参考"

2. `SummaryContent` 新增 `Predictions []MetricPrediction` 字段：
   - `MetricPrediction` 包含：metricName, currentValue, predictedValue（3 天后）, predictedWeekTotal, confidence, trend（上升/下降/平稳）

3. IM 推送中的展示格式：
   ```
   [趋势预测] 基于近 7 天趋势
     本周 GMV 预计：¥1.95M（达成率 92%）
     订单量趋势：持续上升，预计 3 天后达 1,400
   ```

**验收条件**：
- 线性回归预测结果与手动计算一致
- 置信度低时（R^2 < 0.5）有明确标注
- 数据不足 3 天时不输出预测

---

### REQ-W2-010: 每日摘要 -- 正面/负面趋势分离

**EARS 模式**：当系统生成每日摘要时，系统应将需要关注的异常项和正面趋势分开展示，便于用户快速了解业务全貌。

**详细需求**：

1. `SummaryContent` 新增：
   - `Concerns []ConcernItem`：需要关注的项（异常、持续下降等）
   - `Positives []PositiveItem`：正面趋势（创新高、持续上升等）

2. 分类逻辑：
   - Concern：指标环比下降 > 5%，或连续 3 天下滑，或基线外异常
   - Positive：指标环比增长 > 10%，或创近 30 天新高

3. 每项包含：
   - `title`：一句话标题
   - `analysis`：AI 分析原因（简短）
   - `suggestion`：建议操作

**验收条件**：
- 正面和负面趋势分离展示
- 每项包含标题、分析、建议三部分

---

### REQ-W2-011: 调度服务 -- 多租户遍历

**EARS 模式**：当调度服务执行定时任务时，系统应遍历所有注册租户（而非硬编码 demo），对每个租户执行完整的监控流程。

**详细需求**：

1. `executeHourlyTasks` 改造：
   - 查询 `tenants` 表获取所有租户
   - 对每个租户异步执行基线学习 + 异常检测（使用 goroutine pool 限制并发）
   - 最大并发数：10 个租户

2. `executeDailySummary` 改造：
   - 遍历所有租户
   - 每个租户的摘要发送到该租户所有已启用的 IM 平台

3. 健壮性要求：
   - 单个租户处理失败不影响其他租户
   - 日志中记录每个租户的处理结果（成功/失败/跳过）

**验收条件**：
- 调度服务能处理多个租户
- 单租户失败有日志记录，不影响整体

---

## 三、非功能需求

### NFR-W2-001: 性能

- 单个指标的基线学习查询应在 5 秒内完成
- 根因分析（含交叉下钻 + 时间序列 + 关联指标）总耗时应 < 15 秒
- 每日摘要生成（含所有指标查询）应在 10 秒内完成

### NFR-W2-002: 容错

- 数据源不可达时优雅降级，不阻塞整体流程
- SQL 执行超时（10 秒）后自动取消
- 基线/异常/摘要的生成逻辑之间互相解耦，一个失败不影响另一个

### NFR-W2-003: 可观测性

- 所有数据源查询应记录 SQL 日志和耗时
- 异常检测结果应记录日志（检测了多少指标、发现了多少异常）
- 每日摘要生成结果应记录日志

---

## 四、影响范围

### 后端修改文件

| 文件 | 修改类型 | 说明 |
|------|---------|------|
| `backend/internal/service/baseline_service.go` | 重大改造 | fetchHistoricalValues 对接真实数据源 |
| `backend/internal/service/anomaly_service.go` | 小改 | 无需大改，但 DetectAnomaly 的调用方式随调度改造而变 |
| `backend/internal/service/root_cause_service.go` | 新增功能 | 交叉下钻、时间序列分析、关联指标验证 |
| `backend/internal/service/daily_summary_service.go` | 重大改造 | 核心指标查询、趋势预测、正负面分类 |
| `backend/internal/service/scheduler_service.go` | 重大改造 | 多租户遍历、真实数据查询、平台 ID 获取 |
| `backend/internal/model/model.go` | 小改 | 可能新增辅助类型 |

### 不涉及的部分

- 前端页面（Week2 聚焦后端引擎增强，前端展示待后续迭代）
- 认证/授权（不变）
- 数据源管理（不变，复用现有 ExecuteQuery）

---

## 五、依赖关系

| 依赖 | 说明 | 风险 |
|------|------|------|
| DataSourceService.ExecuteQuery | 根因分析和基线学习的核心查询能力 | 已实现，低风险 |
| MetricService | 指标定义查询 | 已实现，低风险 |
| Dimension 表 | 维度信息查询（用于下钻） | 已实现，低风险 |
| IM 推送 | 摘要和告警推送通道 | 已实现，低风险 |
| 租户数据源已配置 | 必须至少有 1 个已连接的数据源才能生效 | 中风险，需处理无数据源场景 |
