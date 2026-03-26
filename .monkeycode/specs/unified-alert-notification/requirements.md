# 统一告警与通知模块 - 需求与设计文档

> 创建日期：2026-03-26  
> 版本：v1.0  
> 状态：实现中

---

## 1. 概述

### 1.1 背景

当前系统中存在两套独立但功能相似的告警/通知模块：

| 模块 | 定位 | 触发方式 | 数据源 | 频率 |
|------|------|----------|--------|------|
| AlertEvent（告警事件） | 快速告警 | 手动/外部 API 触发 | 指标名 + 阈值 | 单次/变化 |
| NotificationRule（通知规则） | 自动监控 | 定时任务/查库 | SQL 查询 + 阈值 | 实时/小时/日/周 |

两者在底层共享 IM 发送能力，但前端分散在 `/alerts` 和 `/im/rules` 两个独立页面。

### 1.2 目标

将 `AlertEvent` 和 `NotificationRule` 合并为一个统一的"告警与通知"模块，在 UI 上合并到同一页面，通过 Tab 区分两种模式。

- **快速告警**：对应原 `AlertEvent`，手动/外部触发，侧重即时通知
- **自动规则**：对应原 `NotificationRule`，定时/查库触发，侧重持续监控

### 1.3 架构设计

```
┌─────────────────────────────────────────────────────┐
│                  前端统一 UI (/alerts)               │
│  ┌──────────────┐  ┌──────────────┐                │
│  │  快速告警 Tab │  │  自动规则 Tab │                │
│  │ (AlertEvent) │  │(NotificationRule)              │
│  └──────┬───────┘  └──────┬───────┘                │
│         │                 │                         │
│         └────────┬────────┘                         │
│                  │                                  │
│         ┌────────▼────────┐                        │
│         │ 统一告警 Service │                        │
│         │ (AlertService)  │                        │
│         └────────┬────────┘                        │
│                  │                                  │
│         ┌────────▼────────┐                        │
│         │  IMServicesend │                        │
│         │  (共享发送能力)  │                        │
│         └────────┬────────┘                        │
│                  │                                  │
│    ┌─────────────┼─────────────┐                  │
│    │             │             │                   │
│ ┌──▼───┐   ┌────▼────┐   ┌───▼───┐              │
│ │ 钉钉 │   │  飞书   │   │企业微信│ ...         │
│ └──────┘   └────────┘   └───────┘               │
└─────────────────────────────────────────────────────┘
```

---

## 2. 数据模型

### 2.1 AlertEvent（快速告警）

保留原模型，不修改数据库结构：

```go
type AlertEvent struct {
    ID            string             `json:"id"`
    TenantID      string             `json:"tenantId"`
    Name          string             `json:"name"`
    Description   string             `json:"description"`
    Enabled       bool               `json:"enabled"`
    Metric        string             `json:"metric"`         // 指标名
    ConditionType AlertConditionType `json:"conditionType"`   // greater/less/equals/change/custom
    Threshold     float64            `json:"threshold"`
    Message       string             `json:"message"`         // 通知内容
    PlatformIDs   string             `json:"platformIds"`     // IM 平台 ID（逗号分隔）
    CreatedAt     time.Time          `json:"createdAt"`
    UpdatedAt     time.Time          `json:"updatedAt"`
}
```

### 2.2 NotificationRule（自动规则）

保留原模型，不修改数据库结构：

```go
type NotificationRule struct {
    ID              string                 `json:"id"`
    TenantID        string                 `json:"tenantId"`
    Name            string                 `json:"name"`
    Description     string                 `json:"description"`
    Enabled         bool                   `json:"enabled"`
    RuleType        NotificationRuleType    `json:"ruleType"`        // data_threshold/data_change/scheduled/custom
    Frequency       NotificationFrequency   `json:"frequency"`        // once/hourly/daily/weekly/monthly/realtime
    DataSourceID    string                 `json:"dataSourceId"`     // 数据源 ID
    TableName       string                 `json:"tableName"`        // 表名
    MetricField     string                 `json:"metricField"`      // 指标字段
    ConditionType   AlertConditionType     `json:"conditionType"`
    Threshold       float64                `json:"threshold"`
    ConditionExpr   string                 `json:"conditionExpr"`    // 自定义条件表达式
    ScheduleTime    string                 `json:"scheduleTime"`     // 定时时间
    TimeRange       string                 `json:"timeRange"`         // 时间范围
    MessageTemplate string                 `json:"messageTemplate"`
    MessageTitle    string                 `json:"messageTitle"`
    PlatformIDs     string                 `json:"platformIds"`
    WebhookURL      string                 `json:"webhookUrl"`
    NLQuery         string                 `json:"nlQuery"`
    CreatedAt       time.Time              `json:"createdAt"`
    UpdatedAt       time.Time              `json:"updatedAt"`
}
```

### 2.3 AlertTriggerLog（统一触发日志）

扩展原日志表，增加来源类型字段：

```go
type AlertTriggerLog struct {
    ID          string    `json:"id"`
    TenantID    string    `json:"tenantId"`
    EventID     string    `json:"eventId"`
    EventName   string    `json:"eventName"`
    Metric      string    `json:"metric"`
    ActualValue float64   `json:"actualValue"`
    Threshold   float64   `json:"threshold"`
    Message     string    `json:"message"`
    Status      string    `json:"status"`          // sent/failed/condition_not_met
    Error       string    `json:"error,omitempty"`
    SourceType  string    `json:"sourceType"`       // NEW: quick_alert / auto_rule
    TriggeredAt time.Time `json:"triggeredAt"`
    CreatedAt   time.Time `json:"createdAt"`
}
```

---

## 3. API 设计

### 3.1 统一路由结构

