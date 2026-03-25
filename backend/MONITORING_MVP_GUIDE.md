# 业务健康监控 MVP 使用指南

## 功能概述

BizLens 业务健康监控系统实现了以下核心功能：

1. **基线学习** - 自动学习指标的正常范围
2. **异常检测** - 实时检测指标偏离基线的情况
3. **智能推送** - 异常发生时自动推送到 IM 平台
4. **每日摘要** - 每天早上 9 点自动发送业务健康报告

## 架构说明

```
调度服务 (每小时)
    ↓
基线学习引擎 → 计算期望值、标准差、上下界
    ↓
异常检测引擎 → 判断实际值是否偏离基线 > 2σ
    ↓
降噪过滤 → 4 小时沉默期，避免重复推送
    ↓
IM 推送 → 钉钉/飞书/企微
```

## API 接口

### 1. 查询异常列表

```bash
GET /api/tenants/{tenantId}/anomalies?status=open
```

**参数**：
- `status`: 可选，过滤状态 (open/acknowledged/resolved/false_positive)

**响应**：
```json
{
  "anomalies": [
    {
      "id": "xxx",
      "metricId": "gmv",
      "detectedAt": "2026-03-25T10:00:00Z",
      "actualValue": 85000,
      "expectedValue": 130000,
      "deviation": 3.2,
      "severity": "critical",
      "confidence": 0.85,
      "direction": "down"
    }
  ]
}
```

### 2. 手动触发异常检测

```bash
POST /api/tenants/{tenantId}/anomalies/detect
Content-Type: application/json

{
  "metricId": "gmv",
  "actualValue": 85000,
  "platformIds": ["platform-id-1", "platform-id-2"]
}
```

**说明**：
- `metricId`: 指标 ID
- `actualValue`: 实际值
- `platformIds`: IM 平台 ID 列表（可选，为空则不推送）

## 数据模型

### MetricBaseline (指标基线)

| 字段 | 类型 | 说明 |
|------|------|------|
| tenant_id | string | 租户 ID |
| metric_id | string | 指标 ID |
| granularity | string | 粒度 (hourly/daily/weekly) |
| expected_value | float | 期望值 |
| std_dev | float | 标准差 |
| upper_bound | float | 上界 (期望值 + 2σ) |
| lower_bound | float | 下界 (期望值 - 2σ) |

### AnomalyEvent (异常事件)

| 字段 | 类型 | 说明 |
|------|------|------|
| tenant_id | string | 租户 ID |
| metric_id | string | 指标 ID |
| detected_at | timestamp | 检测时间 |
| actual_value | float | 实际值 |
| expected_value | float | 期望值 |
| deviation | float | 偏离程度（倍标准差）|
| severity | string | 严重度 (info/warning/critical) |
| status | string | 状态 (open/acknowledged/resolved) |

### DailySummary (每日摘要)

| 字段 | 类型 | 说明 |
|------|------|------|
| tenant_id | string | 租户 ID |
| summary_date | string | 日期 (YYYY-MM-DD) |
| health_score | int | 健康评分 (0-100) |
| content | json | 摘要内容 |

## 调度任务

### 每小时任务

- 执行时间：每小时整点
- 任务内容：
  1. 学习指标基线（7 天窗口）
  2. 检测当前值是否异常
  3. 如有异常，推送到 IM

### 每日摘要任务

- 执行时间：每天早上 9:00
- 任务内容：
  1. 汇总昨日异常
  2. 计算健康评分
  3. 推送到 IM

## 测试步骤

1. 启动后端服务：
```bash
cd backend
go run cmd/main.go
```

2. 运行测试脚本：
```bash
chmod +x test_monitoring.sh
./test_monitoring.sh
```

3. 配置 IM 平台（可选）：
   - 在前端界面配置钉钉/飞书/企微 Webhook
   - 获取平台 ID
   - 在异常检测时传入 platformIds

## 下一步优化

### Week 2 计划

1. **根因分析引擎** - 自动下钻找到异常原因
2. **每日摘要增强** - 添加核心指标速览、趋势预测
3. **降噪优化** - 业务日历、用户反馈闭环

### 未来方向

- 季节性分解算法（STL）
- 关联异常检测（多指标联动）
- AI 语义过滤（LLM 判断是否值得推送）
- 预测性预警（提前发现潜在问题）

## 技术栈

- **后端**: Go + GORM + PostgreSQL
- **调度**: 标准库 time.Ticker
- **推送**: 复用现有 IM 适配器（钉钉/飞书/企微）
- **算法**: 移动平均 + 2σ 阈值检测

## 常见问题

**Q: 为什么没有收到推送？**
A: 检查以下几点：
1. 是否配置了 IM 平台
2. platformIds 是否正确传入
3. 是否在 4 小时沉默期内（同一指标不重复推送）
4. 偏离程度是否 > 2σ

**Q: 如何调整异常阈值？**
A: 当前使用 2σ 作为 warning，3σ 作为 critical。可在 `anomaly_service.go` 中修改。

**Q: 如何添加新指标？**
A: 当前 MVP 使用硬编码的 "gmv" 指标。后续会集成语义层，自动发现所有可监控指标。
