# 后台管理系统技术设计文档

> BizLens AI 数据分析平台 - 后台管理系统

## 1. 核心变更：授权码激活流程

### 1.1 变更概述

原有的硬编码预设账号（`koala@qq.com / admin123`）方案替换为**授权码激活**模式：

| 方面 | 旧方案 | 新方案 |
|-----|-------|-------|
| 初始账号 | 硬编码在 `auth_service.go` | 无预设，通过授权码激活创建 |
| 管理员来源 | 出厂预设 | 部署后由客户自行创建 |
| 授权方式 | 无 | 环境变量 `LICENSE_KEY` 配置授权码 |
| 注册限制 | 任何人可注册 | 未激活时禁止注册，激活后管理员添加用户 |

### 1.2 激活流程状态机

```
[系统启动]
    │
    ▼
查询 users 表：是否有 role=owner/admin 的用户？
    │
    ├── 无 → UNACTIVATED 状态 → 所有请求返回 { unactivated: true }
    │                                       │
    │                                       ▼
    │                                  用户访问 /auth/login
    │                                       │
    │                                       ▼
    │                             前端 redirect 到 /auth/activate
    │                                       │
    │                                       ▼
    │                             用户输入授权码 + 管理员信息
    │                                       │
    │                                       ▼
    │                              POST /api/auth/activate
    │                              (校验 LICENSE_KEY 环境变量)
    │                                       │
    │                                       ▼
    │                              创建 owner 用户 + JWT token
    │                                       │
    │                                       ▼
    └── 有 → ACTIVATED 状态 → 正常登录/注册流程
```

---

## 2. 后端变更

### 2.1 Config 变更

```go
// backend/internal/config/config.go

type Config struct {
    // ... 现有字段 ...

    // 授权相关（新增）
    LicenseKey     string  // 必填，授权码
    LicenseSeats   int     // 可选，最大用户数上限
    LicenseExpires string  // 可选，到期日期 YYYY-MM-DD
}

func Load() *Config {
    // 加载 LICENSE_KEY（必填）
    licenseKey := os.Getenv("LICENSE_KEY")
    if licenseKey == "" {
        log.Fatal("错误：未配置环境变量 LICENSE_KEY，无法启动系统")
    }

    // 校验授权码格式（4段各4位）
    if !isValidLicenseKeyFormat(licenseKey) {
        log.Fatal("错误：LICENSE_KEY 格式无效，应为 XXXX-XXXX-XXXX-XXXX")
    }

    // 加载可选字段
    licenseSeats := getEnvInt("LICENSE_SEATS", 0)   // 0 表示不限制
    licenseExpires := os.Getenv("LICENSE_EXPIRES")   // YYYY-MM-DD

    return &Config{
        // ... 现有字段 ...
        LicenseKey:     licenseKey,
        LicenseSeats:   licenseSeats,
        LicenseExpires: licenseExpires,
    }
}
```

### 2.2 Auth DTO 变更

```go
// backend/internal/dto/auth_dto.go

// ActivateRequest 激活请求（新）
type ActivateRequest struct {
    LicenseKey string `json:"licenseKey" validate:"required"`
    Name       string `json:"name" validate:"required"`
    Email      string `json:"email" validate:"required,email"`
    Password   string `json:"password" validate:"required,min=6"`
}

// ActivateResponse 激活响应（新）
type ActivateResponse struct {
    Activated bool          `json:"activated"`
    User      *UserResponse `json:"user,omitempty"`
    Tokens    *Tokens       `json:"tokens,omitempty"`
    Error     string        `json:"error,omitempty"`
    Code      string        `json:"code,omitempty"`
}

// LoginResponse 增加激活状态字段（修改）
type LoginResponse struct {
    User         *UserResponse `json:"user,omitempty"`
    Tokens       *Tokens       `json:"tokens,omitempty"`
    Unactivated  bool          `json:"unactivated"`  // 新增
    SystemName   string        `json:"systemName"`   // 新增
    Version      string        `json:"version"`     // 新增
}
```

### 2.3 AuthService 变更

