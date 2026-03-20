#!/bin/bash

echo "=== BizLens v3.0 启动脚本 ==="
echo ""

# 显示帮助信息
show_help() {
    echo "使用方法：./start.sh [选项]"
    echo ""
    echo "选项:"
    echo "  --dev         启动完整开发环境 (前端 + 后端 + 数据库) [默认]"
    echo "  --poc         仅运行 POC 测试"
    echo "  --db          仅启动数据库"
    echo "  --backend     仅启动后端"
    echo "  --frontend    仅启动前端"
    echo "  --help        显示帮助信息"
    echo ""
}

# 启动 PostgreSQL 数据库
start_database() {
    echo "[1/3] 启动 PostgreSQL 数据库..."
    
    # 检查 Docker 是否可用
    if ! command -v docker &> /dev/null; then
        echo "警告：Docker 未安装，跳过数据库启动"
        echo "请确保已设置 DATABASE_URL 环境变量或使用 SQLite"
        return 1
    fi
    
    # 检查容器是否已运行
    if docker ps | grep -q ai-bi-postgres; then
        echo "PostgreSQL 已在运行"
    else
        # 启动数据库容器
        cd /workspace
        docker-compose up -d
        
        # 等待数据库就绪
        echo "等待数据库初始化..."
        sleep 5
        
        # 检查数据库是否可连接
        for i in {1..10}; do
            if PGPASSWORD=postgres psql -h localhost -U postgres -d ai_bi -c "SELECT 1" &> /dev/null; then
                echo "PostgreSQL 已就绪"
                break
            fi
            echo "等待数据库启动... ($i/10)"
            sleep 2
        done
    fi
    
    cd /workspace
    return 0
}

# 启动 Go 后端
start_backend() {
    echo "[2/3] 启动 Go 后端 (端口 3001)..."
    
    # 检查 Go 是否安装
    if ! command -v go &> /dev/null; then
        echo "错误：Go 未安装"
        return 1
    fi
    
    # 进入后端目录
    cd /workspace/backend
    
    # 运行后端服务
    go run cmd/main.go &
    BACKEND_PID=$!
    
    cd /workspace
    
    # 等待后端启动
    sleep 3
    
    # 检查后端是否成功启动
    if kill -0 $BACKEND_PID 2>/dev/null; then
        echo "Go 后端已启动 (PID: $BACKEND_PID)"
        return 0
    else
        echo "错误：Go 后端启动失败"
        return 1
    fi
}

# 启动 Next.js 前端
start_frontend() {
    echo "[3/3] 启动 Next.js 前端 (端口 3000)..."
    
    # 检查 Node.js 是否安装
    if ! command -v node &> /dev/null; then
        echo "错误：Node.js 未安装"
        return 1
    fi
    
    # 进入前端目录
    cd /workspace/frontend
    
    # 检查 node_modules 是否存在
    if [ ! -d "node_modules" ]; then
        echo "安装前端依赖..."
        npm install
    fi
    
    # 运行前端开发服务器
    npm run dev &
    FRONTEND_PID=$!
    
    cd /workspace
    
    # 等待前端启动
    sleep 5
    
    # 检查前端是否成功启动
    if kill -0 $FRONTEND_PID 2>/dev/null; then
        echo "Next.js 前端已启动 (PID: $FRONTEND_PID)"
        return 0
    else
        echo "错误：Next.js 前端启动失败"
        return 1
    fi
}

# 运行 POC 测试
run_poc() {
    echo "=== 运行 POC 测试 ==="
    echo ""
    
    # 响应式引擎 POC
    if [ -d "/workspace/backend/pocs/reactive-engine" ]; then
        echo "1. 响应式引擎 POC"
        cd /workspace/backend/pocs/reactive-engine
        go run main.go
        echo ""
    fi
    
    # Pyodide 测试
    if [ -f "/workspace/backend/pocs/pyodide-test/index.html" ]; then
        echo "2. Pyodide 测试页面"
        echo "启动 HTTP 服务器..."
        cd /workspace/backend/pocs/pyodide-test
        python3 -m http.server 8080 &
        PYODIDE_PID=$!
        echo "访问：http://localhost:8080"
        echo "按 Ctrl+C 停止"
        wait $PYODIDE_PID
    fi
}

# 主逻辑
case "${1:-}" in
    --dev|"")
        echo "启动模式：完整开发环境"
        echo ""
        
        # 启动数据库
        start_database || true
        
        # 启动后端
        start_backend || true
        
        # 启动前端
        start_frontend || true
        
        echo ""
        echo "=== 服务已启动 ==="
        echo "前端：http://localhost:3000"
        echo "  - Notebook: http://localhost:3000/notebook"
        echo "  - Explore: http://localhost:3000/explore"
        echo "后端：http://localhost:3001"
        echo "数据库：localhost:5432 (postgres/postgres)"
        echo ""
        echo "按 Ctrl+C 停止所有服务"
        echo ""
        
        # 捕获退出信号
        trap "echo '停止所有服务...'; killall go npm 2>/dev/null; exit" INT TERM
        
        wait
        ;;
    
    --db)
        start_database
        ;;
    
    --backend)
        start_backend
        wait
        ;;
    
    --frontend)
        start_frontend
        wait
        ;;
    
    --poc)
        run_poc
        ;;
    
    --help)
        show_help
        ;;
    
    *)
        echo "错误：未知选项 '$1'"
        echo ""
        show_help
        exit 1
        ;;
esac
