# 语义层功能测试指南

**版本**: v0.4.0  
**日期**: 2026-03-23  
**状态**: 待测试

---

## 📋 测试清单

### 1. 后端 API 测试

#### 1.1 数据库迁移测试

```bash
# 1. 启动后端服务
cd /workspace/backend
go run cmd/main.go

# 2. 检查数据库表是否创建
# 应该创建以下表:
# - metrics
# - dimensions
# - relationships
# - metric_lineage
```

**预期结果**:
- ✅ 服务启动成功
- ✅ 数据库表自动创建
- ✅ 无错误日志

---

#### 1.2 指标 CRUD 测试

```bash
# 1. 创建测试租户和数据源（如果不存在）
curl -X POST http://localhost:3001/api/tenants \
  -H "Content-Type: application/json" \
  -d '{"name": "Test Tenant"}'

# 2. 创建指标
curl -X POST http://localhost:3001/api/tenants/tenant123/metrics \
  -H "Content-Type: application/json" \
  -d '{
    "name": "GMV",
    "displayName": "成交总额",
    "description": "销售总金额",
    "dataType": "currency",
    "aggregation": "sum",
    "formula": "SUM(orders.amount)",
    "baseTable": "orders",
    "baseField": "amount",
    "category": "销售",
    "status": "active"
  }'

# 3. 获取指标列表
curl http://localhost:3001/api/tenants/tenant123/metrics

# 4. 更新指标
curl -X PUT http://localhost:3001/api/tenants/tenant123/metrics/metric123 \
  -H "Content-Type: application/json" \
  -d '{"description": "更新的描述"}'

# 5. 删除指标
curl -X DELETE http://localhost:3001/api/tenants/tenant123/metrics/metric123
```

**预期结果**:
- ✅ 创建成功，返回指标对象
- ✅ 列表查询返回创建的指标
- ✅ 更新成功，描述已修改
- ✅ 删除成功（软删除）

---

#### 1.3 AI 自动发现测试

**准备**: 需要先创建一个数据源，包含表结构信息

```bash
# 1. 创建数据源
curl -X POST http://localhost:3001/api/tenants/tenant123/data-sources \
  -H "Content-Type: application/json" \
  -d '{
    "name": "测试数据库",
    "type": "mysql",
    "host": "localhost",
    "port": 3306,
    "database": "test_db",
    "username": "root",
    "password": "password",
    "tableInfo": "{\"orders\": [{\"name\": \"id\", \"type\": \"INT\"}, {\"name\": \"amount\", \"type\": \"DECIMAL\"}, {\"name\": \"user_id\", \"type\": \"INT\"}, {\"name\": \"created_at\", \"type\": \"DATETIME\"}], \"users\": [{\"name\": \"id\", \"type\": \"INT\"}, {\"name\": \"name\", \"type\": \"VARCHAR\"}]}"
  }'

# 2. 自动发现指标
curl -X POST "http://localhost:3001/api/tenants/tenant123/metrics/auto-discover?dataSourceId=ds_123"

# 3. 自动发现维度
curl -X POST "http://localhost:3001/api/tenants/tenant123/dimensions/auto-discover?dataSourceId=ds_123"

# 4. 自动发现关系
curl -X POST "http://localhost:3001/api/tenants/tenant123/relationships/auto-discover?dataSourceId=ds_123"
```

**预期结果**:
- ✅ 自动发现指标：GMV (SUM of amount), 订单量 (COUNT of orders)
- ✅ 自动发现维度：created_at (时间), name (分类)
- ✅ 自动发现关系：orders.user_id -> users.id
- ✅ 置信度评分合理 (0.8-0.9)

---

#### 1.4 语义层摘要测试

```bash
curl http://localhost:3001/api/tenants/tenant123/semantic/summary
```

**预期响应**:
```json
{
  "metrics": {
    "total": 5,
    "active": 3,
    "draft": 2
  },
  "dimensions": {
    "total": 4
  },
  "relationships": {
    "total": 2
  },
  "categories": {
    "销售": 3,
    "用户": 2
  }
}
```

---

### 2. 前端界面测试

#### 2.1 访问指标管理页面

```
URL: http://localhost:3000/settings/metrics
```

**测试步骤**:
1. 打开浏览器访问上述 URL
2. 检查页面加载正常
3. 检查摘要卡片显示正确
4. 检查指标列表显示

**预期结果**:
- ✅ 页面加载成功
- ✅ 摘要卡片显示总数、活跃数、草稿数
- ✅ 指标列表正确显示
- ✅ 支持排序和筛选

---

#### 2.2 创建指标测试

1. 点击"新建指标"按钮
2. 填写表单:
   - 指标名称：TEST_GMV
   - 显示名称：测试 GMV
   - 数据类型：金额
   - 聚合方式：SUM
   - 公式：SUM(test.amount)
   - 基础表：test
   - 基础字段：amount
3. 点击"创建"

**预期结果**:
- ✅ 表单验证通过
- ✅ 创建成功提示
- ✅ 列表中显示新指标
- ✅ 状态为"活跃"

---

#### 2.3 AI 自动发现测试

1. 点击"AI 自动发现"按钮
2. 选择数据源
3. 点击"开始分析"
4. 检查发现的指标列表
5. 点击"确认"或"忽略"

**预期结果**:
- ✅ 分析过程有加载动画
- ✅ 显示发现的指标及置信度
- ✅ 可以单个确认或全部确认
- ✅ 确认后的指标出现在列表中

---