```go
// backend/internal/service/auth_service.go

// 删除以下内容：
const (
    adminEmail    = "koala@qq.com"
    adminName     = "管理员"
    adminPassword = "admin123"
)

func (s *AuthService) EnsureAdminAccount() error { ... }

// 修改 Register：未激活时禁止注册，激活后可注册但 role 固定为 "member"
func (s *AuthService) Register(req *dto.RegisterRequest) (*model.User, *dto.Tokens, error) {
    if !s.IsActivated() {
        return nil, nil, errors.New("系统尚未激活，请先激活系统")
    }
    // ... 现有逻辑 ...
}

// 新增方法：

// IsActivated 检查系统是否已激活（至少有一个 owner/admin）
func (s *AuthService) IsActivated() bool {
    var count int64
    s.db.Model(&model.User{}).
        Where("role IN ('owner', 'admin') AND deleted_at IS NULL").
        Count(&count)
    return count > 0
}

// Activate 系统激活
func (s *AuthService) Activate(req *dto.ActivateRequest) (*model.User, *dto.Tokens, error) {
    // 1. 校验授权码格式
    if !isValidLicenseKeyFormat(req.LicenseKey) {
        return nil, nil, errors.New("授权码格式无效")
    }

    // 2. 比对环境变量 LICENSE_KEY
    if req.LicenseKey != s.cfg.LicenseKey {
        return nil, nil, errors.New("授权码无效")
    }

    // 3. 检查是否已激活
    if s.IsActivated() {
        return nil, nil, errors.New("系统已被激活")
    }

    // 4. 检查用户数上限
    if s.cfg.LicenseSeats > 0 {
        var count int64
        s.db.Model(&model.User{}).Count(&count)
        if count >= int64(s.cfg.LicenseSeats) {
            return nil, nil, errors.New("已达到授权用户数上限")
        }
    }

    // 5. 检查邮箱是否已被注册
    var existing model.User
    if err := s.db.Where("email = ?", req.Email).First(&existing).Error; err == nil {
        return nil, nil, errors.New("该邮箱已被注册")
    }

    // 6. 创建默认租户（如果不存在）
    s.EnsureDefaultTenant()

    // 7. 创建 owner 用户
    hashedPassword, _ := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
    user := &model.User{
        ID:           uuid.New().String(),
        TenantID:     defaultTenantID,
        Name:         req.Name,
        Email:        req.Email,
        PasswordHash: string(hashedPassword),
        Role:         "owner",
    }

    var tokens *dto.Tokens
    s.db.Transaction(func(tx *gorm.DB) error {
        tx.Create(user)
        tokens, _ = s.generateTokens(tx, user.ID)
        return nil
    })

    return user, tokens, nil
}

// ValidateLicense 获取激活状态（供登录接口使用）
func (s *AuthService) ValidateLicense() (bool, string, string) {
    return s.IsActivated(), "BizLens", "1.0.0"
}

// ListUsers 列出用户（支持租户筛选、关键字搜索、分页）
func (s *AuthService) ListUsers(tenantID, keyword string, page, pageSize int) ([]model.User, int64, error) {
    query := s.db.Model(&model.User{}).Where("deleted_at IS NULL")

    if tenantID != "" {
        query = query.Where("tenant_id = ?", tenantID)
    }
    if keyword != "" {
        query = query.Where("name LIKE ? OR email LIKE ?", "%"+keyword+"%", "%"+keyword+"%")
    }

    var total int64
    query.Count(&total)

    var users []model.User
    offset := (page - 1) * pageSize
    query.Order("created_at DESC").Offset(offset).Limit(pageSize).Find(&users)

    return users, total, nil
}

// CreateUser 管理员创建用户
func (s *AuthService) CreateUser(req *dto.CreateUserRequest) (*model.User, error) {
    var existing model.User
    if err := s.db.Where("email = ?", req.Email).First(&existing).Error; err == nil {
        return nil, errors.New("该邮箱已被注册")
    }

    hashedPassword, _ := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
    user := &model.User{
        ID:           uuid.New().String(),
        TenantID:     defaultTenantID,
        Name:         req.Name,
        Email:        req.Email,
        PasswordHash: string(hashedPassword),
        Role:         req.Role, // admin / member
    }

    if err := s.db.Create(user).Error; err != nil {
        return nil, err
    }
    return user, nil
}

// UpdateUser 更新用户
func (s *AuthService) UpdateUser(userID, name, role string) error {
    updates := map[string]interface{}{}
    if name != "" {
        updates["name"] = name
    }
    if role != "" && role != "owner" { // owner 角色不可被修改
        updates["role"] = role
    }
    return s.db.Model(&model.User{}).Where("id = ?", userID).Updates(updates).Error
}

// DeleteUser 删除用户
func (s *AuthService) DeleteUser(userID string) error {
    return s.db.Where("id = ?", userID).Delete(&model.User{}).Error
}

// ResetUserPassword 重置密码，返回新密码明文
func (s *AuthService) ResetUserPassword(userID string) (string, error) {
    newPassword := generateRandomPassword(12) // 生成12位随机密码
    hashedPassword, _ := bcrypt.GenerateFromPassword([]byte(newPassword), bcrypt.DefaultCost)
    err := s.db.Model(&model.User{}).Where("id = ?", userID).
        Update("password_hash", string(hashedPassword)).Error
    return newPassword, err
}

// generateRandomPassword 生成随机密码
func generateRandomPassword(length int) string {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789"
    b := make([]byte, length)
    rand.Read(b)
    for i := range b {
        b[i] = chars[int(b[i])%len(chars)]
    }
    return string(b)
}
```

