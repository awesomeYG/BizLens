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

### 用户输入快速配置数据源偏好
- Date: 2026-03-24
- Context: 用户在聊天页面希望通过指令自动配置数据源
- Instructions:
  - 当用户在聊天中输入“帮我配置下数据源 <postgres 连接串>”，应自动配置对应数据源
  - 需支持解析形如 `postgres://username:password@host:port/dbname` 的连接串
  - 数据源配置完成后应在聊天界面反馈成功/失败结果

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

### 报表模块架构
- Date: 2026-03-24
- Context: Agent 在执行报表功能完整实现时发现
- Category: 代码结构
- Instructions:
  - 后端模型：Report + ReportSection 在 backend/internal/model/model.go
  - 后端服务：backend/internal/service/report_service.go，支持完整 CRUD + 复制 + DTO 转换
  - 后端 Handler：backend/internal/handler/report_handler.go，统一入口 HandleReports 按路径分发
  - 后端路由：/api/tenants/{id}/reports[/{reportId}[/duplicate]]，注册在 main.go 的 tenantRouter 中
  - ReportSection 复用 DashboardSectionType 枚举，与大屏区块共用 SectionRenderer 渲染引擎
  - 前端页面：/reports（列表）、/reports/[id]（详情/查看）、/reports/create（创建/编辑，?edit=id 编辑模式）
  - 前端类型定义在 frontend/lib/types.ts：Report、ReportSection、CreateReportRequest、UpdateReportRequest
  - AI 对话中用户说"生成报表"时，AI 输出 report_config JSON 块，ChatPanel 自动解析并调用后端 API 创建
  - system prompt 在 frontend/app/api/chat/route.ts 中已添加 report_config 格式说明
  - 报表创建页使用 Suspense 包裹 useSearchParams（Next.js 15 要求）
### AI 对话自动执行模式（Action Blocks）
- Date: 2026-03-24
- Context: Agent 在执行 chat 数据源配置功能开发时发现
- Category: 代码模式
- Instructions:
  - AI 对话支持 4 种结构化 JSON 块：`dashboard_config`、`alert_config`、`notification_rule`、`datasource_config`
  - System Prompt 定义在 `frontend/app/api/chat/route.ts` 的 SYSTEM_PROMPT 常量中（第 8-185 行附近）
  - ChatPanel (`frontend/components/ChatPanel.tsx`) 在流式/非流式响应完成后依次调用 create*FromResponse 函数
  - SimpleChatPanel (`frontend/components/SimpleChatPanel.tsx`) 是简化版聊天，也支持 datasource_config 自动执行
  - 新增 action block 的标准流程：1) System Prompt 加引导格式 2) ChatPanel 加解析+API调用函数 3) 渲染时过滤 JSON 块 4) SimpleChatPanel 同步

### Onboarding 数据源非必填
- Date: 2026-03-24
- Context: 用户在调整新用户引导流程时明确说明
- Instructions:
  - onboarding 页面完成初始化时不应强制要求用户至少添加一个数据源
  - 数据源在引导流程中属于可选项，用户可稍后再去 `/data-sources` 补充

### 钉钉双向对话架构
- Date: 2026-03-25
- Context: Agent 在执行钉钉双向对话功能开发时发现
- Category: 代码结构
- Instructions:
  - 钉钉接收消息采用 Stream 模式（官方推荐，无需公网回调地址）
  - 使用官方 SDK：github.com/open-dingtalk/dingtalk-stream-sdk-go（依赖 gorilla/websocket）
  - Stream 客户端服务：backend/internal/service/dingtalk_stream_service.go，启动时自动建立 WebSocket 长连接到钉钉网关
  - Bot 处理服务：backend/internal/service/dingtalk_bot_service.go（复用），调用 Next.js /api/chat 获取 AI 回复
  - Secret 字段格式改为 `appKey:appSecret`（冒号分隔），来自钉钉企业内部应用
  - Stream 连接在 main.go 启动时异步建立，后端启动后自动连接所有已启用钉钉配置
  - IMConfig WebhookURL 仍用于主动发送通知，Secret 字段改为存 appKey:appSecret
  - AI 回复中的 action blocks 在发送到钉钉前会被自动剥离
  - 前端 SimpleChatPanel 增加了"给钉钉发句话"直接发送快捷指令（走 /api/tenants/{id}/notifications/send）
  - 前端 IMPlatformForm 钉钉配置增加了 Stream 模式提示和 AppKey:AppSecret 格式说明

