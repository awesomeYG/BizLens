# BizLens 产品方向规划 - 2026 Q2

> 从 "更好的 BI" 到 "中小企业的业务雷达站"
> 日期：2026-03-25

---

## 一、问题诊断：为什么当前产品缺乏不可替代性

### 现状

BizLens 当前的核心交互模式是 **"自然语言问数据"**：

```
用户提问 -> AI 生成 SQL -> 查询数据库 -> 返回图表/文字
```

这个模式在 2024 年是创新，到 2026 年已经是行业标配。ThoughtSpot、Power BI Copilot、Tableau AI、Metabase + LLM 插件、甚至一个周末 hackathon 项目都能做到。

### 根本原因

| 问题 | 说明 |
|------|------|
| AI 只是"翻译层" | LLM 充当了自然语言到 SQL 的翻译器，没有真正理解业务 |
| 被动响应模式 | 用户不问，系统就不说。用户不知道该问什么，工具就没用 |
| 无数据资产沉淀 | 每次对话是一次性的，知识不积累，用户不会越用越离不开 |
| 功能同质化 | 问答、图表、大屏 -- 传统 BI 做了 20 年的事情，只是换了个交互方式 |

### 核心洞察

> **"AI BI" 不是一个产品品类，而是一个功能特性。**
> 真正的产品品类应该回答一个问题：**用户因为什么离不开你？**

---

## 二、新定位：AI 驱动的业务雷达站

### 一句话定位

**BizLens 是中小企业的业务健康监控中心 -- 像体检报告一样持续监测你的业务指标，出了问题主动告诉你原因和解法。**

### 定位对比

| 维度 | 传统 BI | 当前 BizLens | 新 BizLens |
|------|---------|-------------|------------|
| 交互模式 | 用户拖拽/点击 | 用户用自然语言问 | **系统主动推送** |
| AI 角色 | 无 | 翻译器（NL -> SQL） | **业务顾问（监控+分析+建议）** |
| 价值时间 | 用户打开工具时 | 用户发起对话时 | **7x24h 持续监控** |
| 数据资产 | 报表模板 | 对话历史 | **语义指标 + 基线 + 规则** |
| 用户门槛 | 需要分析思维 | 需要知道该问什么 | **零门槛，AI 主动服务** |
| 迁移成本 | 低（换个工具就行） | 低 | **高（指标资产、基线数据不可替代）** |

### 不可替代性来源

1. **时间壁垒**：基线数据需要持续积累，新产品无法冷启动
2. **资产壁垒**：指标定义、告警规则、分析经验沉淀在系统中
3. **信任壁垒**：AI 预警的准确率需要时间校准，用户不会轻易换

---

## 三、三大战略方向

### 方向总览

```
方向一 [P0]                方向二 [P1]               方向三 [P2]
业务健康体检                语义层 + 指标资产化         决策闭环
(主动监控)                 (数据理解)                 (行动驱动)

  AI 主动发现异常              AI 理解业务语义             AI 建议 + 执行
  推送根因 + 建议              指标统一定义               IM 内审批操作
  每日业务摘要                 知识持续积累               效果反馈跟踪
       |                        |                        |
       +------------------------+------------------------+
                                |
                     形成完整的观测-理解-行动闭环
```

三个方向不是独立的，而是层层递进的关系：
- **方向一**解决"用户不知道该看什么"的问题
- **方向二**解决"AI 不理解业务"的问题，让方向一更准确
- **方向三**解决"看到了问题然后呢"的问题，完成最后一环

---

## 四、方向一 [P0]：业务健康体检（主动监控）

> **核心命题**：从"用户问 AI 答"变为"AI 主动发现并推送"

### 4.1 为什么是最高优先级

- 这是与所有传统 BI（含 AI BI）最直接的差异化
- 已有告警基础设施（AlertEvent + AlertTriggerLog + IM 适配器），改造成本低
- 用户无需学习任何东西，连接数据源就能获得价值
- 是典型的 "aha moment" 功能 -- 用户第一次收到有价值的异常推送时，会意识到这不是传统 BI

### 4.2 功能架构

