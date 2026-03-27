# BizLens 后台管理系统 - 技术设计文档

> 版本：v1.0.0
> 日期：2026-03-27
> 状态：草稿

## 1. 技术架构概览

### 1.1 技术栈

沿用现有 BizLens 技术栈，不引入额外依赖：

| 层级 | 技术 | 说明 |
|------|------|------|
| 前端框架 | Next.js 15 (App Router) | React 19, TypeScript |
| 样式方案 | Tailwind CSS + CSS Variables | 沿用现有 `globals.css` 设计系统 |
| 图表库 | ECharts | 沿用，用于仪表盘统计图 |
| 后端 | Go net/http + GORM | 沿用，不引入新框架 |
| 数据库 | PostgreSQL / SQLite | 沿用 |
| 认证 | JWT | 沿用 `/api/admin/*` 统一 JWT 中间件 |

### 1.2 架构决策

**前后端分离 + 同域部署**：Admin UI 作为 Next.js 的 `/admin` 路由，与主产品共享同一域名和部署环境，通过 Next.js API Routes 作为代理层转发到 Go 后端。

**API 路由前缀**：`/api/admin/*`（已确定，不变）

**样式复用策略**：
- 全局组件类（glass-card, btn-primary, input-base, badge 等）直接在 `globals.css` 中复用
- Admin 专用组件放在 `frontend/components/admin/` 目录
- 页面级别组件放在各自 `page.tsx` 中（无跨页面复用需求时）

---

## 2. 目录结构

### 2.1 前端目录结构

```
frontend/
├── app/
│   ├── admin/
│   │   ├── layout.tsx                  # AdminRootLayout: AdminLayout + AdminHeaderNav
│   │   ├── page.tsx                    # 仪表盘 (增强版)
│   │   ├── users/
│   │   │   └── page.tsx                # 用户管理 (完善版)
│   │   ├── assets/
│   │   │   ├── files/page.tsx         # 文件管理 (完善版)
│   │   │   ├── databases/page.tsx      # 数据库管理 (完善版)
│   │   │   └── storage/page.tsx       # 存储配置 (对接 API)
│   │   ├── config/
│   │   │   ├── page.tsx               # 系统配置概览
│   │   │   ├── ai/page.tsx            # AI 模型配置
│   │   │   ├── alerts/page.tsx         # 告警配置
│   │   │   ├── notifications/page.tsx  # 通知渠道
│   │   │   └── retention/page.tsx      # 数据保留策略
│   │   └── logs/
│   │       └── page.tsx               # 操作日志
│   │
│   └── api/admin/                      # Next.js API Routes 代理层
│       ├── stats/route.ts              # GET /api/admin/stats
│       ├── users/route.ts             # GET/POST /api/admin/users
│       ├── users/[id]/route.ts        # PUT/DELETE /api/admin/users/{id}
│       ├── users/[id]/reset-password/route.ts
│       ├── users/[id]/toggle/route.ts
│       ├── datasets/route.ts           # GET/DELETE /api/admin/datasets
│       ├── data-sources/route.ts      # GET/DELETE /api/admin/data-sources
│       ├── data-sources/[id]/test/route.ts
│       ├── config/route.ts             # GET/PUT /api/admin/config
│       └── logs/route.ts              # GET /api/admin/logs
│
├── components/admin/                   # Admin 专用组件
│   ├── AdminLayout.tsx                # 主布局 (侧边栏 + 权限校验)
│   ├── AdminSidebar.tsx               # 侧边栏导航 (独立导出，供复用)
│   ├── AdminHeaderNav.tsx             # 顶部标签导航
│   ├── AdminBreadcrumb.tsx            # 面包屑导航 (新增)
│   ├── AdminStats.tsx                 # 仪表盘统计卡片
│   ├── AdminDashboard.tsx             # 仪表盘增强组件
│   ├── UserTable.tsx                  # 用户管理表格 (抽取自 users/page.tsx)
│   ├── UserFormModal.tsx              # 添加/编辑用户弹窗
│   ├── UserDetailPanel.tsx            # 用户详情侧滑面板
│   ├── FileTable.tsx                  # 文件管理表格 (抽取自 files/page.tsx)
│   ├── DatabaseTable.tsx              # 数据库连接表格 (抽取自 databases/page.tsx)
│   ├── StorageForm.tsx                # 存储配置表单
│   ├── ConfigSection.tsx              # 配置区块组件
│   ├── LogTable.tsx                   # 操作日志表格
│   ├── Toast.tsx                      # Toast 提示组件
│   └── shared/                        # 共享 Admin 组件
│       ├── AdminPageHeader.tsx        # 统一页面标题组件
│       ├── AdminToolbar.tsx           # 统一工具栏组件
│       ├── AdminTable.tsx             # 统一表格封装
│       ├── ConfirmModal.tsx           # 确认模态框
│       ├── EmptyState.tsx            # 空状态组件
│       ├── LoadingSkeleton.tsx        # 加载骨架屏
│       └── PagePagination.tsx         # 分页组件
│
└── lib/admin/
    ├── api.ts                         # Admin API 封装 (已有，待扩展)
    ├── types.ts                       # Admin 类型定义 (待新增)
    └── utils.ts                       # Admin 工具函数 (待新增)
```

