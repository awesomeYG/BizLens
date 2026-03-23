# 用户认证系统技术设计文档

## 文档信息

- **版本**: 1.0
- **日期**: 2026-03-23
- **关联需求**: requirements.md
- **状态**: Draft

---

## 1. 系统架构

### 1.1 技术栈确认

| 层级 | 技术 | 说明 |
|------|------|------|
| 后端 | Go 1.21 + net/http + GORM | 当前项目使用的框架 |
| 前端 | Next.js 15 + React 19 + TypeScript | 当前项目使用的框架 |
| 数据库 | PostgreSQL/MySQL/SQLite | GORM 支持的多数据库 |
| 认证 | JWT (HS256) | 无状态认证 |
| 密码加密 | BCrypt (cost=12) | 安全哈希 |

### 1.2 认证流程概览

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   前端应用   │     │   后端 API   │     │   数据库    │
│  (Next.js)  │     │   (Go)      │     │  (GORM)     │
└──────┬──────┘     └──────┬──────┘     └──────┬──────┘
       │                   │                   │
       │  1. 注册/登录请求   │                   │
       │──────────────────>│                   │
       │                   │  2. 验证/创建用户   │
       │                   │──────────────────>│
       │                   │<──────────────────│
       │                   │                   │
       │  3. 返回 Token 对   │                   │
       │<──────────────────│                   │
       │                   │                   │
       │  4. 存储 Token     │                   │
       │                   │                   │
       │  5. API 请求 (携带 Token)              │
       │──────────────────>│                   │
       │                   │  6. 验证 Token     │
       │                   │                   │
       │  7. 返回数据       │                   │
       │<──────────────────│                   │
       │                   │                   │
```

---

## 2. 数据库设计

### 2.1 User 模型扩展

在现有 `User` 模型基础上新增字段：

```go
// User 用户（扩展后）
type User struct {
    ID            string         `gorm:"type:varchar(50);primaryKey;default:null" json:"id"`
    TenantID      string         `gorm:"type:varchar(50);not null;index" json:"tenantId"`
    Name          string         `gorm:"size:100;not null" json:"name"`
    Email         string         `gorm:"size:200;not null;uniqueIndex" json:"email"`
    Role          string         `gorm:"size:50;default:'member'" json:"role"` // owner / admin / member
    
    // 新增认证字段
    PasswordHash  string         `gorm:"size:255;not null" json:"-"` // 不返回给前端
    LastLoginAt   *time.Time     `json:"lastLoginAt,omitempty"`
    LoginAttempts int            `gorm:"default:0" json:"-"` // 连续失败次数
    LockedUntil   *time.Time     `json:"-"` // 锁定截止时间
    
    CreatedAt     time.Time      `json:"createdAt"`
    UpdatedAt     time.Time      `json:"updatedAt"`
    DeletedAt     gorm.DeletedAt `gorm:"index" json:"-"`

    Tenant        Tenant         `gorm:"foreignKey:TenantID" json:"-"`
}
```

### 2.2 RefreshToken 表

```go
// RefreshToken 刷新令牌
type RefreshToken struct {
    ID        string         `gorm:"type:varchar(50);primaryKey;default:null" json:"id"`
    UserID    string         `gorm:"type:varchar(50);not null;index" json:"userId"`
    Token     string         `gorm:"size:500;not null;uniqueIndex" json:"-"` // 存储哈希值
    ExpiresAt time.Time      `gorm:"not null" json:"expiresAt"`
    RevokedAt *time.Time     `json:"revokedAt,omitempty"`
    CreatedAt time.Time      `json:"createdAt"`
    UserAgent string         `gorm:"size:500" json:"userAgent,omitempty"`
    IPAddress string         `gorm:"size:50" json:"ipAddress,omitempty"`

    User      User           `gorm:"foreignKey:UserID" json:"-"`
}
```

### 2.3 AuthProvider 表（预留）

```go
// AuthProvider 第三方认证提供商（预留，未来扩展 OAuth）
type AuthProvider struct {
    ID             string         `gorm:"type:varchar(50);primaryKey;default:null" json:"id"`
    UserID         string         `gorm:"type:varchar(50);not null;index" json:"userId"`
    Provider       string         `gorm:"size:50;not null;index" json:"provider"` // google, github, etc.
    ProviderUserID string         `gorm:"size:200;not null;uniqueIndex:idx_provider_user" json:"providerUserId"`
    AccessToken    string         `gorm:"size:500" json:"-"` // 加密存储
    RefreshToken   string         `gorm:"size:500" json:"-"` // 加密存储
    ExpiresAt      *time.Time     `json:"expiresAt,omitempty"`
    CreatedAt      time.Time      `json:"createdAt"`
    UpdatedAt      time.Time      `json:"updatedAt"`

    User           User           `gorm:"foreignKey:UserID" json:"-"`
}
```

### 2.4 迁移脚本

在 `backend/internal/model/model.go` 的 `AutoMigrate` 函数中添加：

```go
func AutoMigrate(db *gorm.DB) error {
    return db.AutoMigrate(
        // 现有模型
        &Tenant{},
        &User{},
        &IMConfig{},
        // ... 其他现有模型
        
        // 新增认证模型
        &RefreshToken{},
        &AuthProvider{},
    )
}
```

---

## 3. 后端 API 设计

### 3.1 API 路由规划

```
POST   /api/auth/register          # 用户注册
POST   /api/auth/login             # 用户登录
POST   /api/auth/logout            # 用户登出
POST   /api/auth/refresh           # 刷新 Token
GET    /api/auth/me                # 获取当前用户
PUT    /api/auth/me                # 更新用户信息
POST   /api/auth/password/reset    # 请求重置密码（未来）
POST   /api/auth/password/change   # 修改密码（未来）
GET    /api/auth/oauth/:provider   # OAuth 重定向（未来）
GET    /api/auth/oauth/:provider/callback  # OAuth 回调（未来）
```

### 3.2 请求/响应 DTO

```go
// backend/internal/dto/auth_dto.go
package dto

