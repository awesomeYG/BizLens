# 数据大屏重构技术设计文档 -- 业务观测中心

> 版本: v1.0
> 日期: 2026-03-26
> 状态: Draft

---

## 1. 设计概述

### 1.1 重构范围

将现有"数据大屏"模块从静态模板展示系统重构为业务健康观测中心。涉及：

| 层面 | 新增 | 修改 | 保留 |
|------|------|------|------|
| 后端模型 | metric_baselines, anomaly_events, daily_summaries | AlertEvent(扩展) | DashboardTemplate/Instance/Section |
| 后端服务 | BaselineService, AnomalyDetectionService, InsightService, DailySummaryService | DashboardTemplateService | LayoutEngine, ColorEngine, RefreshService |
| 后端调度 | CronScheduler(基线计算/异常检测/摘要生成) | -- | -- |
| 前端页面 | ObservabilityCenter(观测中心首页) | dashboards/page.tsx(路由入口) | DashboardView, SectionRenderer |
| 前端组件 | HealthScore, AnomalyFeed, InsightCard, KpiCard(增强版), DailySummaryPanel | AppHeader(导航文案) | DashboardTabs, TemplateSelectorModal |

### 1.2 架构总览

```
                         +--------------------------+
                         |   前端: 观测中心页面       |
                         |  /dashboards              |
                         +-----+----------+---------+
                               |          |
                    +----------+    +-----+--------+
                    |               |              |
              +-----v-----+  +-----v-----+  +-----v--------+
              | 健康评分   |  | 异常事件流 |  | 我的看板     |
              | HealthAPI  |  | AnomalyAPI |  | DashboardAPI |
              +-----+-----+  +-----+-----+  +-----+--------+
                    |               |              |
         +----------+---------------+--------------+
         |                  Go Backend              |
         |  +-------------+  +------------------+   |
         |  | Baseline    |  | AnomalyDetection |   |
         |  | Service     |  | Service          |   |
         |  +------+------+  +--------+---------+   |
         |         |                  |              |
         |  +------v------+  +-------v---------+   |
         |  | Insight     |  | DailySummary    |   |
         |  | Service     |  | Service         |   |
         |  +------+------+  +-------+---------+   |
         |         |                  |              |
         |  +------v------------------v---------+   |
         |  |        CronScheduler              |   |
         |  +-----------------------------------+   |
         |                                          |
         |  +-----------------------------------+   |
         |  |   Semantic Layer (Metrics/Dims)   |   |
         |  +-----------------------------------+   |
         |                                          |
         |  +-----------------------------------+   |
         |  |   Data Sources (PostgreSQL/etc)   |   |
         |  +-----------------------------------+   |
         +------------------------------------------+
```

---

## 2. 后端设计

### 2.1 数据模型

#### 2.1.1 metric_baselines 表 (新增)

位置: `backend/internal/model/model.go`

```go
type MetricBaseline struct {
    ID            string    `json:"id" gorm:"primaryKey;type:varchar(50)"`
    TenantID      string    `json:"tenantId" gorm:"type:varchar(50);not null;index:idx_baseline_tenant_metric"`
    MetricID      string    `json:"metricId" gorm:"type:varchar(50);not null;index:idx_baseline_tenant_metric"`
    Granularity   string    `json:"granularity" gorm:"type:varchar(20);not null"`   // hourly / daily / weekly
    PeriodKey     string    `json:"periodKey" gorm:"type:varchar(50);not null"`     // "2026-03-25" 或 "Monday" 或 "14:00"
    ExpectedValue float64   `json:"expectedValue"`
    StdDev        float64   `json:"stdDev"`
    UpperBound    float64   `json:"upperBound"`
    LowerBound    float64   `json:"lowerBound"`
    SampleCount   int       `json:"sampleCount"`
    Method        string    `json:"method" gorm:"type:varchar(50)"`                 // moving_avg / percentile
    ComputedAt    time.Time `json:"computedAt" gorm:"autoCreateTime"`
    CreatedAt     time.Time `json:"createdAt" gorm:"autoCreateTime"`
    UpdatedAt     time.Time `json:"updatedAt" gorm:"autoUpdateTime"`
}
```

