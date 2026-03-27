# 后台管理系统实施任务清单

> BizLens AI 数据分析平台 - 后台管理系统

## 任务总览

| Phase | 模块 | 任务数 | 预估工时 |
|-------|-----|-------|---------|
| 0 | 授权码激活 | 7 | 2h |
| 1 | 后台框架搭建 | 5 | 3h |
| 2 | 数据资产管理 | 8 | 6h |
| 3 | 用户管理 | 5 | 4h |
| 4 | 系统配置 | 3 | 2h |
| **合计** | | **28** | **~17h** |

---

## Phase 0: 授权码激活（优先）

- [ ] **T0.1** 后端配置：`LICENSE_KEY`（必填）、`LICENSE_SEATS`、`LICENSE_EXPIRES`，启动时校验为空报错
- [ ] **T0.2** 删除预设超管逻辑：移除 `EnsureAdminAccount` 与相关常量
- [ ] **T0.3** 新增 `POST /api/auth/activate`：授权码校验 + 创建 owner + 返回 JWT
- [ ] **T0.4** 登录接口增加 `unactivated` 字段：未激活时前端跳转激活页
- [ ] **T0.5** 前端新增 `/auth/activate` 页面：4段授权码输入 + 管理员信息表单 + 提交激活
- [ ] **T0.6** 前端登录页适配：收到 `unactivated` → redirect 激活页
- [ ] **T0.7** 频率限制：激活接口 5 分钟最多 5 次

---

## Phase 1: 后台框架搭建

### 1.1 前端 - 布局与权限
- [ ] **T1.1.1** `frontend/components/admin/AdminSidebar.tsx`
  - 定义导航（仪表盘/数据资产/用户管理/系统配置）
  - 高亮与折叠，移动端自适应
- [ ] **T1.1.2** `frontend/components/admin/AdminLayout.tsx`
  - 组合 AppHeader + AdminSidebar
  - AdminAuthGuard（仅 owner/admin）
- [ ] **T1.1.3** `frontend/app/admin/layout.tsx`
  - 使用 AdminLayout 包裹
- [ ] **T1.1.4** `frontend/components/AppHeader.tsx`
  - 插入"管理"菜单（仅 owner/admin 显示）
- [ ] **T1.1.5** `frontend/lib/admin/types.ts`
  - AdminStats、DatasetRow、DataSourceRow、UserRow、StorageConfig 等类型

### 1.2 后端 - Admin 框架
- [ ] **T1.2.1** `backend/internal/service/admin_service.go`
  - `GetStats()`：用户/文件/连接数、存储总量、最近文件
- [ ] **T1.2.2** `backend/internal/handler/admin_handler.go`
  - AdminAuth 中间件（JWT + role）
  - `GetStats` / `ListAllDatasets` / `ListAllDataSources`
- [ ] **T1.2.3** `backend/cmd/main.go`
  - 注册 `/api/admin/*` 路由组

### 1.3 前端 - 仪表盘
- [ ] **T1.3.1** `frontend/lib/admin/api.ts`：getStats/listDatasets/listDataSources
- [ ] **T1.3.2** `frontend/components/admin/AdminStats.tsx`
- [ ] **T1.3.3** `frontend/app/admin/page.tsx`

---

## Phase 2: 数据资产管理

### 2.1 文件管理
- [ ] **T2.1.1** `frontend/components/admin/FileTable.tsx`
  - 列：文件名、所属租户/或单租户隐藏、格式、大小、行数、时间、状态、操作
  - 筛选：格式、时间、搜索；批量删除；预览/下载/删除
- [ ] **T2.1.2** `frontend/app/admin/assets/files/page.tsx`

### 2.2 数据库管理
- [ ] **T2.2.1** `frontend/components/admin/DatabaseTable.tsx`
  - 列：名称、租户/单租户隐藏、类型、状态、最近同步、操作（测试/详情/删除）
- [ ] **T2.2.2** `frontend/app/admin/assets/databases/page.tsx`

### 2.3 存储配置
- [ ] **T2.3.1** `frontend/components/admin/StorageForm.tsx`
  - 本地/S3/MinIO 配置；存储统计；清理过期文件
- [ ] **T2.3.2** `frontend/app/admin/assets/storage/page.tsx`

### 2.4 后端扩展
- [ ] **T2.4.1** AdminHandler：测试连接、删除数据源、删除文件
- [ ] **T2.4.2** `backend/internal/service/storage_service.go`
- [ ] **T2.4.3** `backend/internal/model/model.go`：SystemConfig

---

## Phase 3: 用户管理（管理员自主运营）

- [ ] **T3.1** AdminService/AdminHandler：用户 CRUD、重置密码、启用/禁用
- [ ] **T3.2** `frontend/app/admin/users/page.tsx`：用户列表 + 搜索 + 分页
- [ ] **T3.3** `frontend/components/admin/UserTable.tsx` + `UserFormModal.tsx`
- [ ] **T3.4** 防护：不可删除自己，不可修改/删除 owner，重置密码明文仅返回一次
- [ ] **T3.5** （可选）邀请注册链接（受限于时间，可放入 Phase 4）

---

## Phase 4: 系统配置

- [ ] **T4.1** `frontend/app/admin/config/page.tsx`
  - AI 默认配置、通知配置、告警配置、数据保留策略、API 限流
- [ ] **T4.2** 后端 `PUT /api/admin/config/{category}`
- [ ] **T4.3** 后端 `GET /api/admin/config/{category}`

---

## 验收检查

| 检查项 | 说明 |
|-------|-----|
| 激活流程 | 未配置 LICENSE_KEY 启动失败；未激活时必须走授权码激活；激活成功后能登录 |
| 登录适配 | 登录接口返回 unactivated 时，前端正确跳转激活页 |
| 角色控制 | member 无法访问 /admin/*；owner/admin 可访问 |
| 用户管理 | owner/admin 可创建/编辑/重置/禁用用户，不能删除自己，不能降级/删除 owner |
| 数据资产 | 文件/数据库列表可用，筛选/分页/操作正常，敏感信息脱敏 |
| 系统配置 | 配置保存与读取正常，敏感字段不回显明文 |
| 性能 | 列表分页可用，接口响应 <2s（常规数据量） |
| 安全 | 激活接口有限频，密码不明文返回（重置除外一次性），license 必填 |