// 注册请求
type RegisterRequest struct {
    Email     string `json:"email"`
    Password  string `json:"password"`
    Name      string `json:"name,omitempty"`
    TenantID  string `json:"tenantId,omitempty"`
}

// 登录请求
type LoginRequest struct {
    Email    string `json:"email"`
    Password string `json:"password"`
}

// Token 响应
type TokenResponse struct {
    AccessToken  string    `json:"accessToken"`
    RefreshToken string    `json:"refreshToken"`
    ExpiresIn    int       `json:"expiresIn"` // 秒
    TokenType    string    `json:"tokenType"` // "Bearer"
}

// 认证响应（登录/注册成功）
type AuthResponse struct {
    User  UserDTO       `json:"user"`
    Tokens TokenResponse `json:"tokens"`
}

// 刷新 Token 请求
type RefreshTokenRequest struct {
    RefreshToken string `json:"refreshToken"`
}

// 刷新 Token 响应
type RefreshTokenResponse struct {
    AccessToken  string `json:"accessToken"`
    RefreshToken string `json:"refreshToken,omitempty"` // 轮换时返回
    ExpiresIn    int    `json:"expiresIn"`
}

// 用户信息响应
type UserDTO struct {
    ID          string     `json:"id"`
    TenantID    string     `json:"tenantId"`
    Name        string     `json:"name"`
    Email       string     `json:"email"`
    Role        string     `json:"role"`
    LastLoginAt *time.Time `json:"lastLoginAt,omitempty"`
    CreatedAt   time.Time  `json:"createdAt"`
}

// 更新用户请求
type UpdateUserRequest struct {
    Name string `json:"name,omitempty"`
}

// 通用错误响应
type ErrorResponse struct {
    Success bool        `json:"success"`
    Data    interface{} `json:"data,omitempty"`
    Error   *ErrorInfo  `json:"error,omitempty"`
}

type ErrorInfo struct {
    Code    string `json:"code"`
    Message string `json:"message"`
}

// 通用成功响应
type SuccessResponse struct {
    Success bool        `json:"success"`
    Data    interface{} `json:"data"`
    Error   interface{} `json:"error,omitempty"`
}
```

### 3.3 Handler 实现

```go
// backend/internal/handler/auth_handler.go
package handler

import (
    "ai-bi-server/internal/dto"
    "ai-bi-server/internal/service"
    "encoding/json"
    "net/http"
    "time"
)

type AuthHandler struct {
    authService *service.AuthService
}

func NewAuthHandler(authService *service.AuthService) *AuthHandler {
    return &AuthHandler{authService: authService}
}

// Register 用户注册
func (h *AuthHandler) Register(w http.ResponseWriter, r *http.Request) {
    if r.Method != http.MethodPost {
        http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
        return
    }

    var req dto.RegisterRequest
    if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
        h.sendError(w, "INVALID_REQUEST", "请求格式错误", http.StatusBadRequest)
        return
    }

    // 调用服务层
    resp, err := h.authService.Register(r.Context(), req)
    if err != nil {
        h.handleServiceError(w, err)
        return
    }

    h.sendJSON(w, dto.SuccessResponse{
        Success: true,
        Data:    resp,
    }, http.StatusCreated)
}

// Login 用户登录
func (h *AuthHandler) Login(w http.ResponseWriter, r *http.Request) {
    if r.Method != http.MethodPost {
        http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
        return
    }

    var req dto.LoginRequest
    if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
        h.sendError(w, "INVALID_REQUEST", "请求格式错误", http.StatusBadRequest)
        return
    }

    // 获取客户端信息
    userAgent := r.UserAgent()
    ipAddress := r.RemoteAddr

    resp, err := h.authService.Login(r.Context(), req, userAgent, ipAddress)
    if err != nil {
        h.handleServiceError(w, err)
        return
    }

    h.sendJSON(w, dto.SuccessResponse{
        Success: true,
        Data:    resp,
    }, http.StatusOK)
}

// Logout 用户登出
func (h *AuthHandler) Logout(w http.ResponseWriter, r *http.Request) {
    if r.Method != http.MethodPost {
        http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
        return
    }

    var req dto.RefreshTokenRequest
    if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
        h.sendError(w, "INVALID_REQUEST", "请求格式错误", http.StatusBadRequest)
        return
    }

    if err := h.authService.Logout(r.Context(), req.RefreshToken); err != nil {
        h.handleServiceError(w, err)
        return
    }

    h.sendJSON(w, dto.SuccessResponse{
        Success: true,
        Data:    map[string]string{"message": "登出成功"},
    }, http.StatusOK)
}

// RefreshToken 刷新 Token
func (h *AuthHandler) RefreshToken(w http.ResponseWriter, r *http.Request) {
    if r.Method != http.MethodPost {
        http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
        return
    }

    var req dto.RefreshTokenRequest
    if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
        h.sendError(w, "INVALID_REQUEST", "请求格式错误", http.StatusBadRequest)
        return
    }

    resp, err := h.authService.RefreshToken(r.Context(), req.RefreshToken)
    if err != nil {
        h.handleServiceError(w, err)
        return
    }

    h.sendJSON(w, dto.SuccessResponse{
        Success: true,
        Data:    resp,
    }, http.StatusOK)
}

