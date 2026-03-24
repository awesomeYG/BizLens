# 统一数据源管理 -- 需求文档

> 版本: 1.0
> 日期: 2026-03-24
> 状态: 待评审

## 1. 背景

当前系统中"数据来源"被拆分为两个完全独立的模块：

| 维度 | 数据库数据源 | 文件上传 |
|------|------------|---------|
| 前端入口 | `/data-sources`（聊天页顶栏"数据源"按钮） | `/settings/files`（设置中心侧边栏） |
| 后端 API | `/api/tenants/{id}/data-sources/` | `/api/datasets/` |
| 数据模型 | `model.DataSource` | `model.UploadedDataset` |
| 认证方式 | 无认证（从 URL 取 tenantId） | JWT 认证 |
| 持久化 | 前端 localStorage + 后端 DB | 后端 DB |

用户需要在两个不同的页面之间来回切换管理数据来源，体验割裂。本需求将两者整合到统一的"数据源管理"模块下，通过 Tab 切换区分"数据库连接"和"上传文件"两种类型。

## 2. 术语表

| 术语 | 含义 |
|------|------|
| 数据源 (Data Source) | 系统中所有可供 AI 分析使用的数据来源的统称，包括数据库连接和上传文件 |
| 数据库连接 (Database Connection) | 通过 Host/Port/用户名/密码等连接远程数据库的数据源类型 |
| 上传文件 (Uploaded File / Dataset) | 用户手动上传的 CSV/Excel/JSON/XML 等文件型数据源 |
| 数据清洗 (Data Cleaning) | 对上传文件进行数据质量修正、格式统一等操作 |

## 3. 功能需求

### REQ-01: 统一数据源管理页面

**EARS 模式**: When 用户点击导航栏"数据源"入口, the system shall 展示统一的数据源管理页面，包含"数据库连接"和"上传文件"两个 Tab。

**验收标准**:
- AC-01-1: 页面路由为 `/data-sources`，取代原有的 `/data-sources` 和 `/settings/files` 两个独立页面
- AC-01-2: 页面顶部有两个 Tab："数据库连接"和"上传文件"，默认选中"数据库连接"
- AC-01-3: 两个 Tab 之间切换时，页面不刷新，状态保持（如正在填写的表单不丢失）
- AC-01-4: URL 通过 query 参数或 hash 反映当前 Tab 状态（如 `/data-sources?tab=files`），支持直接链接到指定 Tab

### REQ-02: 数据库连接 Tab 功能保持

**EARS 模式**: When 用户切换到"数据库连接" Tab, the system shall 展示与当前 `/data-sources` 页面一致的数据库数据源配置功能。

**验收标准**:
- AC-02-1: 保留左右双栏布局 -- 左侧"已保存数据源"列表，右侧"新增数据源"表单
- AC-02-2: 支持所有当前已支持的数据源类型（MySQL, PostgreSQL, SQLite, MongoDB, API 等）
- AC-02-3: 保留"测试连接"和"保存并继续添加"功能
- AC-02-4: 保留动态表单（根据数据源类型显示不同的配置字段）
- AC-02-5: 数据源列表从后端 API 获取（不再依赖 localStorage）

### REQ-03: 上传文件 Tab 功能保持

**EARS 模式**: When 用户切换到"上传文件" Tab, the system shall 展示与当前 `/settings/files` 页面一致的文件管理功能。

**验收标准**:
- AC-03-1: 保留统计概览卡片（文件总数、总存储体积、平均质量评分、处理中任务）
- AC-03-2: 保留拖拽上传区域，支持 xlsx/xls/csv/json/xml 格式
- AC-03-3: 保留文件列表表格（含文件信息、格式、大小、数据量、质量评分、状态、操作列）
- AC-03-4: 保留搜索和格式筛选功能
- AC-03-5: 保留删除确认弹窗

### REQ-04: 导航入口统一

