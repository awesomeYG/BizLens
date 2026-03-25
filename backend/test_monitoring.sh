#!/bin/bash

# 业务健康监控 MVP 测试脚本

echo "=========================================="
echo "业务健康监控 MVP 端到端测试"
echo "=========================================="

BASE_URL="http://localhost:3001"
TENANT_ID="demo"

# 1. 健康检查
echo ""
echo "1. 健康检查..."
curl -s "$BASE_URL/api/health" | jq .

# 2. 手动触发异常检测
echo ""
echo "2. 手动触发异常检测（模拟 GMV 异常下降）..."
curl -s -X POST "$BASE_URL/api/tenants/$TENANT_ID/anomalies/detect" \
  -H "Content-Type: application/json" \
  -d '{
    "metricId": "gmv",
    "actualValue": 85000,
    "platformIds": []
  }' | jq .

# 3. 查询异常列表
echo ""
echo "3. 查询异常列表..."
curl -s "$BASE_URL/api/tenants/$TENANT_ID/anomalies?status=open" | jq .

echo ""
echo "=========================================="
echo "测试完成！"
echo "=========================================="
echo ""
echo "后续步骤："
echo "1. 配置 IM 平台（钉钉/飞书/企微）"
echo "2. 在异常检测时传入 platformIds 以接收推送"
echo "3. 等待每天早上 9 点自动发送每日摘要"
echo "4. 调度服务每小时自动执行基线学习和异常检测"