// GetCurrentUser 获取当前用户
func (h *AuthHandler) GetCurrentUser(w http.ResponseWriter, r *http.Request) {
    if r.Method != http.MethodGet {
        http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
        return
    }

    // 从 context 中获取用户 ID（由 auth 中间件设置）
    userID, ok := r.Context().Value("userID").(string)
    if !ok {
        h.sendError(w, "UNAUTHORIZED", "未认证", http.StatusUnauthorized)
        return
    }

    user, err := h.authService.GetUserByID(r.Context(), userID)
    if err != nil {
        h.handleServiceError(w, err)
        return
    }

    h.sendJSON(w, dto.SuccessResponse{
        Success: true,
        Data:    user,
    }, http.StatusOK)
}

// UpdateUser 更新用户信息
func (h *AuthHandler) UpdateUser(w http.ResponseWriter, r *http.Request) {
    if r.Method != http.MethodPut {
        http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
        return
    }

    userID, ok := r.Context().Value("userID").(string)
    if !ok {
        h.sendError(w, "UNAUTHORIZED", "未认证", http.StatusUnauthorized)
        return
    }

    var req dto.UpdateUserRequest
    if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
        h.sendError(w, "INVALID_REQUEST", "请求格式错误", http.StatusBadRequest)
        return
    }

    user, err := h.authService.UpdateUser(r.Context(), userID, req)
    if err != nil {
        h.handleServiceError(w, err)
        return
    }

    h.sendJSON(w, dto.SuccessResponse{
        Success: true,
        Data:    user,
    }, http.StatusOK)
}

// 辅助方法
func (h *AuthHandler) sendJSON(w http.ResponseWriter, data interface{}, status int) {
    w.Header().Set("Content-Type", "application/json")
    w.WriteHeader(status)
    json.NewEncoder(w).Encode(data)
}

func (h *AuthHandler) sendError(w http.ResponseWriter, code, message string, status int) {
    h.sendJSON(w, dto.ErrorResponse{
        Success: false,
        Error: &dto.ErrorInfo{
            Code:    code,
            Message: message,
        },
    }, status)
}

func (h *AuthHandler) handleServiceError(w http.ResponseWriter, err error) {
    // 根据错误类型返回不同的状态码
    switch err.Error() {
    case "USER_EXISTS":
        h.sendError(w, "USER_EXISTS", "邮箱已被注册", http.StatusConflict)
    case "INVALID_CREDENTIALS":
        h.sendError(w, "INVALID_CREDENTIALS", "邮箱或密码错误", http.StatusUnauthorized)
    case "ACCOUNT_LOCKED":
        h.sendError(w, "ACCOUNT_LOCKED", "账户已锁定，请稍后再试", http.StatusForbidden)
    case "INVALID_TOKEN":
        h.sendError(w, "INVALID_TOKEN", "Token 无效", http.StatusUnauthorized)
    case "TOKEN_EXPIRED":
        h.sendError(w, "TOKEN_EXPIRED", "Token 已过期", http.StatusUnauthorized)
    case "USER_NOT_FOUND":
        h.sendError(w, "USER_NOT_FOUND", "用户不存在", http.StatusNotFound)
    default:
        h.sendError(w, "INTERNAL_ERROR", "服务器内部错误", http.StatusInternalServerError)
    }
}
```

### 3.4 Service 层实现

```go
// backend/internal/service/auth_service.go
package service

import (
    "ai-bi-server/internal/dto"
    "ai-bi-server/internal/model"
    "context"
    "crypto/sha256"
    "encoding/hex"
    "errors"
    "time"

    "github.com/google/uuid"
    "golang.org/x/crypto/bcrypt"
    "gopkg.in/square/go-jose.v2/jwt"
    "gorm.io/gorm"
)

// JWT 配置
var (
    jwtSecret     = []byte(getEnv("JWT_SECRET", "your-secret-key-change-in-production"))
    accessTokenExpiry  = 15 * time.Minute
    refreshTokenExpiry = 7 * 24 * time.Hour
)

type AuthService struct {
    db *gorm.DB
}

func NewAuthService(db *gorm.DB) *AuthService {
    return &AuthService{db: db}
}

// Register 用户注册
func (s *AuthService) Register(ctx context.Context, req dto.RegisterRequest) (*dto.AuthResponse, error) {
    // 验证邮箱格式
    if !isValidEmail(req.Email) {
        return nil, errors.New("INVALID_EMAIL")
    }

    // 验证密码强度
    if err := validatePasswordStrength(req.Password); err != nil {
        return nil, err
    }

    // 检查邮箱是否已存在
    var existingUser model.User
    if err := s.db.Where("email = ?", req.Email).First(&existingUser).Error; err == nil {
        return nil, errors.New("USER_EXISTS")
    }

    // 密码加密
    hashedPassword, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
    if err != nil {
        return nil, errors.New("INTERNAL_ERROR")
    }

    // 事务处理
    var user model.User
    var tenantID = req.TenantID

    err = s.db.Transaction(func(tx *gorm.DB) error {
        // 如未提供租户 ID，创建新租户
        if tenantID == "" {
            tenantID = uuid.New().String()
            tenant := model.Tenant{
                ID:   tenantID,
                Name: "默认租户",
                Plan: "free",
            }
            if err := tx.Create(&tenant).Error; err != nil {
                return err
            }
        }

        // 创建用户
        user = model.User{
            ID:           uuid.New().String(),
            TenantID:     tenantID,
            Name:         req.Name,
            Email:        req.Email,
            PasswordHash: string(hashedPassword),
            Role:         "owner", // 第一个用户为 owner
        }
        return tx.Create(&user).Error
    })

    if err != nil {
        return nil, errors.New("INTERNAL_ERROR")
    }

    // 生成 Token
    tokens, err := s.generateTokens(user.ID)
    if err != nil {
        return nil, errors.New("INTERNAL_ERROR")
    }

    return &dto.AuthResponse{
        User: dto.UserDTO{
            ID:        user.ID,
            TenantID:  user.TenantID,
            Name:      user.Name,
            Email:     user.Email,
            Role:      user.Role,
            CreatedAt: user.CreatedAt,
        },
        Tokens: tokens,
    }, nil
}