```
                    +-------------------+
                    |   调度引擎         |
                    |  (Cron/Interval)  |
                    +--------+----------+
                             |
              +--------------+--------------+
              |              |              |
     +--------v------+ +----v--------+ +---v-----------+
     | 基线学习引擎   | | 异常检测引擎 | | 根因分析引擎   |
     | BaselineLearner| | AnomalyDetect| | RootCauseAnalyzer|
     +--------+------+ +----+--------+ +---+-----------+
              |              |              |
              +--------------+--------------+
                             |
                    +--------v----------+
                    |   洞察生成器       |
                    |  InsightGenerator |
                    +--------+----------+
                             |
              +--------------+--------------+
              |              |              |
     +--------v------+ +----v--------+ +---v-----------+
     | IM 推送        | | 邮件摘要     | | 站内通知       |
     | (飞书/钉钉/企微)| | DailySummary | | InAppNotify   |
     +---------------+ +-------------+ +---------------+
```

### 4.3 核心模块设计

#### 4.3.1 基线学习引擎 (Baseline Learner)

**职责**：为每个指标建立"正常是什么样"的基准。

```go
// backend/internal/service/baseline/learner.go

type BaselineConfig struct {
    MetricID    string        // 关联的指标 ID
    Window      time.Duration // 学习窗口（7d/30d/90d）
    Granularity string        // 粒度（hourly/daily/weekly）
    Method      string        // 算法（moving_avg/percentile/prophet）
}

type BaselineResult struct {
    MetricID   string
    Timestamp  time.Time
    Expected   float64   // 期望值
    StdDev     float64   // 标准差
    Upper      float64   // 上界（期望 + N*标准差）
    Lower      float64   // 下界（期望 - N*标准差）
    SeasonAdj  float64   // 季节性调整因子
}
```

**学习策略**：

| 策略 | 适用场景 | 说明 |
|------|---------|------|
| 移动平均 | 稳定型指标（日活、留存） | 简单，计算快，适合初始版本 |
| 分位数包络 | 波动型指标（GMV、订单量） | P5/P95 作为异常边界 |
| 季节性分解 | 有周期的指标（周末效应） | STL 分解，剥离趋势+季节+残差 |

**冷启动方案**（数据不足 7 天时）：
- 第 1-3 天：使用行业经验基线（可配置）
- 第 4-7 天：混合模式（行业基线 + 已有数据加权）
- 第 7 天+：切换到纯数据驱动基线

#### 4.3.2 异常检测引擎 (Anomaly Detector)

**职责**：将实际值与基线对比，识别有意义的偏离。

```go
// backend/internal/service/anomaly/detector.go

type AnomalyResult struct {
    MetricID    string
    Timestamp   time.Time
    ActualValue float64
    Expected    float64
    Deviation   float64     // 偏离程度（倍标准差）
    Severity    string      // critical / warning / info
    Confidence  float64     // 置信度 0-1
    Direction   string      // up / down
    Context     string      // "GMV 较基线下降 35%，是近 30 天最大跌幅"
}
```

**检测规则层级**：

```
第一层：统计阈值检测
  |  简单快速，覆盖面广
  |  规则：偏离 > 2 倍标准差 -> warning，> 3 倍 -> critical
  v
第二层：趋势突变检测
  |  识别拐点，而非单点异常
  |  规则：连续 3 个点同方向偏离 > 1.5 倍标准差
  v
第三层：关联异常检测
  |  多指标联动异常（GMV 降 + 转化率降 = 真异常）
  |  规则：>= 2 个关联指标同时异常 -> 提升 severity
  v
第四层：AI 语义过滤（LLM）
  |  过滤误报：已知原因（节假日、大促后回落）
  |  需要 LLM 判断：这个异常是否值得推送给用户
```

**降噪策略**（避免告警疲劳）：

| 策略 | 说明 |
|------|------|
| 最小沉默期 | 同一指标同一方向，4 小时内最多推送 1 次 |
| 严重度衰减 | 持续异常但无恶化，severity 自动降级 |
| 业务日历 | 已知的促销/节假日，自动调高阈值 |
| 用户反馈 | 用户标记"这不是问题"，自动调整基线 |

#### 4.3.3 根因分析引擎 (Root Cause Analyzer)

**职责**：异常被确认后，自动下钻找到原因。

