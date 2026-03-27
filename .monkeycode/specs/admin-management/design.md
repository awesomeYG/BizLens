# 后台管理系统技术设计文档

> BizLens AI 数据分析平台 - 后台管理系统

## 1. 技术架构概览

### 1.1 整体架构

```
┌─────────────────────────────────────────────────────────┐
│                    Browser                               │
│  ┌──────────────────────────────────────────────────┐   │
│  │  Next.js Frontend (frontend/)                    │   │
│  │  ├── /admin/*     → 后台管理页面                 │   │
│  │  ├── /settings/*  → 用户设置页面（已存在）       │   │
│  │  ├── /chat/*      → AI 对话页面（已存在）         │   │
│  │  └── /api/*       → Next.js API Routes           │   │
│  └───────────────────────┬──────────────────────────┘   │
│                          │                              │
│  next.config.ts rewrites│ /api/* → localhost:3001      │
│                          ▼                              │
│  ┌──────────────────────────────────────────────────┐   │
│  │  Go Backend (backend/)                            │   │
│  │  ├── /api/admin/*   → 后台管理 API（新）          │   │
│  │  ├── /api/tenants/* → 租户级 API（已存在）        │   │
│  │  ├── /api/datasets/* → 数据集 API（已存在）       │   │
│  │  └── /api/auth/*   → 认证 API（已存在）           │   │
│  └──────────────────────────────────────────────────┘   │
│                          │                              │
│                          ▼                              │
│  ┌──────────────────────────────────────────────────┐   │
│  │  PostgreSQL 16 / SQLite                           │   │
│  │  ├── tenants, users (已存在)                      │   │
│  │  ├── data_sources (已存在)                        │   │
│  │  ├── uploaded_datasets (已存在)                  │   │
│  │  └── system_config (新增：存储配置、系统参数)     │   │
│  └──────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
```

### 1.2 设计原则

1. **复用优先**：前端复用全部现有 CSS/组件，后端复用现有 Service 层
2. **渐进增强**：Admin 功能在现有系统上叠加，不破坏已有功能
3. **统一风格**：后台管理使用与主站一致的深色主题和组件风格
4. **安全隔离**：admin API 严格权限校验，多租户数据完全隔离

---

## 2. 前端架构设计

### 2.1 目录结构

```
frontend/app/
├── admin/                          # 后台管理（新）
│   ├── layout.tsx                   # AdminLayout - 侧边导航 + 权限守卫
│   ├── page.tsx                     # 仪表盘 /admin
│   ├── assets/
│   │   ├── page.tsx                 # 数据资产总览
│   │   ├── files/page.tsx           # 文件管理
│   │   ├── databases/page.tsx       # 数据库管理
│   │   └── storage/page.tsx         # 存储配置
│   ├── tenants/
│   │   ├── page.tsx                 # 租户列表
│   │   └── users/page.tsx           # 用户管理
│   └── config/
│       └── page.tsx                 # 系统配置
│
frontend/components/admin/           # 后台管理专用组件（新）
│   ├── AdminLayout.tsx              # 后台侧边导航布局
│   ├── AdminSidebar.tsx             # 侧边导航栏
│   ├── AdminStats.tsx               # 统计卡片
│   ├── FileTable.tsx                # 文件管理表格
│   ├── DatabaseTable.tsx            # 数据库连接表格
│   ├── TenantTable.tsx               # 租户管理表格
│   ├── UserTable.tsx                # 用户管理表格
│   └── StorageForm.tsx              # 存储配置表单
│
frontend/lib/admin/
│   └── api.ts                       # 后台 API 封装（新增）
```

### 2.2 AdminLayout 组件设计

```typescript
// frontend/components/admin/AdminLayout.tsx

// 复用现有 AppHeader，但通过 navItems 注入管理专属导航
// 后台侧边栏独立设计，支持展开/折叠

interface AdminLayoutProps {
  children: React.ReactNode;
  // 当前激活的一级/二级导航路径
  activePath: string;
}

// 侧边导航数据结构
const ADMIN_SIDEBAR_NAV = [
  {
    label: "仪表盘",
    icon: "M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6",
    href: "/admin",
  },
  {
    label: "数据资产",
    icon: "M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4",
    children: [
      { label: "文件管理", href: "/admin/assets/files" },
      { label: "数据库", href: "/admin/assets/databases" },
      { label: "存储配置", href: "/admin/assets/storage" },
    ],
  },
  {
    label: "租户管理",
    icon: "M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4",
    children: [
      { label: "租户列表", href: "/admin/tenants" },
      { label: "用户管理", href: "/admin/tenants/users" },
    ],
  },
  {
    label: "系统配置",
    icon: "M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z",
    href: "/admin/config",
  },
];
```

