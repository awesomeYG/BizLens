# Week2 实施任务列表

> 对应需求：`requirements.md`
> 对应设计：`design.md`
> 预计工时：5-7 天

---

## 阶段一：公共基础设施 (Day 1)

### Task 1.1: 抽取公共查询辅助函数
- [ ] 创建 `backend/internal/service/query_helpers.go`
- [ ] 抽取 `buildAggExpression()` 为包级函数（当前在 `root_cause_service.go` 中是方法）
- [ ] 抽取 `toFloat64Safe()` 为包级函数
- [ ] 新增 `calcChangePercent(current, previous float64) float64`
- [ ] 新增 `isConsecutiveDecline(values []float64, n int) bool`
- [ ] 新增 `buildTimeGroupExpr(dsType, timeField, granularity string) string`（跨方言时间分组）
- [ ] 新增 `resolveTimeField(db, tenantID, baseTable string, dsType) string`（时间字段识别）
- [ ] 新增 `findDataSourceForMetric(db, dataSourceService, tenantID string, metric) (*DataSource, error)`（数据源匹配）

### Task 1.2: 修复已有编译错误
- [ ] 修复 `main.go` 中 `NewAnomalyHandler` 调用参数不匹配问题
- [ ] 修复 `daily_summary_handler.go` 中 `GetLatestSummary` / `ListSummaries` 方法不存在问题
- [ ] 确保 `go build ./...` 通过

---

## 阶段二：真实数据源集成 (Day 2-3)

### Task 2.1: BaselineService 对接真实数据源 (REQ-W2-001)
- [ ] 修改 `NewBaselineService` 签名，注入 `MetricService` 和 `DataSourceService`
- [ ] 重写 `fetchHistoricalValues`：根据 metricID 获取指标 -> 匹配数据源 -> 构建聚合 SQL -> 执行查询
- [ ] 实现 `buildAggExpression` 复用公共函数
- [ ] 实现时间字段识别（复用 `resolveTimeField`）
- [ ] 支持 PostgreSQL / MySQL / SQLite 三种方言的时间分组 SQL
- [ ] 更新 `main.go` 中 `NewBaselineService` 调用

### Task 2.2: SchedulerService 多租户改造 (REQ-W2-002, REQ-W2-011)
- [ ] 修改 `NewSchedulerService` 签名，注入 `MetricService`、`DataSourceService`、`IMService`
- [ ] 重写 `executeHourlyTasks`：遍历所有租户 -> 并发处理（goroutine pool, max 10）
- [ ] 实现 `processHourlyForTenant`：获取活跃指标 -> 基线学习 -> 查询实际值 -> 异常检测 -> 推送
- [ ] 实现 `queryCurrentValue`：从数据源查询当前周期聚合值
- [ ] 实现 `getEnabledPlatformIDs`：从 `im_configs` 获取已启用平台 ID
- [ ] 重写 `executeDailySummary`：遍历所有租户 -> 获取平台 ID -> 发送摘要
- [ ] 每个租户独立 goroutine，单个失败不影响其他
- [ ] 更新 `main.go` 中 `NewSchedulerService` 调用

### Task 2.3: 验证端到端流程
- [ ] 使用 SQLite 种子数据验证：基线学习能从种子数据计算出合理的期望值
- [ ] 验证异常检测使用真实查询值（非硬编码）
- [ ] 验证多租户场景不 panic

---

## 阶段三：根因分析引擎增强 (Day 3-4)

### Task 3.1: 交叉下钻 (REQ-W2-004)
- [ ] 新增 `CrossDrillDown` 数据结构
- [ ] 实现 `performCrossDrillDown`：取 Top1 因子 -> 固定主维度 -> 遍历次维度下钻
- [ ] 交叉下钻触发条件：`|contribution| > 30%`
- [ ] 限制：最多 3 个次维度 + 每维度 LIMIT 10
- [ ] 在 `AnalyzeRootCause` 主流程中集成调用
- [ ] 查询失败时记录日志但不阻塞主流程

### Task 3.2: 时间序列分析 (REQ-W2-005)
- [ ] 新增 `TimeSeriesDetail`、`TimePoint` 数据结构
- [ ] 实现 `analyzeTimeSeries`：查询最近 7 天每日数据 -> 标注异常点 -> 找拐点
- [ ] 拐点检测：连续 2+ 点偏离均值 > 1.5 sigma
- [ ] 趋势方向判定：最新值 vs 3 天前值
- [ ] 在主流程中集成（交叉下钻之后）
- [ ] 支持带维度筛选条件的时间序列查询