```go
// backend/internal/service/rootcause/analyzer.go

type RootCauseResult struct {
    AnomalyID    string
    Hypotheses   []Hypothesis
    DataEvidence []Evidence
    Confidence   float64
}

type Hypothesis struct {
    Description  string   // "华东地区退货率飙升导致 GMV 下降"
    Confidence   float64  // 0-1
    Contribution float64  // 对总体异常的贡献度 0-1
    Dimensions   []string // 下钻维度路径 ["region=华东", "category=数码"]
    Verification string   // "建议查看华东地区最近 7 天退货详情"
}
```

**分析策略**：

```
输入：GMV 异常下降 35%

Step 1: 维度下钻（自动遍历所有维度）
  -> 按地域拆分：华东 -52%，华南 -5%，华北 +3%
  -> 按品类拆分：数码 -60%，服装 -10%，食品 +5%
  -> 按渠道拆分：APP -40%，Web -25%，小程序 +2%

Step 2: 交叉下钻（聚焦异常最大的维度）
  -> 华东 + 数码：-75%  <-- 定位！
  -> 华东 + 服装：-20%

Step 3: 时间序列分析
  -> 华东数码品类从 3 天前开始下降
  -> 同期退货率从 5% 飙升到 28%

Step 4: 关联指标验证
  -> 客服工单数同期增长 300%
  -> 退货原因 TOP1："商品与描述不符"

Step 5: AI 生成假设
  -> "3 天前上线的华东数码品类可能存在商品描述问题，
      导致退货率飙升，进而影响 GMV。
      建议：检查近期上架/修改的数码品类商品详情。"
```

#### 4.3.4 每日业务摘要

**推送内容结构**：

```
---------- BizLens 每日业务摘要 ----------
日期：2026-03-25（周二）

[健康评分] 72/100（较昨日 -8）

[核心指标速览]
  GMV:    ¥285,000  同比 +12%  环比 -5%
  订单量:  1,234     同比 +8%   环比 -3%
  客单价:  ¥231      同比 +4%   环比 -2%
  转化率:  3.2%      同比 -0.1pp 环比 -0.2pp

[需要关注] 2 项
  1. 转化率连续 3 天下滑（当前 3.2%，基线 3.5%）
     -> AI 分析：主要集中在移动端，可能与上周 APP 改版相关
     -> 建议：对比改版前后的漏斗数据
  
  2. 库存周转天数升至 45 天（阈值 40 天）
     -> AI 分析：SKU-1234/SKU-5678 库存积压严重
     -> 建议：考虑促销清仓或调整采购计划

[正面趋势] 1 项
  1. 新客获取成本降至 ¥28（本月最低）
     -> 原因：上周投放的短视频渠道 ROI 达 5.2

[预测] 基于当前趋势
  本周 GMV 预计：¥1.95M（达成率 92%）
----------------------------------------------
```

### 4.4 实现路线

| 阶段 | 时间 | 交付物 | 说明 |
|------|------|--------|------|
| MVP | 2 周 | 基线学习 + 统计异常检测 + IM 推送 | 最小可用，验证用户反应 |
| V1 | +2 周 | 根因分析 + 每日摘要 + 降噪 | 完整体验 |
| V2 | +3 周 | 季节性分解 + 关联检测 + 用户反馈闭环 | 准确率提升 |

### 4.5 技术方案与现有架构的对接

| 现有组件 | 复用方式 |
|---------|---------|
| AlertEvent + AlertTriggerLog | 扩展为基线规则载体，新增 baseline 类型的告警 |
| IM 适配器（飞书/钉钉/企微） | 直接复用推送通道，新增摘要消息模板 |
| Schema 感知系统 | 自动发现可监控的数值字段，生成候选指标 |
| Go 后端 Cron | 新增调度模块，定时执行基线计算和异常检测 |
| AI 对话 | 异常推送可点击展开对话，用户追问根因细节 |

### 4.6 数据模型新增