// Login 用户登录
func (s *AuthService) Login(ctx context.Context, req dto.LoginRequest, userAgent, ipAddress string) (*dto.AuthResponse, error) {
    // 查找用户
    var user model.User
    if err := s.db.Where("email = ?", req.Email).First(&user).Error; err != nil {
        if errors.Is(err, gorm.ErrRecordNotFound) {
            return nil, errors.New("INVALID_CREDENTIALS")
        }
        return nil, errors.New("INTERNAL_ERROR")
    }

    // 检查账户是否被锁定
    if user.LockedUntil != nil && time.Now().Before(*user.LockedUntil) {
        return nil, errors.New("ACCOUNT_LOCKED")
    }

    // 验证密码
    if err := bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(req.Password)); err != nil {
        // 增加失败计数
        s.incrementLoginAttempts(user.ID)
        return nil, errors.New("INVALID_CREDENTIALS")
    }

    // 登录成功，重置失败计数
    s.resetLoginAttempts(user.ID)

    // 更新最后登录时间
    now := time.Now()
    s.db.Model(&user).Update("last_login_at", now)

    // 生成 Token
    tokens, err := s.generateTokens(user.ID)
    if err != nil {
        return nil, errors.New("INTERNAL_ERROR")
    }

    // 保存 Refresh Token
    if err := s.saveRefreshToken(user.ID, tokens.RefreshToken, userAgent, ipAddress); err != nil {
        return nil, errors.New("INTERNAL_ERROR")
    }

    return &dto.AuthResponse{
        User: dto.UserDTO{
            ID:          user.ID,
            TenantID:    user.TenantID,
            Name:        user.Name,
            Email:       user.Email,
            Role:        user.Role,
            LastLoginAt: user.LastLoginAt,
            CreatedAt:   user.CreatedAt,
        },
        Tokens: tokens,
    }, nil
}

// Logout 用户登出
func (s *AuthService) Logout(ctx context.Context, refreshToken string) error {
    // 吊销 Refresh Token
    tokenHash := hashToken(refreshToken)
    now := time.Now()
    result := s.db.Model(&model.RefreshToken{}).
        Where("token = ? AND revoked_at IS NULL", tokenHash).
        Update("revoked_at", now)

    if result.RowsAffected == 0 {
        return errors.New("INVALID_TOKEN")
    }

    return nil
}

// RefreshToken 刷新 Token
func (s *AuthService) RefreshToken(ctx context.Context, refreshToken string) (*dto.RefreshTokenResponse, error) {
    // 验证 Refresh Token
    tokenHash := hashToken(refreshToken)
    
    var storedToken model.RefreshToken
    if err := s.db.Where("token = ? AND revoked_at IS NULL", tokenHash).
        Preload("User").First(&storedToken).Error; err != nil {
        return nil, errors.New("INVALID_TOKEN")
    }

    // 检查是否过期
    if time.Now().After(storedToken.ExpiresAt) {
        return nil, errors.New("TOKEN_EXPIRED")
    }

    // 生成新的 Access Token
    newAccessToken, err := s.generateAccessToken(storedToken.UserID)
    if err != nil {
        return nil, errors.New("INTERNAL_ERROR")
    }

    // 可选：轮换 Refresh Token
    // var newRefreshToken string
    // if shouldRotate() {
    //     // 吊销旧 Token
    //     s.db.Model(&storedToken).Update("revoked_at", time.Now())
    //     // 生成新 Token
    //     newRefreshToken, _ = s.generateRefreshToken(storedToken.UserID)
    //     s.saveRefreshToken(storedToken.UserID, newRefreshToken, storedToken.UserAgent, storedToken.IPAddress)
    // }

    return &dto.RefreshTokenResponse{
        AccessToken:  newAccessToken,
        RefreshToken: "", // 轮换时返回新 Token
        ExpiresIn:    int(accessTokenExpiry.Seconds()),
    }, nil
}

// GetUserByID 根据 ID 获取用户
func (s *AuthService) GetUserByID(ctx context.Context, userID string) (*dto.UserDTO, error) {
    var user model.User
    if err := s.db.Where("id = ?", userID).First(&user).Error; err != nil {
        if errors.Is(err, gorm.ErrRecordNotFound) {
            return nil, errors.New("USER_NOT_FOUND")
        }
        return nil, errors.New("INTERNAL_ERROR")
    }

    return &dto.UserDTO{
        ID:          user.ID,
        TenantID:    user.TenantID,
        Name:        user.Name,
        Email:       user.Email,
        Role:        user.Role,
        LastLoginAt: user.LastLoginAt,
        CreatedAt:   user.CreatedAt,
    }, nil
}

// UpdateUser 更新用户信息
func (s *AuthService) UpdateUser(ctx context.Context, userID string, req dto.UpdateUserRequest) (*dto.UserDTO, error) {
    var user model.User
    if err := s.db.Where("id = ?", userID).First(&user).Error; err != nil {
        return nil, errors.New("USER_NOT_FOUND")
    }

    updates := make(map[string]interface{})
    if req.Name != "" {
        updates["name"] = req.Name
    }

    if len(updates) > 0 {
        s.db.Model(&user).Updates(updates)
    }

    return s.GetUserByID(ctx, userID)
}