### Task 3.3: 关联指标验证 (REQ-W2-006)
- [ ] 新增 `CorrelatedAnomaly` 数据结构
- [ ] 实现 `checkCorrelatedMetrics`：查找同 base_table 其他指标 -> 查询当前值 vs 基线值 -> 标注异常
- [ ] 限制：最多 5 个关联指标
- [ ] 关联度判定：>= 2 个异常 -> 置信度 +0.1，同方向 >= 2 -> +0.05

### Task 3.4: 置信度与摘要增强 (REQ-W2-007)
- [ ] 实现 `calculateEnhancedConfidence`：基础置信度 + 关联指标增强
- [ ] 重写 `generateSummary` 为 `generateEnhancedSummary`
- [ ] 摘要包含四部分：定位、时间、关联、建议
- [ ] 摘要长度控制在 200 字以内

---

## 阶段四：每日摘要增强 (Day 4-5)

### Task 4.1: DailySummaryService 依赖注入改造
- [ ] 修改 `NewDailySummaryService` 签名，注入 `MetricService` 和 `DataSourceService`
- [ ] 更新 `main.go` 中调用

### Task 4.2: 核心指标速览 (REQ-W2-003, REQ-W2-008)
- [ ] 实现 `getCoreMetrics`：按 tags "核心指标" 或 confidence_score 排序选取
- [ ] 实现 `queryMetricData`：查询当日/昨日/上周同日值 -> 计算环比/同比
- [ ] 实现 `querySparkline`：查询最近 7 天每日聚合值
- [ ] 实现 `queryAggValue`：通用的时间范围聚合查询
- [ ] `MetricSummary` 结构增强：unit, format, yoyChange, sparkline

### Task 4.3: 趋势预测 (REQ-W2-009)
- [ ] 新增 `MetricPrediction` 数据结构
- [ ] 实现 `predictTrends`：线性回归（最小二乘法）
- [ ] 计算 slope, intercept, R-squared
- [ ] 预测 3 天后值 + 本周预测总量
- [ ] R^2 < 0.5 时添加备注 "趋势不明显，预测仅供参考"
- [ ] 数据不足 3 天时跳过预测

### Task 4.4: 正负面趋势分类 (REQ-W2-010)
- [ ] 新增 `ConcernItem`、`PositiveItem` 数据结构
- [ ] 实现 `classifyTrends`：环比判定 + 连续下滑检测 + 异常关联
- [ ] Concern 规则：环比下降 > 5%，或连续 3 天下滑
- [ ] Positive 规则：环比增长 > 10%

### Task 4.5: IM 推送消息增强
- [ ] 重写 `SendDailySummary` 中的消息构建逻辑
- [ ] 消息包含：健康评分 + 核心指标速览 + 需要关注 + 正面趋势 + 趋势预测
- [ ] 格式对齐（指标名称统一宽度，数值右对齐）

### Task 4.6: 补全 DailySummaryService 缺失方法
- [ ] 实现 `GetLatestSummary(tenantID string) (*model.DailySummary, error)`
- [ ] 实现 `ListSummaries(tenantID string, limit int) ([]model.DailySummary, error)`
- [ ] 确保 daily_summary_handler.go 编译通过

---

## 阶段五：集成 & 验证 (Day 5-6)

### Task 5.1: main.go 初始化链路更新
- [ ] 更新所有服务的初始化顺序和参数
- [ ] 确保 `go build ./...` 零错误
- [ ] 确保所有 handler 路由正确注册

### Task 5.2: 端到端功能验证
- [ ] 启动服务，使用 SQLite + 种子数据
- [ ] 手动触发基线学习 API，验证基线从种子数据计算
- [ ] 手动触发异常检测 API，验证实际值从种子数据查询
- [ ] 手动触发根因分析 API，验证交叉下钻 + 时间序列 + 关联指标
- [ ] 手动触发每日摘要生成 API，验证核心指标 + 预测 + 分类
- [ ] 检查 IM 推送消息格式

### Task 5.3: 错误场景验证
- [ ] 无数据源时的降级处理
- [ ] 数据源连接失败时的降级处理
- [ ] 指标无数据时的降级处理
- [ ] 单租户失败不影响其他租户

---

## 阶段六：文档更新 (Day 6)

### Task 6.1: MEMORY.md 更新
- [ ] 记录新的服务依赖关系
- [ ] 记录 query_helpers.go 公共函数列表
- [ ] 记录 SQL 方言兼容策略

### Task 6.2: 实施进度报告
- [ ] 创建 `week2-implementation-progress.md`
- [ ] 记录完成状态和待改进点