### 2.3 权限守卫

```typescript
// 复用现有的 AuthGuard 模式，在 AdminLayout 中注入

// frontend/components/admin/AdminAuthGuard.tsx
// 在每个 /admin/* 页面加载时检查：
// 1. localStorage 中有 token
// 2. 当前用户 role 为 'admin' 或 'owner'
// 若不满足，重定向到 /chat 并显示 toast 提示

import { getCurrentUser } from "@/lib/user-store";

function AdminAuthGuard({ children }: { children: React.ReactNode }) {
  const user = getCurrentUser();
  if (!user || (user.role !== "admin" && user.role !== "owner")) {
    // 重定向到首页
    return null; // 或使用 router.push
  }
  return <>{children}</>;
}
```

### 2.4 样式复用策略

| 现有资产 | 复用方式 |
|---------|---------|
| `globals.css` | 全站共享，继续使用 |
| `.glass-card` | 后台管理卡片使用 `glass-card rounded-xl` |
| `.btn-primary` / `.btn-secondary` | 直接使用 |
| `.badge-*` | 直接使用 |
| `.input-base` | 直接使用 |
| Tailwind 工具类 | 直接使用 |
| 现有动画类 | 直接使用 |
| **不新增** | 不新增 CSS 变量、工具类 |

后台管理页面仅在 `globals.css` 末尾追加少量管理后台专属工具类（如果需要的话）。

---

## 3. 后端 API 设计

### 3.1 API 路由总览

所有 admin API 统一前缀 `/api/admin/`，需 JWT 认证 + admin 角色校验。

| 方法 | 路径 | 功能 |
|-----|-----|-----|
| GET | `/api/admin/stats` | 系统统计（仪表盘） |
| **数据集** | | |
| GET | `/api/admin/datasets` | 所有租户文件列表（支持分页、筛选） |
| DELETE | `/api/admin/datasets/{id}` | 删除指定文件 |
| **数据源** | | |
| GET | `/api/admin/data-sources` | 所有租户数据库连接列表 |
| POST | `/api/admin/data-sources/{id}/test` | 测试指定数据源连接 |
| DELETE | `/api/admin/data-sources/{id}` | 删除指定数据源 |
| **租户** | | |
| GET | `/api/admin/tenants` | 租户列表 |
| POST | `/api/admin/tenants` | 创建租户 |
| GET | `/api/admin/tenants/{id}` | 获取租户详情 |
| PUT | `/api/admin/tenants/{id}` | 更新租户 |
| DELETE | `/api/admin/tenants/{id}` | 删除租户 |
| **用户** | | |
| GET | `/api/admin/users` | 用户列表（支持租户筛选） |
| POST | `/api/admin/users` | 创建用户 |
| PUT | `/api/admin/users/{id}` | 更新用户（角色等） |
| DELETE | `/api/admin/users/{id}` | 删除用户 |
| POST | `/api/admin/users/{id}/reset-password` | 重置密码 |
| **存储配置** | | |
| GET | `/api/admin/storage/config` | 获取存储配置 |
| PUT | `/api/admin/storage/config` | 更新存储配置 |
| GET | `/api/admin/storage/usage` | 各租户存储使用量 |
| POST | `/api/admin/storage/cleanup` | 清理过期文件 |

### 3.2 Admin Handler 设计

```go
// backend/internal/handler/admin_handler.go（新文件）

type AdminHandler struct {
    authService         *service.AuthService
    dataSourceService   *service.DataSourceService
    datasetService      *service.DatasetService
    storageService      *service.StorageService  // 新增
}

func NewAdminHandler(...) *AdminHandler

// AdminAuth 中间件：在 JWT 认证基础上额外检查 role == "admin"
func AdminAuth(authService *service.AuthService) func(http.Handler) http.Handler {
    return func(next http.Handler) http.Handler {
        return middleware.Auth(authService)(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
            role := r.Context().Value("userRole").(string)
            if role != "admin" {
                writeError(w, http.StatusForbidden, "需要管理员权限")
                return
            }
            next.ServeHTTP(w, r)
        }))
    }
}

// GET /api/admin/stats
func (h *AdminHandler) GetStats(w http.ResponseWriter, r *http.Request)
// GET /api/admin/datasets
func (h *AdminHandler) ListAllDatasets(w http.ResponseWriter, r *http.Request)
// GET /api/admin/data-sources
func (h *AdminHandler) ListAllDataSources(w http.ResponseWriter, r *http.Request)
// GET /api/admin/tenants
func (h *AdminHandler) ListTenants(w http.ResponseWriter, r *http.Request)
// POST /api/admin/tenants
func (h *AdminHandler) CreateTenant(w http.ResponseWriter, r *http.Request)
// GET /api/admin/users
func (h *AdminHandler) ListUsers(w http.ResponseWriter, r *http.Request)
// GET /api/admin/storage/config
func (h *AdminHandler) GetStorageConfig(w http.ResponseWriter, r *http.Request)
// PUT /api/admin/storage/config
func (h *AdminHandler) UpdateStorageConfig(w http.ResponseWriter, r *http.Request)
```

