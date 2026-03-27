package handler

import (
	"ai-bi-server/internal/dto"
	"ai-bi-server/internal/service"
	"encoding/json"
	"net/http"
	"strings"
)

type AuthHandler struct {
	authService *service.AuthService
}

func NewAuthHandler(authService *service.AuthService) *AuthHandler {
	return &AuthHandler{authService: authService}
}

// extractBearerToken 从 Authorization 头提取 Bearer Token
func extractBearerToken(r *http.Request) string {
	authHeader := r.Header.Get("Authorization")
	if authHeader == "" {
		return ""
	}

	parts := strings.Split(authHeader, " ")
	if len(parts) != 2 || parts[0] != "Bearer" {
		return ""
	}

	return parts[1]
}

// getUserIDFromContext 从上下文获取用户 ID（由中间件设置）
func getUserIDFromContext(r *http.Request) string {
	return r.Context().Value("userID").(string)
}

// GetSystemStatus 获取系统状态（无需认证）
// GET /api/auth/status
func (h *AuthHandler) GetSystemStatus(w http.ResponseWriter, r *http.Request) {
	isActivated, systemName, version := h.authService.ValidateLicense()
	writeJSON(w, http.StatusOK, map[string]interface{}{
		"unactivated": !isActivated,
		"systemName":  systemName,
		"version":     version,
	})
}

// Register 处理注册请求
// POST /api/auth/register
func (h *AuthHandler) Register(w http.ResponseWriter, r *http.Request) {
	var req dto.RegisterRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "请求体解析失败")
		return
	}

	// 基本验证
	if req.Email == "" || req.Password == "" || req.Name == "" {
		writeError(w, http.StatusBadRequest, "email, password, name 必填")
		return
	}

	if len(req.Password) < 6 {
		writeError(w, http.StatusBadRequest, "密码长度至少 6 位")
		return
	}

	user, tokens, err := h.authService.Register(&req)
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}

	response := &dto.RegisterResponse{
		User: &dto.UserResponse{
			ID:        user.ID,
			TenantID:  user.TenantID,
			Name:      user.Name,
			Email:     user.Email,
			Role:      user.Role,
			CreatedAt: user.CreatedAt.Format("2006-01-02T15:04:05Z"),
		},
		Tokens: tokens,
	}

	writeJSON(w, http.StatusCreated, response)
}

// Login 处理登录请求
// POST /api/auth/login
func (h *AuthHandler) Login(w http.ResponseWriter, r *http.Request) {
	var req dto.LoginRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "请求体解析失败")
		return
	}

	if req.Email == "" || req.Password == "" {
		writeError(w, http.StatusBadRequest, "email 和 password 必填")
		return
	}

	user, tokens, err := h.authService.Login(&req)
	if err != nil {
		writeError(w, http.StatusUnauthorized, err.Error())
		return
	}

	response := &dto.LoginResponse{
		User: &dto.UserResponse{
			ID:          user.ID,
			TenantID:    user.TenantID,
			Name:        user.Name,
			Email:       user.Email,
			Role:        user.Role,
			LastLoginAt: user.LastLoginAt,
			CreatedAt:   user.CreatedAt.Format("2006-01-02T15:04:05Z"),
		},
		Tokens: tokens,
	}

	isActivated, systemName, version := h.authService.ValidateLicense()
	response.Unactivated = !isActivated
	response.SystemName = systemName
	response.Version = version

	writeJSON(w, http.StatusOK, response)
}

// Logout 处理登出请求
// POST /api/auth/logout
func (h *AuthHandler) Logout(w http.ResponseWriter, r *http.Request) {
	userID := getUserIDFromContext(r)
	if userID == "" {
		writeError(w, http.StatusUnauthorized, "未认证")
		return
	}

	var req dto.RefreshTokenRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "请求体解析失败")
		return
	}

	if err := h.authService.Logout(userID, req.RefreshToken); err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	writeJSON(w, http.StatusOK, map[string]string{"message": "登出成功"})
}

// RefreshToken 处理刷新 Token 请求
// POST /api/auth/refresh
func (h *AuthHandler) RefreshToken(w http.ResponseWriter, r *http.Request) {
	var req dto.RefreshTokenRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "请求体解析失败")
		return
	}

	if req.RefreshToken == "" {
		writeError(w, http.StatusBadRequest, "refreshToken 必填")
		return
	}

	tokens, err := h.authService.RefreshToken(req.RefreshToken)
	if err != nil {
		writeError(w, http.StatusUnauthorized, err.Error())
		return
	}

	writeJSON(w, http.StatusOK, tokens)
}