### 禁止 notification_rule 自动 fallback 到钉钉偏好
- Date: 2026-03-27
- Context: 用户反馈 AI 在普通操作（如"生成个表单"）时会错误给钉钉发消息
- Instructions:
  - notification_rule 的 platformIds 为空时不得默认 fallback 到钉钉
  - notification_rule 示例中 platformIds 必须由用户明确指定，不得自行推断
  - 意图识别不得将纯文本通知类内容误判为 send_dingtalk（除非包含明确的钉钉目标词）
  - send_im_message 工具仅在发现数据异常时调用（如核心指标突然大幅偏离正常范围）
  - 禁止在普通数据分析、生成报表、生成大屏等常规操作中调用 send_im_message

### Chat 页面大屏自动生成偏好
- Date: 2026-03-25
- Context: 用户要求在 chat 页面对话即可直接生成可在数据大屏查看的大屏
- Instructions:
  - 当用户在 Chat 页面提出生成大屏需求时，应自动解析 `dashboard_config` 并创建大屏实例
  - 创建成功后应在对话中返回可直接跳转的 `/dashboards?id=<id>` 查看入口

### 根因分析引擎架构
- Date: 2026-03-25
- Context: Agent 在执行 Week 2 功能开发时发现
- Category: 代码结构
- Instructions:
  - 后端 RCA 服务：`backend/internal/service/rca_service.go`（~980 行），实现自动下钻分析
  - RCA 分析包含 4 个维度：维度下钻（DrillDown）、同比/环比对比（Comparisons）、关联指标分析（Correlations）、操作建议（Suggestions）
  - 使用皮尔逊相关系数计算关联指标，使用线性回归融合加权移动平均做趋势预测
  - RCA Handler 在 `backend/internal/handler/rca_handler.go`，API 端点：`/api/tenants/{id}/rca/analyze`
  - AI 对话中支持 `rca_request` JSON block 自动触发根因分析
  - ChatPanel 中新增 `executeRCAFromResponse` 函数处理 `rca_request` block

### 每日摘要增强架构
- Date: 2026-03-25
- Context: Agent 在执行 Week 2 功能开发时发现
- Category: 代码结构
- Instructions:
  - 后端服务：`backend/internal/service/daily_summary_service.go`（大幅增强，约 580 行）
  - 增强版摘要内容包含：健康评分、核心指标速览、异常告警、趋势描述、趋势预测（带历史序列）、变化最大的指标 Top Changes
  - 趋势预测使用线性回归 + 加权移动平均融合算法
  - 从真实数据源查询核心指标（`queryRealMetricSummaries`），遍历已确认/活跃的 Metric 配置
  - 每日摘要 Handler：`backend/internal/handler/daily_summary_handler.go`
  - API 端点：`GET /api/tenants/{id}/daily-summary`、`GET /api/tenants/{id}/daily-summary/latest`、`POST /api/tenants/{id}/daily-summary/generate`
  - 前端页面：`frontend/app/insights/page.tsx`，包含健康评分卡片、核心指标网格、Top Changes 表格、异常告警列表、趋势预测卡片（含迷你 sparkline）
  - 导航入口：`AppHeader` 中增加了 Insights 导航项