```sql
-- 基线快照表
CREATE TABLE metric_baselines (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    metric_id UUID NOT NULL,
    granularity VARCHAR(20) NOT NULL,   -- hourly/daily/weekly
    period_key VARCHAR(50) NOT NULL,    -- "2026-03-25" 或 "2026-03-25T14"
    expected_value DOUBLE PRECISION,
    std_dev DOUBLE PRECISION,
    upper_bound DOUBLE PRECISION,
    lower_bound DOUBLE PRECISION,
    sample_count INTEGER,
    method VARCHAR(50),                 -- moving_avg/percentile/stl
    computed_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(tenant_id, metric_id, granularity, period_key)
);

-- 异常事件表
CREATE TABLE anomaly_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    metric_id UUID NOT NULL,
    detected_at TIMESTAMPTZ NOT NULL,
    actual_value DOUBLE PRECISION,
    expected_value DOUBLE PRECISION,
    deviation DOUBLE PRECISION,
    severity VARCHAR(20) NOT NULL,      -- critical/warning/info
    confidence DOUBLE PRECISION,
    direction VARCHAR(10),              -- up/down
    root_cause JSONB,                   -- 根因分析结果
    status VARCHAR(20) DEFAULT 'open',  -- open/acknowledged/resolved/false_positive
    notified_at TIMESTAMPTZ,
    resolved_at TIMESTAMPTZ,
    user_feedback VARCHAR(50),          -- helpful/not_helpful/false_alarm
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 每日摘要表
CREATE TABLE daily_summaries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    summary_date DATE NOT NULL,
    health_score INTEGER,               -- 0-100
    content JSONB NOT NULL,             -- 结构化摘要内容
    sent_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(tenant_id, summary_date)
);

CREATE INDEX idx_baselines_tenant_metric ON metric_baselines(tenant_id, metric_id);
CREATE INDEX idx_anomalies_tenant_time ON anomaly_events(tenant_id, detected_at);
CREATE INDEX idx_anomalies_status ON anomaly_events(status) WHERE status = 'open';
CREATE INDEX idx_summaries_tenant_date ON daily_summaries(tenant_id, summary_date);
```

---

## 五、方向二 [P1]：语义层 + 指标资产化

> **核心命题**：让 AI 不只理解表结构，而是理解业务含义；让数据越用越有价值

### 5.1 为什么重要

当前 BizLens 的 AI 对话依赖 Schema 感知系统，本质是把表结构（字段名、类型）喂给 LLM。这有两个问题：

1. **AI 不理解业务**："amount" 字段是 GMV、还是退款金额、还是运费？LLM 只能猜
2. **知识不积累**：上次用户告诉 AI "amount 是 GMV"，下次对话又要重新解释

语义层的价值在于：**把人脑中的业务知识（指标口径、维度含义、计算规则）固化到系统里，让 AI 每次对话都自带业务理解。**

### 5.2 功能架构

```
+---------------------------------------------------+
|                  用户交互层                          |
|  "上个月华东地区的 GMV 同比增长多少？"               |
+----------------------------+----------------------+
                             |
                             v
+---------------------------------------------------+
|                  语义解析层                          |
|  GMV -> metrics.gmv (SUM(orders.amount))           |
|  华东 -> dimensions.region = '华东'                 |
|  上个月 -> time_range: last_month                   |
|  同比 -> compare: year_over_year                    |
+----------------------------+----------------------+
                             |
                             v
+---------------------------------------------------+
|                  SQL 生成层                          |
|  基于语义模型生成精确 SQL，而非 LLM 猜测             |
|  SELECT SUM(amount) FROM orders                    |
|  WHERE region = '华东'                              |
|  AND created_at BETWEEN '2026-02-01' AND '2026-02-28' |
+----------------------------+----------------------+
                             |
                             v
+---------------------------------------------------+
|                  执行 + 展示层                       |
+---------------------------------------------------+
```

### 5.3 核心模块设计

#### 5.3.1 指标自动发现 (Metric Discovery)

**职责**：连接数据源后，AI 自动扫描表结构，推断业务指标。

```go
// backend/internal/service/semantic/discovery.go

type DiscoveryResult struct {
    SuggestedMetrics    []MetricSuggestion
    SuggestedDimensions []DimensionSuggestion
    SuggestedRelations  []RelationSuggestion
    Confidence          float64
}

type MetricSuggestion struct {
    Name        string  // "GMV" / "订单量" / "客单价"
    Formula     string  // "SUM(orders.amount)"
    SourceTable string  // "orders"
    SourceCol   string  // "amount"
    DataType    string  // currency / count / ratio / percentage
    Confidence  float64
    Reasoning   string  // "字段名 amount + 类型 decimal + 关联 order 表 -> 推断为交易金额"
}
```

**发现策略**：

