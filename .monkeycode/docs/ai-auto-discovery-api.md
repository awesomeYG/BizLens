# AI 自动发现功能 API 文档

## 概述

AI 自动发现功能会在数据源连接后自动分析数据，生成数据洞察、语义模型和可视化大屏。

## 核心功能

### 1. AI 自动发现 (AI Discovery)

当用户连接新的数据源后，系统会自动分析数据并生成以下洞察：

- **数据模式发现**：识别数据分布、统计特征
- **异常检测**：发现极端值、空值比例过高等问题
- **业务洞察**：推荐适合作为维度的列
- **优化建议**：数据质量改进建议

#### API 端点

```
GET /api/tenants/{tenantId}/data-sources/{dataSourceId}/ai-findings
```

获取数据源的所有 AI 发现

**查询参数**:
- `type` (可选): 过滤发现类型 (pattern/anomaly/trend/insight/recommend)

**响应示例**:
```json
[
  {
    "id": "uuid",
    "type": "anomaly",
    "severity": "high",
    "title": "orders.amount 存在极端大值",
    "description": "该列最大值为 100000.00，是平均值 500.00 的 200.0 倍",
    "tableName": "orders",
    "columnName": "amount",
    "metricValue": 100000,
    "evidence": "{\"max\":100000,\"mean\":500,\"ratio\":200}",
    "suggestion": "建议检查是否存在数据录入错误"
  }
]
```

---

```
GET /api/tenants/{tenantId}/data-sources/{dataSourceId}/ai-findings/stats
```

获取发现统计信息

**响应示例**:
```json
{
  "total": 15,
  "byType": [
    {"type": "pattern", "count": 5},
    {"type": "anomaly", "count": 3}
  ],
  "bySeverity": [
    {"severity": "high", "count": 2},
    {"severity": "medium", "count": 5}
  ]
}
```

---

```
GET /api/tenants/{tenantId}/data-sources/{dataSourceId}/ai-findings/summary
```

获取洞察摘要（文本格式，用于 AI 对话上下文）

**响应**: 纯文本摘要

---

```
POST /api/tenants/{tenantId}/data-sources/{dataSourceId}/ai-findings/rediscover
```

手动触发重新发现

---

### 2. 语义模型 (Semantic Model)

自动构建语义层，增强 AI 对话的语义理解能力。

#### API 端点

```
POST /api/tenants/{tenantId}/data-sources/{dataSourceId}/semantic-model/build
```

构建语义模型缓存

---

```
GET /api/tenants/{tenantId}/data-sources/{dataSourceId}/semantic-model
```

获取语义模型缓存

**响应示例**:
```json
{
  "metrics": "[...]",     // JSON 数组，指标定义
  "dimensions": "[...]",  // JSON 数组，维度定义
  "relations": "[...]",   // JSON 数组，表关系
  "nlQueries": "[...]"    // JSON 数组，自然语言查询模式
}
```

---

```
GET /api/tenants/{tenantId}/data-sources/{dataSourceId}/semantic-model/context
```

获取语义上下文（用于 AI 对话增强）

**响应**: 纯文本，格式化的语义模型描述

---

```
POST /api/tenants/{tenantId}/data-sources/{dataSourceId}/semantic-model/refresh
```

刷新语义模型

---

```
POST /api/tenants/{tenantId}/data-sources/{dataSourceId}/semantic-model/nl2sql
```

自然语言转 SQL（简化版本）

**请求**:
```json
{
  "query": "orders 的总金额是多少"
}
```

**响应**:
```json
{
  "sql": "SELECT SUM(amount) FROM orders"
}
```

---

### 3. 自动化大屏 (Auto Dashboard)

基于 AI 发现自动生成可视化大屏（SpotterViz 风格）。

#### API 端点

```
POST /api/tenants/{tenantId}/dashboards
```

创建大屏（如果 name 为空且指定 dataSourceId，则自动生成）

**请求**:
```json
{
  "dataSourceId": "uuid",
  "name": ""  // 空表示自动生成
}
```

---

```
GET /api/tenants/{tenantId}/dashboards?dataSourceId=uuid
```

获取大屏列表

---

```
GET /api/tenants/{tenantId}/dashboards/{dashboardId}
```

获取单个大屏详情

**响应示例**:
```json
{
  "id": "uuid",
  "name": "AI 自动生成大屏",
  "layoutType": "auto",
  "widgets": "[...]",    // JSON 数组，组件配置
  "storyOrder": "[...]", // JSON 数组，故事线顺序
  "isAutoGen": true
}
```

---

```
GET /api/tenants/{tenantId}/dashboards/{dashboardId}/preview
```

获取大屏预览数据（执行所有组件的查询）

**响应**:
```json
{
  "widgets": [
    {
      "widgetId": "widget_0",
      "data": [{"value": 1000}]
    }
  ]
}
```

---

```
POST /api/tenants/{tenantId}/dashboards/{dashboardId}/regenerate
```

重新生成大屏

---

```
GET /api/tenants/{tenantId}/data-sources/{dataSourceId}/dashboards/suggestions
```

获取布局建议

**响应**:
```json
{
  "recommendedLayout": "story",
  "widgetCount": 12,
  "storyMode": true,
  "reason": "发现较多，建议使用故事线布局引导用户关注重点"
}
```

---

## 数据类型定义

### AIFindingType (发现类型)

- `pattern`: 数据模式
- `anomaly`: 异常检测
- `trend`: 趋势分析
- `insight`: 业务洞察
- `recommend`: 优化建议

### AIFindingSeverity (严重程度)

- `high`: 高
- `medium`: 中
- `low`: 低
- `info`: 提示

### DashboardLayoutType (布局类型)

- `auto`: AI 自动布局
- `grid`: 网格布局
- `free`: 自由布局
- `story`: 故事线布局

---

## 使用流程

### 1. 连接数据源后自动触发

当用户创建数据库类型的数据源时，后端会自动：
1. 测试连接
2. 获取 Schema
3. 触发 AI 发现（异步）
4. 构建语义模型（异步）
5. 生成 AI 大屏（异步）

### 2. 查看 AI 发现结果

前端轮询或等待 WebSocket 通知（待实现），然后调用：
```
GET /api/tenants/{id}/data-sources/{dsId}/ai-findings
```

### 3. 查看/编辑生成的语义模型

```
GET /api/tenants/{id}/data-sources/{dsId}/semantic-model
```

### 4. 查看/编辑自动生成的大屏

```
GET /api/tenants/{id}/dashboards?dataSourceId={dsId}
```

---

## 前端集成建议

### 数据源连接页面

1. 创建数据源成功后，显示"AI 正在分析数据..."状态
2. 轮询 AI 发现接口，直到返回结果
3. 显示发现数量统计和摘要

### AI 发现详情页

1. 按严重程度分组展示发现
2. 支持按类型筛选
3. 每条发现显示：标题、描述、证据、建议
4. 支持手动触发重新发现

### 语义模型页面

1. 展示自动生成的指标和维度
2. 支持编辑和添加自定义指标
3. 显示表关系图

### 大屏页面

1. 列表展示自动生成的大屏
2. 支持预览和编辑
3. 提供布局建议
4. 支持故事线模式展示

---

## 性能考虑

- AI 发现过程是异步的，不会阻塞数据源创建
- 大屏预览数据可以缓存，避免重复查询
- 语义模型在数据源 schema 变化时需要刷新