### 2.2 后端目录结构（新增/变更）

```
backend/
├── internal/
│   ├── model/
│   │   ├── model.go                   # 追加: SystemConfig, AdminLog 模型
│   │   └── dataset.go
│   │
│   ├── dto/
│   │   └── admin_dto.go               # Admin 相关 DTO (新增)
│   │
│   ├── service/
│   │   ├── admin_service.go          # Admin Service (新增，整合统计/配置/日志)
│   │   └── admin_log_service.go      # Admin 操作日志 Service (新增)
│   │
│   ├── handler/
│   │   ├── admin_handler.go          # 已有，待扩展
│   │   └── admin_log_handler.go      # 操作日志 Handler (新增)
│   │
│   └── middleware/
│       └── admin_auth.go             # Admin 认证中间件 (可选封装，已有通用 Auth 中间件)
│
└── cmd/
    └── main.go                        # Admin 路由注册 (追加新路由)
```

---

## 3. 页面路由设计

### 3.1 路由总览

| 前端路由 | 页面名称 | 后端 API | 说明 |
|---------|---------|----------|------|
| `/admin` | 仪表盘 | `GET /api/admin/stats` | 增强版，含图表 |
| `/admin/users` | 用户管理 | `GET/POST /api/admin/users` | 完善版，含编辑 |
| `/admin/users/{id}` | - | `PUT/DELETE /api/admin/users/{id}` | 编辑/删除 |
| `/admin/users/{id}/reset-password` | - | `POST .../reset-password` | 重置密码 |
| `/admin/users/{id}/toggle` | - | `POST .../toggle` | 启禁用 |
| `/admin/assets/files` | 文件管理 | `GET/DELETE /api/admin/datasets` | 完善版 |
| `/admin/assets/databases` | 数据库连接 | `GET/DELETE /api/admin/data-sources` | 完善版 |
| `/admin/assets/storage` | 存储配置 | `GET/PUT /api/admin/storage` | 对接 API |
| `/admin/config` | 系统配置 | `GET/PUT /api/admin/config` | 对接 API |
| `/admin/config/ai` | AI 模型配置 | - | 前端路由，后端同一 API |
| `/admin/config/alerts` | 告警配置 | - | 前端路由，后端同一 API |
| `/admin/config/notifications` | 通知渠道 | - | 前端路由，后端同一 API |
| `/admin/config/retention` | 数据保留策略 | - | 前端路由，后端同一 API |
| `/admin/logs` | 操作日志 | `GET /api/admin/logs` | 新增 |