```
输入：数据源的完整 Schema

Step 1: 字段语义识别（基于命名规则 + 类型 + 采样值）
  amount/price/cost/fee       -> 金额类指标
  count/qty/quantity          -> 数量类指标
  rate/ratio/percentage       -> 比率类指标
  created_at/updated_at/date  -> 时间维度
  region/city/province        -> 地理维度
  category/type/status        -> 分类维度
  user_id/customer_id         -> 实体维度

Step 2: 表语义识别（基于表名 + 字段组合）
  orders/transactions         -> 交易表
  users/customers             -> 用户表
  products/items              -> 商品表
  refunds/returns             -> 退货表

Step 3: 复合指标推断（基于基础指标组合）
  GMV           = SUM(orders.amount)
  客单价         = SUM(orders.amount) / COUNT(DISTINCT orders.user_id)
  退货率         = COUNT(refunds) / COUNT(orders)
  转化率         = COUNT(orders) / COUNT(DISTINCT visits.user_id)

Step 4: 用户确认 + 校准
  AI 推荐的指标列表展示给用户
  用户可以：确认 / 修改名称 / 修改公式 / 删除 / 新增
```

#### 5.3.2 指标注册中心 (Metric Registry)

**职责**：统一管理所有指标定义，确保组织内口径一致。

```go
// backend/internal/service/semantic/registry.go

type MetricDefinition struct {
    ID          string
    TenantID    string
    Name        string            // "GMV"
    DisplayName string            // "成交总额"
    Description string            // "所有已完成订单的金额总和，不含退款"
    Formula     string            // "SUM(orders.amount) WHERE orders.status = 'completed'"
    Unit        string            // "CNY" / "件" / "%"
    Format      string            // "#,##0.00" / "0.0%"
    Tags        []string          // ["核心指标", "销售"]
    Owner       string            // "销售部"
    DataSource  string            // 数据源 ID
    Dimensions  []string          // 可下钻的维度
    TimeGrain   []string          // 支持的时间粒度 ["hourly", "daily", "weekly", "monthly"]
    Derived     []DerivedMetric   // 衍生指标（同比、环比等）
    CreatedBy   string            // 创建方式 "auto_discovery" / "manual" / "ai_suggestion"
    Version     int               // 版本号，每次修改递增
    Status      string            // active / deprecated / draft
}

type DerivedMetric struct {
    Name    string // "GMV 日环比"
    Type    string // year_over_year / month_over_month / day_over_day
    Formula string // "(current - previous) / previous"
}
```

#### 5.3.3 语义 SQL 生成器 (Semantic SQL Generator)

**职责**：基于语义模型生成 SQL，而非让 LLM 直接猜 SQL。

**与当前 Schema 感知系统的区别**：

| 维度 | 当前（Schema 感知） | 新方案（语义层） |
|------|-------------------|----------------|
| AI 输入 | 表结构（字段名+类型） | 指标定义 + 维度 + 关系 |
| SQL 生成 | LLM 自由生成 | 基于模板 + 规则生成，LLM 只做意图解析 |
| 口径一致性 | 不保证 | 同一指标永远用同一公式 |
| 错误率 | 高（LLM 幻觉） | 低（模板化生成） |

**生成流程**：

```
用户："上个月华东地区的 GMV 同比增长多少"

Step 1: LLM 意图解析（只做语义理解，不生成 SQL）
  -> 指标: "GMV"
  -> 维度过滤: region = "华东"
  -> 时间范围: last_month
  -> 计算: year_over_year

Step 2: 语义层映射
  -> GMV -> MetricDefinition{ Formula: "SUM(orders.amount) WHERE status='completed'" }
  -> region -> DimensionDefinition{ Table: "orders", Column: "region" }

Step 3: SQL 模板生成（非 LLM 生成）
  WITH current_period AS (
    SELECT SUM(amount) AS value
    FROM orders
    WHERE status = 'completed'
      AND region = '华东'
      AND created_at BETWEEN '2026-02-01' AND '2026-02-28'
  ),
  previous_period AS (
    SELECT SUM(amount) AS value
    FROM orders
    WHERE status = 'completed'
      AND region = '华东'
      AND created_at BETWEEN '2025-02-01' AND '2025-02-28'
  )
  SELECT
    c.value AS current_value,
    p.value AS previous_value,
    (c.value - p.value) / p.value AS growth_rate
  FROM current_period c, previous_period p

Step 4: 执行 + 格式化
  -> 当期 GMV: ¥2,850,000
  -> 同期 GMV: ¥2,410,000
  -> 同比增长: +18.3%
```