唯一约束: `(tenant_id, metric_id, granularity, period_key)`

#### 2.1.2 anomaly_events 表 (新增)

```go
type AnomalyEvent struct {
    ID            string    `json:"id" gorm:"primaryKey;type:varchar(50)"`
    TenantID      string    `json:"tenantId" gorm:"type:varchar(50);not null;index:idx_anomaly_tenant_time"`
    MetricID      string    `json:"metricId" gorm:"type:varchar(50);not null"`
    MetricName    string    `json:"metricName" gorm:"type:varchar(200)"`
    DetectedAt    time.Time `json:"detectedAt" gorm:"not null;index:idx_anomaly_tenant_time"`
    ActualValue   float64   `json:"actualValue"`
    ExpectedValue float64   `json:"expectedValue"`
    Deviation     float64   `json:"deviation"`                                       // 偏离倍数(标准差)
    Severity      string    `json:"severity" gorm:"type:varchar(20);not null"`       // critical / warning / info
    Confidence    float64   `json:"confidence"`                                      // 0-1
    Direction     string    `json:"direction" gorm:"type:varchar(10)"`               // up / down
    Context       string    `json:"context" gorm:"type:text"`                        // AI 生成的说明
    RootCause     *string   `json:"rootCause" gorm:"type:text"`                     // JSON: 根因分析结果
    Status        string    `json:"status" gorm:"type:varchar(20);default:open"`     // open / acknowledged / resolved / false_positive
    NotifiedAt    *time.Time`json:"notifiedAt"`
    ResolvedAt    *time.Time`json:"resolvedAt"`
    UserFeedback  *string   `json:"userFeedback" gorm:"type:varchar(50)"`           // helpful / not_helpful / false_alarm
    CreatedAt     time.Time `json:"createdAt" gorm:"autoCreateTime"`
    UpdatedAt     time.Time `json:"updatedAt" gorm:"autoUpdateTime"`
}
```

#### 2.1.3 daily_summaries 表 (新增)

```go
type DailySummary struct {
    ID          string    `json:"id" gorm:"primaryKey;type:varchar(50)"`
    TenantID    string    `json:"tenantId" gorm:"type:varchar(50);not null;uniqueIndex:idx_summary_tenant_date"`
    SummaryDate string    `json:"summaryDate" gorm:"type:varchar(10);not null;uniqueIndex:idx_summary_tenant_date"` // "2026-03-25"
    HealthScore int       `json:"healthScore"`                                       // 0-100
    Content     string    `json:"content" gorm:"type:text;not null"`                // JSON: 结构化摘要
    SentAt      *time.Time`json:"sentAt"`
    CreatedAt   time.Time `json:"createdAt" gorm:"autoCreateTime"`
}
```

#### 2.1.4 health_score_snapshots 表 (新增)

用于存储每日健康评分快照，支持趋势展示。

```go
type HealthScoreSnapshot struct {
    ID          string    `json:"id" gorm:"primaryKey;type:varchar(50)"`
    TenantID    string    `json:"tenantId" gorm:"type:varchar(50);not null;uniqueIndex:idx_health_tenant_date"`
    SnapshotDate string   `json:"snapshotDate" gorm:"type:varchar(10);not null;uniqueIndex:idx_health_tenant_date"`
    Score       int       `json:"score"`          // 0-100
    Details     string    `json:"details" gorm:"type:text"` // JSON: 各维度评分明细
    CreatedAt   time.Time `json:"createdAt" gorm:"autoCreateTime"`
}
```

### 2.2 服务层设计

#### 2.2.1 BaselineService

位置: `backend/internal/service/baseline_service.go`