### 3.2 权限守卫

所有 `/admin/*` 路由通过 Next.js Middleware 进行前端守卫：

```typescript
// frontend/middleware.ts

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  
  if (pathname.startsWith('/admin')) {
    const token = getAccessTokenFromCookie(request);
    
    if (!token) {
      return NextResponse.redirect(new URL('/auth/login', request.url));
    }
    
    // 解析 token 中的 role
    const role = getRoleFromToken(token);
    if (role !== 'admin' && role !== 'owner') {
      return NextResponse.redirect(new URL('/chat', request.url));
    }
  }
  
  return NextResponse.next();
}
```

---

## 4. API 设计

### 4.1 现有 API（保持不变）

| 方法 | 路径 | 功能 |
|------|------|------|
| GET | `/api/admin/stats` | 系统统计（增强：增加趋势数据） |
| GET | `/api/admin/users` | 用户列表 |
| POST | `/api/admin/users` | 创建用户 |
| PUT | `/api/admin/users/{id}` | 更新用户 |
| DELETE | `/api/admin/users/{id}` | 删除用户 |
| POST | `/api/admin/users/{id}/reset-password` | 重置密码 |
| POST | `/api/admin/users/{id}/toggle` | 启禁用 |
| GET | `/api/admin/datasets` | 文件列表 |
| DELETE | `/api/admin/datasets/{id}` | 删除文件 |
| GET | `/api/admin/data-sources` | 数据源列表 |
| POST | `/api/admin/data-sources/{id}/test` | 测试连接 |
| DELETE | `/api/admin/data-sources/{id}` | 删除数据源 |

### 4.2 新增 API

#### 4.2.1 系统配置

```
GET /api/admin/config
```
响应：
```json
{
  "ai_model": "gpt-4o-mini",
  "ai_temperature": 0.7,
  "alert_cooldown_minutes": 5,
  "default_notification_channel": "dingtalk",
  "file_retention_days": 90,
  "alert_log_retention_days": 30,
  "default_user_role": "member",
  "session_timeout_hours": 24
}
```

```
PUT /api/admin/config
```
请求体：`{ "ai_model": "gpt-4o", "ai_temperature": 0.8, ... }`（部分更新）

#### 4.2.2 存储配置

```
GET /api/admin/storage
```
响应：
```json
{
  "type": "local",
  "local_path": "/data/uploads",
  "s3": {
    "endpoint": "",
    "bucket": "",
    "region": ""
  }
}
```

```
PUT /api/admin/storage
```
请求体：`{ "type": "s3", "s3": { "endpoint": "...", ... } }`

#### 4.2.3 操作日志

```
GET /api/admin/logs
```
Query 参数：`page`, `pageSize`, `operator`(邮箱搜索), `action`(类型筛选), `startDate`, `endDate`

响应：
```json
{
  "logs": [
    {
      "id": "uuid",
      "operator_id": "user-uuid",
      "operator_name": "张三",
      "operator_email": "zhangsan@example.com",
      "action": "user_delete",
      "target_type": "user",
      "target_id": "target-uuid",
      "target_name": "李四",
      "detail": "删除了用户",
      "ip_address": "192.168.1.100",
      "created_at": "2026-03-27T10:30:00Z"
    }
  ],
  "total": 100,
  "page": 1,
  "pageSize": 20,
  "totalPage": 5
}
```

#### 4.2.4 仪表盘增强（扩展现有 stats）

在现有 `GET /api/admin/stats` 基础上，追加以下字段（通过新增的 `GET /api/admin/dashboard/enhanced` 端点返回，或通过同一端点的增强响应）：

```json
{
  "trend": {
    "user_count_7d": [10, 12, 11, 14, 13, 15, 16],
    "file_upload_7d": [5, 3, 7, 2, 8, 4, 6],
    "active_users_7d": [8, 10, 9, 12, 11, 13, 14]
  },
  "datasource_health": {
    "connected": 5,
    "disconnected": 2,
    "error": 1
  },
  "alert_summary": {
    "last_7_days": 12,
    "change_ratio": -0.15
  }
}
```

