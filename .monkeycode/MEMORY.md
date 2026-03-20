# 用户指令记忆

本文件记录了用户的指令、偏好和教导，用于在未来的交互中提供参考。

## 格式

### 用户指令条目
用户指令条目应遵循以下格式：

[用户指令摘要]
- Date: [YYYY-MM-DD]
- Context: [提及的场景或时间]
- Instructions:
  - [用户教导或指示的内容，逐行描述]

### 项目知识条目
Agent 在任务执行过程中发现的条目应遵循以下格式：

[项目知识摘要]
- Date: [YYYY-MM-DD]
- Context: Agent 在执行 [具体任务描述] 时发现
- Category: [代码结构|代码模式|代码生成|构建方法|测试方法|依赖关系|环境配置]
- Instructions:
  - [具体的知识点，逐行描述]

## 去重策略
- 添加新条目前，检查是否存在相似或相同的指令
- 若发现重复，跳过新条目或与已有条目合并
- 合并时，更新上下文或日期信息
- 这有助于避免冗余条目，保持记忆文件整洁

## 条目

### 用户技术偏好
- Date: 2026-03-20
- Context: 用户在讨论多 IM 平台接入功能时表达
- Instructions:
  - 用户是前端开发者，后端语言选择 Go
  - 项目需要有后端支撑，数据存数据库，不用 localStorage 做持久化
  - 需要为未来作为 SaaS 产品对外销售预留空间（多租户架构）
  - UI 要规整漂亮，考虑多平台扩展性

### 项目架构
- Date: 2026-03-20
- Context: Agent 在执行多 IM 平台接入功能开发时发现
- Category: 代码结构
- Instructions:
  - 前端: Next.js 15 (App Router) + React 19 + Tailwind CSS + ECharts
  - 后端: Go (net/http + gorm + PostgreSQL)，位于 /server 目录
  - 前端通过 next.config.ts rewrites 反向代理 /api/tenants/* 到 Go 后端 :3001
  - 前端自身的 API Routes (/api/chat, /api/parse-data, /api/company-profile) 保留在 Next.js 中
  - 数据库使用 Docker Compose 启动 PostgreSQL 16

### 构建方法
- Date: 2026-03-20
- Context: Agent 在执行构建验证时发现
- Category: 构建方法
- Instructions:
  - 前端构建: cd /workspace && npm run build
  - 后端构建: cd /workspace/server && go build ./...
  - 前端依赖安装: npm install
  - 后端依赖安装: cd /workspace/server && go mod tidy
  - 启动脚本: ./start.sh (启动 PostgreSQL + Go 后端 + Next.js 前端)

### IM 平台适配器模式
- Date: 2026-03-20
- Context: Agent 在执行多 IM 平台接入功能开发时发现
- Category: 代码模式
- Instructions:
  - IM 适配器接口定义在 server/internal/im/adapter.go
  - 每个平台实现 Adapter 接口 (Send + Test 方法)
  - 新增平台只需: 1) 在 im/ 下新增适配器文件 2) 在 factory.go 注册 3) 前端 registry.ts 添加元信息
  - 前端 lib/im/ 只保留类型定义和 UI 展示用的平台元信息，不含业务逻辑