### 2.4 AuthHandler 变更

```go
// backend/internal/handler/auth_handler.go

// POST /api/auth/activate（新）
func (h *AuthHandler) Activate(w http.ResponseWriter, r *http.Request) {
    var req dto.ActivateRequest
    if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
        writeError(w, http.StatusBadRequest, "请求体解析失败")
        return
    }

    user, tokens, err := h.authService.Activate(&req)
    if err != nil {
        json.NewEncoder(w).Encode(dto.ActivateResponse{
            Activated: false,
            Error:     err.Error(),
            Code:      "ACTIVATION_FAILED",
        })
        return
    }

    json.NewEncoder(w).Encode(dto.ActivateResponse{
        Activated: true,
        User:      toUserResponse(user),
        Tokens:    tokens,
    })
}

// POST /api/auth/login 变更：响应增加 unactivated 字段
func (h *AuthHandler) Login(w http.ResponseWriter, r *http.Request) {
    // ... 现有登录逻辑 ...

    // 登录成功后，额外返回激活状态
    isActivated, systemName, version := h.authService.ValidateLicense()

    json.NewEncoder(w).Encode(dto.LoginResponse{
        User:        userResponse,
        Tokens:      tokens,
        Unactivated: !isActivated,
        SystemName:  systemName,
        Version:     version,
    })
}

// POST /api/auth/register 变更：未激活时返回错误
func (h *AuthHandler) Register(w http.ResponseWriter, r *http.Request) {
    // ...
    if !h.authService.IsActivated() {
        writeError(w, http.StatusForbidden, `{"error":"系统尚未激活","code":"NOT_ACTIVATED"}`)
        return
    }
    // ...
}
```

### 2.5 路由注册变更

```go
// backend/cmd/main.go

// 修改 auth 路由：
mux.HandleFunc("/api/auth/", func(w http.ResponseWriter, r *http.Request) {
    path := strings.TrimPrefix(r.URL.Path, "/api/auth/")

    switch {
    // POST /api/auth/activate（新）
    case path == "activate" && r.Method == http.MethodPost:
        authHandler.Activate(w, r)
        return

    // POST /api/auth/register（修改：增加激活状态检查）
    case path == "register" && r.Method == http.MethodPost:
        // 在 handler 中已处理...
        authHandler.Register(w, r)
        return

    // POST /api/auth/login（修改：响应增加 unactivated）
    case path == "login" && r.Method == http.MethodPost:
        authHandler.Login(w, r)
        return

    // ... 其他路由不变 ...
    }
})

// 移除 EnsureAdminAccount 启动调用：
// 删除了：
// if err := authService.EnsureAdminAccount(); err != nil {
//     log.Fatalf("初始化超管账号失败：%v", err)
// }
// log.Println("超管账号初始化完成：koala@qq.com / admin123")
```

---

## 3. 前端变更

### 3.1 登录页适配

```typescript
// frontend/app/auth/login/page.tsx 改动
// POST /api/auth/login 后检查 unactivated 状态

const handleLogin = async () => {
  const res = await fetch("/api/auth/login", { ... });
  const data = await res.json();

  if (data.unactivated === true) {
    router.replace("/auth/activate");
    return;
  }
  // 正常登录...
};
```

### 3.2 激活页面（/auth/activate）

视觉风格与登录页一致：深色背景、品牌渐变、玻璃卡片。

授权码输入使用 4 段输入框，支持粘贴自动跳格。激活成功后保存 token 并重定向到 `/onboarding`。

### 3.3 前端 API Route 变更

