# BizLens - AI 智能数据分析平台

> **让数据说话，让决策更智能**

BizLens 是一个 AI 驱动的商业智能 (BI) 数据分析平台，通过自然语言对话分析企业数据，自动监控关键指标并推送告警。

![Version](https://img.shields.io/badge/version-0.2.0-blue)

---

## ✨ 核心功能

### 🤖 AI 对话分析
上传数据文件，与 AI 对话获取商业洞察和决策建议。支持多种 AI 模型（OpenAI GPT-4、Claude、通义千问、文心一言）。

### 📊 数据源管理 🆕
直接连接 MySQL/PostgreSQL 数据库，或上传 CSV/Excel 文件。自动获取表结构，支持连接测试。

### 📈 智能告警
用自然语言配置数据监控规则，异常实时推送到钉钉/飞书/企业微信。

### 🖥️ 数据大屏
一键生成可视化大屏，支持多套模板和多 Tab 切换。

---

## 🚀 快速开始

### 环境要求
- Node.js 18+
- Go 1.21+
- PostgreSQL 16+ (或 SQLite 用于开发)

### 1. 安装依赖

**前端**:
```bash
cd frontend
npm install
```

**后端**:
```bash
cd backend
go mod tidy
```

### 2. 配置环境变量

创建 `.env.local` 文件：
```bash
# AI 服务配置（可选，也可在前端界面配置）
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4o-mini

# 数据库配置
DATABASE_URL=postgresql://user:password@localhost:5432/bizlens
# 或使用 SQLite（开发环境）
USE_SQLITE=true
```

### 3. 启动服务

**方式 1: 使用启动脚本**
```bash
./start.sh
```

**方式 2: 手动启动**

启动 PostgreSQL（Docker）:
```bash
docker-compose up -d
```

启动后端（端口 3001）:
```bash
cd backend
go run ./cmd/main.go
```

启动前端（端口 3000）:
```bash
npm run dev
```

### 4. 访问应用

打开浏览器访问：http://localhost:3000

---

## 📖 使用指南

### 快速上手
1. **登录**: 输入姓名和邮箱
2. **配置 AI** (推荐): 访问 `/settings/ai` 配置 API Key
3. **连接数据源**: 访问 `/data-sources` 连接数据库或上传 CSV
4. **开始分析**: 访问 `/chat` 与 AI 对话分析数据

### 示例对话
- "帮我分析销售趋势"
- "哪个产品利润率最高？"
- "生成一个数据大屏"
- "当库存低于 50 时通知我"

---

## 🏗️ 技术架构

### 前端
- **框架**: Next.js 15 (App Router)
- **语言**: TypeScript
- **样式**: Tailwind CSS
- **图表**: ECharts

### 后端
- **语言**: Go 1.21+
- **框架**: net/http
- **ORM**: GORM
- **数据库**: PostgreSQL / SQLite

---

## 📁 项目结构

```
bizlens/
├── frontend/                 # Next.js 前端应用
│   ├── app/                  # 页面组件
│   │   ├── api/              # API Routes
│   │   ├── chat/             # AI 对话
│   │   ├── dashboards/       # 数据大屏
│   │   ├── data-sources/     # 数据源管理
│   │   ├── alerts/           # 告警管理
│   │   └── settings/         # 设置页面
│   ├── components/           # React 组件
│   ├── lib/                  # 工具库
│   ├── package.json          # 前端依赖
│   └── next.config.ts        # Next.js 配置
├── backend/                  # Go 后端服务
│   ├── cmd/                  # 程序入口
│   ├── internal/             # 内部模块
│   │   ├── handler/          # HTTP 处理器
│   │   ├── service/          # 业务逻辑
│   │   ├── model/            # 数据模型
│   │   ├── config/           # 配置管理
│   │   ├── middleware/       # 中间件
│   │   └── im/               # IM 平台适配器
│   ├── go.mod                # Go 模块依赖
│   └── go.sum
├── docs/                     # 项目文档
├── scripts/                  # 工具脚本
├── docker-compose.yml        # Docker 配置
└── .monkeycode/              # 项目规范文档
```

---

## 🔧 开发

```bash
# 前端
cd frontend
npm install
npm run dev

# 后端
cd backend
go mod tidy
go run ./cmd/main.go
```

---

## 📚 文档

- [v0.2.0 发布说明](./.monkeycode/docs/v0.2.0-release.md)

---

## 🛣️ 路线图

### v0.2.0 (当前) ✅
- [x] 数据源连接器
- [x] AI 多模型支持
- [x] 数据源管理页面

### v0.3.0 (计划)
- [ ] SQL 查询编辑器
- [ ] 大屏拖拽编辑器
- [ ] 更多数据源类型

---

## 📄 许可证

MIT License

---

**BizLens - 让数据说话，让决策更智能**