### 监控服务真实数据源集成
- Date: 2026-03-25
- Context: Agent 在执行 Week 2 功能开发时发现
- Category: 代码结构
- Instructions:
  - BaselineService（`baseline_service.go`）：改造 `fetchHistoricalValues` 从真实数据源查询每日数据，`LearnBaseline` 使用真实基线值，`QueryCurrentValue` 查询当前值
  - SchedulerService（`scheduler_service.go`）：改造为遍历所有租户的所有已确认/活跃指标（不再硬编码 demo），自动获取租户的 IM 平台 ID 用于异常通知推送
  - 使用延迟注入（SetDataDependencies）模式解决循环依赖问题
  - AnomalyService 中的 `DetectAnomaly` 自动使用 BaselineService 获取基线，结合实际值做偏离检测
  - 所有服务初始化完成后在 main.go 中调用 `SetDataDependencies` 注入依赖

### 统一告警与通知模块架构
- Date: 2026-03-26
- Context: Agent 在执行告警与通知模块合并重构时发现
- Category: 代码结构
- Instructions:
  - 后端统一 Handler：`backend/internal/handler/unified_alert_handler.go`
  - 合并了 AlertHandler 和 NotificationRuleHandler 的功能
  - AlertTriggerLog 模型增加了 sourceType 字段（quick_alert / auto_rule）
  - 统一路由：/api/tenants/{id}/alerts[?type=quick_alert|auto_rule]
  - 支持 toggle、trigger、parse-nl 等统一操作
  - 前端统一页面：/alerts，通过 Tab 区分"快速告警"和"自动规则"
  - 前端类型定义在 frontend/lib/im/types.ts：UnifiedAlertItem、UnifiedAlertCreateRequest
  - 旧的 /alerts/config 和 /im/rules 页面已改为重定向到 /alerts
  - 设计文档：.monkeycode/specs/unified-alert-notification/requirements.md

### 观测中心（业务健康监控）架构
- Date: 2026-03-26
- Context: Agent 在执行数据大屏重构时发现
- Category: 代码结构
- Instructions:
  - 大屏模块已重构为"业务健康观测中心"，对齐 product-direction-2026Q2.md 的"业务雷达站"定位
  - `/dashboards` 页面改为 Tab 布局：默认显示"观测中心"（原模板画廊降级为"我的看板"Tab）
  - 观测中心组件位于 `frontend/components/observability/`，包含：
    - HealthScoreCard（圆环进度条健康评分 + 趋势 Sparkline）
    - MetricKpiCard（增强版 KPI 卡片，含同比环比 + Sparkline + 异常状态边框）
    - AnomalyFeed（时间线布局异常事件，含展开详情 + 操作按钮）
    - InsightCarousel（水平滚动洞察卡片，正面/负面/中性分类）
    - DailySummarySection（可折叠摘要面板 + 历史列表）
    - OnboardingGuide（未配置数据源时的引导页）
    - ObservabilityCenter（主组件，组装所有子组件）
  - 后端新增统一 API Handler：`backend/internal/handler/observability_handler.go`
  - API 端点统一在 `/api/tenants/{id}/observability/*`：health-score、core-metrics、anomalies、insights、summaries、rca/analyze
  - 前端 API 封装：`frontend/lib/observability-api.ts`
  - 导航文案已更新："数据大屏" -> "观测中心"（AppHeader.tsx）
  - 设计文档：`.monkeycode/specs/dashboard-redesign-observability/`（requirements.md + design.md + tasklist.md）

