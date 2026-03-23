#!/bin/bash

# =============================================================================
# BizLens 开发环境一键启动脚本
# =============================================================================
# 使用方法：
#   ./dev.sh              # 启动完整开发环境（前端 + 后端 + SQLite）
#   ./dev.sh --postgres   # 使用 PostgreSQL（需要 Docker）
#   ./dev.sh --clean      # 清理并重新启动
#   ./dev.sh --stop       # 停止所有服务
#   ./dev.sh --help       # 显示帮助信息
# =============================================================================

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 项目根目录
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$PROJECT_ROOT"

# 日志函数
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# 显示帮助信息
show_help() {
    cat << EOF
BizLens 开发环境启动脚本

使用方法：./dev.sh [选项]

选项:
  (无)            启动完整开发环境（前端 + 后端 + SQLite）[默认]
  --postgres      使用 PostgreSQL 数据库（需要 Docker）
  --clean         清理缓存并重新启动
  --stop          停止所有服务
  --restart       重启所有服务
  --free-ports    释放被占用的端口（3000 和 3001）
  --help          显示此帮助信息

快速命令:
  ./dev.sh                    # 默认启动（SQLite 模式）
  ./dev.sh --postgres         # 使用 PostgreSQL
  ./dev.sh --stop             # 停止所有服务
  ./dev.sh --free-ports       # 仅释放被占用的端口
  Ctrl+C                      # 停止当前会话的所有服务

环境变量:
  可通过 .env.local 文件配置:
  - USE_SQLITE=true           # 使用 SQLite（默认）
  - USE_SQLITE=false          # 使用 PostgreSQL
  - SERVER_PORT=3001          # 后端端口
  - NEXT_PUBLIC_API_URL=...   # API 地址
EOF
}

# 检查依赖
check_dependencies() {
    log_info "检查依赖..."
    
    # 检查 Go
    if ! command -v go &> /dev/null; then
        log_error "Go 未安装，请安装 Go 1.21+"
        exit 1
    fi
    GO_VERSION=$(go version | awk '{print $3}')
    log_success "Go 已安装：$GO_VERSION"
    
    # 检查 Node.js
    if ! command -v node &> /dev/null; then
        log_error "Node.js 未安装，请安装 Node.js 18+"
        exit 1
    fi
    NODE_VERSION=$(node --version)
    log_success "Node.js 已安装：$NODE_VERSION"
    
    # 检查 npm
    if ! command -v npm &> /dev/null; then
        log_error "npm 未安装"
        exit 1
    fi
    NPM_VERSION=$(npm --version)
    log_success "npm 已安装：$NPM_VERSION"
    
    # 检查 Docker（可选）
    if command -v docker &> /dev/null; then
        log_success "Docker 已安装（可用于 PostgreSQL 模式）"
        HAS_DOCKER=true
    else
        log_warning "Docker 未安装，将使用 SQLite 模式"
        HAS_DOCKER=false
    fi
}

# 清理缓存
clean_cache() {
    log_info "清理缓存..."
    
    # 清理 Go 缓存
    if [ -d "$PROJECT_ROOT/backend" ]; then
        cd "$PROJECT_ROOT/backend"
        go clean -cache 2>/dev/null || true
        rm -rf bin/ 2>/dev/null || true
    fi
    
    # 清理 Next.js 缓存
    if [ -d "$PROJECT_ROOT/frontend" ]; then
        cd "$PROJECT_ROOT/frontend"
        rm -rf .next/ node_modules/ 2>/dev/null || true
    fi
    
    # 清理 SQLite 数据库（可选）
    if [ -f "/tmp/ai_bi.db" ]; then
        rm -f /tmp/ai_bi.db
        log_info "已清理 SQLite 数据库"
    fi
    
    log_success "清理完成"
}

