package dto

import "time"

// RegisterRequest 注册请求（无 tenantId，所有用户属于默认组织）
type RegisterRequest struct {
	Email    string `json:"email" validate:"required,email"`
	Password string `json:"password" validate:"required,min=6"`
	Name     string `json:"name" validate:"required"`
}

// LoginRequest 登录请求
type LoginRequest struct {
	Email    string `json:"email" validate:"required,email"`
	Password string `json:"password" validate:"required"`
}

// RefreshTokenRequest 刷新 Token 请求
type RefreshTokenRequest struct {
	RefreshToken string `json:"refreshToken" validate:"required"`
}

// UpdateUserRequest 更新用户信息请求
type UpdateUserRequest struct {
	Name  string `json:"name"`
	Email string `json:"email"`
	Role  string `json:"role"`
}

// ChangePasswordRequest 修改密码请求
type ChangePasswordRequest struct {
	OldPassword string `json:"oldPassword" validate:"required"`
	NewPassword string `json:"newPassword" validate:"required,min=6"`
}

// ForgotPasswordRequest 忘记密码请求
type ForgotPasswordRequest struct {
	Email string `json:"email" validate:"required,email"`
}

// ForgotPasswordResponse 忘记密码响应
type ForgotPasswordResponse struct {
	Message string `json:"message"`
}

// ResetPasswordRequest 重置密码请求
type ResetPasswordRequest struct {
	Token       string `json:"token" validate:"required"`
	NewPassword string `json:"newPassword" validate:"required,min=6"`
}

// ValidateResetTokenResponse 校验重置令牌响应
type ValidateResetTokenResponse struct {
	Valid   bool   `json:"valid"`
	Message string `json:"message,omitempty"`
}

// Tokens 访问令牌和刷新令牌
type Tokens struct {
	AccessToken  string `json:"accessToken"`
	RefreshToken string `json:"refreshToken"`
	ExpiresIn    int64  `json:"expiresIn"` // Access Token 过期时间（秒）
}

// UserResponse 用户信息响应
type UserResponse struct {
	ID          string     `json:"id"`
	TenantID    string     `json:"tenantId"`
	Name        string     `json:"name"`
	Email       string     `json:"email"`
	Role        string     `json:"role"`
	LastLoginAt *time.Time `json:"lastLoginAt,omitempty"`
	CreatedAt   string     `json:"createdAt"`
}

// LoginResponse 登录响应
type LoginResponse struct {
	User        *UserResponse `json:"user,omitempty"`
	Tokens      *Tokens       `json:"tokens,omitempty"`
	Unactivated bool          `json:"unactivated"` // 系统是否未激活
	SystemName  string        `json:"systemName"`  // 系统名称
	Version     string        `json:"version"`     // 系统版本
}

// RegisterResponse 注册响应
type RegisterResponse struct {
	User   *UserResponse `json:"user"`
	Tokens *Tokens       `json:"tokens"`
}

// AuthError 认证错误响应
type AuthError struct {
	Code    string `json:"code"`
	Message string `json:"message"`
}

// ActivateRequest 激活请求
type ActivateRequest struct {
	LicenseKey string `json:"licenseKey" validate:"required"`
	Name       string `json:"name" validate:"required"`
	Email      string `json:"email" validate:"required,email"`
	Password   string `json:"password" validate:"required,min=6"`
}

// ActivateResponse 激活响应
type ActivateResponse struct {
	Activated bool          `json:"activated"`
	User      *UserResponse `json:"user,omitempty"`
	Tokens    *Tokens       `json:"tokens,omitempty"`
	Error     string        `json:"error,omitempty"`
	Code      string        `json:"code,omitempty"`
}

// CreateUserRequest 管理员创建用户请求
type CreateUserRequest struct {
	Name     string `json:"name" validate:"required"`
	Email    string `json:"email" validate:"required,email"`
	Password string `json:"password" validate:"required,min=6"`
	Role     string `json:"role" validate:"required"` // admin / member
}

// Common error codes
const (
	ErrCodeInvalidCredentials = "INVALID_CREDENTIALS"
	ErrCodeAccountLocked      = "ACCOUNT_LOCKED"
	ErrCodeTokenExpired       = "TOKEN_EXPIRED"
	ErrCodeTokenInvalid       = "TOKEN_INVALID"
	ErrCodeUserNotFound       = "USER_NOT_FOUND"
	ErrCodeEmailAlreadyExists = "EMAIL_ALREADY_EXISTS"
	ErrCodeWeakPassword       = "WEAK_PASSWORD"
	ErrCodeUnauthorized       = "UNAUTHORIZED"
	ErrCodeForbidden          = "FORBIDDEN"
	ErrCodeInternalError      = "INTERNAL_ERROR"
	ErrCodeNotActivated       = "NOT_ACTIVATED"
	ErrCodeInvalidLicense     = "INVALID_LICENSE_KEY"
	ErrCodeAlreadyActivated   = "ALREADY_ACTIVATED"
)