```go
type BaselineService struct {
    db             *gorm.DB
    metricService  *MetricService       // 语义层指标服务
    dataSourceSvc  *DataSourceService   // 数据源查询
}

// ComputeBaseline 为指定指标计算基线
// 策略: 移动平均法，窗口 30 天
func (s *BaselineService) ComputeBaseline(ctx context.Context, tenantID, metricID string) error

// ComputeAllBaselines 为租户的所有活跃指标批量计算基线
func (s *BaselineService) ComputeAllBaselines(ctx context.Context, tenantID string) error

// GetBaseline 获取指定指标在指定时间点的基线值
func (s *BaselineService) GetBaseline(ctx context.Context, tenantID, metricID, periodKey string) (*MetricBaseline, error)

// GetBaselineHistory 获取基线历史（用于前端趋势展示）
func (s *BaselineService) GetBaselineHistory(ctx context.Context, tenantID, metricID string, days int) ([]MetricBaseline, error)
```

**基线计算算法 (MVP: 移动平均)**:

```
输入: 指标 M 的近 30 天每日聚合值 [v1, v2, ..., v30]
输出: 期望值 E, 标准差 S, 上界 U, 下界 L

E = mean(v1..v30)
S = stddev(v1..v30)
U = E + 2 * S
L = E - 2 * S (下界不低于 0)

存储: MetricBaseline { ExpectedValue: E, StdDev: S, UpperBound: U, LowerBound: L }
```

#### 2.2.2 AnomalyDetectionService

位置: `backend/internal/service/anomaly_detection_service.go`

```go
type AnomalyDetectionService struct {
    db              *gorm.DB
    baselineService *BaselineService
    metricService   *MetricService
    dataSourceSvc   *DataSourceService
    imService       *IMService           // IM 推送(复用现有)
}

// DetectAnomalies 对租户的所有指标执行一轮异常检测
func (s *AnomalyDetectionService) DetectAnomalies(ctx context.Context, tenantID string) ([]AnomalyEvent, error)

// DetectSingleMetric 对单个指标执行异常检测
func (s *AnomalyDetectionService) DetectSingleMetric(ctx context.Context, tenantID, metricID string) (*AnomalyEvent, error)

// AcknowledgeAnomaly 用户确认异常
func (s *AnomalyDetectionService) AcknowledgeAnomaly(ctx context.Context, id string) error

// ResolveAnomaly 标记异常已解决
func (s *AnomalyDetectionService) ResolveAnomaly(ctx context.Context, id string) error

// MarkFalsePositive 标记为误报（反馈闭环，用于校准基线）
func (s *AnomalyDetectionService) MarkFalsePositive(ctx context.Context, id string) error

// ListAnomalies 分页查询异常事件
func (s *AnomalyDetectionService) ListAnomalies(ctx context.Context, tenantID string, filter AnomalyFilter) ([]AnomalyEvent, int64, error)
```

**异常检测算法**:

```
输入: 指标 M 的当前值 V, 基线 B
输出: AnomalyEvent (or nil)

deviation = (V - B.ExpectedValue) / B.StdDev  // 偏离几倍标准差

severity:
  |deviation| > 3  -> critical
  |deviation| > 2  -> warning
  |deviation| > 1.5 -> info
  |deviation| <= 1.5 -> 正常, 不生成事件

降噪:
  查询同指标同方向最近 4h 内是否已有事件 -> 跳过
  若已有同指标 open 事件且新 severity <= 旧 severity -> 跳过
```

#### 2.2.3 InsightService

位置: `backend/internal/service/insight_service.go`

```go
type InsightService struct {
    db              *gorm.DB
    baselineService *BaselineService
    metricService   *MetricService
    dataSourceSvc   *DataSourceService
}

// GenerateInsights 为租户生成当日洞察列表
func (s *InsightService) GenerateInsights(ctx context.Context, tenantID string) ([]Insight, error)

// ComputeHealthScore 计算当日业务健康评分
func (s *InsightService) ComputeHealthScore(ctx context.Context, tenantID string) (int, map[string]interface{}, error)
```