---

## 5. 数据模型

### 5.1 SystemConfig（新增）

```go
// backend/internal/model/model.go

// SystemConfig 系统级配置（Key-Value 存储）
type SystemConfig struct {
    ID        string    `gorm:"type:varchar(50);primaryKey" json:"id"`
    Key       string    `gorm:"size:100;uniqueIndex;not null" json:"key"`
    Value     string    `gorm:"type:text" json:"value"`
    Category  string    `gorm:"size:50;default:'general'" json:"category"` // ai / alert / notification / retention / general
    IsSecret  bool      `gorm:"default:false" json:"-"`                    // 敏感字段不在 API 响应中返回
    CreatedAt time.Time `json:"createdAt"`
    UpdatedAt time.Time `json:"updatedAt"`
}
```

**配置项定义**：

| Key | Category | Default | IsSecret | 说明 |
|-----|----------|---------|----------|------|
| `ai_model` | ai | `gpt-4o-mini` | N | AI 模型名称 |
| `ai_temperature` | ai | `0.7` | N | AI 温度参数 |
| `alert_cooldown_minutes` | alert | `5` | N | 告警冷却分钟数 |
| `default_notification_channel` | notification | `` | N | 默认通知渠道 |
| `file_retention_days` | retention | `90` | N | 文件保留天数 |
| `alert_log_retention_days` | retention | `30` | N | 告警日志保留天数 |
| `default_user_role` | general | `member` | N | 新用户默认角色 |
| `session_timeout_hours` | general | `24` | N | 会话超时小时数 |
| `storage_type` | general | `local` | N | 存储类型 |
| `storage_local_path` | general | `/data/uploads` | N | 本地存储路径 |
| `storage_s3_endpoint` | general | `` | N | S3 端点 |
| `storage_s3_access_key` | general | `` | **Y** | S3 Access Key |
| `storage_s3_secret_key` | general | `` | **Y** | S3 Secret Key |
| `storage_s3_bucket` | general | `` | N | S3 Bucket |
| `storage_s3_region` | general | `` | N | S3 Region |

### 5.2 AdminLog（新增）

```go
// backend/internal/model/model.go

// AdminLog 管理员操作日志
type AdminLog struct {
    ID          string    `gorm:"type:varchar(50);primaryKey" json:"id"`
    OperatorID  string    `gorm:"type:varchar(50);not null;index" json:"operatorId"`
    OperatorName  string `gorm:"size:100" json:"operatorName"`
    OperatorEmail string  `gorm:"size:200" json:"operatorEmail"`
    Action      string    `gorm:"size:50;not null;index" json:"action"` // user_create / user_update / user_delete / user_enable / user_disable / user_reset_password / dataset_delete / datasource_delete / config_update / storage_update
    TargetType  string    `gorm:"size:50" json:"targetType"`            // user / dataset / datasource / config / storage
    TargetID    string    `gorm:"type:varchar(50)" json:"targetId"`
    TargetName  string    `gorm:"size:200" json:"targetName"`
    Detail      string    `gorm:"type:text" json:"detail"`
    IPAddress   string    `gorm:"size:45" json:"ipAddress"`             // 支持 IPv6
    UserAgent   string    `gorm:"size:500" json:"userAgent"`
    CreatedAt   time.Time `json:"createdAt"`
}

// AdminLogAction 操作类型常量
const (
    AdminLogUserCreate        = "user_create"
    AdminLogUserUpdate        = "user_update"
    AdminLogUserDelete        = "user_delete"
    AdminLogUserEnable        = "user_enable"
    AdminLogUserDisable       = "user_disable"
    AdminLogUserResetPassword = "user_reset_password"
    AdminLogDatasetDelete      = "dataset_delete"
    AdminLogDatasourceDelete  = "datasource_delete"
    AdminLogDatasourceTest    = "datasource_test"
    AdminLogConfigUpdate      = "config_update"
    AdminLogStorageUpdate     = "storage_update"
    AdminLogLogin             = "login"
    AdminLogLogout            = "logout"
)
```