### 3.3 Storage Service 设计

```go
// backend/internal/service/storage_service.go（新文件）

type StorageService struct {
    db *gorm.DB
    // 配置项（可从数据库 SystemConfig 或环境变量读取）
    storageType string // "local" | "s3" | "minio"
    localPath   string
    s3Config    S3Config
}

type SystemConfig struct {
    ID        string `gorm:"type:varchar(50);primaryKey"`
    Key       string `gorm:"size:100;uniqueIndex;not null"`
    Value     string `gorm:"type:text"`
    UpdatedAt time.Time
}

// StorageUsage 租户存储使用量
type StorageUsage struct {
    TenantID    string
    TenantName  string
    TotalSize   int64
    FileCount   int
}
```

### 3.4 后端路由注册

```go
// backend/cmd/main.go 中新增

// Admin Handler
adminHandler := handler.NewAdminHandler(authService, dataSourceService, datasetService, storageService)

// Admin 路由组：/api/admin/*
// 所有路由都需要 Auth + admin 角色
adminRouter := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
    path := strings.TrimPrefix(r.URL.Path, "/api/admin/")

    switch {
    // stats
    case path == "stats" && r.Method == http.MethodGet:
        adminHandler.GetStats(w, r)
        return
    // datasets
    case path == "datasets" && r.Method == http.MethodGet:
        adminHandler.ListAllDatasets(w, r)
        return
    // storage
    case path == "storage/config" && r.Method == http.MethodGet:
        adminHandler.GetStorageConfig(w, r)
        return
    // ... 其他路由
    default:
        http.NotFound(w, r)
    }
})

mux.Handle("/api/admin/", adminRouter)
```

注意：前端 Next.js `next.config.ts` 的 rewrites 只代理 `/api/` 到后端，所以 admin API 不需要额外配置 rewrite。

### 3.5 前端 API 封装

