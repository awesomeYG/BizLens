# 语义层实施进度报告

**日期**: 2026-03-23  
**阶段**: Phase 1 - 语义层基础 (v0.4.0)  
**状态**: ✅ 后端完成，前端待开发

---

## ✅ 已完成

### 1. 数据模型设计

已在 `/workspace/backend/internal/model/model.go` 中添加以下模型：

#### Metric (业务指标)
```go
type Metric struct {
    ID              string
    Name            string          // 如 "GMV"
    DisplayName     string          // 如 "成交总额"
    DataType        MetricDataType  // currency/number/percentage
    Aggregation     MetricAggregation // sum/count/avg
    Formula         string          // 如 "SUM(orders.amount)"
    BaseTable       string
    BaseField       string
    IsAutoDetected  bool
    ConfidenceScore float64
    Status          string  // active/inactive/draft
}
```

#### Dimension (业务维度)
```go
type Dimension struct {
    ID           string
    Name         string         // 如 "province"
    DisplayName  string         // 如 "省份"
    DataType     DimensionType  // time/category/geo
    BaseTable    string
    BaseField    string
    IsAutoDetected bool
}
```

#### Relationship (表关系)
```go
type Relationship struct {
    ID            string
    Name          string           // 如 "订单 - 用户"
    SourceTable   string
    TargetTable   string
    Relationship  RelationshipType // one_to_many 等
    JoinKey       string
    TargetKey     string
    IsAutoDetected bool
}
```

#### MetricLineage (指标血缘)
- 追踪指标来源
- 记录使用次数
- 最后使用时间

---

### 2. 后端服务实现

#### MetricService (`/workspace/backend/internal/service/metric_service.go`)
- ✅ `CreateMetric` - 创建指标
- ✅ `UpdateMetric` - 更新指标
- ✅ `DeleteMetric` - 删除指标
- ✅ `GetMetric` - 获取单个指标
- ✅ `ListMetrics` - 获取指标列表
- ✅ `AutoDiscoverMetrics` - AI 自动发现指标
  - 识别金额字段 → GMV 等指标
  - 识别数量字段 → 订单量等
  - 识别交易表 → 自动创建计数指标

#### DimensionService
- ✅ `AutoDiscoverDimensions` - AI 自动发现维度
  - 时间维度 (date/time 字段)
  - 分类维度 (varchar 字段)
  - 地理维度 (province/city 字段)

#### RelationshipService
- ✅ `AutoDiscoverRelationships` - AI 自动发现表关系
  - 基于命名约定发现外键
  - 如 `orders.user_id` → `users.id`

---

### 3. API Handler

已在 `/workspace/backend/internal/handler/metric_handler.go` 实现：

| API | Method | 功能 |
|-----|--------|------|
| `/api/tenants/{id}/metrics` | GET | 获取指标列表 |
| `/api/tenants/{id}/metrics` | POST | 创建指标 |
| `/api/tenants/{id}/metrics/{metricId}` | GET | 获取单个指标 |
| `/api/tenants/{id}/metrics/{metricId}` | PUT | 更新指标 |
| `/api/tenants/{id}/metrics/{metricId}` | DELETE | 删除指标 |
| `/api/tenants/{id}/metrics/auto-discover` | POST | 自动发现指标 |
| `/api/tenants/{id}/metrics/confirm` | POST | 批量确认指标 |
| `/api/tenants/{id}/dimensions/auto-discover` | POST | 自动发现维度 |
| `/api/tenants/{id}/relationships/auto-discover` | POST | 自动发现关系 |
| `/api/tenants/{id}/semantic/summary` | GET | 获取语义层摘要 |

---

### 4. 路由注册

已在 `/workspace/backend/cmd/main.go` 注册所有语义层路由。

---

### 5. AI 自动发现算法

实现原理：

```go
// 1. 识别金额字段
func isAmountField(colName, colType string) bool {
    // 检查列名：amount, price, cost, fee, revenue, gmv, sales
    // 检查类型：decimal, numeric, money, float, double
}

// 2. 识别数量字段
func isQuantityField(colName, colType string) bool {
    // 检查列名：quantity, qty, count, num, amount
}

// 3. 识别交易表
func isTransactionTable(tableName string) bool {
    // 检查表名：order, transaction, payment, sale
}

// 4. 识别时间维度
func isTimeField(colName, colType string) bool {
    // 检查列名：date, time, created, updated
    // 检查类型：date, time, timestamp, datetime
}

// 5. 识别地理维度
func isGeoField(colName string) bool {
    // 检查列名：province, city, district, region, address
}

// 6. 发现外键关系
func findForeignKeyRelationship(table1, table2 string) bool {
    // 检查常见外键：user_id, customer_id, product_id
}
```

置信度评分：
- 金额字段：0.9
- 地理维度：0.85
- 交易表计数：0.85
- 时间维度：0.9
- 分类维度：0.8
- 外键关系：0.85

---

## 📋 待完成

### 1. 前端界面 (高优先级)

需要创建以下前端页面：

