# BizLens v3.0 快速启动指南

---

## 🚀 快速开始

### 方式 1: 启动完整开发环境（推荐）

```bash
# 一键启动所有服务 (数据库 + 后端 + 前端)
./start.sh
```

启动后访问:
- **前端**: http://localhost:3000
  - Notebook: http://localhost:3000/notebook
  - Explore: http://localhost:3000/explore
- **后端**: http://localhost:3001
- **数据库**: localhost:5432 (postgres/postgres)

### 方式 2: 单独启动服务

```bash
# 仅启动数据库
./start.sh --db

# 仅启动后端
./start.sh --backend

# 仅启动前端
./start.sh --frontend
```

### 方式 3: 运行 POC 测试

```bash
# 运行所有 POC 测试
./start.sh --poc
```

---

## 📋 完整启动流程

### 1. 启动 PostgreSQL 数据库

**使用 Docker (推荐)**:
```bash
docker-compose up -d
```

**手动安装 PostgreSQL**:
```bash
# 创建数据库
createdb ai_bi

# 设置密码
psql -d ai_bi -c "ALTER USER postgres WITH PASSWORD 'postgres';"
```

**验证连接**:
```bash
PGPASSWORD=postgres psql -h localhost -U postgres -d ai_bi -c "SELECT 1"
```

### 2. 初始化数据库 Schema

```bash
# 运行迁移脚本
psql -h localhost -U postgres -d ai_bi -f backend/pocs/semantic-layer-schema.sql
```

### 3. 启动后端服务

```bash
cd backend

# 方式 1: 使用 start.sh
./start.sh --backend

# 方式 2: 手动启动
go mod tidy
go run cmd/main.go
```

后端将在 http://localhost:3001 启动

### 4. 启动前端服务

```bash
cd frontend

# 方式 1: 使用 start.sh
./start.sh --frontend

# 方式 2: 手动启动
npm install
npm run dev
```

前端将在 http://localhost:3000 启动

---

## 🧪 运行 POC 测试

### 1. 响应式引擎 POC

```bash
cd backend/pocs/reactive-engine
go run main.go
```

**预期输出**:
```
=== BizLens v3.0 Reactive Engine POC ===

Adding cells to engine...

=== Running all cells ===
Execution order: [cell1 cell2 cell3 cell4]

--- Executing cell1 ---
Executing cell cell1 (sql):
  Code: SELECT * FROM orders WHERE created_at >= '2026-01-01'
...
```

### 2. Pyodide 测试

```bash
cd backend/pocs/pyodide-test
python3 -m http.server 8080
```

然后访问：http://localhost:8080

**测试内容**:
- Python 代码执行
- Pandas 库支持
- 跨单元格变量共享
- 输出捕获

---

## 🔧 故障排查

### 问题 1: 数据库连接失败

**错误**: `无法连接到 PostgreSQL`

**解决方案**:
```bash
# 1. 检查 Docker 容器
docker ps | grep postgres

# 2. 重启数据库
docker-compose down
docker-compose up -d

# 3. 等待数据库就绪
sleep 10

# 4. 验证连接
PGPASSWORD=postgres psql -h localhost -U postgres -d ai_bi -c "SELECT 1"
```

### 问题 2: 后端启动失败

**错误**: `package not found` 或 `build failed`

**解决方案**:
```bash
cd backend

# 1. 清理 Go 模块缓存
go clean -modcache

# 2. 重新下载依赖
go mod tidy

# 3. 重新构建
go build ./cmd/main.go

# 4. 重新启动
go run cmd/main.go
```

### 问题 3: 前端启动失败

**错误**: `npm ERR!` 或 `Module not found`

**解决方案**:
```bash
cd frontend

# 1. 删除 node_modules 和 lock 文件
rm -rf node_modules package-lock.json

# 2. 重新安装依赖
npm install

# 3. 清除 Next.js 缓存
rm -rf .next

# 4. 重新启动
npm run dev
```

### 问题 4: 端口被占用

**错误**: `Address already in use`

**解决方案**:
```bash
# 查找占用端口的进程
lsof -i :3000  # 前端
lsof -i :3001  # 后端

# 杀死占用端口的进程
kill -9 <PID>

# 或者使用其他端口
PORT=3002 npm run dev  # 前端
```

---

## 📖 start.sh 参数说明

| 参数 | 说明 | 示例 |
|------|------|------|
| `--dev` | 启动完整开发环境 (默认) | `./start.sh --dev` |
| `--db` | 仅启动数据库 | `./start.sh --db` |
| `--backend` | 仅启动后端 | `./start.sh --backend` |
| `--frontend` | 仅启动前端 | `./start.sh --frontend` |
| `--poc` | 运行 POC 测试 | `./start.sh --poc` |
| `--help` | 显示帮助信息 | `./start.sh --help` |

---

## 🎯 验证启动成功

### 1. 检查服务状态

```bash
# 检查数据库
docker ps | grep postgres

# 检查后端
curl http://localhost:3001/health

# 检查前端
curl http://localhost:3000
```

### 2. 访问页面

- **前端首页**: http://localhost:3000
- **Notebook 页面**: http://localhost:3000/notebook
- **Explore 页面**: http://localhost:3000/explore

### 3. 测试功能

**测试 Notebook**:
1. 访问 http://localhost:3000/notebook
2. 点击 "+ SQL" 添加单元格
3. 输入 `SELECT 1` 并运行
4. 应该看到输出结果

**测试 Explore**:
1. 访问 http://localhost:3000/explore
2. 输入问题 "本月 GMV 是多少？"
3. 点击 "提问"
4. 应该看到 AI 生成的 SQL 和结果

---

## 📝 环境变量配置

### 后端环境变量

创建 `backend/.env`:
```bash
# 数据库配置
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/ai_bi
USE_SQLITE=false

# AI 服务配置 (可选)
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4o-mini

# 服务配置
PORT=3001
ENV=development
```

### 前端环境变量

创建 `frontend/.env.local`:
```bash
# 后端 API 地址
NEXT_PUBLIC_API_URL=http://localhost:3001

# AI 服务配置 (可选，也可在前端界面配置)
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4o-mini
```

---

## 🎉 成功启动示例

```bash
$ ./start.sh

=== BizLens v3.0 启动脚本 ===

启动模式：完整开发环境

[1/3] 启动 PostgreSQL 数据库...
PostgreSQL 已就绪

[2/3] 启动 Go 后端 (端口 3001)...
Go 后端已启动 (PID: 12345)

[3/3] 启动 Next.js 前端 (端口 3000)...
Next.js 前端已启动 (PID: 67890)

=== 服务已启动 ===
前端：http://localhost:3000
  - Notebook: http://localhost:3000/notebook
  - Explore: http://localhost:3000/explore
后端：http://localhost:3001
数据库：localhost:5432 (postgres/postgres)

按 Ctrl+C 停止所有服务
```

---

## 📚 相关文档

- [v3.0 完整设计文档](./.monkeycode/docs/v3.0-complete-redesign.md)
- [技术架构设计](./.monkeycode/docs/v3.0-technical-architecture.md)
- [实施路线图](./.monkeycode/docs/v3.0-implementation-roadmap.md)
- [Phase 0 总结](./.monkeycode/docs/v3.0-phase0-summary.md)

---

**有问题？** 查看 [故障排查](#故障排查) 部分或提交 Issue。