**健康评分算法**:

```
输入: 租户所有核心指标的当前值和基线
输出: 健康评分 0-100

对每个核心指标 M:
  deviation_ratio = |actual - expected| / expected
  if deviation_ratio < 0.05  -> metric_score = 100
  if deviation_ratio < 0.10  -> metric_score = 80
  if deviation_ratio < 0.20  -> metric_score = 60
  if deviation_ratio < 0.35  -> metric_score = 40
  else                       -> metric_score = 20

  如果偏离方向是正面(如 GMV 上涨), metric_score = max(metric_score, 80)

health_score = weighted_avg(all metric_scores)  // 权重基于指标优先级
```

**洞察生成规则**:

| 类型 | 触发条件 | 示例 |
|------|---------|------|
| trend_up | 连续 3 天正向偏离 > 5% | "GMV 连续 3 天增长，累计 +18%" |
| trend_down | 连续 3 天负向偏离 > 5% | "转化率连续 3 天下滑，需关注" |
| new_high | 创近 30 天新高 | "今日订单量创近 30 天新高" |
| new_low | 创近 30 天新低 | "客单价降至近 30 天最低" |
| recovery | 异常指标恢复到基线 | "支付成功率已恢复正常水平" |

#### 2.2.4 DailySummaryService

位置: `backend/internal/service/daily_summary_service.go`

```go
type DailySummaryService struct {
    db              *gorm.DB
    insightService  *InsightService
    anomalyService  *AnomalyDetectionService
    metricService   *MetricService
    imService       *IMService
}

// GenerateAndSend 生成每日摘要并通过 IM 推送
func (s *DailySummaryService) GenerateAndSend(ctx context.Context, tenantID string) error

// GetSummary 获取指定日期的摘要
func (s *DailySummaryService) GetSummary(ctx context.Context, tenantID, date string) (*DailySummary, error)

// ListSummaries 获取摘要历史列表
func (s *DailySummaryService) ListSummaries(ctx context.Context, tenantID string, limit int) ([]DailySummary, error)
```

**摘要内容结构 (JSON)**:

```json
{
  "healthScore": 72,
  "healthScoreDelta": -8,
  "coreMetrics": [
    {
      "name": "GMV",
      "value": 285000,
      "unit": "CNY",
      "yoy": 0.12,
      "mom": -0.05,
      "status": "normal"
    }
  ],
  "attentionItems": [
    {
      "metricName": "转化率",
      "description": "连续 3 天下滑，当前 3.2%，基线 3.5%",
      "severity": "warning",
      "suggestion": "对比 APP 改版前后的漏斗数据"
    }
  ],
  "positiveItems": [
    {
      "metricName": "新客获取成本",
      "description": "降至 28 元，本月最低"
    }
  ],
  "prediction": {
    "description": "本周 GMV 预计 195 万，达成率 92%"
  }
}
```

#### 2.2.5 CronScheduler

位置: `backend/internal/service/cron_scheduler.go`

```go
type CronScheduler struct {
    baselineService   *BaselineService
    anomalyService    *AnomalyDetectionService
    dailySummaryService *DailySummaryService
    db                *gorm.DB
}

// Start 启动定时任务
func (s *CronScheduler) Start(ctx context.Context)

// 定时任务列表:
// 1. 基线计算: 每天 02:00 (凌晨低峰期)
// 2. 异常检测: 每小时整点 (hourly 粒度) 或每天 08:00 (daily 粒度)
// 3. 每日摘要: 每天 09:00 (可配置)
// 4. 健康评分快照: 每天 23:55
```

MVP 阶段使用 Go 标准库 `time.Ticker` + goroutine 实现简易调度，后续可升级为 `robfig/cron`。

### 2.3 API 设计

