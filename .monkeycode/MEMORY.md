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

### 产品定位调整
- Date: 2026-03-20
- Context: 用户明确产品核心是 AI 对话 + 商业分析，大屏为辅助功能
- Instructions:
  - 产品核心功能是 AI 对话分析，大屏功能降低存在感（放到"更多"菜单中）
  - 智能告警是重要功能：支持用户在 AI 对话中用自然语言配置告警规则
  - 告警规则管理页面放在 /alerts/config，不要太显眼
  - AI 回复中包含 ```alert_config JSON 块时，ChatPanel 自动调用后端 API 创建告警
  - 首页主入口只保留"AI 对话"和"智能告警"两个大卡片

### 告警事件架构
- Date: 2026-03-20
- Context: Agent 在执行智能告警功能开发时发现
- Category: 代码结构
- Instructions:
  - 后端模型：AlertEvent（告警规则）+ AlertTriggerLog（触发记录）在 server/internal/model/model.go
  - 后端服务：server/internal/service/alert_service.go，支持 CRUD + 触发 + 通知发送
  - 后端路由：/api/tenants/{id}/alerts[/{eventId}[/trigger]] 和 /alerts/logs
  - 前端页面：/alerts（概览）、/alerts/config（规则管理）
  - AI 对话中的告警配置通过 chat API system prompt 引导 AI 输出 alert_config JSON
  - ChatPanel 自动解析 alert_config 块并调用后端创建告警

### 认证测试账号约定
- Date: 2026-03-23
- Context: Agent 在执行登录失败排查时发现
- Category: 测试方法
- Instructions:
  - 开发环境后端启动时会自动确保 `demo` 租户和测试账号 `test@example.com` 存在，默认密码为 `password123`
  - 前端登录流程必须先保存后端返回的 access token 和 refresh token，否则 `AuthGuard` 会将用户视为未登录

### 提交行为偏好
- Date: 2026-03-23
- Context: 用户先前要求默认不自动提交，后续在“图标遮挡修复”任务中更新偏好
- Instructions:
  - 默认不自动提交代码
  - 当用户在当前任务中明确要求“写完自动提交”时，任务完成后自动执行 commit

### 认证提示偏好
- Date: 2026-03-23
- Context: 用户在登录页错误提示优化时明确说明
- Instructions:
  - 登录页中“用户不存在”和“密码错误”应统一为更安全的通用提示，避免暴露账号是否存在

### 数据源入口偏好
- Date: 2026-03-23
- Context: 用户在统一 onboarding 与 data source 页面职责时明确说明
- Instructions:
  - 数据源填写应集中在 `frontend/app/data-sources/page.tsx`
  - onboarding 页面保留初始化流程，不再承载数据源填写表单

### SimpleChatPanel 布局调整
- Date: 2026-03-23
- Context: Agent 在处理聊天页头部粘性与内容遮挡问题时发现
- Category: 代码结构
- Instructions:
  - 聊天页面主容器设置 `overflow-auto` 以配合头部 `sticky` 固定，不影响整体滚动
  - SimpleChatPanel 的消息区域增加 `padding-top`，避免粘性头部遮挡首条消息
  - 头部保持 `top: 0` 粘性定位，消息列表滚动不再剪裁头部

### 数据集 API 认证模式
- Date: 2026-03-24
- Context: Agent 在执行文件上传功能修复时发现
- Category: 代码模式
- Instructions:
  - 数据集相关路由（/api/datasets/*）已统一使用 JWT 认证中间件（middleware.Auth），不再从 X-Tenant-ID/X-User-ID header 获取用户信息
  - handler 中通过 `getAuthInfo(r)` 从 request context 获取 tenantID 和 userID（由 JWT 中间件注入）
  - 前端 Next.js API Routes（/api/datasets, /api/datasets/upload/file）作为代理层，转发请求到 Go 后端 localhost:3001，保留 Authorization header
  - 前端上传/列表/删除请求需要从 localStorage 获取 token 并附加到 Authorization header
  - 上传文件在测试环境下临时存储在 `backend/uploads/` 目录（已加 .gitignore 忽略上传内容）
  - data-sources/clean/page.tsx 中仍存在硬编码的 X-Tenant-ID/X-User-ID，待后续统一修改

### 统一 AppHeader 组件
- Date: 2026-03-24
- Context: Agent 在执行 header 统一重构时发现
- Category: 代码模式
- Instructions:
  - 全站统一使用 `frontend/components/AppHeader.tsx` 作为顶部导航组件
  - AppHeader 基于 Chat 页面的 header 风格：毛玻璃背景、底部微光线、AI 头像、标准导航项
  - 支持 props：title, subtitle, backHref, backLabel, breadcrumb, actions, showNav, showLogout, showOnlineStatus, navItems
  - 默认导航项：AI 对话、数据源、报表、告警 + 集成（紫色按钮）+ 设置（齿轮图标）+ 退出
  - 当前路径自动高亮对应导航项（indigo 高亮样式）
  - 品牌名统一为 "BizLens"（之前首页用 "DataMind"、其他页面混用 "BizLens"/"AI BI"）

### 数据大屏模板引擎架构
- Date: 2026-03-24
- Context: Agent 在执行数据大屏模板重构时发现
- Category: 代码结构
- Instructions:
  - 模板配置定义在 `frontend/lib/dashboard-templates.ts`，包含 8 个行业预置模板 + 1 个自定义模板
  - 通用渲染引擎为 `frontend/components/dashboard/SectionRenderer.tsx`，根据 `section.type` 渲染对应图表
  - `DashboardView.tsx` 已重构为配置驱动，支持 3 种输入：template / sections / 旧版 config（向后兼容）
  - 泛化数据模型定义在 `frontend/lib/types.ts`：SectionData、KpiItem、SeriesData、PieItem、FunnelItem 等
  - 新增模板只需在 `dashboard-templates.ts` 中添加 JSON 配置，零代码
  - 支持的区块类型：kpi、line、area、bar、pie、funnel、ranking、gauge、table
  - AI 对话中用户说"生成大屏"时，AI 输出 `dashboard_config` JSON 块，ChatPanel 自动解析并内联预览
  - 旧的 `frontend/lib/templates.ts` 已改为重导出 `dashboard-templates.ts`，保持向后兼容

### 统一数据源管理模块
- Date: 2026-03-24
- Context: Agent 在执行数据源整合重构时发现
- Category: 代码结构
- Instructions:
  - 数据库数据源和文件上传已统一到 `/data-sources` 页面，使用 Tab 切换（数据库连接 / 上传文件）
  - 组件结构：`data-sources/page.tsx`（Tab 容器） -> `components/DatabaseConnectionTab.tsx` + `components/FileUploadTab.tsx`
  - Tab 使用 CSS `hidden` 控制显隐，保持两个 Tab 都挂载以避免状态丢失
  - 数据库数据源已改为通过后端 API (`/api/tenants/{id}/data-sources`) 管理，不再使用 localStorage
  - 首次加载时自动检测并迁移 localStorage 中的旧数据源到后端
  - `/settings/files` 已改为自动重定向到 `/data-sources?tab=files`
  - 所有 tenant 路由 (`/api/tenants/*`) 已统一使用 JWT 认证中间件
  - `parseTenantID` 优先从 JWT context 获取 tenantID，fallback 到 URL path 和 Header
