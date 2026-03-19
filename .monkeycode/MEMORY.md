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

[新用户初始化数据使用 mock 数据]
- Date: 2026-03-19
- Context: 用户要求在填写新用户初始化数据时，先用 mock 假数据填进去
- Instructions:
  - 新用户初始化相关的数据填充，优先使用 mock 假数据

[产品定位：AI 对话为核心，大屏为辅]
- Date: 2026-03-19
- Context: 用户明确产品主要是和用户对话、做商业分析，大屏功能需要降低存在感
- Instructions:
  - AI 对话是产品核心功能，UI 中应突出对话入口
  - 数据大屏功能降低存在感，导航中用小字、不突出显示
  - 首页欢迎页只展示 AI 对话入口，不展示大屏入口

[钉钉通知事件功能]
- Date: 2026-03-19
- Context: 用户要求支持配置钉钉通知事件，用自然语言在对话中创建
- Instructions:
  - 支持用户在 AI 对话中用自然语言描述来创建通知规则
  - 通知规则管理放在 /settings 页面，入口低调
  - 通知规则存储在 localStorage，key 为 ai-bi-notification-rules
  - AI 返回通知指令时使用 NOTIFICATION_ACTION 标记包裹 JSON

[项目代码结构]
- Date: 2026-03-19
- Context: Agent 在执行钉钉通知功能开发时发现
- Category: 代码结构
- Instructions:
  - Next.js 15 App Router 项目，纯前端，数据存 localStorage
  - 类型定义在 lib/types.ts
  - 存储层模式：lib/xxx-store.ts，提供 CRUD 函数
  - 页面路由守卫：useEffect 中检查 getCurrentUser()?.isOnboarded，未初始化则 router.replace("/")
  - chat API 在无 OPENAI_API_KEY 时走 fallback 演示模式
  - ChatPanel 通过 sendToAI 函数与 /api/chat 交互，解析返回内容中的结构化指令