// GetCurrentUser 获取当前用户信息
// GET /api/auth/me
func (h *AuthHandler) GetCurrentUser(w http.ResponseWriter, r *http.Request) {
	userID := getUserIDFromContext(r)
	if userID == "" {
		writeError(w, http.StatusUnauthorized, "未认证")
		return
	}

	user, err := h.authService.GetUserByID(userID)
	if err != nil {
		writeError(w, http.StatusNotFound, err.Error())
		return
	}

	response := &dto.UserResponse{
		ID:          user.ID,
		TenantID:    user.TenantID,
		Name:        user.Name,
		Email:       user.Email,
		Role:        user.Role,
		LastLoginAt: user.LastLoginAt,
		CreatedAt:   user.CreatedAt.Format("2006-01-02T15:04:05Z"),
	}

	writeJSON(w, http.StatusOK, response)
}

// UpdateUser 更新用户信息
// PUT /api/auth/me
func (h *AuthHandler) UpdateUser(w http.ResponseWriter, r *http.Request) {
	userID := getUserIDFromContext(r)
	if userID == "" {
		writeError(w, http.StatusUnauthorized, "未认证")
		return
	}

	var req dto.UpdateUserRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "请求体解析失败")
		return
	}

	updates := make(map[string]interface{})
	if req.Name != "" {
		updates["name"] = req.Name
	}
	if req.Email != "" {
		updates["email"] = req.Email
	}
	if req.Role != "" {
		updates["role"] = req.Role
	}

	user, err := h.authService.UpdateUser(userID, updates)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	response := &dto.UserResponse{
		ID:        user.ID,
		TenantID:  user.TenantID,
		Name:      user.Name,
		Email:     user.Email,
		Role:      user.Role,
		CreatedAt: user.CreatedAt.Format("2006-01-02T15:04:05Z"),
	}

	writeJSON(w, http.StatusOK, response)
}

// ChangePassword 修改密码
// POST /api/auth/change-password
func (h *AuthHandler) ChangePassword(w http.ResponseWriter, r *http.Request) {
	userID := getUserIDFromContext(r)
	if userID == "" {
		writeError(w, http.StatusUnauthorized, "未认证")
		return
	}

	var req dto.ChangePasswordRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "请求体解析失败")
		return
	}

	if req.OldPassword == "" || req.NewPassword == "" {
		writeError(w, http.StatusBadRequest, "oldPassword 和 newPassword 必填")
		return
	}

	if len(req.NewPassword) < 6 {
		writeError(w, http.StatusBadRequest, "新密码长度至少 6 位")
		return
	}

	if err := h.authService.ChangePassword(userID, req.OldPassword, req.NewPassword); err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}

	writeJSON(w, http.StatusOK, map[string]string{"message": "密码修改成功"})
}

// Activate 处理激活请求
// POST /api/auth/activate
func (h *AuthHandler) Activate(w http.ResponseWriter, r *http.Request) {
	var req dto.ActivateRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "请求体解析失败")
		return
	}

	if req.LicenseKey == "" || req.Name == "" || req.Email == "" || req.Password == "" {
		writeError(w, http.StatusBadRequest, "licenseKey, name, email, password 必填")
		return
	}

	if len(req.Password) < 6 {
		writeError(w, http.StatusBadRequest, "密码长度至少 6 位")
		return
	}

	user, tokens, err := h.authService.Activate(&req)
	if err != nil {
		// 根据错误类型返回对应的 HTTP 状态码
		statusCode := http.StatusBadRequest
		errCode := "ACTIVATION_FAILED"
		errMsg := err.Error()

		switch {
		case strings.Contains(errMsg, "授权码格式无效"):
			statusCode = http.StatusBadRequest
			errCode = dto.ErrCodeInvalidLicense
		case strings.Contains(errMsg, "授权码无效"):
			statusCode = http.StatusUnauthorized
			errCode = dto.ErrCodeInvalidLicense
		case strings.Contains(errMsg, "已被激活"):
			statusCode = http.StatusConflict
			errCode = dto.ErrCodeAlreadyActivated
		case strings.Contains(errMsg, "用户数上限"):
			statusCode = http.StatusForbidden
			errCode = dto.ErrCodeInternalError
		case strings.Contains(errMsg, "已被注册"):
			statusCode = http.StatusConflict
			errCode = dto.ErrCodeEmailAlreadyExists
		}

		writeJSON(w, statusCode, dto.ActivateResponse{
			Activated: false,
			Error:     errMsg,
			Code:      errCode,
		})
		return
	}

	writeJSON(w, http.StatusOK, dto.ActivateResponse{
		Activated: true,
		User: &dto.UserResponse{
			ID:        user.ID,
			TenantID:  user.TenantID,
			Name:      user.Name,
			Email:     user.Email,
			Role:      user.Role,
			CreatedAt: user.CreatedAt.Format("2006-01-02T15:04:05Z"),
		},
		Tokens: tokens,
	})
}