所有 API 在 `/api/tenants/{tenantId}/observability/` 路径下，使用 JWT 认证中间件。

#### 2.3.1 健康评分

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/observability/health-score` | 获取当前健康评分 + 近 7 天趋势 |

响应:
```json
{
  "score": 72,
  "delta": -8,
  "level": "attention",
  "trend": [
    {"date": "2026-03-20", "score": 85},
    {"date": "2026-03-21", "score": 82},
    {"date": "2026-03-22", "score": 80},
    {"date": "2026-03-23", "score": 78},
    {"date": "2026-03-24", "score": 75},
    {"date": "2026-03-25", "score": 72}
  ],
  "details": {
    "gmv": {"score": 80, "weight": 0.3},
    "orderCount": {"score": 65, "weight": 0.25},
    "conversionRate": {"score": 55, "weight": 0.25},
    "customerCost": {"score": 90, "weight": 0.2}
  }
}
```

#### 2.3.2 核心指标

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/observability/core-metrics` | 获取核心指标速览 (含 sparkline 数据) |
| GET | `/observability/core-metrics?range=today\|week\|month` | 按时间范围查询 |

#### 2.3.3 异常事件

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/observability/anomalies` | 分页查询异常事件列表 |
| GET | `/observability/anomalies/{id}` | 获取异常详情（含根因分析） |
| PUT | `/observability/anomalies/{id}/acknowledge` | 确认异常 |
| PUT | `/observability/anomalies/{id}/resolve` | 标记已解决 |
| PUT | `/observability/anomalies/{id}/false-positive` | 标记误报 |

#### 2.3.4 洞察

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/observability/insights` | 获取当日 AI 洞察列表 |

#### 2.3.5 每日摘要

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/observability/summaries` | 获取摘要历史列表 |
| GET | `/observability/summaries/{date}` | 获取指定日期摘要 |
| POST | `/observability/summaries/generate` | 手动触发生成今日摘要 |

### 2.4 与现有服务的集成

#### 2.4.1 与语义层集成

`BaselineService` 和 `AnomalyDetectionService` 依赖 `MetricService`（语义层）获取：
- 已注册指标列表（`ListMetrics`）
- 指标的 SQL 公式（`GetMetric().Formula`）
- 指标的可下钻维度（`GetMetric().Dimensions`）

当语义层指标不存在时，观测中心功能降级为引导态。

#### 2.4.2 与 IM 集成

复用现有 `IMService`（`server/internal/im/`），新增消息模板：
- `anomaly_alert`: 异常告警消息
- `daily_summary`: 每日摘要消息

消息通过已有 IM 适配器（飞书/钉钉/企微）发送。

#### 2.4.3 与数据源集成

指标的实际值查询通过现有数据源连接执行 SQL：
1. 从语义层获取指标公式（如 `SUM(orders.amount)`）
2. 从数据源管理获取连接信息
3. 执行 SQL 查询获取聚合值
4. 结果用于基线对比和异常检测

---

## 3. 前端设计

### 3.1 页面结构重构

#### 3.1.1 路由变更

| 路由 | 当前 | 重构后 |
|------|------|-------|
| `/dashboards` | 模板画廊 + 我的大屏 | **观测中心首页** |
| `/dashboards?tab=boards` | 不存在 | 我的看板 (原模板+实例功能) |
| `/dashboards?id=xxx` | 直接渲染大屏实例 | 保持兼容，渲染指定看板 |
| `/dashboard` | 重定向到 /dashboards | 保持不变 |

#### 3.1.2 观测中心页面组件树

```
dashboards/page.tsx (路由入口，Tab 切换)
  |
  +-- ObservabilityCenter (默认 Tab: 观测中心)
  |     |
  |     +-- HealthScoreCard         -- 健康评分卡片
  |     +-- CoreMetricsGrid         -- 核心指标 KPI 网格
  |     |     +-- MetricKpiCard     -- 增强版 KPI 卡片(含 sparkline + 异常标识)
  |     +-- AnomalyFeed             -- 异常事件时间线
  |     |     +-- AnomalyEventCard  -- 单条异常事件(可展开)
  |     |     +-- RootCausePanel    -- 根因分析展开面板
  |     +-- InsightCarousel         -- AI 洞察轮播卡片
  |     +-- TrendChartSection       -- 趋势图表区(含预测叠加)
  |     +-- DailySummarySection     -- 每日摘要折叠区
  |
  +-- MyBoardsPanel (Tab: 我的看板)
        |
        +-- 现有 DashboardTabs / DashboardView 逻辑(保留)
        +-- TemplateSelectorModal (保留)