### 5.4 实现路线

| 阶段 | 时间 | 交付物 | 说明 |
|------|------|--------|------|
| MVP | 3 周 | 指标自动发现 + 注册中心 + 手动编辑 | 先让用户看到并确认指标 |
| V1 | +2 周 | 语义 SQL 生成器替代纯 LLM 生成 | 提升查询准确率 |
| V2 | +3 周 | 衍生指标 + 跨数据源指标 + 指标血缘 | 完整语义层 |

### 5.5 与方向一的协同

语义层直接增强方向一的效果：

- 基线学习引擎 -> 基于语义层定义的指标自动建立基线（而非手动配置）
- 异常检测 -> 基于语义理解的智能阈值（金额类指标和比率类指标用不同策略）
- 根因分析 -> 基于维度定义自动决定下钻路径（而非暴力遍历所有字段）
- 每日摘要 -> 自动选择"核心指标" tag 的指标生成摘要

### 5.6 数据模型新增

```sql
-- 指标定义表（扩展现有 metrics 表）
ALTER TABLE metrics ADD COLUMN IF NOT EXISTS
    display_name VARCHAR(200),
    unit VARCHAR(50),
    format_pattern VARCHAR(100),
    data_source_id UUID,
    time_grains TEXT[],
    derived_metrics JSONB,
    created_by VARCHAR(50) DEFAULT 'manual',
    version INTEGER DEFAULT 1,
    status VARCHAR(20) DEFAULT 'active';

-- 指标版本历史
CREATE TABLE metric_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    metric_id UUID NOT NULL REFERENCES metrics(id),
    version INTEGER NOT NULL,
    formula TEXT NOT NULL,
    changed_by UUID,
    change_reason TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(metric_id, version)
);

-- 指标使用统计（用于推荐排序）
CREATE TABLE metric_usage_stats (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    metric_id UUID NOT NULL,
    query_count INTEGER DEFAULT 0,
    last_queried_at TIMESTAMPTZ,
    avg_query_time_ms INTEGER,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(tenant_id, metric_id)
);

CREATE INDEX idx_metric_versions_metric ON metric_versions(metric_id);
CREATE INDEX idx_metric_usage_tenant ON metric_usage_stats(tenant_id);
```

---

## 六、方向三 [P2]：决策闭环

> **核心命题**：从"告诉你发生了什么"到"帮你解决问题"

### 6.1 为什么是 P2

- 依赖方向一（发现问题）和方向二（理解问题）的成熟
- 涉及用户信任问题 -- AI 建议需要足够准确才敢让它"行动"
- 需要更深入的业务集成（ERP、CRM 等），短期内集成成本高
- 但这是终极形态，需要提前设计接口，为未来预留空间

### 6.2 功能架构

```
+------------------+     +------------------+     +------------------+
| 方向一：发现问题  | --> | 方向二：理解原因  | --> | 方向三：解决问题  |
| 异常检测 + 推送   |     | 根因分析 + 下钻   |     | 建议 + 审批 + 执行 |
+------------------+     +------------------+     +------------------+
                                                          |
                                                          v
                                                 +------------------+
                                                 |   行动引擎        |
                                                 |  ActionEngine    |
                                                 +--------+---------+
                                                          |
                              +---------------------------+---------------------------+
                              |                           |                           |
                     +--------v--------+         +--------v--------+         +--------v--------+
                     | 通知类行动       |         | 分析类行动       |         | 操作类行动       |
                     | (IM 推送/邮件)   |         | (生成报告/下钻)  |         | (API 调用/Webhook)|
                     +-----------------+         +-----------------+         +-----------------+
```

### 6.3 核心模块设计

#### 6.3.1 行动建议生成器 (Action Recommender)