| 端点 | 方法 | 功能 | 说明 |
|------|------|------|------|
| `/api/tenants/{id}/alerts` | GET | 列表（统一） | 返回合并后的告警列表，支持 `?type=quick_alert\|auto_rule` 筛选 |
| `/api/tenants/{id}/alerts` | POST | 创建 | 根据请求体 type 字段路由到不同处理 |
| `/api/tenants/{id}/alerts/{id}` | GET/PUT/DELETE | 单条操作 | 支持两种类型 |
| `/api/tenants/{id}/alerts/{id}/trigger` | POST | 手动触发 | 通用触发接口 |
| `/api/tenants/{id}/alerts/{id}/toggle` | POST | 启用/禁用 | 通用切换接口 |
| `/api/tenants/{id}/alerts/logs` | GET | 触发日志 | 支持 `?type=` 筛选 |
| `/api/tenants/{id}/alerts/parse-nl` | POST | NL 解析 | 解析自然语言创建规则 |

### 3.2 统一请求体

```typescript
// 创建请求（快速告警）
interface QuickAlertCreateRequest {
  type: "quick_alert";
  name: string;
  description?: string;
  metric: string;
  conditionType: "greater" | "less" | "equals" | "change" | "custom";
  threshold: number;
  message: string;
  platformIds: string;
  enabled?: boolean;
}

// 创建请求（自动规则）
interface AutoRuleCreateRequest {
  type: "auto_rule";
  name: string;
  description?: string;
  ruleType: "data_threshold" | "data_change" | "scheduled" | "custom";
  frequency: "once" | "hourly" | "daily" | "weekly" | "monthly" | "realtime";
  dataSourceId?: string;
  tableName?: string;
  metricField?: string;
  conditionType?: "greater" | "less" | "equals" | "custom";
  threshold?: number;
  conditionExpr?: string;
  scheduleTime?: string;
  timeRange?: string;
  messageTemplate?: string;
  messageTitle?: string;
  platformIds?: string;
  webhookUrl?: string;
  nlQuery?: string;
  enabled?: boolean;
}
```

---

## 4. 前端 UI 设计

### 4.1 页面结构

```
/alerts
├── Tab: 快速告警（Quick Alerts）
│   ├── 概览统计卡片（总规则数、已启用数、触发次数）
│   ├── 规则列表（卡片形式）
│   └── 创建/编辑弹窗
│
├── Tab: 自动规则（Auto Rules）
│   ├── 概览统计卡片
│   ├── 规则列表
│   └── 创建/编辑弹窗（包含数据源配置、时间配置）
│
└── Tab: 触发历史（History）
    ├── 统一日志列表（新增 sourceType 筛选）
    └── 日志详情
```

### 4.2 Tab 导航设计

在 `/alerts` 页面顶部增加 Tab 切换：

```
┌─────────────────────────────────────────────────────────────┐
│  快速告警（Quick Alerts）  │  自动规则（Auto Rules）  │  触发历史  │
└─────────────────────────────────────────────────────────────┘
```

- **快速告警 Tab**：原 `/alerts` 功能，侧重即时触发
- **自动规则 Tab**：原 `/im/rules` 功能，侧重定时监控
- **触发历史 Tab**：合并的日志视图

### 4.3 创建/编辑表单差异化

| 字段 | 快速告警 | 自动规则 |
|------|---------|---------|
| 名称 | 必填 | 必填 |
| 描述 | 可选 | 可选 |
| 类型 | 固定 | 必选（data_threshold/data_change/scheduled/custom） |
| 监控指标 | 必填（指标名） | 必填（数据源+表+字段） |
| 条件 | 必选 | 必选 |
| 阈值 | 必填 | 必填 |
| 触发频率 | 无 | 必选 |
| 定时时间 | 无 | 必选（scheduled 类型） |
| 时间范围 | 无 | 可选 |
| 通知内容 | 必填 | 必填 |
| 通知平台 | 必填 | 可选 |

---

## 5. 实现计划

### Phase 1: 后端统一 Handler（保持向后兼容）

1. 创建统一的 `AlertAndNotificationHandler`，合并 `AlertHandler` 和 `NotificationRuleHandler`
2. 保持原有路由不变，新增统一路由
3. 扩展 `AlertTriggerLog` 表，增加 `source_type` 字段

### Phase 2: 统一 Service 层

1. 合并 `AlertService` 和 `NotificationRuleService` 的发送通知逻辑
2. 提取公共的通知发送方法到 `IMService`
3. 统一触发日志记录

### Phase 3: 前端统一页面

1. 重构 `/alerts` 页面，增加 Tab 导航
2. 创建统一的规则创建/编辑表单组件
3. 合并 `/im/rules` 页面到 `/alerts`
4. 更新导航组件

### Phase 4: AI 对话集成

1. 更新 System Prompt，统一 `alert_config` 和 `notification_rule` 的生成说明
2. 更新 `ChatPanel` 解析逻辑，统一处理两种类型

---

## 6. 向后兼容性

- 保留原有 `/api/tenants/{id}/alerts` 路由（映射到 `AlertEvent`）
- 保留原有 `/api/tenants/{id}/notification-rules` 路由（映射到 `NotificationRule`）
- 新增统一路由供新 UI 使用
- 数据库表结构不变，只扩展 `AlertTriggerLog`

---

## 7. 验收标准

1. 用户可在 `/alerts` 页面通过 Tab 切换查看"快速告警"和"自动规则"
2. 两种规则类型使用统一的创建/编辑表单
3. 两种规则类型共用底层的 IM 通知发送能力
4. 触发历史统一展示，可通过来源类型筛选
5. 原有 API 路由保持兼容，不破坏现有功能
6. AI 对话中仍可通过自然语言创建两种类型的告警/规则