```typescript
// frontend/app/api/auth/activate/route.ts（新文件）
export async function POST(req: Request) {
  const body = await req.json();
  const res = await fetch(`${BACKEND_URL}/api/auth/activate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return NextResponse.json(await res.json(), { status: res.status });
}
```

---

## 4. 后台管理系统架构

### 4.1 目录结构

```
frontend/app/
├── auth/
│   ├── login/page.tsx              # 适配 unactivated 状态
│   └── activate/page.tsx           # 新增：激活引导页
│
├── admin/                          # 后台管理（新）
│   ├── layout.tsx                  # AdminLayout
│   ├── page.tsx                    # 仪表盘
│   ├── assets/
│   │   ├── files/page.tsx         # 文件管理
│   │   ├── databases/page.tsx     # 数据库管理
│   │   └── storage/page.tsx       # 存储配置
│   ├── users/
│   │   └── page.tsx               # 用户管理（核心）
│   └── config/
│       └── page.tsx               # 系统配置

frontend/components/admin/          # 后台管理专用组件（新）
│   ├── AdminLayout.tsx
│   ├── AdminSidebar.tsx
│   ├── AdminStats.tsx
│   ├── UserTable.tsx               # 用户管理表格
│   ├── UserFormModal.tsx           # 添加/编辑用户弹窗
│   ├── FileTable.tsx
│   ├── DatabaseTable.tsx
│   └── StorageForm.tsx

frontend/lib/admin/
│   ├── api.ts                      # Admin API 封装
│   └── types.ts                    # Admin 类型定义
```

### 4.2 Admin API 总览

所有 admin API 统一前缀 `/api/admin/`，需 JWT 认证 + admin/owner 角色。

| 方法 | 路径 | 功能 |
|-----|-----|-----|
| GET | `/api/admin/stats` | 系统统计 |
| **用户管理** | | |
| GET | `/api/admin/users` | 用户列表（支持分页、搜索） |
| POST | `/api/admin/users` | 添加用户 |
| PUT | `/api/admin/users/{id}` | 编辑用户 |
| DELETE | `/api/admin/users/{id}` | 删除用户 |
| POST | `/api/admin/users/{id}/reset-password` | 重置密码 |
| POST | `/api/admin/users/{id}/toggle` | 启用/禁用 |
| **数据资产** | | |
| GET | `/api/admin/datasets` | 文件列表 |
| DELETE | `/api/admin/datasets/{id}` | 删除文件 |
| GET | `/api/admin/data-sources` | 数据库连接列表 |
| POST | `/api/admin/data-sources/{id}/test` | 测试连接 |
| DELETE | `/api/admin/data-sources/{id}` | 删除连接 |
| **存储** | | |
| GET | `/api/admin/storage/config` | 存储配置 |
| PUT | `/api/admin/storage/config` | 更新存储配置 |

### 4.3 Admin Handler

```go
// backend/internal/handler/admin_handler.go（新文件）

type AdminHandler struct {
    authService       *service.AuthService
    dataSourceService *service.DataSourceService
    datasetService    *service.DatasetService
    storageService    *service.StorageService
}

// AdminAuth 中间件：JWT + 角色校验
func AdminAuth(authService *service.AuthService) func(http.Handler) http.Handler {
    return func(next http.Handler) http.Handler {
        return middleware.Auth(authService)(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
            role := r.Context().Value("userRole").(string)
            if role != "admin" && role != "owner" {
                writeError(w, http.StatusForbidden, "需要管理员权限")
                return
            }
            next.ServeHTTP(w, r)
        }))
    }
}

// GET /api/admin/stats
func (h *AdminHandler) GetStats(w http.ResponseWriter, r *http.Request) { ... }

// GET /api/admin/users
func (h *AdminHandler) ListUsers(w http.ResponseWriter, r *http.Request) { ... }

// POST /api/admin/users
func (h *AdminHandler) CreateUser(w http.ResponseWriter, r *http.Request) { ... }

// PUT /api/admin/users/{id}
func (h *AdminHandler) UpdateUser(w http.ResponseWriter, r *http.Request) { ... }

// DELETE /api/admin/users/{id}
func (h *AdminHandler) DeleteUser(w http.ResponseWriter, r *http.Request) {
    parts := strings.Split(r.URL.Path, "/")
    userID := parts[len(parts)-2]

    currentUserID := r.Context().Value("userID").(string)
    if userID == currentUserID {
        writeError(w, http.StatusBadRequest, "无法删除自己的账号")
        return
    }

    if err := h.authService.DeleteUser(userID); err != nil {
        writeError(w, http.StatusBadRequest, err.Error())
        return
    }
}

// POST /api/admin/users/{id}/reset-password
func (h *AdminHandler) ResetUserPassword(w http.ResponseWriter, r *http.Request) {
    parts := strings.Split(r.URL.Path, "/")
    userID := parts[len(parts)-2]

    newPassword, err := h.authService.ResetUserPassword(userID)
    if err != nil {
        writeError(w, http.StatusBadRequest, err.Error())
        return
    }

    json.NewEncoder(w).Encode(map[string]string{"password": newPassword})
}

