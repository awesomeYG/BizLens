#!/bin/bash

echo "=== AI BI 平台启动 ==="
echo ""
echo "注意：本脚本假设 PostgreSQL 已经运行。"
echo "如果没有数据库，请先安装并启动 PostgreSQL，然后执行："
echo "  docker compose up -d postgres  # 使用 Docker"
echo "或手动安装 PostgreSQL 并创建数据库 ai_bi"
echo ""

# 检查 PostgreSQL 是否可连接
if command -v psql &> /dev/null; then
    echo "检查 PostgreSQL 连接..."
    if PGPASSWORD=postgres psql -h localhost -U postgres -d ai_bi -c "SELECT 1" &> /dev/null; then
        echo "PostgreSQL 连接成功"
    else
        echo "警告：无法连接到 PostgreSQL，请确保数据库已启动"
        echo "继续启动可能会导致后端启动失败..."
        sleep 2
    fi
fi

# 启动 Go 后端
echo "[1/2] 启动 Go 后端 (端口 3001)..."
cd /workspace/server && go run cmd/main.go &
BACKEND_PID=$!
cd /workspace
sleep 3

# 启动 Next.js 前端
echo "[2/2] 启动 Next.js 前端 (端口 3000)..."
cd /workspace && npm run dev &
FRONTEND_PID=$!

echo ""
echo "=== 服务已启动 ==="
echo "前端：http://localhost:3000"
echo "后端：http://localhost:3001"
echo ""
echo "按 Ctrl+C 停止所有服务"
echo ""

trap "kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; exit" INT TERM
wait