#### `/workspace/app/settings/metrics/page.tsx` - 指标管理页面
```tsx
功能：
- 指标列表展示 (表格)
- 指标创建/编辑表单
- 指标确认界面 (自动发现的指标)
- 指标血缘可视化
```

#### 组件：
- `/workspace/components/metrics/MetricCard.tsx` - 指标卡片
- `/workspace/components/metrics/MetricForm.tsx` - 指标表单
- `/workspace/components/metrics/MetricLineage.tsx` - 血缘图
- `/workspace/components/metrics/AutoDiscoverModal.tsx` - 自动发现弹窗

#### UI 设计：
```
┌────────────────────────────────────────────────────┐
│  指标管理                              [+ 新建指标] │
├────────────────────────────────────────────────────┤
│                                                    │
│  [🤖 AI 自动发现]  [导出]  [刷新]                   │
│                                                    │
│  ┌──────────────────────────────────────────────┐ │
│  │ 名称      │ 类型    │ 公式            │ 状态 │ │
│  ├──────────────────────────────────────────────┤ │
│  │ GMV       │ 金额    │ SUM(amount)     │ ✅   │ │
│  │ 订单量    │ 数字    │ COUNT(id)       │ ✅   │ │
│  │ 客单价    │ 数字    │ SUM/COUNT       │ ⚠️   │ │
│  └──────────────────────────────────────────────┘ │
│                                                    │
│  AI 发现建议 (3 个待确认):                          │
│  ┌──────────────────────────────────────────────┐ │
│  │ 📊 支付金额 = SUM(payment.amount)            │ │
│  │    置信度：90%  [确认] [编辑] [忽略]          │ │
│  ├──────────────────────────────────────────────┤ │
│  │ 📊 退款订单数 = COUNT(refund_orders)         │ │
│  │    置信度：85%  [确认] [编辑] [忽略]          │ │
│  └──────────────────────────────────────────────┘ │
└────────────────────────────────────────────────────┘
```

### 2. 集成到 AI 查询引擎 (高优先级)

修改 AI 对话系统，使用语义层：

```typescript
// 当前：直接查表
AI → SQL: SELECT SUM(amount) FROM orders WHERE ...

// 改进后：使用语义层
AI → 语义层解析 → SQL:
1. 识别 "销售额" → Metric: GMV
2. 查找 Metric.GMV.Formula → "SUM(orders.amount)"
3. 生成最终 SQL
```

需要修改：
- `/workspace/backend/internal/service/schema_handler.go` - 集成语义层查询
- `/workspace/app/api/chat/route.ts` - AI 查询使用语义层

### 3. 测试 (中优先级)

- [ ] 单元测试：指标服务
- [ ] 集成测试：自动发现算法
- [ ] E2E 测试：完整流程

---

## 📊 代码统计

| 文件 | 行数 | 说明 |
|------|------|------|
| `model/model.go` | +120 | 新增 4 个模型 |
| `service/metric_service.go` | 280 | 3 个服务类 |
| `handler/metric_handler.go` | 326 | 10 个 API handler |
| `cmd/main.go` | +60 | 路由注册 |
| **总计** | **~786 行** | 新增代码 |

---

## 🎯 下一步计划

### 本周剩余时间 (Week 1)
1. ✅ ~~数据模型设计~~ (已完成)
2. ✅ ~~后端 API 实现~~ (已完成)
3. 🔄 前端界面开发 (进行中)
4. ⏳ AI 查询引擎集成

### 下周 (Week 2)
1. 完善自动发现算法
2. 集成到 AI 对话
3. 用户测试和反馈收集

---

## 💡 使用示例

### 1. 自动发现指标

```bash
# 调用 API
curl -X POST "http://localhost:3001/api/tenants/tenant123/metrics/auto-discover?dataSourceId=ds_456"

# 响应
{
  "metrics": [
    {
      "id": "metric_123",
      "name": "GMV",
      "displayName": "成交总额",
      "formula": "SUM(orders.amount)",
      "dataType": "currency",
      "aggregation": "sum",
      "isAutoDetected": true,
      "confidenceScore": 0.9,
      "status": "draft"
    }
  ],
  "count": 1
}
```

### 2. 确认指标

```bash
curl -X POST "http://localhost:3001/api/tenants/tenant123/metrics/confirm" \
  -H "Content-Type: application/json" \
  -d '{"metricIds": ["metric_123", "metric_124"]}'
```

### 3. 查询指标

```bash
curl "http://localhost:3001/api/tenants/tenant123/metrics?status=active"
```

---

## ⚠️ 注意事项

1. **数据库迁移**: 首次运行需要执行数据库迁移
   ```bash
   cd /workspace/backend && go run cmd/main.go
   # 自动创建 tables: metrics, dimensions, relationships, metric_lineage
   ```

2. **自动发现前提**: 数据源需要有 `tableInfo` 字段（JSON 格式的表结构信息）

3. **置信度阈值**: 
   - > 0.8: 高置信度，建议用户确认
   - 0.6-0.8: 中等置信度，需要人工审核
   - < 0.6: 低置信度，不推荐

---

**实施进度**: 60% ✅  
**预计完成时间**: 2026-03-30 (Week 2 结束)