// GET /api/admin/datasets
func (h *AdminHandler) ListAllDatasets(w http.ResponseWriter, r *http.Request) { ... }

// DELETE /api/admin/datasets/{id}
func (h *AdminHandler) DeleteDataset(w http.ResponseWriter, r *http.Request) { ... }

// GET /api/admin/data-sources
func (h *AdminHandler) ListAllDataSources(w http.ResponseWriter, r *http.Request) { ... }

// POST /api/admin/data-sources/{id}/test
func (h *AdminHandler) TestDataSource(w http.ResponseWriter, r *http.Request) {
    parts := strings.Split(r.URL.Path, "/")
    dsID := parts[len(parts)-2]
    result := h.dataSourceService.TestConnection(dsID)
    json.NewEncoder(w).Encode(result)
}
```

---

## 5. 数据模型

### 5.1 新增 SystemConfig

```go
// backend/internal/model/model.go

// SystemConfig 系统级配置（Key-Value）
type SystemConfig struct {
    ID        string    `gorm:"type:varchar(50);primaryKey" json:"id"`
    Key       string    `gorm:"size:100;uniqueIndex;not null" json:"key"`
    Value     string    `gorm:"type:text" json:"value"`
    Category  string    `gorm:"size:50;default:'storage'" json:"category"` // storage/ai/alert/license
    UpdatedAt time.Time `json:"updatedAt"`
}

// AdminStats 系统统计（聚合数据，非持久化）
type AdminStats struct {
    TotalUsers       int64            `json:"totalUsers"`
    TotalDatasets    int64            `json:"totalDatasets"`
    TotalDataSources int64            `json:"totalDataSources"`
    TotalStorageSize int64            `json:"totalStorageSize"`
    StorageByFormat  map[string]int64 `json:"storageByFormat"`
    RecentDatasets   []DatasetSummary `json:"recentDatasets"`
}

type DatasetSummary struct {
    ID         string `json:"id"`
    Name       string `json:"name"`
    FileName   string `json:"fileName"`
    FileSize   int64  `json:"fileSize"`
    FileFormat string `json:"fileFormat"`
    CreatedAt  string `json:"createdAt"`
}
```

---

## 6. 环境变量清单

| 变量名 | 必填 | 说明 | 示例 |
|-------|-----|-----|------|
| `LICENSE_KEY` | **是** | 授权码，格式 `XXXX-XXXX-XXXX-XXXX` | `BIZL-8K3M-A7PW-2N9Q` |
| `LICENSE_SEATS` | 否 | 最大用户数上限，不填则不限制 | `50` |
| `LICENSE_EXPIRES` | 否 | 授权到期日期，不填则永不过期 | `2027-12-31` |
| `JWT_SECRET` | 是 | JWT 签名密钥（生产环境必须修改） | `your-secret-here` |
| `SERVER_PORT` | 否 | 后端端口，默认 `3001` | `3001` |
| `DB_*` | 否 | 数据库连接配置 | 见 config.go |

---

## 7. 实施顺序

### Phase 0: 授权码激活（核心）
1. Config 增加 `LICENSE_KEY` 校验
2. AuthService 增加 `Activate` 方法
3. AuthHandler 增加 `/api/auth/activate` 接口
4. 登录接口响应增加 `unactivated` 字段
5. 移除 `EnsureAdminAccount` 及相关代码
6. 前端 `/auth/activate` 激活页面
7. 登录页适配 `unactivated` 跳转

### Phase 1: 用户管理
8. AdminService + AdminHandler（用户 CRUD）
9. `/admin/users` 用户管理页面
10. AppHeader 管理入口

### Phase 2: 后台框架
11. AdminLayout + 侧边导航
12. `/admin` 仪表盘

### Phase 3: 数据资产管理
13. 文件管理 + 数据库管理 + 存储配置

### Phase 4: 系统配置
14. `/admin/config` 各配置区块

---

## 8. 安全注意事项

1. **`LICENSE_KEY` 必须非空**：后端启动时校验，未配置则 `log.Fatal` 退出
2. **暴力破解防护**：激活接口增加请求频率限制（5分钟内最多 5 次）
3. **明文密码仅展示一次**：重置密码后返回明文一次，后续不可查
4. **不可删除/修改 owner**：owner 不可被删除，角色不可被降级
5. **不可删除自己**：管理员无法删除自己的账号
6. **敏感字段脱敏**：API 响应中密码字段永不返回明文