```go
// backend/internal/service/action/recommender.go

type ActionRecommendation struct {
    ID           string
    AnomalyID    string             // 关联的异常事件
    Type         string             // notify / analyze / operate
    Title        string             // "建议：对积压 SKU 启动促销"
    Description  string             // 详细说明
    Confidence   float64            // AI 对该建议的确信度
    Impact       ImpactAssessment   // 预期影响评估
    Steps        []ActionStep       // 执行步骤
    RequiresApproval bool           // 是否需要人工审批
    ExpiresAt    time.Time          // 建议有效期
}

type ImpactAssessment struct {
    Positive     string   // "预计 GMV 回升 15%"
    Risks        []string // ["库存成本增加", "利润率下降 2%"]
    Confidence   float64
    TimeToEffect string   // "预计 3-5 天见效"
}

type ActionStep struct {
    Order       int
    Description string   // "将 SKU-1234 标记为促销商品"
    Type        string   // manual / webhook / api_call
    Config      JSONB    // webhook URL、API 参数等
    Status      string   // pending / executing / completed / failed
}
```

#### 6.3.2 IM 内审批流（复用已有 IM 适配器）

**交互设计**：

```
[BizLens 业务助手] 发送消息到飞书群：

---
[异常] GMV 连续 3 天下降，当前日均 ¥85K（基线 ¥130K）

[根因] 华东地区数码品类退货率飙升至 28%（正常 5%）
       -> 近期上架的 3 款商品评分低于 3.0

[建议操作]
  1. 暂时下架评分低于 3.0 的商品（影响 3 个 SKU）
  2. 启动售后主动联系流程（预计影响 156 笔订单）
  3. 安排品控复查该批次商品

[一键执行] [修改方案] [暂不处理] [这不是问题]
---

用户点击 [一键执行]：

[BizLens] 执行中...
  Step 1/3: 调用商品管理 API 下架 3 个 SKU... Done
  Step 2/3: 创建售后工单批次... Done
  Step 3/3: 通知品控团队... Done

[BizLens] 已全部执行。我会在 3 天后跟进效果：
  - 监控退货率是否回落
  - 监控 GMV 是否回升
  - 生成效果对比报告
```

#### 6.3.3 效果追踪器 (Effect Tracker)

**职责**：执行行动后，自动追踪效果并生成闭环报告。

```go
// backend/internal/service/action/tracker.go

type EffectReport struct {
    ActionID     string
    TrackingDays int              // 已追踪天数
    Metrics      []MetricChange   // 相关指标变化
    Conclusion   string           // "行动有效：退货率从 28% 降至 8%，GMV 回升至基线水平"
    IsEffective  bool
    Confidence   float64
}

type MetricChange struct {
    MetricName  string
    BeforeValue float64   // 行动前
    AfterValue  float64   // 行动后
    BaselineVal float64   // 基线值
    Recovery    float64   // 恢复程度 0-1（1 = 完全恢复到基线）
}
```

### 6.4 实现路线

| 阶段 | 时间 | 交付物 | 说明 |
|------|------|--------|------|
| V0 | 2 周 | 行动建议生成（纯文字建议，无自动执行） | 先验证建议质量 |
| V1 | +3 周 | IM 内审批流 + 通知类/分析类行动自动执行 | 低风险行动先自动化 |
| V2 | +4 周 | Webhook/API 操作类行动 + 效果追踪 | 需要与外部系统集成 |

### 6.5 安全设计

**行动分级**：

| 级别 | 类型 | 审批要求 | 示例 |
|------|------|---------|------|
| L1 | 通知类 | 无需审批 | 发送告警、生成报告 |
| L2 | 分析类 | 无需审批 | 自动下钻分析、数据导出 |
| L3 | 低风险操作 | 单人审批 | 调整告警阈值、修改仪表板 |
| L4 | 高风险操作 | 双人审批 | 调用外部 API、修改业务数据 |

**审计日志**：所有行动（无论是否自动执行）都记录完整的审计日志，包含：谁批准的、什么时候执行的、执行结果是什么、是否可回滚。

### 6.6 数据模型新增