// 辅助方法

func (s *AuthService) generateTokens(userID string) (dto.TokenResponse, error) {
    accessToken, err := s.generateAccessToken(userID)
    if err != nil {
        return dto.TokenResponse{}, err
    }

    refreshToken, err := s.generateRefreshToken(userID)
    if err != nil {
        return dto.TokenResponse{}, err
    }

    return dto.TokenResponse{
        AccessToken:  accessToken,
        RefreshToken: refreshToken,
        ExpiresIn:    int(accessTokenExpiry.Seconds()),
        TokenType:    "Bearer",
    }, nil
}

func (s *AuthService) generateAccessToken(userID string) (string, error) {
    now := time.Now()
    claims := jwt.Claims{
        Issuer:    "ai-bi-server",
        Subject:   userID,
        IssuedAt:  jwt.NewNumericDate(now),
        Expiry:    jwt.NewNumericDate(now.Add(accessTokenExpiry)),
        NotBefore: jwt.NewNumericDate(now),
    }

    signer, err := jwt.NewSignerHS(jwt.HS256, jwtSecret)
    if err != nil {
        return "", err
    }

    builder := jwt.Signed(signer).Claims(claims)
    return builder.CompactSerialize()
}

func (s *AuthService) generateRefreshToken(userID string) (string, error) {
    now := time.Now()
    claims := jwt.Claims{
        Issuer:    "ai-bi-server",
        Subject:   userID,
        IssuedAt:  jwt.NewNumericDate(now),
        Expiry:    jwt.NewNumericDate(now.Add(refreshTokenExpiry)),
        NotBefore: jwt.NewNumericDate(now),
    }

    // 使用不同的密钥签名 Refresh Token
    refreshSigner, err := jwt.NewSignerHS(jwt.HS256, append(jwtSecret, []byte("-refresh")...))
    if err != nil {
        return "", err
    }

    builder := jwt.Signed(refreshSigner).Claims(claims)
    return builder.CompactSerialize()
}

func (s *AuthService) saveRefreshToken(userID, token, userAgent, ipAddress string) error {
    tokenHash := hashToken(token)
    refreshToken := model.RefreshToken{
        ID:        uuid.New().String(),
        UserID:    userID,
        Token:     tokenHash,
        ExpiresAt: time.Now().Add(refreshTokenExpiry),
        UserAgent: userAgent,
        IPAddress: ipAddress,
    }
    return s.db.Create(&refreshToken).Error
}

func (s *AuthService) incrementLoginAttempts(userID string) {
    s.db.Exec(`UPDATE users SET login_attempts = login_attempts + 1, 
               locked_until = CASE WHEN login_attempts + 1 >= 5 THEN ? ELSE locked_until END 
               WHERE id = ?`, time.Now().Add(15*time.Minute), userID)
}

func (s *AuthService) resetLoginAttempts(userID string) {
    s.db.Model(&model.User{}).Where("id = ?", userID).
        Updates(map[string]interface{}{"login_attempts": 0, "locked_until": nil})
}

func hashToken(token string) string {
    hash := sha256.Sum256([]byte(token))
    return hex.EncodeToString(hash[:])
}

func isValidEmail(email string) bool {
    // 简单的邮箱验证，可使用更严格的正则
    return len(email) > 5 && 
           email[0] != '@' && 
           email[len(email)-1] != '@' &&
           containsAt(email)
}

func containsAt(s string) bool {
    for i := 0; i < len(s); i++ {
        if s[i] == '@' {
            return true
        }
    }
    return false
}

func validatePasswordStrength(password string) error {
    if len(password) < 8 {
        return errors.New("PASSWORD_TOO_SHORT")
    }
    
    var hasUpper, hasLower, hasDigit, hasSpecial bool
    for _, r := range password {
        switch {
        case r >= 'A' && r <= 'Z':
            hasUpper = true
        case r >= 'a' && r <= 'z':
            hasLower = true
        case r >= '0' && r <= '9':
            hasDigit = true
        default:
            hasSpecial = true
        }
    }

    if !hasUpper || !hasLower || !hasDigit || !hasSpecial {
        return errors.New("PASSWORD_WEAK")
    }

    return nil
}

func getEnv(key, fallback string) string {
    if v := os.Getenv(key); v != "" {
        return v
    }
    return fallback
}
```

### 3.5 Auth 中间件

```go
// backend/internal/middleware/auth.go
package middleware

import (
    "context"
    "gopkg.in/square/go-jose.v2/jwt"
    "net/http"
    "strings"
)

var jwtSecret = []byte(getEnv("JWT_SECRET", "your-secret-key-change-in-production"))

// AuthMiddleware JWT 认证中间件
func AuthMiddleware(next http.Handler) http.Handler {
    return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
        // 获取 Authorization header
        authHeader := r.Header.Get("Authorization")
        if authHeader == "" {
            http.Error(w, `{"error": "missing_authorization_header"}`, http.StatusUnauthorized)
            return
        }

        // 解析 Bearer Token
        parts := strings.Split(authHeader, " ")
        if len(parts) != 2 || parts[0] != "Bearer" {
            http.Error(w, `{"error": "invalid_authorization_header"}`, http.StatusUnauthorized)
            return
        }

        token := parts[1]

        // 验证并解析 Token
        parsed, err := jwt.ParseSigned(token)
        if err != nil {
            http.Error(w, `{"error": "invalid_token"}`, http.StatusUnauthorized)
            return
        }

        var claims jwt.Claims
        if err := parsed.Claims(jwtSecret, &claims); err != nil {
            http.Error(w, `{"error": "token_verification_failed"}`, http.StatusUnauthorized)
            return
        }

        // 检查过期
        if err := claims.Validate(jwt.Expected{Time: time.Now()}); err != nil {
            http.Error(w, `{"error": "token_expired"}`, http.StatusUnauthorized)
            return
        }

        // 将用户 ID 注入 context
        ctx := context.WithValue(r.Context(), "userID", claims.Subject)
        next.ServeHTTP(w, r.WithContext(ctx))
    })
}
```

### 3.6 路由注册

在 `backend/cmd/main.go` 中添加认证路由：

```go
// 导入
import (
    "ai-bi-server/internal/middleware"
    "ai-bi-server/internal/handler"
    "ai-bi-server/internal/service"
)

