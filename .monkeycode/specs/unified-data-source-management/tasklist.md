# 统一数据源管理 -- 实施任务清单

> 版本: 1.0
> 日期: 2026-03-24

## 任务概览

总计 12 个任务，分为 4 个阶段。建议按阶段顺序执行，阶段内任务可适当并行。

---

## 阶段 1: 后端认证统一 (预计 2 个任务)

### TASK-01: 数据源 API 增加 JWT 认证中间件
- **文件**: `backend/cmd/main.go`
- **内容**:
  - 将 `/api/tenants/` 路由包裹到 `middleware.Auth(authService)` 中间件
  - 确保 tenant 路由下所有子路由（data-sources、alerts、im 等）都受 JWT 保护
- **验证**: 不带 token 访问 `/api/tenants/{id}/data-sources` 返回 401

### TASK-02: data_source_handler 认证方式适配
- **文件**: `backend/internal/handler/data_source_handler.go`
- **内容**:
  - 修改 `parseTenantID(r)` 函数，优先从 JWT context 获取 tenantID
  - fallback 到 URL path 解析（过渡兼容）
  - 新增 `parseUserID(r)` 函数从 JWT context 获取 userID
- **验证**: 携带 JWT token 访问数据源 API 正常返回数据

---

## 阶段 2: 前端组件提取 (预计 4 个任务)

### TASK-03: 提取 DatabaseConnectionTab 组件
- **新增文件**: `frontend/app/data-sources/components/DatabaseConnectionTab.tsx`
- **内容**:
  - 从 `data-sources/page.tsx` 提取数据库连接相关的状态、表单和逻辑
  - 改造数据获取：从 `getCurrentUser().dataSources` (localStorage) 改为调用 `GET /api/tenants/{id}/data-sources` (后端 API)
  - 改造数据保存：从 `saveOnboardingDraft(...)` 改为调用 `POST /api/tenants/{id}/data-sources` (后端 API)
  - 所有 API 调用携带 JWT token（`Authorization: Bearer xxx`）
- **验证**: 组件独立渲染正常，CRUD 操作通过后端 API 完成

### TASK-04: 提取 FileUploadTab 组件
- **新增文件**: `frontend/app/data-sources/components/FileUploadTab.tsx`
- **内容**:
  - 从 `settings/files/page.tsx` 迁移完整的文件管理逻辑
  - 调整导入路径（如 `@/lib/auth/api` 等）
  - 新增"清洗"操作按钮，在文件列表的操作列中（仅状态为可用的文件显示）
  - "清洗"按钮跳转到 `/data-sources/clean?dataset={id}`
- **验证**: 组件独立渲染正常，文件上传/列表/删除功能正常

### TASK-05: 重构 data-sources/page.tsx 为 Tab 容器
- **文件**: `frontend/app/data-sources/page.tsx`
- **内容**:
  - 清空原有内容，替换为 Tab 容器结构
  - 读取 URL `?tab=files` 参数设置默认 Tab
  - 使用 CSS `hidden` 控制 Tab 内容显隐，保持状态不丢失
  - 两个 Tab 同时挂载（`DatabaseConnectionTab` + `FileUploadTab`）
  - 添加统一的页面标题和 Tab 切换栏
  - 添加顶部导航栏（品牌、返回、AI 对话、智能告警等链接）
- **验证**: 页面渲染正常，Tab 切换流畅，表单状态不丢失

### TASK-06: localStorage 数据迁移逻辑
- **文件**: `frontend/app/data-sources/components/DatabaseConnectionTab.tsx`
- **内容**:
  - 组件挂载时检查 localStorage 中是否有旧的 `dataSources` 数据
  - 如果有，逐条调用后端 API 创建数据源
  - 迁移成功后清除 localStorage 中的 `dataSources` 字段
  - 迁移失败时显示提示，保留 localStorage 数据
- **验证**: 旧数据能成功迁移到后端，迁移后 localStorage 已清理

---

## 阶段 3: 导航与路由调整 (预计 4 个任务)

### TASK-07: 设置中心侧边栏移除"文件管理"
- **文件**: `frontend/app/settings/layout.tsx`
- **内容**:
  - 从 `SETTINGS_NAV` 数组中移除 `{ href: "/settings/files", ... }` 项
  - 如果 `SETTINGS_NAV` 只剩"AI 模型配置"一项，调整布局使其不显得空旷
- **验证**: 设置中心侧边栏不再显示"文件管理"

### TASK-08: 浮动设置按钮链接修改
- **文件**: `frontend/components/FloatingSettingsButton.tsx`
- **内容**:
  - 跳转目标从 `/settings/files` 改为 `/data-sources?tab=files`
  - 按钮图标和文案可考虑调整（如从"设置"改为"数据文件"）
- **验证**: 点击浮动按钮跳转到数据源页面的"上传文件" Tab

### TASK-09: settings/files 页面重定向
- **文件**: `frontend/app/settings/files/page.tsx`
- **内容**:
  - 清空原有内容，替换为重定向逻辑
  - 使用 `router.replace("/data-sources?tab=files")` 或 Next.js `redirect()`
- **验证**: 访问 `/settings/files` 自动跳转到 `/data-sources?tab=files`

### TASK-10: 验证聊天页导航不受影响
- **文件**: `frontend/components/SimpleChatPanel.tsx`
- **内容**:
  - 确认"数据源"按钮仍指向 `/data-sources`（预期不需要修改）
  - 确认 onboarding 页面中引用数据源的逻辑不受影响
- **验证**: 聊天页"数据源"按钮正常跳转

---

## 阶段 4: 验证与收尾 (预计 2 个任务)

### TASK-11: 端到端功能验证
- **内容**:
  - 验证完整的数据库连接配置流程：创建 -> 测试连接 -> 保存 -> 列表显示
  - 验证完整的文件上传流程：上传 -> 列表显示 -> 预览 -> 清洗 -> 删除
  - 验证 Tab 切换时表单状态保持
  - 验证旧路由 `/settings/files` 重定向正常
  - 验证未登录状态访问 `/data-sources` 跳转到登录页
  - 验证 onboarding 流程中"数据源"入口正常
- **验证**: 所有场景通过

### TASK-12: 前端构建验证
- **内容**:
  - 运行 `npm run build`，确保无 TypeScript 编译错误
  - 运行后端构建 `go build ./...`，确保无编译错误
  - 检查是否有遗留的未使用 import 或变量
- **验证**: 前后端构建通过，无警告