```typescript
// frontend/lib/admin/api.ts（新文件）

import { getAccessToken } from "./auth/api";

const BASE = "/api/admin";

async function request<T>(
  path: string,
  options?: RequestInit
): Promise<T> {
  const token = getAccessToken();
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...options?.headers,
    },
  });
  if (!res.ok) {
    throw new Error(await res.text());
  }
  return res.json();
}

// API 函数
export const adminApi = {
  // 统计
  getStats: () => request<AdminStats>("/stats"),

  // 数据集
  listDatasets: (params?: DatasetListParams) =>
    request<DatasetListResponse>(`/datasets?${new URLSearchParams(params as any)}`),
  deleteDataset: (id: string) => request<void>(`/datasets/${id}`, { method: "DELETE" }),

  // 数据源
  listDataSources: (params?: DataSourceListParams) =>
    request<DataSourceListResponse>(`/data-sources?${new URLSearchParams(params as any)}`),
  testDataSource: (id: string) =>
    request<ConnectionTestResult>(`/data-sources/${id}/test`, { method: "POST" }),
  deleteDataSource: (id: string) =>
    request<void>(`/data-sources/${id}`, { method: "DELETE" }),

  // 租户
  listTenants: (params?: TenantListParams) =>
    request<TenantListResponse>(`/tenants?${new URLSearchParams(params as any)}`),
  createTenant: (data: CreateTenantRequest) =>
    request<Tenant>(`/tenants`, { method: "POST", body: JSON.stringify(data) }),
  updateTenant: (id: string, data: UpdateTenantRequest) =>
    request<Tenant>(`/tenants/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  deleteTenant: (id: string) => request<void>(`/tenants/${id}`, { method: "DELETE" }),

  // 用户
  listUsers: (params?: UserListParams) =>
    request<UserListResponse>(`/users?${new URLSearchParams(params as any)}`),
  createUser: (data: CreateUserRequest) =>
    request<User>(`/users`, { method: "POST", body: JSON.stringify(data) }),
  updateUser: (id: string, data: UpdateUserRequest) =>
    request<User>(`/users/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  deleteUser: (id: string) => request<void>(`/users/${id}`, { method: "DELETE" }),
  resetUserPassword: (id: string) => request<{ password: string }>(`/users/${id}/reset-password`, { method: "POST" }),

  // 存储
  getStorageConfig: () => request<StorageConfig>("/storage/config"),
  updateStorageConfig: (data: StorageConfig) =>
    request<StorageConfig>("/storage/config", { method: "PUT", body: JSON.stringify(data) }),
  getStorageUsage: () => request<StorageUsage[]>("/storage/usage"),
  cleanupStorage: (olderThanDays: number) =>
    request<CleanupResult>("/storage/cleanup", { method: "POST", body: JSON.stringify({ olderThanDays }) }),
};
```

---

## 4. 页面详细设计

### 4.1 仪表盘（/admin）

**组件结构：**
```
AdminDashboard
├── StatCard[]              # 4个统计卡片（租户数/用户数/文件数/连接数）
├── RecentFilesSection       # 最近文件列表
├── StorageOverviewSection    # 存储概览（饼图）
└── ActiveTenantsSection      # 活跃租户趋势
```

**数据流：** `page.tsx` -> `adminApi.getStats()` -> 渲染统计卡片

### 4.2 文件管理（/admin/assets/files）

**组件结构：**
```
FileManagementPage
├── FilterBar               # 筛选栏（租户下拉、类型下拉、时间范围）
├── FileTable               # 表格（复用 DataTable 模式）
│   ├── Checkbox 批量选择
│   ├── TenantCell         # 显示所属租户
│   ├── FileSizeCell       # 格式化文件大小
│   ├── StatusCell         # 状态徽章
│   └── ActionCell         # 预览/下载/删除
└── Pagination             # 分页器
```

**表格字段：**
| 字段 | 类型 | 说明 |
|-----|-----|-----|
| checkbox | Selection | 批量选择 |
| name | Text | 文件名 |
| tenant | Badge | 所属租户名 |
| format | Badge | 格式（excel/csv） |
| size | Text | 格式化大小 |
| rows | Number | 行数 |
| uploadedAt | Date | 上传时间 |
| status | Badge | 状态 |
| actions | Actions | 操作按钮 |

### 4.3 数据库管理（/admin/assets/databases）

**表格字段：**
| 字段 | 类型 | 说明 |
|-----|-----|-----|
| name | Text | 连接名称 |
| tenant | Badge | 所属租户 |
| type | Badge | 数据库类型 |
| status | Badge | 连接状态（connected/disconnected/error） |
| lastSync | Date | 最近同步时间 |
| actions | Actions | 测试/详情/删除 |

### 4.4 存储配置（/admin/assets/storage）

使用表单布局，支持动态切换：
- 本地存储：仅显示路径字段
- S3/MinIO：显示 Endpoint、AccessKey、SecretKey、Bucket、Region

### 4.5 租户列表（/admin/tenants）

表格 + 展开详情（显示关联的用户数、文件数、数据源数）

### 4.6 用户管理（/admin/tenants/users）

左侧租户筛选 + 右侧用户表格

---

## 5. 数据模型

### 5.1 新增模型

```go
// backend/internal/model/model.go 中新增

// SystemConfig 系统级配置（Key-Value）
type SystemConfig struct {
    ID        string    `gorm:"type:varchar(50);primaryKey" json:"id"`
    Key       string    `gorm:"size:100;uniqueIndex;not null" json:"key"`
    Value     string    `gorm:"type:text" json:"value"`
    Category  string    `gorm:"size:50;default:'storage'" json:"category"` // storage/ai/alert/retention
    UpdatedAt time.Time `json:"updatedAt"`
}

// AdminStats 系统统计（聚合数据，非持久化）
type AdminStats struct {
    TotalTenants     int64            `json:"totalTenants"`
    TotalUsers       int64            `json:"totalUsers"`
    TotalDatasets    int64            `json:"totalDatasets"`
    TotalDataSources int64            `json:"totalDataSources"`
    TotalStorageSize int64            `json:"totalStorageSize"`
    ActiveTenants7d  int64            `json:"activeTenants7d"`  // 7日内活跃租户数
    RecentDatasets    []DatasetSummary `json:"recentDatasets"`   // 最近上传
    StorageByFormat   map[string]int64 `json:"storageByFormat"` // 按格式统计
}

type DatasetSummary struct {
    ID          string `json:"id"`
    Name        string `json:"name"`
    FileName    string `json:"fileName"`
    TenantID    string `json:"tenantId"`
    FileSize    int64  `json:"fileSize"`
    FileFormat  string `json:"fileFormat"`
    CreatedAt   string `json:"createdAt"`
}
```

### 5.2 已有模型复用

| 模型 | 所在文件 | 复用方式 |
|-----|---------|---------|
| Tenant | model/model.go | Admin API 直接查询 |
| User | model/model.go | Admin API 直接查询 |
| DataSource | model/model.go | 复用 List/CRUD |
| UploadedDataset | model/dataset.go | 复用 + admin 列表扩展 |

---

## 6. 安全设计

### 6.1 权限模型

```
角色层级：
- admin    → 可访问全部 /admin/* 功能
- owner    → 可访问其所属租户的 /admin/* 功能（受限视图）
- member   → 不可访问 /admin/*

路由守卫：
1. 前端：AdminLayout 中检查 localStorage token + user.role
2. 后端：每个 admin API 都经过 AdminAuth 中间件校验 role
```

### 6.2 数据安全

1. **敏感信息脱敏**：前端 API 响应中的密码/API Key 显示为 `***`，后端返回前脱敏
2. **删除保护**：删除租户/数据源需二次确认，删除前检查关联数据
3. **审计日志**：记录 admin 操作到 `admin_audit_logs` 表（扩展设计）

---

## 7. 依赖与扩展点

### 7.1 复用点

| 现有模块 | 复用内容 |
|---------|---------|
| `FileUploadTab.tsx` | 上传组件复用（admin 文件管理不需上传，只看） |
| `DatabaseConnectionTab.tsx` | 连接表单 + 测试逻辑 |
| `data_source_service.go` | `ListDataSources`、`TestConnection`、`Delete` |
| `dataset_service.go` | `ListDatasets`、`Delete` |
| `globals.css` | 所有样式 |
| `AppHeader` | 复用扩展管理入口 |

### 7.2 扩展点

1. **文件预览**：图片/PDF 使用 iframe 或第三方预览组件
2. **批量操作**：文件删除、数据源删除支持批量
3. **审计日志**：记录所有 admin 操作
4. **通知**：admin 操作后可向相关租户发送通知

---

## 8. 实现顺序建议

### Phase 1：框架 + 仪表盘
1. `AdminLayout.tsx` + `AdminSidebar.tsx`
2. AppHeader 管理入口注入
3. Admin 权限守卫
4. 后端 `AdminHandler` + `/api/admin/stats`
5. `/admin` 仪表盘页面

### Phase 2：数据资产管理
6. 后端 `GET /api/admin/datasets` + `/api/admin/data-sources`
7. `/admin/assets/files` 文件管理页面
8. `/admin/assets/databases` 数据库管理页面
9. `/admin/assets/storage` 存储配置页面

### Phase 3：租户管理
10. 后端租户 CRUD API
11. `/admin/tenants` 页面
12. 后端用户 CRUD API
13. `/admin/tenants/users` 页面

### Phase 4：系统配置
14. `/admin/config` 各配置区块

---

## 9. 文件清单

### 前端新增文件
```
frontend/components/admin/
  AdminLayout.tsx              (~120行)  后台侧边栏布局 + 权限守卫
  AdminSidebar.tsx             (~150行)  侧边导航组件
  AdminStats.tsx               (~60行)   统计卡片组件
  FileTable.tsx                (~200行)  文件管理表格
  DatabaseTable.tsx            (~180行)  数据库连接表格
  TenantTable.tsx              (~150行)  租户管理表格
  UserTable.tsx                (~150行)  用户管理表格
  StorageForm.tsx              (~120行)  存储配置表单

frontend/app/admin/
  layout.tsx                  (~30行)   调用 AdminLayout
  page.tsx                    (~80行)   仪表盘
  assets/
    page.tsx                  (~40行)   数据资产汇总（重定向到 files）
    files/page.tsx            (~100行)  文件管理
    databases/page.tsx        (~100行)  数据库管理
    storage/page.tsx          (~100行)  存储配置
  tenants/
    page.tsx                  (~100行)  租户列表
    users/page.tsx            (~100行)  用户管理
  config/
    page.tsx                  (~100行)  系统配置

frontend/lib/admin/
  api.ts                      (~120行)  Admin API 封装
  types.ts                   (~80行)   Admin 相关 TypeScript 类型
```

### 后端新增/修改文件
```
backend/internal/
  handler/
    admin_handler.go          (~400行)  Admin Handler（新增）
    admin_handler_test.go     (~100行)  单元测试（可选）

  service/
    storage_service.go       (~200行)  存储服务（新增）
    admin_service.go         (~200行)  Admin 聚合统计服务（新增）

  model/
    model.go                  (+SystemConfig + AdminStats DTO)

  cmd/main.go                 (+Admin 路由注册 ~20行)
```