### 5.3 AutoMigrate 更新

在 `model.AutoMigrate()` 中追加：

```go
// 管理员系统配置
&SystemConfig{},
// 管理员操作日志
&AdminLog{},
```

---

## 6. 组件设计

### 6.1 Admin 组件架构

```
components/admin/
    ├── AdminLayout.tsx               # 根布局：AppHeader + AdminSidebar + main
    ├── AdminSidebar.tsx             # 侧边栏（AdminLayout 内部使用）
    │   └── ADMIN_NAV 常量（所有导航项定义）
    ├── AdminHeaderNav.tsx           # 顶部标签导航
    ├── AdminBreadcrumb.tsx          # 面包屑（新增）
    │
    ├── AdminStats.tsx               # 统计卡片（已有）
    ├── AdminDashboard.tsx          # 仪表盘图表区（新增）
    │
    ├── UserTable.tsx                # 用户表格
    ├── UserFormModal.tsx            # 添加/编辑用户弹窗
    ├── UserDetailPanel.tsx          # 用户详情侧滑面板
    │
    ├── FileTable.tsx               # 文件表格
    ├── FilePreview.tsx              # 文件预览组件（新增）
    │
    ├── DatabaseTable.tsx           # 数据库表格
    ├── DatabaseTestModal.tsx       # 测试连接结果弹窗（抽取）
    │
    ├── StorageForm.tsx             # 存储配置表单
    │
    ├── ConfigSection.tsx           # 配置区块（从 config/page.tsx 抽取）
    ├── AIConfigForm.tsx            # AI 配置表单
    ├── AlertConfigForm.tsx         # 告警配置表单
    ├── NotificationConfigForm.tsx  # 通知渠道表单
    ├── RetentionConfigForm.tsx    # 保留策略表单
    │
    ├── LogTable.tsx               # 操作日志表格
    │
    └── shared/                     # 共享 Admin 组件
        ├── AdminPageHeader.tsx     # 统一页面标题
        ├── AdminToolbar.tsx        # 统一工具栏
        ├── AdminTable.tsx          # 表格封装
        ├── ConfirmModal.tsx        # 确认模态框
        ├── EmptyState.tsx          # 空状态
        ├── LoadingSkeleton.tsx     # 骨架屏
        ├── PagePagination.tsx      # 分页
        └── Toast.tsx               # Toast
```

### 6.2 核心组件接口设计

#### AdminPageHeader

```typescript
// frontend/components/admin/shared/AdminPageHeader.tsx

interface AdminPageHeaderProps {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  breadcrumb?: Array<{ label: string; href?: string }>;
}
```

#### ConfirmModal

```typescript
// frontend/components/admin/shared/ConfirmModal.tsx

interface ConfirmModalProps {
  open: boolean;
  title: string;
  description?: string;
  confirmLabel?: string;
  confirmVariant?: "primary" | "danger";
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}
```

#### Toast

```typescript
// frontend/components/admin/shared/Toast.tsx

type ToastType = "success" | "error" | "warning" | "info";

interface ToastMessage {
  id: string;
  type: ToastType;
  message: string;
}

// 使用 React Context + useReducer 管理 Toast 队列
// 全局导出 useToast() hook
```

#### PagePagination

```typescript
// frontend/components/admin/shared/PagePagination.tsx

interface PagePaginationProps {
  page: number;
  totalPage: number;
  total?: number;
  onPageChange: (page: number) => void;
}
```

### 6.3 Admin Sidebar 导航配置