# 启动 PostgreSQL（使用 Docker）
start_postgres() {
    log_info "启动 PostgreSQL 数据库..."
    
    if [ "$HAS_DOCKER" = false ]; then
        log_error "Docker 未安装，无法启动 PostgreSQL"
        exit 1
    fi
    
    # 检查容器是否已运行
    if docker ps | grep -q ai-bi-postgres; then
        log_success "PostgreSQL 已在运行"
        return 0
    fi
    
    # 启动数据库容器
    cd "$PROJECT_ROOT"
    docker-compose up -d
    
    # 等待数据库就绪
    log_info "等待数据库初始化..."
    for i in {1..15}; do
        if docker exec ai-bi-postgres pg_isready -U postgres &> /dev/null; then
            log_success "PostgreSQL 已就绪"
            return 0
        fi
        sleep 1
    done
    
    log_error "PostgreSQL 启动超时"
    exit 1
}

# 停止 PostgreSQL
stop_postgres() {
    log_info "停止 PostgreSQL..."
    cd "$PROJECT_ROOT"
    docker-compose down 2>/dev/null || true
    log_success "PostgreSQL 已停止"
}

# 检查端口是否被占用并清理
check_and_free_port() {
    local port=$1
    local service_name=$2
    
    if lsof -Pi :$port -sTCP:LISTEN -t >/dev/null 2>&1 ; then
        log_warning "$service_name 端口 $port 被占用，正在清理..."
        local pid=$(lsof -ti:$port 2>/dev/null | head -1)
        if [ -n "$pid" ]; then
            kill -9 $pid 2>/dev/null || true
            sleep 1
            log_success "已清理占用端口 $port 的进程 (PID: $pid)"
        fi
    fi
}

# 启动 Go 后端
start_backend() {
    log_info "启动 Go 后端..."
    
    cd "$PROJECT_ROOT/backend"
    
    # 检查依赖
    if ! [ -f "go.sum" ]; then
        log_info "安装 Go 依赖..."
        go mod download
    fi
    
    # 设置环境变量
    export USE_SQLITE="${USE_SQLITE:-true}"
    export SERVER_PORT="${SERVER_PORT:-3001}"
    
    if [ "$USE_SQLITE" = "true" ]; then
        log_info "数据库模式：SQLite"
    else
        log_info "数据库模式：PostgreSQL"
        export DB_HOST="${DB_HOST:-localhost}"
        export DB_PORT="${DB_PORT:-5432}"
        export DB_USER="${DB_USER:-postgres}"
        export DB_PASSWORD="${DB_PASSWORD:-postgres}"
        export DB_NAME="${DB_NAME:-ai_bi}"
        export DB_SSLMODE="${DB_SSLMODE:-disable}"
    fi
    
    # 检查并释放端口
    check_and_free_port $SERVER_PORT "后端服务"
    
    # 启动后端服务
    log_info "后端服务启动中..."
    go run cmd/main.go &
    BACKEND_PID=$!
    
    # 等待后端启动
    sleep 3
    
    # 检查是否成功启动
    if kill -0 $BACKEND_PID 2>/dev/null; then
        log_success "Go 后端已启动 (PID: $BACKEND_PID)"
        echo $BACKEND_PID > "$PROJECT_ROOT/.backend.pid"
        return 0
    else
        log_error "Go 后端启动失败"
        return 1
    fi
}

# 停止 Go 后端
stop_backend() {
    log_info "停止 Go 后端..."
    if [ -f "$PROJECT_ROOT/.backend.pid" ]; then
        kill $(cat "$PROJECT_ROOT/.backend.pid") 2>/dev/null || true
        rm -f "$PROJECT_ROOT/.backend.pid"
        log_success "Go 后端已停止"
    else
        pkill -f "go run cmd/main.go" 2>/dev/null || true
        log_success "Go 后端已停止"
    fi
    # 确保端口被释放
    sleep 1
}

# 启动 Next.js 前端
start_frontend() {
    log_info "启动 Next.js 前端..."
    
    cd "$PROJECT_ROOT/frontend"
    
    # 检查 node_modules
    if ! [ -d "node_modules" ]; then
        log_info "安装前端依赖（这可能需要几分钟）..."
        npm install
    fi
    
    # 检查并释放端口
    check_and_free_port 3000 "前端服务"
    
    # 启动前端服务
    log_info "前端服务启动中..."
    npm run dev &
    FRONTEND_PID=$!
    
    # 等待前端启动
    sleep 5
    
    # 检查是否成功启动
    if kill -0 $FRONTEND_PID 2>/dev/null; then
        log_success "Next.js 前端已启动 (PID: $FRONTEND_PID)"
        echo $FRONTEND_PID > "$PROJECT_ROOT/.frontend.pid"
        return 0
    else
        log_error "Next.js 前端启动失败"
        return 1
    fi
}

