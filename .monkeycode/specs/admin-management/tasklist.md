# 后台管理系统实施任务清单

> BizLens AI 数据分析平台 - 后台管理系统

## 任务总览

| Phase | 模块 | 任务数 | 预估工时 |
|-------|-----|-------|---------|
| 1 | 后台框架搭建 | 5 | 3h |
| 2 | 数据资产管理 | 8 | 6h |
| 3 | 租户管理 | 6 | 4h |
| 4 | 系统配置 | 3 | 2h |
| **合计** | | **22** | **~15h** |

---

## Phase 1: 后台框架搭建

### 1.1 前端 - 后台布局与权限

- [ ] **T1.1.1** 创建 `frontend/components/admin/AdminSidebar.tsx`
  - 定义 `ADMIN_SIDEBAR_NAV` 导航配置（4个一级菜单、8个二级菜单）
  - 实现侧边栏展开/折叠交互
  - 高亮当前激活项（基于 pathname）
  - 响应式：移动端自动折叠

- [ ] **T1.1.2** 创建 `frontend/components/admin/AdminLayout.tsx`
  - 组合 AppHeader + AdminSidebar
  - 注入管理专属导航项到 AppHeader
  - 包含 AdminAuthGuard 权限检查
  - 提供面包屑和页面标题插槽

- [ ] **T1.1.3** 创建 `frontend/app/admin/layout.tsx`
  - 使用 AdminLayout 包裹
  - 导出面包屑上下文

- [ ] **T1.1.4** 修改 `frontend/components/AppHeader.tsx`
  - 在默认导航项前插入"管理"菜单
  - 仅对 admin/owner 角色显示（从 localStorage 读取 user.role）
  - 管理菜单为下拉形式，包含：仪表盘、数据资产、租户管理、系统配置

- [ ] **T1.1.5** 创建 `frontend/lib/admin/types.ts`
  - 定义所有 Admin 相关的 TypeScript 类型
  - AdminStats、DatasetRow、DataSourceRow、TenantRow、UserRow、StorageConfig 等

### 1.2 后端 - Admin 框架

- [ ] **T1.2.1** 创建 `backend/internal/service/admin_service.go`
  - `GetStats()`：聚合统计（租户数、用户数、文件数、连接数、存储总量、7日活跃租户）
  - `ListAllDatasets(tenantID, fileFormat, page, pageSize)`：跨租户文件列表
  - `ListAllDataSources(tenantID, dbType, status, page, pageSize)`：跨租户数据库列表

- [ ] **T1.2.2** 创建 `backend/internal/handler/admin_handler.go`
  - 实现 `AdminAuth` 中间件（JWT + role 检查）
  - 实现所有 admin API Handler
  - `GetStats` → `service.GetStats()`
  - `ListAllDatasets` → `service.ListAllDatasets()`
  - `ListAllDataSources` → `service.ListAllDataSources()`
  - `TestDataSource` → 复用 `dataSourceService.TestConnection()`

- [ ] **T1.2.3** 修改 `backend/cmd/main.go`
  - 初始化 AdminHandler 和 AdminService
  - 注册 `/api/admin/` 路由组（统一 AdminAuth 中间件）

### 1.3 前端 - 仪表盘

- [ ] **T1.3.1** 创建 `frontend/lib/admin/api.ts`
  - 实现 `adminApi.getStats()` 函数
  - 实现 `adminApi.listDatasets()` 函数
  - 实现 `adminApi.listDataSources()` 函数

- [ ] **T1.3.2** 创建 `frontend/components/admin/AdminStats.tsx`
  - 4个 StatCard：租户总数、用户总数、文件总数、数据库连接总数
  - 每个卡片：图标 + 数值 + 标签 + 可选趋势指示
  - 悬停浮动效果

- [ ] **T1.3.3** 创建 `frontend/app/admin/page.tsx`（仪表盘页面）
  - 调用 `adminApi.getStats()`
  - 渲染 AdminStats 统计卡片（2x2 网格）
  - 最近文件列表（表格，5条）
  - 存储概览（格式分布柱状图）
  - 活跃租户（列表，7日内有操作的租户）

---

## Phase 2: 数据资产管理

### 2.1 文件管理

- [ ] **T2.1.1** 创建 `frontend/components/admin/FileTable.tsx`
  - 表格列：勾选框、文件名、所属租户、格式、文件大小、行数、上传时间、状态、操作
  - 筛选栏：租户下拉、文件格式下拉、搜索框、分页
  - 操作：预览（图片/PDF 弹窗）、下载、删除
  - 批量选择 + 批量删除
  - 删除确认弹窗（Modal）

- [ ] **T2.1.2** 创建 `frontend/app/admin/assets/files/page.tsx`
  - 布局：筛选栏 + FileTable + Pagination
  - URL 参数同步（tab、tenant、format、page）
  - 加载状态骨架屏

### 2.2 数据库管理

- [ ] **T2.2.1** 创建 `frontend/components/admin/DatabaseTable.tsx`
  - 表格列：名称、所属租户、类型、状态、最近同步、操作
  - 筛选栏：租户下拉、数据库类型下拉、连接状态筛选、搜索框、分页
  - 操作：测试连接（显示 loading -> 成功/失败图标）、查看详情弹窗、删除
  - 详情弹窗：展示完整连接信息（密码脱敏为 `****`）

- [ ] **T2.2.2** 创建 `frontend/app/admin/assets/databases/page.tsx`
  - 布局：筛选栏 + DatabaseTable + Pagination
  - URL 参数同步