### 授权码激活架构（SaaS 交付模式）
- Date: 2026-03-27
- Context: 用户要求以 SaaS 授权码模式交付产品，管理员凭授权码激活后自主管理用户
- Category: 架构
- Instructions:
  - BizLens 以授权码激活模式交付，不预设任何账号
  - 授权码通过环境变量 `LICENSE_KEY` 配置（必填），格式 `XXXX-XXXX-XXXX-XXXX`
  - 可选环境变量：`LICENSE_SEATS`（最大用户数）、`LICENSE_EXPIRES`（到期日期）
  - 激活流程：访问 `/auth/login` -> 检测到 `unactivated` -> 跳转 `/auth/activate` -> 输入授权码 + 管理员信息 -> 激活成功
  - 激活 API：`POST /api/auth/activate`，后端校验 `LICENSE_KEY` 环境变量
  - 登录接口响应增加 `unactivated` 字段，供前端判断是否跳转激活页
  - 测试/开发授权码：`TEST-BIZL-0000-0001`，配置在 `backend/.env.example` 和根目录 `.env.example` 中
  - `.env.example.local` 是开发本地配置模板，复制为 `.env.local` 后使用（已被 `.gitignore` 忽略）
  - `dev.sh` 启动脚本已更新：自动从 `.env.local` 加载环境变量，启动时显示测试授权码
  - 设计文档：`.monkeycode/specs/admin-management/`（requirements.md + design.md + tasklist.md）

### 前端启动与 Next 配置约定
- Date: 2026-03-31
- Context: Agent 在执行 forgot-password 页面修复与预览验证时发现
- Category: 构建方法
- Instructions:
  - 前端独立工程位于 `frontend/`，依赖安装与启动命令需在该目录执行
  - 前端开发启动命令：`cd /workspace/frontend && npm run dev`
  - 前端构建命令：`cd /workspace/frontend && npm run build`
  - 当前 Next.js 版本为 15.3.2，预览域名放行依赖 `allowedDevOrigins` 与 `experimental.serverActions.allowedOrigins`
  - `experimental.allowedHosts` 不受该版本 `NextConfig` 类型支持，加入后会导致 TypeScript 构建失败

### 密码重置邮件流程
- Date: 2026-03-31
- Context: Agent 在实现 forgot-password 真正邮件找回密码流程时发现
- Category: 代码结构
- Instructions:
  - 后端新增公开认证接口：`POST /api/auth/forgot-password`、`GET /api/auth/reset-password/validate`、`POST /api/auth/reset-password`
  - 密码重置令牌存储在 `backend/internal/model/model.go` 的 `PasswordResetToken` 表，数据库中只保存 token 的 SHA-256 哈希
  - 重置链接格式为 `APP_BASE_URL/auth/reset-password?token=...`，默认有效期 30 分钟，同一用户只保留最新一条未使用链接
  - 邮件发送由 `backend/internal/service/email_service.go` 负责，依赖环境变量 `SMTP_HOST`、`SMTP_PORT`、`SMTP_USER`、`SMTP_PASSWORD`、`SMTP_FROM`
  - 邮件内容采用 multipart/alternative，同时发送纯文本和 HTML 模板；587 端口优先尝试 STARTTLS，465 端口走 TLS 直连
  - 未配置 SMTP 时，后端在开发环境会把重置链接输出到日志，接口仍返回通用成功提示，避免暴露邮箱是否存在
  - 前端页面位于 `frontend/app/auth/forgot-password/page.tsx` 和 `frontend/app/auth/reset-password/page.tsx`

### AI Schema 分析依赖 AI 配置
- Date: 2026-03-31
- Context: Agent 在排查“数据库连接正常但 AI 分析失败”时发现
- Category: 代码模式
- Instructions:
  - 数据库连接成功只说明数据库凭据可用，不代表 AI 分析链路可用；Schema 分析还依赖租户级 `AIServiceConfig`
  - `backend/internal/service/ai_config_service.go` 在租户首次访问时会自动初始化 `openai + gpt-4o-mini` 配置，但不会自动写入 API Key
  - `backend/internal/service/schema_analysis_service.go` 的 Schema 分析最终通过 `LLMService.CallLLMJSON` 调用外部模型接口
  - 若未配置 API Key，AI 分析会失败；需要在 `frontend/app/settings/ai/page.tsx` 先保存 AI 配置后再执行 Schema 分析

### 弹窗交互偏好
- Date: 2026-03-31
- Context: 用户要求 AI 分析按钮的二次确认不要使用原生弹窗
- Instructions:
  - 交互中的二次确认弹窗优先使用项目内自定义 Modal/Dialog，不使用浏览器原生 `window.confirm`