```

### 3.2 新增组件设计

#### 3.2.1 HealthScoreCard

位置: `frontend/components/observability/HealthScoreCard.tsx`

```typescript
interface HealthScoreCardProps {
  score: number;           // 0-100
  delta: number;           // 较昨日变化
  level: 'excellent' | 'good' | 'attention' | 'warning' | 'danger';
  trend: { date: string; score: number }[];  // 近 7 天趋势
}
```

视觉设计:
- 大号圆环进度条，中心显示分数（大字体）
- 圆环颜色随等级变化: excellent(绿) / good(蓝绿) / attention(黄) / warning(橙) / danger(红)
- 右侧显示趋势 Sparkline（近 7 天）
- 底部显示等级标签和较昨日变化

#### 3.2.2 MetricKpiCard (增强版)

位置: `frontend/components/observability/MetricKpiCard.tsx`

在现有 KPI 卡片基础上增强：

```typescript
interface MetricKpiCardProps {
  name: string;
  value: number;
  unit: string;
  format: string;           // "#,##0" / "0.0%"
  yoyChange?: number;       // 同比
  momChange?: number;       // 环比
  sparkline: number[];      // 近 7 天数值数组
  anomalyStatus: 'normal' | 'warning' | 'critical';
  baselineExpected?: number; // 基线期望值
}
```

视觉设计:
- 左上角: 指标名称
- 中部: 当前值(大字体) + 单位
- 中部右侧: 同比/环比变化(绿色上涨/红色下降)
- 底部: 7 天 Sparkline 迷你图
- 异常状态: warning 时卡片左边框变橙色, critical 时变红色 + 脉冲动效
- 基线对比: 灰色虚线标注基线期望值位置

#### 3.2.3 AnomalyFeed

位置: `frontend/components/observability/AnomalyFeed.tsx`

```typescript
interface AnomalyFeedProps {
  anomalies: AnomalyEventDTO[];
  onAcknowledge: (id: string) => void;
  onResolve: (id: string) => void;
  onMarkFalsePositive: (id: string) => void;
  onAskAI: (anomaly: AnomalyEventDTO) => void;
}
```

视觉设计:
- 垂直时间线布局，左侧时间轴标记节点
- 每条事件卡片包含: 严重度图标(红/橙/蓝) + 指标名 + 偏离描述 + 时间
- 点击展开: 根因分析摘要 + 操作按钮(确认/解决/误报/AI追问)
- critical 事件卡片有红色左边框 + 微弱脉冲背景

#### 3.2.4 InsightCarousel

位置: `frontend/components/observability/InsightCarousel.tsx`

```typescript
interface InsightCardData {
  type: 'positive' | 'negative' | 'neutral';
  title: string;
  description: string;
  metricName: string;
  confidence: number;
}
```

视觉设计:
- 水平滚动的卡片列表
- 卡片样式: positive(绿色图标+边框) / negative(红色) / neutral(蓝色)
- 每张卡片: 类型图标 + 标题(一行) + 描述(两行) + 置信度标签

### 3.3 前端 API 封装

位置: `frontend/lib/observability-api.ts`

```typescript
// 健康评分
export async function getHealthScore(): Promise<HealthScoreResponse>