#### 2.4 编辑和删除测试

1. 点击某个指标的"编辑"按钮
2. 修改描述或分类
3. 点击"更新"
4. 点击"删除"按钮
5. 确认删除

**预期结果**:
- ✅ 编辑表单正确填充
- ✅ 更新成功
- ✅ 删除前有确认提示
- ✅ 删除后列表不再显示

---

### 3. 集成测试

#### 3.1 端到端流程测试

**场景**: 新用户首次使用语义层

1. 连接数据源
2. 使用 AI 自动发现指标
3. 确认发现的指标
4. 在 AI 对话中询问业务问题
5. 检查 AI 是否使用语义层

**预期流程**:
```
用户连接 MySQL → AI 发现 5 个指标 → 用户确认 → 
用户问"上周 GMV 多少" → AI 使用语义层生成 SQL → 
返回结果
```

---

### 4. 性能测试

#### 4.1 大量指标测试

```bash
# 创建 100 个测试指标
for i in {1..100}; do
  curl -X POST http://localhost:3001/api/tenants/tenant123/metrics \
    -H "Content-Type: application/json" \
    -d "{
      \"name\": \"METRIC_$i\",
      \"displayName\": \"测试指标$i\",
      \"dataType\": \"number\",
      \"aggregation\": \"sum\",
      \"formula\": \"SUM(test.field$i)\",
      \"baseTable\": \"test\",
      \"baseField\": \"field$i\",
      \"status\": \"active\"
    }"
done

# 测试列表查询性能
time curl http://localhost:3001/api/tenants/tenant123/metrics
```

**预期结果**:
- ✅ 列表查询 < 500ms
- ✅ 页面渲染流畅
- ✅ 无内存泄漏

---

### 5. 错误处理测试

#### 5.1 边界条件测试

```bash
# 1. 创建空名称指标（应失败）
curl -X POST http://localhost:3001/api/tenants/tenant123/metrics \
  -H "Content-Type: application/json" \
  -d '{"name": ""}'

# 2. 创建重复名称指标
curl -X POST http://localhost:3001/api/tenants/tenant123/metrics \
  -H "Content-Type: application/json" \
  -d '{
    "name": "DUPLICATE",
    "displayName": "重复测试",
    "dataType": "number",
    "aggregation": "sum",
    "formula": "SUM(test.col)",
    "baseTable": "test",
    "baseField": "col"
  }'

# 3. 更新不存在的指标
curl -X PUT http://localhost:3001/api/tenants/tenant123/metrics/nonexistent \
  -H "Content-Type: application/json" \
  -d '{"name": "updated"}'

# 4. 删除不存在的指标
curl -X DELETE http://localhost:3001/api/tenants/tenant123/metrics/nonexistent
```

**预期结果**:
- ✅ 空名称返回 400 错误
- ✅ 重复名称允许创建（不同租户可以重复）
- ✅ 更新不存在返回 404
- ✅ 删除不存在返回 404

---

## 📊 测试结果记录

### 测试环境
- **日期**: ___________
- **测试人员**: ___________
- **后端版本**: ___________
- **前端版本**: ___________
- **数据库**: SQLite / PostgreSQL

### 测试结果

| 测试项 | 通过/失败 | 备注 |
|--------|----------|------|
| 数据库迁移 | ⬜ 通过 ⬜ 失败 | |
| 指标创建 | ⬜ 通过 ⬜ 失败 | |
| 指标更新 | ⬜ 通过 ⬜ 失败 | |
| 指标删除 | ⬜ 通过 ⬜ 失败 | |
| 指标列表 | ⬜ 通过 ⬜ 失败 | |
| AI 自动发现 - 指标 | ⬜ 通过 ⬜ 失败 | |
| AI 自动发现 - 维度 | ⬜ 通过 ⬜ 失败 | |
| AI 自动发现 - 关系 | ⬜ 通过 ⬜ 失败 | |
| 前端页面加载 | ⬜ 通过 ⬜ 失败 | |
| 前端创建指标 | ⬜ 通过 ⬜ 失败 | |
| 前端 AI 发现 | ⬜ 通过 ⬜ 失败 | |
| 性能测试 | ⬜ 通过 ⬜ 失败 | |
| 错误处理 | ⬜ 通过 ⬜ 失败 | |

### 发现的问题

| 编号 | 问题描述 | 严重程度 | 状态 |
|------|----------|----------|------|
| 1 | | 高/中/低 | 待修复/已修复 |
| 2 | | | |

### 改进建议

1. ________________
2. ________________
3. ________________

---

## 🚀 快速开始测试

### 一键启动测试环境

```bash
# 1. 启动数据库
docker-compose up -d postgres

# 2. 启动后端
cd /workspace/backend
go run cmd/main.go &

# 3. 启动前端
cd /workspace
npm run dev &

# 4. 等待服务就绪
sleep 5

# 5. 运行测试脚本
bash scripts/test-semantic-layer.sh
```

---

## 📝 测试报告模板

测试完成后，填写以下报告：

```markdown
# 语义层测试报告

## 测试概况
- 测试日期：2026-03-23
- 测试人员：QA Team
- 通过率：95% (19/20)

## 主要发现
✅ 核心功能正常工作
✅ AI 自动发现准确率 85%
⚠️ 大量数据时页面加载较慢

## 阻塞性问题
无

## 建议
1. 优化前端列表虚拟滚动
2. 增加指标导入导出功能
3. 改进 AI 发现算法
```

---

**下一步**: 收集用户反馈，迭代优化