### 2.3 存储配置

- [ ] **T2.3.1** 创建 `frontend/components/admin/StorageForm.tsx`
  - 存储类型切换：本地 / S3 / MinIO（Tab 或 Radio）
  - 本地配置：路径输入框
  - S3/MinIO 配置：Endpoint、AccessKey（密码输入）、SecretKey（密码输入）、Bucket、Region
  - 存储使用统计：各租户存储排行（表格 + 进度条）
  - 清理过期文件按钮 + 确认弹窗

- [ ] **T2.3.2** 创建 `frontend/app/admin/assets/storage/page.tsx`
  - 布局：StorageForm + 存储使用统计
  - 表单提交 + 清理操作

### 2.4 后端扩展

- [ ] **T2.4.1** 扩展 `backend/internal/handler/admin_handler.go`
  - `POST /api/admin/data-sources/{id}/test`：调用 dataSourceService 测试连接
  - `DELETE /api/admin/data-sources/{id}`：调用 dataSourceService.Delete
  - `DELETE /api/admin/datasets/{id}`：调用 datasetService.Delete

- [ ] **T2.4.2** 创建 `backend/internal/service/storage_service.go`
  - `GetStorageConfig()`：从 SystemConfig 表读取存储配置
  - `UpdateStorageConfig()`：更新存储配置到 SystemConfig 表
  - `GetStorageUsage()`：按租户统计文件存储量
  - `CleanupExpiredFiles(days)`：清理 N 天前的文件

- [ ] **T2.4.3** 修改 `backend/internal/model/model.go`
  - 新增 `SystemConfig` 模型

---

## Phase 3: 租户管理

### 3.1 租户列表

- [ ] **T3.1.1** 创建 `frontend/components/admin/TenantTable.tsx`
  - 表格列：租户名称、Plan 徽章、用户数、文件数、数据源数、创建时间、状态、操作
  - 行展开：显示关联汇总
  - 筛选栏：Plan 下拉、状态筛选、搜索框、分页
  - 操作：创建（弹窗表单）、编辑（弹窗表单）、切换 Plan、暂停/启用、删除

- [ ] **T3.1.2** 创建 `frontend/app/admin/tenants/page.tsx`
  - 布局：TenantTable + 创建弹窗
  - 创建/编辑弹窗：名称输入、Plan 选择（Radio）、备注（textarea）

### 3.2 用户管理

- [ ] **T3.2.1** 创建 `frontend/components/admin/UserTable.tsx`
  - 左侧租户筛选 + 右侧用户表格
  - 表格列：用户名、邮箱、角色徽章、所属租户、最后登录、状态、操作
  - 操作：创建（弹窗表单）、编辑角色（inline 或弹窗）、重置密码、禁用/启用、删除

- [ ] **T3.2.2** 创建 `frontend/app/admin/tenants/users/page.tsx`
  - 布局：UserTable
  - 创建用户弹窗：用户名、邮箱、初始密码、角色选择、所属租户选择

### 3.3 后端扩展

- [ ] **T3.3.1** 扩展 `backend/internal/handler/admin_handler.go`
  - `GET /api/admin/tenants`：租户列表（含关联统计）
  - `POST /api/admin/tenants`：创建租户
  - `GET/PUT/DELETE /api/admin/tenants/{id}`：租户 CRUD
  - `GET /api/admin/users`：用户列表（支持租户筛选）
  - `POST /api/admin/users`：创建用户
  - `GET/PUT/DELETE /api/admin/users/{id}`：用户 CRUD
  - `POST /api/admin/users/{id}/reset-password`：重置密码

- [ ] **T3.3.2** 扩展 `backend/internal/service/admin_service.go`
  - `ListTenants(page, pageSize)`：租户列表
  - `CreateTenant(data)`：创建租户（调用 authService）
  - `UpdateTenant(id, data)`：更新租户
  - `DeleteTenant(id)`：删除租户（软删除 + 关联数据清理）
  - `ListUsers(tenantID, page, pageSize)`：用户列表
  - `CreateUser(data)`：创建用户
  - `UpdateUser(id, data)`：更新用户
  - `DeleteUser(id)`：删除用户
  - `ResetUserPassword(id)`：重置密码

---

## Phase 4: 系统配置

- [ ] **T4.1** 创建 `frontend/app/admin/config/page.tsx`
  - 分区块配置表单：AI 默认配置、通知配置、告警配置、数据保留策略、API 限流
  - 各区块独立保存按钮
  - 调用对应的 admin API

- [ ] **T4.2** 后端 `PUT /api/admin/config/{category}`
  - 存储各分类配置到 SystemConfig 表

- [ ] **T4.3** 后端 `GET /api/admin/config/{category}`
  - 读取各分类配置

---

## 验收检查

每个 Phase 完成后对照以下检查项：

| 检查项 | 说明 |
|-------|-----|
| 路由可达 | `/admin/*` 页面正常加载 |
| 权限校验 | 非 admin 用户访问被拦截并重定向 |
| 数据正确 | API 返回数据与页面渲染一致 |
| 操作可用 | 所有 CRUD 操作正常工作 |
| 风格一致 | 页面风格与现有系统一致 |
| 响应式 | 侧边栏在移动端正常折叠 |
| 加载状态 | 列表加载中有骨架屏或 Loading |
| 错误处理 | API 失败时显示友好错误提示 |
| 确认弹窗 | 危险操作（删除）有二次确认 |
| 脱敏展示 | 敏感信息（如密码）不完整显示 |