// 核心指标
export async function getCoreMetrics(range?: 'today' | 'week' | 'month'): Promise<CoreMetric[]>

// 异常事件
export async function listAnomalies(params?: { status?: string; severity?: string; page?: number }): Promise<PaginatedResponse<AnomalyEventDTO>>
export async function acknowledgeAnomaly(id: string): Promise<void>
export async function resolveAnomaly(id: string): Promise<void>
export async function markFalsePositive(id: string): Promise<void>

// 洞察
export async function listInsights(): Promise<Insight[]>

// 每日摘要
export async function listSummaries(limit?: number): Promise<DailySummary[]>
export async function getSummary(date: string): Promise<DailySummary>
export async function generateSummary(): Promise<DailySummary>
```

### 3.4 导航变更

`AppHeader.tsx` 中将"数据大屏"导航项改为"观测中心"：

```typescript
// 修改前
{ label: "数据大屏", href: "/dashboards" }

// 修改后
{ label: "观测中心", href: "/dashboards" }
```

### 3.5 未配置状态的引导页

当租户未接入数据源或未配置语义层指标时，观测中心显示引导页:

```
+-----------------------------------------------------------+
|                                                           |
|            [观测中心图标]                                   |
|                                                           |
|        开启你的业务健康监控                                  |
|                                                           |
|   BizLens 观测中心会持续监控你的核心业务指标，               |
|   出现异常时主动通知你，并帮你分析原因。                      |
|                                                           |
|   +---------------------------------------------------+   |
|   | Step 1: 连接数据源    [已完成] / [去配置]          |   |
|   | Step 2: 配置核心指标  [已完成] / [去配置]          |   |
|   | Step 3: 开始监控      [启动]                      |   |
|   +---------------------------------------------------+   |
|                                                           |
+-----------------------------------------------------------+
```

---

## 4. 数据流设计

### 4.1 基线计算流程

```
CronScheduler (每天 02:00)
    |
    v
BaselineService.ComputeAllBaselines(tenantID)
    |
    +-- MetricService.ListActiveMetrics(tenantID)
    |     -> [metric1, metric2, ...]
    |
    +-- for each metric:
    |     |
    |     +-- DataSourceService.ExecuteQuery(metric.Formula, last30days)
    |     |     -> [daily_values...]
    |     |
    |     +-- compute mean, stddev, upper, lower
    |     |
    |     +-- upsert MetricBaseline record
    |
    v
Done
```

### 4.2 异常检测流程

```
CronScheduler (每小时整点)
    |
    v
AnomalyDetectionService.DetectAnomalies(tenantID)
    |
    +-- MetricService.ListActiveMetrics(tenantID)
    |
    +-- for each metric:
    |     |
    |     +-- DataSourceService.ExecuteQuery(metric.Formula, current_period)
    |     |     -> actual_value
    |     |
    |     +-- BaselineService.GetBaseline(metricID, period_key)
    |     |     -> expected, stddev, upper, lower
    |     |
    |     +-- compute deviation = (actual - expected) / stddev
    |     |
    |     +-- if |deviation| > 1.5:
    |     |     |
    |     |     +-- 降噪检查: 4h 内是否已有同指标同方向事件?
    |     |     |
    |     |     +-- if 通过: create AnomalyEvent
    |     |     |
    |     |     +-- if severity == critical:
    |     |           +-- IMService.SendAnomalyAlert(event)
    |
    v
Done
```

### 4.3 每日摘要流程

```
CronScheduler (每天 09:00)
    |
    v
DailySummaryService.GenerateAndSend(tenantID)
    |
    +-- InsightService.ComputeHealthScore(tenantID)
    |     -> score, details
    |
    +-- getCoreMetrics with yoy/mom calculations
    |
    +-- AnomalyDetectionService.ListOpenAnomalies(tenantID)
    |
    +-- InsightService.GenerateInsights(tenantID)
    |
    +-- compose summary JSON
    |
    +-- save DailySummary record
    |
    +-- IMService.SendDailySummary(summary)
    |
    v
