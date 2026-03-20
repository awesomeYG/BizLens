# MCP 风格 Schema 感知系统

> **Model Context Protocol** - 让 AI 直接感知数据库结构

---

## 🎯 功能概述

BizLens v0.3.0 引入了类似 MCP（Model Context Protocol）的 Schema 感知系统，使 AI 能够：

1. **理解数据库结构** - 自动获取表、字段、类型信息
2. **生成智能 SQL** - 自然语言转 SQL 查询
3. **自动修复错误** - 诊断并修复 SQL 语法错误
4. **预览数据** - 执行查询并展示结果

---

## 🏗️ 架构设计

### 系统架构

```
┌─────────────────────────────────────────────────────────┐
│                    用户界面层                              │
│  ┌─────────────┐  ┌──────────────┐  ┌───────────────┐  │
│  │ Schema 浏览器 │  │ SQL 查询编辑器 │  │  数据预览面板  │  │
│  └─────────────┘  └──────────────┘  └───────────────┘  │
└─────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────┐
│                    AI 对话层                              │
│  ┌──────────────────────────────────────────────────┐   │
│  │  自然语言提问 → AI 生成 SQL → 执行 → 展示结果       │   │
│  │  SQL 执行错误 → AI 诊断 → 自动修复 → 重新执行       │   │
│  └──────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────┐
│                    服务层                                 │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │ Schema 服务   │  │ SQL 执行服务   │  │ AI 修复服务   │  │
│  └──────────────┘  └──────────────┘  └──────────────┘  │
└─────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────┐
│                    数据源层                               │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │    MySQL     │  │ PostgreSQL   │  │   CSV 文件    │  │
│  └──────────────┘  └──────────────┘  └──────────────┘  │
└─────────────────────────────────────────────────────────┘
```

---

## 📡 API 接口

### 1. 获取 Schema 上下文

```http
GET /api/tenants/{tenantId}/data-sources/{dsId}/schema/context
```

**响应**:
```json
{
  "schemaContext": "## 数据库 Schema 信息\n\n### 表：orders\n记录数：10000\n\n| 字段 | 类型 | 可空 | 说明 |\n|------|------|------|------|\n| id | bigint | 否 | 主键 |\n| order_no | varchar | 否 | 订单号 |\n..."
}
```

**用途**:
- AI 对话时传入 Schema 上下文
- 让 AI 理解数据库结构
- 生成准确的 SQL 查询

---

### 2. 执行 SQL 查询

```http
POST /api/tenants/{tenantId}/data-sources/{dsId}/query
Content-Type: application/json

{
  "sql": "SELECT * FROM orders LIMIT 100"
}
```

**响应**:
```json
{
  "success": true,
  "data": [
    {"id": 1, "order_no": "ORD001", "amount": 199.00},
    {"id": 2, "order_no": "ORD002", "amount": 299.00}
  ],
  "count": 2,
  "sql": "SELECT * FROM orders LIMIT 100"
}
```

**安全机制**:
- ✅ 只允许 SELECT 查询
- ❌ 禁止 INSERT/UPDATE/DELETE
- ❌ 禁止 DROP/ALTER/CREATE
- ⏱️ 30 秒超时
- 🔒 连接池限制

---

### 3. 获取样本数据

```http
POST /api/tenants/{tenantId}/data-sources/{dsId}/sample
Content-Type: application/json

{
  "tableName": "orders",
  "limit": 100
}
```

**响应**:
```json
{
  "data": [...],
  "count": 100
}
```

---

### 4. AI 修复 SQL

```http
POST /api/tenants/{tenantId}/data-sources/{dsId}/query/repair
Content-Type: application/json

{
  "sql": "SELECT * FROM order WHERE id = 1",
  "error": "Table 'order' doesn't exist"
}
```

**响应**:
```json
{
  "originalSQL": "SELECT * FROM order WHERE id = 1",
  "repairedSQL": "SELECT * FROM orders WHERE id = 1",
  "explanation": "表名错误，应该是 orders 而不是 order",
  "canTryRepair": true
}
```

---

## 🔧 后端实现

### Data Source Service

```go
// server/internal/service/data_source_service.go

// 执行 SQL 查询
func (s *DataSourceService) ExecuteQuery(ds *model.DataSource, query string) ([]map[string]interface{}, error) {
    // 安全检查：只允许 SELECT 查询
    dangerous := []string{"INSERT", "UPDATE", "DELETE", "DROP", "ALTER", "CREATE", "TRUNCATE"}
    for _, op := range dangerous {
        if strings.Contains(queryUpper, op) {
            return nil, fmt.Errorf("禁止执行 %s 操作", op)
        }
    }
    
    // 连接数据库并执行
    // ...
}

// 获取样本数据
func (s *DataSourceService) GetSampleData(ds *model.DataSource, tableName string, limit int) ([]map[string]interface{}, error) {
    query := fmt.Sprintf("SELECT * FROM %s LIMIT %d", tableName, limit)
    return s.ExecuteQuery(ds, query)
}

// 生成 Schema 上下文（用于 AI）
func (s *DataSourceService) GenerateSchemaContext(ds *model.DataSource) (string, error) {
    // 格式化为 AI 可读的文本
    // 包含表名、字段、类型、记录数等
}
```

### Schema Handler