```typescript
// frontend/components/admin/AdminSidebar.tsx

const ADMIN_NAV: AdminNavItem[] = [
  {
    label: "仪表盘",
    href: "/admin",
    icon: "M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6",
  },
  {
    label: "数据资产",
    href: "/admin/assets",
    icon: "M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4",
    children: [
      { label: "文件管理", href: "/admin/assets/files" },
      { label: "数据库", href: "/admin/assets/databases" },
      { label: "存储配置", href: "/admin/assets/storage" },
    ],
  },
  {
    label: "用户管理",
    href: "/admin/users",
    icon: "M17 20h5V4H2v16h5m10 0v-4a3 3 0 00-3-3H9a3 3 0 00-3 3v4m10 0H6",
  },
  {
    label: "系统配置",
    href: "/admin/config",
    icon: "M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z",
    children: [
      { label: "AI 配置", href: "/admin/config/ai" },
      { label: "告警配置", href: "/admin/config/alerts" },
      { label: "通知渠道", href: "/admin/config/notifications" },
      { label: "数据策略", href: "/admin/config/retention" },
    ],
  },
  {
    label: "操作日志",
    href: "/admin/logs",
    icon: "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01",
    divider: true,
  },
];
```

---

## 7. 页面详细设计

### 7.1 仪表盘（/admin）增强

**新增组件**：`AdminDashboard.tsx`

在现有 `AdminStats.tsx` 基础上增加 ECharts 图表：

```typescript
// 仪表盘布局
<AdminLayout>
  <AdminHeaderNav />
  
  {/* 统计卡片行（已有） */}
  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
    <StatCard title="用户数" value={stats.totalUsers} />
    <StatCard title="文件数" value={stats.totalDatasets} />
    <StatCard title="数据源数" value={stats.totalDataSources} />
    <StatCard title="存储总量" value={formatSize(stats.totalStorageSize)} />
  </div>
  
  {/* 趋势图表行（新增） */}
  <div className="grid gap-4 lg:grid-cols-2">
    <glass-card>
      <ECharts option={userTrendOption} />
    </glass-card>
    <glass-card>
      <ECharts option={uploadTrendOption} />
    </glass-card>
  </div>
  
  {/* 数据源健康 + 告警摘要行（新增） */}
  <div className="grid gap-4 lg:grid-cols-2">
    <glass-card>
      <DatasourceHealthChart data={stats.datasource_health} />
    </glass-card>
    <glass-card>
      <AlertSummary data={stats.alert_summary} />
    </glass-card>
  </div>
  
  {/* 最近上传（已有，保留） */}
  <RecentUploads data={stats.recentDatasets} />
</AdminLayout>
```

### 7.2 用户管理（/admin/users）完善

**关键变更**：

1. 编辑用户功能：点击用户名或编辑图标打开 `UserFormModal`（复用添加用户表单，数据预填充）
2. 用户详情面板：`UserDetailPanel.tsx` 侧滑展示用户完整信息
3. 角色筛选：`AdminToolbar` 中增加角色筛选下拉（Owner/Admin/Member/全部）
4. CSV 导入：新增"导入"按钮，弹出上传 CSV 弹窗

**UserFormModal 接口扩展**：

```typescript
interface UserFormModalProps {
  open: boolean;
  mode: "create" | "edit";
  user?: User;           // edit 模式时预填充
  onSuccess: () => void;
  onClose: () => void;
}
```

### 7.3 文件管理（/admin/assets/files）完善

**关键变更**：

1. 按租户筛选：表格增加"所属租户"列
2. 文件预览：图片/PDF 点击文件名触发预览模态框
3. 存储分布图：页面顶部增加按格式分布的饼图
4. 批量删除：保留并增强，添加确认提示

### 7.4 系统配置（/admin/config）重构

**结构变更**：将现有的单一 `config/page.tsx` 拆分为 5 个子页面：