Done
```

---

## 5. 实施任务分解

### Phase 1: 后端基础 (预计 3-4 天)

| # | 任务 | 优先级 | 预计时间 |
|---|------|--------|---------|
| 1 | 新增数据模型 (4 个表) + AutoMigrate | P0 | 2h |
| 2 | 实现 BaselineService (基线计算) | P0 | 4h |
| 3 | 实现 AnomalyDetectionService (异常检测+降噪) | P0 | 4h |
| 4 | 实现 InsightService (健康评分+洞察生成) | P0 | 4h |
| 5 | 实现 DailySummaryService (摘要生成+IM推送) | P0 | 3h |
| 6 | 实现 CronScheduler (定时调度) | P0 | 2h |
| 7 | 实现 Observability API Handler + 路由注册 | P0 | 4h |
| 8 | IM 消息模板 (anomaly_alert + daily_summary) | P0 | 2h |

### Phase 2: 前端观测中心 (预计 3-4 天)

| # | 任务 | 优先级 | 预计时间 |
|---|------|--------|---------|
| 9 | 前端 API 封装 (observability-api.ts) | P0 | 1h |
| 10 | 前端类型定义 (types.ts 扩展) | P0 | 1h |
| 11 | HealthScoreCard 组件 | P0 | 3h |
| 12 | MetricKpiCard 增强版组件 | P0 | 3h |
| 13 | AnomalyFeed + AnomalyEventCard 组件 | P0 | 4h |
| 14 | InsightCarousel 组件 | P1 | 2h |
| 15 | DailySummarySection 组件 | P1 | 2h |
| 16 | ObservabilityCenter 页面组装 | P0 | 3h |
| 17 | dashboards/page.tsx 重构 (Tab: 观测中心 / 我的看板) | P0 | 2h |
| 18 | 未配置状态引导页 | P0 | 2h |
| 19 | AppHeader 导航文案更新 | P0 | 0.5h |

### Phase 3: 集成与优化 (预计 2 天)

| # | 任务 | 优先级 | 预计时间 |
|---|------|--------|---------|
| 20 | 根因分析基础版 (维度下钻) | P1 | 4h |
| 21 | RootCausePanel 前端组件 | P1 | 3h |
| 22 | 异常事件 -> AI 对话跳转集成 | P1 | 2h |
| 23 | 趋势图表区(预测叠加显示) | P2 | 3h |
| 24 | 端到端测试验证 | P0 | 3h |
| 25 | 向后兼容验证 (旧大屏实例+AI生成) | P0 | 2h |

---

## 6. 风险与缓解

| 风险 | 概率 | 影响 | 缓解 |
|------|------|------|------|
| 语义层指标覆盖不足导致观测中心空洞 | 高 | 中 | 提供引导页 + 支持 AI 自动发现指标(已有基础) |
| 异常检测误报率高导致用户不信任 | 中 | 高 | MVP 仅推送 critical + 用户反馈闭环 + 严格降噪 |
| 基线计算依赖充足历史数据 | 中 | 中 | 冷启动期使用行业经验基线(可配置) |
| 数据源查询性能瓶颈 | 低 | 中 | 基线计算在凌晨低峰期执行 + 结果缓存 |
| 旧版大屏用户的迁移成本 | 低 | 低 | 完整保留旧版功能在"我的看板" Tab |

---

## 7. 未来扩展

本次设计为后续方向预留了接口：

- **语义 SQL 生成器** (方向二 V1): `InsightService` 的指标查询可切换为语义层驱动
- **决策闭环** (方向三): `AnomalyEvent` 可关联 `ActionRecommendation`，从"发现问题"延伸到"解决问题"
- **季节性基线** (方向一 V2): `BaselineService` 的 `Method` 字段支持切换到 STL 分解算法
- **关联异常检测** (方向一 V2): 多指标同时异常时自动提升严重度