```go
// server/internal/handler/schema_handler.go

// 获取 Schema 上下文
func (h *SchemaHandler) GetSchemaContext(w http.ResponseWriter, r *http.Request) {
    ctx, err := h.dataSourceService.GenerateSchemaContext(ds)
    writeJSON(w, http.StatusOK, map[string]string{
        "schemaContext": ctx,
    })
}

// 执行 SQL
func (h *SchemaHandler) ExecuteSQL(w http.ResponseWriter, r *http.Request) {
    results, err := h.dataSourceService.ExecuteQuery(ds, req.SQL)
    writeJSON(w, http.StatusOK, map[string]interface{}{
        "success": true,
        "data": results,
    })
}

// AI 修复 SQL
func (h *SchemaHandler) RepairSQL(w http.ResponseWriter, r *http.Request) {
    // 调用 AI API 修复 SQL
    repairedSQL, explanation, err := repairSQLWithAI(req.SQL, req.LastError, schemaCtx)
    writeJSON(w, http.StatusOK, map[string]interface{}{
        "repairedSQL": repairedSQL,
        "explanation": explanation,
    })
}
```

---

## 🎨 前端组件

### Schema Explorer

```tsx
// components/schema-explorer.tsx

interface SchemaExplorerProps {
  schemaContext: string;
  tables: TableSchema[];
  onTableClick?: (tableName: string) => void;
  onPreviewSample?: (tableName: string) => void;
}

// 功能:
// - 显示所有表
// - 展开查看字段详情
// - 点击表名复制到对话
// - 预览样本数据
```

### SQL Query Editor

```tsx
// components/sql-query-editor.tsx

interface SQLQueryEditorProps {
  dataSourceId: string;
  tenantId: string;
  onQueryExecuted?: (result: QueryResult) => void;
}

// 功能:
// - SQL 代码编辑器
// - 一键执行查询
// - 表格展示结果
// - 错误提示
```

---

## 🤖 AI 集成示例

### 自然语言转 SQL

**用户**: "帮我查看最近的订单"

**AI 思考过程**:
1. 获取 Schema 上下文 → 知道有 `orders` 表
2. 理解意图 → 查询最近的订单
3. 生成 SQL:
   ```sql
   SELECT * FROM orders 
   ORDER BY created_at DESC 
   LIMIT 20
   ```
4. 执行查询并展示结果

### 自动修复 SQL

**用户**: "查询 order 表的所有数据"

**AI 生成**: `SELECT * FROM order`

**执行错误**: `Table 'order' doesn't exist`

**AI 修复**:
1. 分析错误 → 表名不存在
2. 查看 Schema → 正确的表名是 `orders`
3. 修复 SQL: `SELECT * FROM orders`
4. 重新执行 → 成功

---

## 📊 使用场景

### 场景 1: 数据探索

1. 用户连接 MySQL 数据源
2. AI 自动获取 Schema 信息
3. 用户问："我们有哪些表？"
4. AI 展示表列表和说明
5. 用户点击表名预览数据

### 场景 2: 业务分析

1. 用户问："上个月销售额是多少？"
2. AI 理解 Schema → `orders` 表有 `amount` 字段
3. 生成 SQL:
   ```sql
   SELECT SUM(amount) 
   FROM orders 
   WHERE created_at >= '2026-02-01' 
     AND created_at < '2026-03-01'
   ```
4. 执行并展示结果

### 场景 3: 错误自修复

1. AI 生成 SQL 执行失败
2. 系统自动调用修复接口
3. AI 诊断错误并修复
4. 重新执行成功的 SQL
5. 用户看到结果，无需手动干预

---

## 🔒 安全机制

### SQL 注入防护
- ✅ 只允许 SELECT 查询
- ✅ 关键字过滤（INSERT/UPDATE/DELETE 等）
- ✅ 参数化查询（预处理）
- ✅ SQL 长度限制

### 连接管理
- ✅ 连接池限制（最大 5 个连接）
- ✅ 查询超时（30 秒）
- ✅ 空闲连接回收
- ✅ 错误重试机制

### 权限控制
- ✅ 多租户隔离
- ✅ 数据源权限验证
- ✅ 只读账号建议
- ✅ 敏感操作审计日志

---

## 🚀 性能优化

### 查询优化
- ✅ LIMIT 默认限制（100 行）
- ✅ 样本数据快速获取
- ✅ Schema 缓存（避免重复查询）
- ✅ 增量加载

### 响应优化
- ✅ 流式返回结果
- ✅ 分页展示
- ✅ 前端虚拟滚动
- ✅ 结果压缩

---

## 📈 未来规划

### v0.3.0 (当前)
- [x] Schema 感知系统
- [x] SQL 执行引擎
- [x] 基础错误修复
- [ ] AI 对话集成

### v0.4.0
- [ ] 自然语言转 SQL（NL2SQL）
- [ ] 智能查询建议
- [ ] 查询历史记录
- [ ] 查询性能分析

### v0.5.0
- [ ] 跨数据源查询
- [ ] 可视化查询构建器
- [ ] SQL 模板库
- [ ] 自动索引建议

---

## 💡 最佳实践

### 1. 使用 Schema 上下文
```typescript
// 在 AI 对话时传入 Schema 上下文
const response = await fetch('/api/chat', {
  method: 'POST',
  body: JSON.stringify({
    messages,
    dataSchema: schemaContext, // ← AI 能理解数据库结构
  }),
});
```

### 2. 安全执行查询
```typescript
// 始终使用后端 API 执行查询
// 不要在前端拼接 SQL
const result = await fetch(`/api/tenants/${id}/data-sources/${dsId}/query`, {
  method: 'POST',
  body: JSON.stringify({ sql: 'SELECT * FROM ...' }),
});
```

### 3. 错误处理
```typescript
try {
  const result = await executeSQL(sql);
} catch (error) {
  // 调用 AI 修复
  const repaired = await repairSQL(sql, error.message);
  // 重新执行修复后的 SQL
}
```

---

## 🔗 相关文档

- [数据源连接器](./v0.2.0-release.md)
- [AI 多模型支持](./v0.2.0-release.md)
- [测试指南](./TESTING.md)

---

**BizLens - 让 AI 真正理解你的数据**