```sql
-- 行动建议表
CREATE TABLE action_recommendations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    anomaly_id UUID REFERENCES anomaly_events(id),
    type VARCHAR(20) NOT NULL,          -- notify/analyze/operate
    title VARCHAR(500) NOT NULL,
    description TEXT,
    confidence DOUBLE PRECISION,
    impact JSONB,                       -- ImpactAssessment
    steps JSONB,                        -- []ActionStep
    requires_approval BOOLEAN DEFAULT true,
    risk_level VARCHAR(10) DEFAULT 'L3', -- L1/L2/L3/L4
    status VARCHAR(20) DEFAULT 'pending', -- pending/approved/executing/completed/rejected
    approved_by UUID,
    approved_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 行动执行日志
CREATE TABLE action_execution_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    action_id UUID NOT NULL REFERENCES action_recommendations(id),
    step_index INTEGER NOT NULL,
    status VARCHAR(20) NOT NULL,        -- executing/completed/failed/rolled_back
    result JSONB,
    error_message TEXT,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 效果追踪表
CREATE TABLE action_effect_tracking (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    action_id UUID NOT NULL REFERENCES action_recommendations(id),
    tracking_day INTEGER NOT NULL,      -- 第几天
    metrics JSONB NOT NULL,             -- []MetricChange
    is_effective BOOLEAN,
    conclusion TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(action_id, tracking_day)
);

CREATE INDEX idx_actions_tenant_status ON action_recommendations(tenant_id, status);
CREATE INDEX idx_actions_anomaly ON action_recommendations(anomaly_id);
CREATE INDEX idx_action_logs_action ON action_execution_logs(action_id);
CREATE INDEX idx_effect_tracking_action ON action_effect_tracking(action_id);
```

---

## 七、整体实施路线图

```
2026 Q2 (12 周)
=============================================================================

Week 1-2:  [方向一 MVP] 基线学习 + 统计异常检测 + IM 推送
Week 3-4:  [方向一 V1]  根因分析 + 每日摘要 + 降噪策略
Week 5-7:  [方向二 MVP] 指标自动发现 + 注册中心 + 手动编辑
Week 8-9:  [方向二 V1]  语义 SQL 生成器 + 方向一准确率提升
Week 10-11:[方向三 V0]  行动建议生成 + IM 内审批流
Week 12:   [整合]       三个方向串联 + 端到端用户体验优化

=============================================================================

2026 Q3 (预期)
=============================================================================

方向一 V2: 季节性分解 + 关联检测 + 用户反馈闭环
方向二 V2: 衍生指标 + 跨数据源 + 指标血缘
方向三 V1: Webhook 操作类行动 + 效果追踪
新方向探索: 预测性分析（不止告诉你发生了什么，还告诉你即将发生什么）
```

---

## 八、成功指标

### 产品指标

| 指标 | 当前 | Q2 目标 | 说明 |
|------|------|---------|------|
| 异常检测准确率 | N/A | > 70% | false positive < 30% |
| 用户打开率（日） | - | > 40% | 包含 IM 内交互 |
| 推送点击率 | N/A | > 25% | 用户收到推送后点击查看详情 |
| 指标覆盖率 | 0% | > 60% | 数据源中可监控指标被语义层覆盖的比例 |
| 查询准确率 | ~60% | > 85% | 语义层替代纯 LLM 后的提升 |

### 北极星指标

**用户每周因为 BizLens 的主动推送而采取的业务行动次数**

这个指标直接衡量了产品的不可替代性 -- 如果用户每周都因为 BizLens 的推送而做了某件原本不会做的事，那这个产品就有了真实价值。

---

## 九、风险与缓解

| 风险 | 概率 | 影响 | 缓解措施 |
|------|------|------|---------|
| 异常检测误报率高导致用户关闭推送 | 高 | 严重 | 保守起步（只推送 critical），逐步放开；用户反馈闭环 |
| 指标自动发现准确率低 | 中 | 中 | 必须经过用户确认才写入注册中心；支持手动修正 |
| 根因分析耗时长影响推送时效 | 中 | 中 | 异步分析，先推送异常，根因就绪后追加 |
| 语义层维护成本高 | 低 | 中 | Schema 变更自动检测 + 提醒用户更新指标 |
| 决策闭环中 AI 建议错误导致业务损失 | 低 | 严重 | 强制审批机制；高风险操作双人审批；完整审计日志 |

---

## 十、总结

BizLens 的差异化不应该来自"接了 AI"，而应该来自 **AI 被用来做了什么**。

传统 BI + AI = 用自然语言问数据（人人都能做）
BizLens + AI = 业务雷达站（持续监控 + 主动推送 + 建议行动）

三个方向形成飞轮效应：
1. **主动监控**让用户养成依赖（每天看 BizLens 的推送）
2. **语义层**让监控越来越准（AI 真正理解业务）
3. **决策闭环**让价值落地（不止发现问题，还解决问题）

最终目标：**让用户觉得关掉 BizLens 就像关掉手机的消息通知一样不安。**