# 停止 Next.js 前端
stop_frontend() {
    log_info "停止 Next.js 前端..."
    if [ -f "$PROJECT_ROOT/.frontend.pid" ]; then
        kill $(cat "$PROJECT_ROOT/.frontend.pid") 2>/dev/null || true
        rm -f "$PROJECT_ROOT/.frontend.pid"
        log_success "Next.js 前端已停止"
    else
        pkill -f "next dev" 2>/dev/null || true
        log_success "Next.js 前端已停止"
    fi
    # 确保端口被释放
    sleep 1
}

# 停止所有服务
stop_all() {
    log_info "停止所有服务..."
    
    stop_frontend
    stop_backend
    
    if [ "$USE_POSTGRES" = true ]; then
        stop_postgres
    fi
    
    # 清理 PID 文件
    rm -f "$PROJECT_ROOT/.backend.pid" "$PROJECT_ROOT/.frontend.pid"
    
    # 额外清理：杀掉可能残留的进程
    pkill -f "go run cmd/main.go" 2>/dev/null || true
    pkill -f "next dev" 2>/dev/null || true
    
    # 等待端口释放
    sleep 2
    
    log_success "所有服务已停止"
}

# 启动所有服务
start_all() {
    echo ""
    echo "=========================================="
    echo "  BizLens 开发环境"
    echo "=========================================="
    echo ""
    
    # 先检查依赖
    check_dependencies
    
    # 选择数据库模式
    if [ "$USE_POSTGRES" = true ]; then
        USE_SQLITE=false
        start_postgres
    else
        USE_SQLITE=true
        log_info "使用 SQLite 数据库（文件：/tmp/ai_bi.db）"
    fi
    
    # 启动后端
    start_backend
    
    # 启动前端
    start_frontend
    
    echo ""
    echo "=========================================="
    echo "  服务已启动"
    echo "=========================================="
    echo ""
    echo -e "${GREEN}前端:${NC} http://localhost:3000"
    echo -e "${GREEN}后端:${NC} http://localhost:3001"
    if [ "$USE_SQLITE" = "true" ]; then
        echo -e "${GREEN}数据库:${NC} SQLite (/tmp/ai_bi.db)"
    else
        echo -e "${GREEN}数据库:${NC} PostgreSQL (localhost:5432)"
        echo -e "         用户：postgres / 密码：postgres"
    fi
    echo ""
    echo -e "${YELLOW}按 Ctrl+C 停止所有服务${NC}"
    echo ""
    
    # 捕获退出信号
    trap "echo ''; log_info '正在停止...'; stop_all; exit" INT TERM
}

# =============================================================================
# 主逻辑
# =============================================================================

# 解析参数
USE_POSTGRES=false

case "${1:-}" in
    --help)
        show_help
        exit 0
        ;;
    
    --stop)
        stop_all
        exit 0
        ;;
    
    --clean)
        clean_cache
        stop_all
        start_all
        exit 0
        ;;
    
    --restart)
        stop_all
        start_all
        exit 0
        ;;
    
    --free-ports)
        log_info "释放被占用的端口..."
        check_and_free_port 3000 "前端服务"
        check_and_free_port 3001 "后端服务"
        log_success "端口已释放"
        exit 0
        ;;
    
    --postgres)
        USE_POSTGRES=true
        export USE_SQLITE=false
        ;;
    
    "")
        # 默认模式，检查环境变量
        if grep -q "USE_SQLITE=false" "$PROJECT_ROOT/.env.local" 2>/dev/null; then
            USE_POSTGRES=true
        fi
        ;;
    
    *)
        log_error "未知选项：$1"
        show_help
        exit 1
        ;;
esac

# 启动服务
start_all
