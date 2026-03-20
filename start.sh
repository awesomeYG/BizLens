#!/bin/bash

echo "=== AI BI 平台启动 ==="

# 启动 PostgreSQL
echo "[1/3] 启动 PostgreSQL..."
docker compose up -d postgres
echo "等待 PostgreSQL 就绪..."
sleep 3

# 启动 Go 后端
echo "[2/3] 启动 Go 后端 (端口 3001)..."
cd server && go run cmd/main.go &
BACKEND_PID=$!
cd ..
sleep 2

# 启动 Next.js 前端
echo "[3/3] 启动 Next.js 前端 (端口 3000)..."
npm run dev &
FRONTEND_PID=$!

echo ""
echo "=== 服务已启动 ==="
echo "前端: http://localhost:3000"
echo "后端: http://localhost:3001"
echo "按 Ctrl+C 停止所有服务"

trap "kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; docker compose down; exit" INT TERM
wait