func main() {
    // ... 现有代码
    
    // 初始化认证服务
    authService := service.NewAuthService(db)
    authHandler := handler.NewAuthHandler(authService)

    // 认证路由（无需认证）
    mux.HandleFunc("/api/auth/register", authHandler.Register)
    mux.HandleFunc("/api/auth/login", authHandler.Login)
    mux.HandleFunc("/api/auth/logout", authHandler.Logout)
    mux.HandleFunc("/api/auth/refresh", authHandler.RefreshToken)

    // 需要认证的路由
    protectedMux := middleware.AuthMiddleware(http.NewServeMux())
    protectedMux.HandleFunc("/api/auth/me", authHandler.GetCurrentUser)
    protectedMux.HandleFunc("/api/auth/me", authHandler.UpdateUser) // PUT

    // 将 protectedMux 的路由代理到主 mux
    mux.HandleFunc("/api/auth/me", func(w http.ResponseWriter, r *http.Request) {
        protectedMux.ServeHTTP(w, r)
    })

    // ... 其他路由
}
```

---

## 4. 前端实现

### 4.1 类型定义

```typescript
// frontend/lib/auth/types.ts

export interface User {
  id: string;
  tenantId: string;
  name: string;
  email: string;
  role: 'owner' | 'admin' | 'member';
  lastLoginAt?: string;
  createdAt: string;
}

export interface Tokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  tokenType: 'Bearer';
}

export interface AuthResponse {
  user: User;
  tokens: Tokens;
}

export interface RegisterRequest {
  email: string;
  password: string;
  name?: string;
  tenantId?: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RefreshTokenResponse {
  accessToken: string;
  refreshToken?: string;
  expiresIn: number;
}

export interface ApiError {
  code: string;
  message: string;
}

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  error?: ApiError;
}
```

### 4.2 API 客户端

```typescript
// frontend/lib/auth/api.ts

import type {
  User,
  AuthResponse,
  RegisterRequest,
  LoginRequest,
  RefreshTokenResponse,
  ApiResponse,
} from './types';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || '/api';

// 存储 Token
const ACCESS_TOKEN_KEY = 'access_token';
const REFRESH_TOKEN_KEY = 'refresh_token';

export function getAccessToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(ACCESS_TOKEN_KEY);
}

export function getRefreshToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(REFRESH_TOKEN_KEY);
}

export function setTokens(accessToken: string, refreshToken: string): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
  localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
}

export function clearTokens(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
}

async function request<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<ApiResponse<T>> {
  const url = `${API_BASE}${endpoint}`;
  
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  // 自动添加 Access Token
  const accessToken = getAccessToken();
  if (accessToken) {
    (headers as Record<string, string>)['Authorization'] = `Bearer ${accessToken}`;
  }

  const response = await fetch(url, {
    ...options,
    headers,
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error?.message || 'Request failed');
  }

  return data;
}

// 带重试的请求（处理 Token 过期）
async function requestWithRetry<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<ApiResponse<T>> {
  try {
    return await request<T>(endpoint, options);
  } catch (error) {
    // 如果是 401，尝试刷新 Token
    const refreshToken = getRefreshToken();
    if (refreshToken) {
      try {
        const refreshData = await request<RefreshTokenResponse>('/auth/refresh', {
          method: 'POST',
          body: JSON.stringify({ refreshToken }),
        });

        if (refreshData.success) {
          // 更新 Token
          setTokens(
            refreshData.data.accessToken,
            refreshData.data.refreshToken || refreshToken
          );

          // 重试原请求
          return await request<T>(endpoint, options);
        }
      } catch {
        // 刷新失败，清除 Token
        clearTokens();
      }
    }
    throw error;
  }
}