**EARS 模式**: When 系统渲染任何包含导航的页面, the system shall 只提供一个"数据源"入口，指向统一的 `/data-sources` 页面。

**验收标准**:
- AC-04-1: 聊天页（`SimpleChatPanel`）顶部导航栏的"数据源"按钮指向 `/data-sources`（保持不变）
- AC-04-2: 设置中心侧边栏移除"文件管理"导航项
- AC-04-3: 浮动设置按钮（`FloatingSettingsButton`）改为指向 `/data-sources?tab=files`
- AC-04-4: 原 `/settings/files` 路由重定向到 `/data-sources?tab=files`

### REQ-05: 后端 API 路由统一

**EARS 模式**: The system shall 将文件数据集相关 API 归入数据源 API 路由命名空间下，统一认证方式为 JWT。

**验收标准**:
- AC-05-1: 原 `/api/datasets/*` 路由迁移到 `/api/tenants/{id}/data-sources/datasets/*` 或保留原路径但统一认证
- AC-05-2: 数据库数据源 API（`/api/tenants/{id}/data-sources/*`）增加 JWT 认证中间件
- AC-05-3: 所有数据源 API 统一从 JWT context 获取 tenantID 和 userID
- AC-05-4: 旧的 `/api/datasets/*` 路由保持兼容（302 重定向或代理转发），过渡期至少保留 1 个版本

### REQ-06: 数据清洗入口调整

**EARS 模式**: When 用户在"上传文件" Tab 查看文件列表, the system shall 在每个文件的操作列中提供"数据清洗"入口。

**验收标准**:
- AC-06-1: 文件列表操作列新增"清洗"按钮（仅状态为"可用"的文件显示）
- AC-06-2: 点击"清洗"按钮跳转到 `/data-sources/clean?dataset={id}`（保持现有清洗页面路由）

## 4. 非功能需求

### NFR-01: 向后兼容

- 旧路由（`/settings/files`、`/api/datasets/*`）须在过渡期内保持可访问
- localStorage 中已有的 `dataSources` 配置数据需迁移到后端数据库

### NFR-02: 性能

- Tab 切换响应时间不超过 100ms（客户端渲染，不发起新的网络请求）
- 文件列表加载时间不超过 2s（100 个文件以内）

### NFR-03: 视觉一致性

- 两个 Tab 的视觉风格保持统一，遵循现有的 zinc/indigo/cyan 暗色主题
- Tab 组件样式与项目中已有的筛选按钮风格保持一致

## 5. 影响范围

### 前端文件

| 文件 | 变更类型 |
|------|---------|
| `frontend/app/data-sources/page.tsx` | 重构 -- 改为 Tab 容器页面 |
| `frontend/app/settings/files/page.tsx` | 迁移 -- 内容移入 data-sources 页面的 Tab |
| `frontend/app/settings/layout.tsx` | 修改 -- 移除"文件管理"导航项 |
| `frontend/components/FloatingSettingsButton.tsx` | 修改 -- 链接改为 `/data-sources?tab=files` |
| `frontend/components/SimpleChatPanel.tsx` | 不变 -- "数据源"按钮已指向 `/data-sources` |
| `frontend/app/data-sources/clean/page.tsx` | 不变 -- 路由保持 |
| `frontend/app/api/datasets/*` | 可能修改 -- 代理路径调整 |

### 后端文件

| 文件 | 变更类型 |
|------|---------|
| `backend/cmd/main.go` | 修改 -- 路由注册调整，统一认证 |
| `backend/internal/handler/data_source_handler.go` | 修改 -- 增加 JWT 认证 |
| `backend/internal/handler/dataset_handler.go` | 可能修改 -- 路由前缀调整 |

## 6. 超出范围

- 数据库数据源与文件数据集的后端模型合并（保持 `DataSource` 和 `UploadedDataset` 两个独立模型）
- 新增数据源类型（如 S3、Google Sheets 等）
- 数据源权限管理（仅管理员可添加/删除等）
- 文件上传的分片上传 / 断点续传优化