```
/admin/config          → 配置概览（显示所有配置项摘要，卡片式）
/admin/config/ai      → AI 模型配置
/admin/admin/config/alerts     → 告警配置
/admin/config/notifications → 通知渠道
/admin/config/retention      → 数据保留策略
```

配置数据通过统一的 `GET/PUT /api/admin/config` API 获取和更新，前端按 category 分组展示。

**ConfigSection 组件**：

```typescript
interface ConfigSectionProps {
  title: string;
  description?: string;
  category: string;
  children: React.ReactNode;
}

// 使用示例
<ConfigSection title="AI 模型配置" description="设置 AI 模型的默认行为" category="ai">
  <AIConfigForm />
</ConfigSection>
```

### 7.5 操作日志（/admin/logs）新增

**页面结构**：

```
<AdminLayout>
  <AdminHeaderNav />
  
  <AdminPageHeader
    title="操作日志"
    description="记录管理员的关键操作行为"
  />
  
  <AdminToolbar>
    <input className="input-base max-w-xs" placeholder="搜索操作者..." />
    <select className="input-base w-auto">
      <option value="">全部操作</option>
      <option value="user_*">用户管理</option>
      <option value="dataset_*">文件管理</option>
      <option value="datasource_*">数据库管理</option>
      <option value="config_*">系统配置</option>
    </select>
    <DateRangePicker />
  </AdminToolbar>
  
  <LogTable data={logs} />
  
  <PagePagination page={page} totalPage={totalPage} onPageChange={setPage} />
</AdminLayout>
```

---

## 8. 后端详细设计

### 8.1 Admin Service

```go
// backend/internal/service/admin_service.go

type AdminService struct {
    db                *gorm.DB
    authService       *AuthService
    dataSourceService *DataSourceService
    datasetService    *DatasetService
}

// NewAdminService 构造函数
func NewAdminService(db *gorm.DB, authService *AuthService, ...) *AdminService {
    return &AdminService{ ... }
}

// GetConfig 获取所有系统配置（敏感字段排除）
func (s *AdminService) GetConfig() (map[string]string, error) { ... }

// UpdateConfig 更新系统配置
func (s *AdminService) UpdateConfig(key, value string) error { ... }

// GetConfigCategory 获取指定 category 的所有配置
func (s *AdminService) GetConfigCategory(category string) (map[string]string, error) { ... }

// GetStorageConfig 获取存储配置
func (s *AdminService) GetStorageConfig() (*StorageConfig, error) { ... }

// UpdateStorageConfig 更新存储配置
func (s *AdminService) UpdateStorageConfig(cfg *StorageConfig) error { ... }

// GetEnhancedStats 获取增强版仪表盘统计
func (s *AdminService) GetEnhancedStats() (*EnhancedStats, error) { ... }

// ListLogs 分页查询操作日志
func (s *AdminService) ListLogs(operator, action, startDate, endDate string, page, pageSize int) ([]AdminLog, int64, error) { ... }

// WriteLog 写入操作日志（供其他 service 调用）
func (s *AdminService) WriteLog(operatorID, operatorName, operatorEmail, action, targetType, targetID, targetName, detail, ipAddress string) error { ... }
```

### 8.2 Admin Handler 路由扩展

在 `backend/cmd/main.go` 的 admin 路由注册中追加：