// 注册
export async function register(data: RegisterRequest): Promise<ApiResponse<AuthResponse>> {
  return request('/auth/register', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

// 登录
export async function login(data: LoginRequest): Promise<ApiResponse<AuthResponse>> {
  return request('/auth/login', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

// 登出
export async function logout(): Promise<ApiResponse<{ message: string }>> {
  const refreshToken = getRefreshToken();
  clearTokens();
  
  if (refreshToken) {
    try {
      await request('/auth/logout', {
        method: 'POST',
        body: JSON.stringify({ refreshToken }),
      });
    } catch {
      // 登出失败也继续
    }
  }
  
  return { success: true, data: { message: '登出成功' } };
}

// 获取当前用户
export async function getCurrentUser(): Promise<ApiResponse<User>> {
  return requestWithRetry('/auth/me');
}

// 更新用户
export async function updateUser(data: { name?: string }): Promise<ApiResponse<User>> {
  return requestWithRetry('/auth/me', {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}
```

### 4.3 更新 user-store.ts

```typescript
// frontend/lib/user-store.ts (更新后)

"use client";

import type { User } from "./auth/types";
import { getAccessToken, setTokens, clearTokens } from "./auth/api";

const USER_STORAGE_KEY = "ai-bi-user-session";

export function getCurrentUser(): User | null {
  if (globalThis.window === undefined) return null;
  
  // 优先从 localStorage 读取
  try {
    const raw = localStorage.getItem(USER_STORAGE_KEY);
    if (raw) {
      return JSON.parse(raw) as User;
    }
  } catch {
    return null;
  }
  
  return null;
}

export function saveCurrentUser(user: User): void {
  if (globalThis.window === undefined) return;
  localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(user));
}

export function loginUser(user: User, accessToken: string, refreshToken: string): void {
  setTokens(accessToken, refreshToken);
  saveCurrentUser(user);
}

export function logoutUser(): void {
  if (globalThis.window === undefined) return;
  localStorage.removeItem(USER_STORAGE_KEY);
  clearTokens();
}

export function isAuthenticated(): boolean {
  return getAccessToken() !== null;
}

// 原有的 Mock 函数保留用于开发测试
// ...
```

### 4.4 登录页面

```tsx
// frontend/app/auth/login/page.tsx

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { login } from "@/lib/auth/api";
import { loginUser } from "@/lib/user-store";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const response = await login({ email, password });
      
      if (response.success) {
        const { user, tokens } = response.data;
        loginUser(user, tokens.accessToken, tokens.refreshToken);
        router.push("/");
      } else {
        setError(response.error?.message || "登录失败");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "登录失败");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full space-y-8 p-8 bg-white rounded-lg shadow">
        <div>
          <h2 className="text-center text-3xl font-extrabold text-gray-900">
            登录 AI-BI
          </h2>
        </div>
        
        {error && (
          <div className="bg-red-50 text-red-500 p-3 rounded text-sm">
            {error}
          </div>
        )}

        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          <div className="rounded-md shadow-sm space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                邮箱
              </label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                placeholder="you@example.com"
              />
            </div>
            
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                密码
              </label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>

          <div>
            <button
              type="submit"
              disabled={loading}
              className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
            >
              {loading ? "登录中..." : "登录"}
            </button>
          </div>

          <div className="text-center">
            <a href="/auth/register" className="text-sm text-blue-600 hover:text-blue-500">
              还没有账户？立即注册
            </a>
          </div>
        </form>
      </div>
    </div>
  );
}
```

### 4.5 注册页面

```tsx
// frontend/app/auth/register/page.tsx

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { register } from "@/lib/auth/api";
import { loginUser } from "@/lib/user-store";

const PASSWORD_RULES = [
  { regex: /.{8,}/, label: "至少 8 个字符" },
  { regex: /[A-Z]/, label: "包含大写字母" },
  { regex: /[a-z]/, label: "包含小写字母" },
  { regex: /[0-9]/, label: "包含数字" },
  { regex: /[^A-Za-z0-9]/, label: "包含特殊字符" },
];

export default function RegisterPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const getPasswordStrength = () => {
    return PASSWORD_RULES.filter(rule => rule.regex.test(password)).length;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    // 验证密码强度
    const strength = getPasswordStrength();
    if (strength < PASSWORD_RULES.length) {
      setError("密码强度不足，请满足所有要求");
      return;
    }

    setLoading(true);

    try {
      const response = await register({ email, password, name: name || undefined });
      
      if (response.success) {
        const { user, tokens } = response.data;
        loginUser(user, tokens.accessToken, tokens.refreshToken);
        router.push("/");
      } else {
        setError(response.error?.message || "注册失败");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "注册失败");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full space-y-8 p-8 bg-white rounded-lg shadow">
        <div>
          <h2 className="text-center text-3xl font-extrabold text-gray-900">
            注册 AI-BI
          </h2>
        </div>

        {error && (
          <div className="bg-red-50 text-red-500 p-3 rounded text-sm">
            {error}
          </div>
        )}

        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          <div className="space-y-4">
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-gray-700">
                昵称（可选）
              </label>
              <input
                id="name"
                name="name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                placeholder="Your Name"
              />
            </div>

            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                邮箱
              </label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                placeholder="you@example.com"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                密码
              </label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="new-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
              />
              
              {/* 密码强度指示器 */}
              <div className="mt-2 space-y-1">
                {PASSWORD_RULES.map((rule, index) => (
                  <div
                    key={index}
                    className={`text-xs ${rule.regex.test(password) ? 'text-green-600' : 'text-gray-400'}`}
                  >
                    {rule.regex.test(password) ? '✓' : '○'} {rule.label}
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div>
            <button
              type="submit"
              disabled={loading || getPasswordStrength() < PASSWORD_RULES.length}
              className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
            >
              {loading ? "注册中..." : "注册"}
            </button>
          </div>

          <div className="text-center">
            <a href="/auth/login" className="text-sm text-blue-600 hover:text-blue-500">
              已有账户？立即登录
            </a>
          </div>
        </form>
      </div>
    </div>
  );
}
```

### 4.6 API 请求拦截器

```typescript
// frontend/lib/api-client.ts

import { getAccessToken, requestWithRetry } from './auth/api';

// 创建统一的 API 客户端
export const apiClient = {
  // GET 请求
  async get<T>(endpoint: string): Promise<T> {
    const response = await requestWithRetry<T>(endpoint, { method: 'GET' });
    return response.data;
  },

  // POST 请求
  async post<T>(endpoint: string, data?: unknown): Promise<T> {
    const response = await requestWithRetry<T>(endpoint, {
      method: 'POST',
      body: JSON.stringify(data),
    });
    return response.data;
  },

  // PUT 请求
  async put<T>(endpoint: string, data?: unknown): Promise<T> {
    const response = await requestWithRetry<T>(endpoint, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
    return response.data;
  },

  // DELETE 请求
  async delete<T>(endpoint: string): Promise<T> {
    const response = await requestWithRetry<T>(endpoint, { method: 'DELETE' });
    return response.data;
  },
};

// 使用示例：
// const metrics = await apiClient.get<Metric[]>('/tenants/' + tenantId + '/metrics');
```

### 4.7 保护路由

```tsx
// frontend/components/auth-guard.tsx

"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { isAuthenticated, getCurrentUser } from "@/lib/user-store";

interface AuthGuardProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export default function AuthGuard({ children, fallback }: AuthGuardProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [isChecking, setIsChecking] = useState(true);
  const [isAuth, setIsAuth] = useState(false);

  useEffect(() => {
    // 跳过登录/注册页面
    if (pathname.startsWith('/auth')) {
      setIsChecking(false);
      setIsAuth(true);
      return;
    }

    const checkAuth = async () => {
      const auth = isAuthenticated();
      
      if (!auth) {
        router.push('/auth/login');
        return;
      }

      // 可选：验证 Token 是否有效
      try {
        await getCurrentUser();
        setIsAuth(true);
      } catch {
        router.push('/auth/login');
        return;
      }
      
      setIsChecking(false);
    };

    checkAuth();
  }, [pathname, router]);

  if (isChecking) {
    return fallback || (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!isAuth) {
    return null;
  }

  return <>{children}</>;
}
```

---

## 5. 安全考虑

### 5.1 密码安全

- 使用 BCrypt 加密，cost factor = 12
- 密码永不明文传输（HTTPS）
- 密码永不明文存储

### 5.2 Token 安全

- Access Token 短期有效（15 分钟）
- Refresh Token 长期有效但可吊销（7 天）
- Token 使用 HS256 签名
- 生产环境必须使用强密钥

### 5.3 防暴力破解

- 5 次失败登录后锁定 15 分钟
- 记录登录 IP 和 User Agent
- 可选：集成验证码

### 5.4 CORS 配置

更新现有 CORS 中间件：

```go
// backend/internal/middleware/cors.go
package middleware

import (
    "net/http"
    "os"
    "strings"
)

func CORSMiddleware(next http.Handler) http.Handler {
    return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
        // 生产环境配置允许的域名
        allowedOrigins := []string{
            "https://your-domain.com",
            "https://www.your-domain.com",
        }
        
        // 开发环境允许 localhost
        if os.Getenv("ENV") != "production" {
            allowedOrigins = append(allowedOrigins, 
                "http://localhost:3000",
                "http://localhost:3001",
            )
        }

        origin := r.Header.Get("Origin")
        isAllowed := false
        for _, allowed := range allowedOrigins {
            if origin == allowed || strings.HasSuffix(origin, ".monkeycode-ai.online") {
                isAllowed = true
                break
            }
        }

        if isAllowed {
            w.Header().Set("Access-Control-Allow-Origin", origin)
            w.Header().Set("Access-Control-Allow-Credentials", "true")
        }

        w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
        w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")
        w.Header().Set("Access-Control-Max-Age", "86400") // 24 小时

        if r.Method == "OPTIONS" {
            w.WriteHeader(http.StatusNoContent)
            return
        }

        next.ServeHTTP(w, r)
    })
}
```

---

## 6. 环境变量配置

### 6.1 后端环境变量

```bash
# .env.example (backend)

# JWT 密钥（生产环境必须修改）
JWT_SECRET=your-super-secret-jwt-key-change-in-production

# 数据库配置
USE_SQLITE=false
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=postgres
DB_NAME=ai_bi

# 服务器端口
SERVER_PORT=3001

# 环境（development/production）
ENV=development
```

### 6.2 前端环境变量

```bash
# .env.local (frontend)

# API 地址
NEXT_PUBLIC_API_URL=http://localhost:3001

# 生产环境
# NEXT_PUBLIC_API_URL=https://api.your-domain.com
```

---

## 7. 部署清单

### 7.1 开发环境

1. [ ] 安装 Go 依赖：`cd backend && go mod tidy`
2. [ ] 安装 Node 依赖：`cd frontend && npm install`
3. [ ] 配置环境变量
4. [ ] 启动后端：`cd backend && go run cmd/main.go`
5. [ ] 启动前端：`cd frontend && npm run dev`

### 7.2 生产环境

1. [ ] 生成强 JWT 密钥
2. [ ] 配置 HTTPS
3. [ ] 设置 CORS 白名单
4. [ ] 配置数据库连接
5. [ ] 启用日志记录
6. [ ] 配置监控告警

---

## 8. 测试计划

### 8.1 单元测试

- [ ] 密码强度验证
- [ ] Token 生成与验证
- [ ] 用户注册逻辑
- [ ] 用户登录逻辑

### 8.2 集成测试

- [ ] 注册 -> 登录 -> 访问 API -> 刷新 Token -> 登出
- [ ] Token 过期自动刷新
- [ ] 暴力破解防护
- [ ] 未认证请求被拒绝

### 8.3 E2E 测试

- [ ] 完整注册流程
- [ ] 完整登录流程
- [ ] 受保护路由访问

---

## 9. 未来扩展

1. **OAuth 集成**: 支持 Google、GitHub 等第三方登录
2. **双因素认证 (2FA)**: TOTP 或短信验证
3. **SSO 单点登录**: SAML/OIDC 集成
4. **审计日志**: 记录所有认证相关事件
5. **会话管理**: 查看和管理活动会话
6. **密码重置**: 邮件验证码重置密码