```go
// GET/PUT /api/admin/config（新增）
case strings.HasPrefix(path, "/config") && r.Method == http.MethodGet:
    middleware.Auth(authService)(http.HandlerFunc(adminHandler.GetConfig)).ServeHTTP(w, r)
case strings.HasPrefix(path, "/config") && r.Method == http.MethodPut:
    middleware.Auth(authService)(http.HandlerFunc(adminHandler.UpdateConfig)).ServeHTTP(w, r)

// GET/PUT /api/admin/storage（新增）
case strings.HasPrefix(path, "/storage") && r.Method == http.MethodGet:
    middleware.Auth(authService)(http.HandlerFunc(adminHandler.GetStorage)).ServeHTTP(w, r)
case strings.HasPrefix(path, "/storage") && r.Method == http.MethodPut:
    middleware.Auth(authService)(http.HandlerFunc(adminHandler.UpdateStorage)).ServeHTTP(w, r)

// GET /api/admin/logs（新增）
case strings.HasPrefix(path, "/logs") && r.Method == http.MethodGet:
    middleware.Auth(authService)(http.HandlerFunc(adminHandler.ListLogs)).ServeHTTP(w, r)

// GET /api/admin/dashboard/enhanced（增强版统计，新增）
case strings.HasPrefix(path, "/dashboard/enhanced") && r.Method == http.MethodGet:
    middleware.Auth(authService)(http.HandlerFunc(adminHandler.GetEnhancedStats)).ServeHTTP(w, r)
```

### 8.3 Admin 操作日志自动记录

在 Admin Handler 的各个方法中，调用 `WriteLog` 记录操作：

```go
func (h *AdminHandler) CreateUser(w http.ResponseWriter, r *http.Request) {
    // ... 现有逻辑 ...
    
    // 记录日志
    h.adminService.WriteLog(
        getUserIDFromCtx(r),
        getUserNameFromCtx(r),
        getUserEmailFromCtx(r),
        model.AdminLogUserCreate,
        "user",
        user.ID,
        req.Name,
        fmt.Sprintf("创建了用户 %s (角色: %s)", req.Name, req.Role),
        getClientIP(r),
    )
}
```

---

## 9. 实施计划

### 9.1 Phase 1: 共享组件与基础设施

1. 创建 `components/admin/shared/` 共享组件
2. 创建 `lib/admin/types.ts` 和 `lib/admin/utils.ts`
3. 完善 `lib/admin/api.ts`（新增 config/storage/logs API）
4. 前端 Next.js API Routes 代理层

### Phase 2: 仪表盘增强

5. `AdminDashboard.tsx` 仪表盘图表组件
6. 后端 `EnhancedStats` 和 `/api/admin/dashboard/enhanced` 端点
7. 仪表盘页面整合

### Phase 3: 用户管理完善

8. `UserTable.tsx` 表格组件抽取
9. `UserFormModal.tsx` 添加/编辑弹窗
10. `UserDetailPanel.tsx` 详情侧滑面板
11. 角色筛选 + CSV 导入功能

### Phase 4: 数据资产管理完善

12. `FileTable.tsx` 抽取 + 预览功能
13. `DatabaseTable.tsx` 抽取 + 测试连接模态框
14. 文件预览组件 `FilePreview.tsx`

### Phase 5: 系统配置

15. `SystemConfig` 和 `AdminLog` 数据模型
16. 后端 `AdminService` 配置管理方法
17. 后端路由注册（config/storage/logs）
18. 前端配置页面拆分（5 个子页面）

### Phase 6: 操作日志

19. 后端 `ListLogs` handler 和 service
20. `LogTable.tsx` 组件
21. `/admin/logs` 页面

### Phase 7: 优化与完善

22. 响应式布局（md/sm 断点优化）
23. Toast 全局通知集成
24. 前端权限守卫 Middleware
25. 加载骨架屏完善
26. 可访问性检查

---

## 10. 技术风险与应对

| 风险 | 等级 | 应对措施 |
|------|------|----------|
| ECharts 在 SSR 模式下水合问题 | 中 | 使用 `dynamic` 导入，关闭 SSR |
| 大表格（1000+ 行）渲染性能 | 中 | 虚拟滚动（react-virtual）或限制每页条数 |
| 配置项数量增长导致管理困难 | 低 | 按 category 分组，前端做子路由 |
| Admin 日志表数据量增长 | 低 | 自动清理 90 天前记录（定时任务） |
| 存储配置包含敏感密钥 | 高 | Secret 字段 `IsSecret=true`，API 不返回；前端使用 password input |
