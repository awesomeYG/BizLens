package service

import (
	"ai-bi-server/internal/config"
	"ai-bi-server/internal/dto"
	"ai-bi-server/internal/model"
	"crypto/rand"
	"encoding/base64"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"
	"golang.org/x/crypto/bcrypt"
	"gopkg.in/square/go-jose.v2"
	"gopkg.in/square/go-jose.v2/jwt"
	"gorm.io/gorm"
)

// AuthService 认证服务
type AuthService struct {
	db     *gorm.DB
	cfg    *config.Config
	signer jose.Signer
}

// Claims JWT Claims
type Claims struct {
	UserID   string `json:"userId"`
	TenantID string `json:"tenantId"`
	Email    string `json:"email"`
	Role     string `json:"role"`
	jwt.Claims
}

// NewAuthService 创建认证服务
func NewAuthService(db *gorm.DB, cfg *config.Config) (*AuthService, error) {
	// 创建 JWT 签名器
	key := []byte(cfg.JWTSecret)
	signingKey := jose.SigningKey{
		Algorithm: jose.HS256,
		Key:       key,
	}

	signer, err := jose.NewSigner(signingKey, nil)
	if err != nil {
		return nil, fmt.Errorf("创建 JWT 签名器失败：%w", err)
	}

	return &AuthService{
		db:     db,
		cfg:    cfg,
		signer: signer,
	}, nil
}

const (
	defaultTenantID   = "default"
	defaultTenantName = "BizLens"
)

// EnsureDefaultTenant 确保默认组织存在
func (s *AuthService) EnsureDefaultTenant() error {
	return s.db.Transaction(func(tx *gorm.DB) error {
		var tenant model.Tenant
		if err := tx.Where("id = ?", defaultTenantID).First(&tenant).Error; err != nil {
			if !errors.Is(err, gorm.ErrRecordNotFound) {
				return fmt.Errorf("查询默认组织失败：%w", err)
			}

			tenant = model.Tenant{
				ID:   defaultTenantID,
				Name: defaultTenantName,
				Plan: "free",
			}
			if err := tx.Create(&tenant).Error; err != nil {
				return fmt.Errorf("创建默认组织失败：%w", err)
			}
		}
		return nil
	})
}

// Register 用户注册（所有用户属于默认组织）
// 系统未激活时禁止注册
func (s *AuthService) Register(req *dto.RegisterRequest) (*model.User, *dto.Tokens, error) {
	// 检查激活状态
	if !s.IsActivated() {
		return nil, nil, errors.New("系统尚未激活，请先激活")
	}

	// 检查邮箱是否已存在
	var existingUser model.User
	if err := s.db.Where("email = ?", req.Email).Limit(1).First(&existingUser).Error; err == nil {
		return nil, nil, errors.New("邮箱已被注册")
	}

	// 确保默认组织存在
	if err := s.EnsureDefaultTenant(); err != nil {
		return nil, nil, err
	}

	// 密码加密
	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	if err != nil {
		return nil, nil, fmt.Errorf("密码加密失败：%w", err)
	}

	// 创建用户（所有用户属于默认组织）
	user := &model.User{
		ID:           uuid.New().String(),
		TenantID:     defaultTenantID,
		Name:         req.Name,
		Email:        req.Email,
		PasswordHash: string(hashedPassword),
		Role:         "member",
	}

	// 事务创建用户和生成 Token
	var tokens *dto.Tokens
	err = s.db.Transaction(func(tx *gorm.DB) error {
		if err := tx.Create(user).Error; err != nil {
			return err
		}

		var err error
		tokens, err = s.generateTokens(tx, user.ID)
		return err
	})

	if err != nil {
		return nil, nil, err
	}

	return user, tokens, nil
}

// Login 用户登录
func (s *AuthService) Login(req *dto.LoginRequest) (*model.User, *dto.Tokens, error) {
	// 查找用户
	var user model.User
	if err := s.db.Where("email = ?", req.Email).First(&user).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, nil, errors.New("用户不存在")
		}
		return nil, nil, fmt.Errorf("查询用户失败：%w", err)
	}

	// 检查账户是否被锁定
	if user.LockedUntil != nil && time.Now().Before(*user.LockedUntil) {
		return nil, nil, fmt.Errorf("账户已被锁定，请在 %v 分钟后重试", int(user.LockedUntil.Sub(time.Now()).Minutes()))
	}

	// 验证密码
	if err := bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(req.Password)); err != nil {
		// 密码错误，增加失败次数
		loginAttempts := user.LoginAttempts + 1
		updates := map[string]interface{}{
			"login_attempts": loginAttempts,
		}

		// 检查是否达到最大尝试次数
		maxAttempts := 5 // 可以从配置读取
		if loginAttempts >= maxAttempts {
			// 锁定账户
			lockDuration := 30 * time.Minute // 可以从配置读取
			lockedUntil := time.Now().Add(lockDuration)
			updates["locked_until"] = &lockedUntil
			updates["login_attempts"] = 0 // 重置尝试次数
		}

		s.db.Model(&user).Updates(updates)
		return nil, nil, errors.New("密码错误")
	}

	// 登录成功，更新登录时间和重置失败次数
	now := time.Now()
	updates := map[string]interface{}{
		"last_login_at":  &now,
		"login_attempts": 0,
		"locked_until":   nil,
	}
	s.db.Model(&user).Updates(updates)

	// 生成 Token
	var tokens *dto.Tokens
	err := s.db.Transaction(func(tx *gorm.DB) error {
		var err error
		tokens, err = s.generateTokens(tx, user.ID)
		return err
	})

	if err != nil {
		return nil, nil, err
	}

	return &user, tokens, nil
}

// Logout 用户登出
func (s *AuthService) Logout(userID string, refreshToken string) error {
	// 吊销刷新令牌
	return s.db.Model(&model.RefreshToken{}).
		Where("user_id = ? AND token = ?", userID, refreshToken).
		Updates(map[string]interface{}{
			"revoked":    true,
			"revoked_at": time.Now(),
		}).Error
}

// RefreshToken 刷新访问令牌
func (s *AuthService) RefreshToken(refreshToken string) (*dto.Tokens, error) {
	// 验证刷新令牌
	var rt model.RefreshToken
	if err := s.db.Preload("User").Where("token = ? AND revoked = ?", refreshToken, false).First(&rt).Error; err != nil {
		return nil, errors.New("刷新令牌无效")
	}

	// 检查是否过期
	if time.Now().After(rt.ExpiresAt) {
		return nil, errors.New("刷新令牌已过期")
	}

	// 生成新的 Token 对
	var tokens *dto.Tokens
	err := s.db.Transaction(func(tx *gorm.DB) error {
		// 吊销旧的刷新令牌
		if err := tx.Model(&rt).Updates(map[string]interface{}{
			"revoked":    true,
			"revoked_at": time.Now(),
		}).Error; err != nil {
			return err
		}

		var err error
		tokens, err = s.generateTokens(tx, rt.UserID)
		return err
	})

	if err != nil {
		return nil, err
	}

	return tokens, nil
}

// GetUserByID 根据 ID 获取用户
func (s *AuthService) GetUserByID(userID string) (*model.User, error) {
	var user model.User
	if err := s.db.Where("id = ?", userID).Limit(1).First(&user).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, errors.New("用户不存在")
		}
		return nil, fmt.Errorf("查询用户失败：%w", err)
	}
	return &user, nil
}

// UpdateUser 更新用户信息
func (s *AuthService) UpdateUser(userID string, updates map[string]interface{}) (*model.User, error) {
	// 不允许更新敏感字段
	delete(updates, "password_hash")
	delete(updates, "tenant_id")
	delete(updates, "role") // 角色不能随意更改

	var user model.User
	if err := s.db.First(&user, userID).Error; err != nil {
		return nil, errors.New("用户不存在")
	}

	if err := s.db.Model(&user).Updates(updates).Error; err != nil {
		return nil, fmt.Errorf("更新用户失败：%w", err)
	}

	return &user, nil
}

// ChangePassword 修改密码
func (s *AuthService) ChangePassword(userID string, oldPassword, newPassword string) error {
	var user model.User
	if err := s.db.First(&user, userID).Error; err != nil {
		return errors.New("用户不存在")
	}

	// 验证旧密码
	if err := bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(oldPassword)); err != nil {
		return errors.New("原密码错误")
	}

	// 加密新密码
	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(newPassword), bcrypt.DefaultCost)
	if err != nil {
		return fmt.Errorf("密码加密失败：%w", err)
	}

	return s.db.Model(&user).Update("password_hash", string(hashedPassword)).Error
}

// generateTokens 为用户生成访问令牌和刷新令牌
func (s *AuthService) generateTokens(tx *gorm.DB, userID string) (*dto.Tokens, error) {
	// 获取用户信息（使用正确的 Where 语法）
	var user model.User
	if err := tx.Where("id = ?", userID).Limit(1).First(&user).Error; err != nil {
		return nil, fmt.Errorf("查询用户失败：%w", err)
	}

	// 生成访问令牌
	now := time.Now()
	accessTokenExpiry := now.Add(time.Duration(s.cfg.AccessTokenExpire) * time.Minute)

	claims := Claims{
		UserID:   user.ID,
		TenantID: user.TenantID,
		Email:    user.Email,
		Role:     user.Role,
		Claims: jwt.Claims{
			IssuedAt:  jwt.NewNumericDate(now),
			Expiry:    jwt.NewNumericDate(accessTokenExpiry),
			NotBefore: jwt.NewNumericDate(now),
			Issuer:    "ai-bi-server",
			Subject:   user.ID,
			ID:        uuid.New().String(),
		},
	}

	// 签名访问令牌
	accessToken, err := jwt.Signed(s.signer).Claims(claims).CompactSerialize()
	if err != nil {
		return nil, fmt.Errorf("生成访问令牌失败：%w", err)
	}

	// 生成刷新令牌
	refreshTokenBytes := make([]byte, 32)
	if _, err := rand.Read(refreshTokenBytes); err != nil {
		return nil, fmt.Errorf("生成刷新令牌失败：%w", err)
	}
	refreshToken := base64.URLEncoding.EncodeToString(refreshTokenBytes)

	refreshTokenExpiry := now.Add(time.Duration(s.cfg.RefreshTokenExpire) * 24 * time.Hour)

	rt := &model.RefreshToken{
		ID:        uuid.New().String(),
		UserID:    user.ID,
		Token:     refreshToken,
		ExpiresAt: refreshTokenExpiry,
		Revoked:   false,
	}

	if err := tx.Create(rt).Error; err != nil {
		return nil, fmt.Errorf("保存刷新令牌失败：%w", err)
	}

	return &dto.Tokens{
		AccessToken:  accessToken,
		RefreshToken: refreshToken,
		ExpiresIn:    int64(s.cfg.AccessTokenExpire * 60),
	}, nil
}

// ValidateToken 验证访问令牌
func (s *AuthService) ValidateToken(tokenString string) (*Claims, error) {
	// 解析令牌
	key := []byte(s.cfg.JWTSecret)
	token, err := jwt.ParseSigned(tokenString)
	if err != nil {
		return nil, errors.New("令牌格式无效")
	}

	claims := &Claims{}
	if err := token.Claims(key, claims); err != nil {
		return nil, errors.New("令牌解析失败")
	}

	// 验证标准声明
	if err := claims.Claims.Validate(jwt.Expected{
		Issuer: "ai-bi-server",
		Time:   time.Now(),
	}); err != nil {
		if errors.Is(err, jwt.ErrExpired) {
			return nil, errors.New("令牌已过期")
		}
		return nil, errors.New("令牌无效")
	}

	return claims, nil
}

// ============================================================
// 授权码激活相关方法
// ============================================================

// IsActivated 检查系统是否已激活（至少有一个 owner 或 admin 用户）
func (s *AuthService) IsActivated() bool {
	var count int64
	s.db.Model(&model.User{}).
		Where("role IN ('owner', 'admin') AND deleted_at IS NULL").
		Count(&count)
	return count > 0
}

// Activate 系统激活（授权码激活）
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
		return nil, nil, errors.New("系统已被激活，无需重复操作")
	}

	// 4. 检查用户数上限
	if s.cfg.LicenseSeats > 0 {
		var count int64
		s.db.Model(&model.User{}).Where("deleted_at IS NULL").Count(&count)
		if count >= int64(s.cfg.LicenseSeats) {
			return nil, nil, errors.New("已达到授权用户数上限")
		}
	}

	// 5. 检查邮箱是否已被注册
	var existing model.User
	if err := s.db.Where("email = ?", req.Email).First(&existing).Error; err == nil {
		return nil, nil, errors.New("该邮箱已被注册")
	}

	// 6. 创建默认租户
	if err := s.EnsureDefaultTenant(); err != nil {
		return nil, nil, err
	}

	// 7. 创建 owner 用户
	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	if err != nil {
		return nil, nil, fmt.Errorf("密码加密失败：%w", err)
	}

	user := &model.User{
		ID:           uuid.New().String(),
		TenantID:     defaultTenantID,
		Name:         req.Name,
		Email:        req.Email,
		PasswordHash: string(hashedPassword),
		Role:         "owner",
	}

	var tokens *dto.Tokens
	err = s.db.Transaction(func(tx *gorm.DB) error {
		if err := tx.Create(user).Error; err != nil {
			return err
		}
		var err2 error
		tokens, err2 = s.generateTokens(tx, user.ID)
		return err2
	})

	if err != nil {
		return nil, nil, err
	}

	return user, tokens, nil
}

// ValidateLicense 获取激活状态（供登录接口使用）
func (s *AuthService) ValidateLicense() (bool, string, string) {
	return s.IsActivated(), "BizLens", "1.0.0"
}

// ============================================================
// 用户管理相关方法（管理员使用）
// ============================================================

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
	if err := query.Order("created_at DESC").Offset(offset).Limit(pageSize).Find(&users).Error; err != nil {
		return nil, 0, err
	}

	return users, total, nil
}

// CreateUser 管理员创建用户
func (s *AuthService) CreateUser(req *dto.CreateUserRequest) (*model.User, error) {
	// 检查邮箱是否已被注册
	var existing model.User
	if err := s.db.Where("email = ?", req.Email).First(&existing).Error; err == nil {
		return nil, errors.New("该邮箱已被注册")
	}

	// owner 不能通过此 API 创建
	if req.Role == "owner" {
		return nil, errors.New("无法创建 owner 角色")
	}

	// 检查用户数上限
	if s.cfg.LicenseSeats > 0 {
		var count int64
		s.db.Model(&model.User{}).Where("deleted_at IS NULL").Count(&count)
		if count >= int64(s.cfg.LicenseSeats) {
			return nil, errors.New("已达到授权用户数上限")
		}
	}

	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	if err != nil {
		return nil, fmt.Errorf("密码加密失败：%w", err)
	}

	user := &model.User{
		ID:           uuid.New().String(),
		TenantID:     defaultTenantID,
		Name:         req.Name,
		Email:        req.Email,
		PasswordHash: string(hashedPassword),
		Role:         req.Role,
	}

	if err := s.db.Create(user).Error; err != nil {
		return nil, err
	}
	return user, nil
}

// AdminUpdateUser 管理员更新用户（支持角色）
func (s *AuthService) AdminUpdateUser(userID, name, role string) error {
	updates := map[string]interface{}{}
	if name != "" {
		updates["name"] = name
	}
	if role != "" && role != "owner" { // owner 角色不可被修改
		updates["role"] = role
	}
	if len(updates) == 0 {
		return nil
	}
	return s.db.Model(&model.User{}).Where("id = ?", userID).Updates(updates).Error
}

// DeleteUser 删除用户
func (s *AuthService) DeleteUser(userID string) error {
	return s.db.Where("id = ?", userID).Delete(&model.User{}).Error
}

// ResetUserPassword 重置密码，返回新密码明文
func (s *AuthService) ResetUserPassword(userID string) (string, error) {
	newPassword := generateRandomPassword(12)
	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(newPassword), bcrypt.DefaultCost)
	if err != nil {
		return "", fmt.Errorf("密码加密失败：%w", err)
	}
	err = s.db.Model(&model.User{}).Where("id = ?", userID).
		Update("password_hash", string(hashedPassword)).Error
	if err != nil {
		return "", err
	}
	return newPassword, nil
}

// ToggleUserStatus 启用/禁用用户
func (s *AuthService) ToggleUserStatus(userID string) (*model.User, bool, error) {
	var user model.User
	if err := s.db.Where("id = ?", userID).First(&user).Error; err != nil {
		return nil, false, errors.New("用户不存在")
	}

	// 判断当前状态：如果有 LockedUntil 且未过期，则认为是禁用状态
	isCurrentlyDisabled := user.LockedUntil != nil && time.Now().Before(*user.LockedUntil)

	var updates map[string]interface{}
	if isCurrentlyDisabled {
		// 启用：清除锁定
		updates = map[string]interface{}{
			"locked_until":   nil,
			"login_attempts": 0,
		}
	} else {
		// 禁用：设置一个遥远的锁定时间（比如 100 年后）
		farFuture := time.Now().AddDate(100, 0, 0)
		updates = map[string]interface{}{
			"locked_until": farFuture,
		}
	}

	if err := s.db.Model(&user).Updates(updates).Error; err != nil {
		return nil, false, err
	}

	// 重新加载
	s.db.Where("id = ?", userID).First(&user)
	return &user, !isCurrentlyDisabled, nil
}

// CountUsers 统计用户总数
func (s *AuthService) CountUsers() (int64, error) {
	var count int64
	err := s.db.Model(&model.User{}).Where("deleted_at IS NULL").Count(&count).Error
	return count, err
}

// DB 获取数据库连接（供其他服务使用）
func (s *AuthService) DB() *gorm.DB {
	return s.db
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

// isValidLicenseKeyFormat 校验授权码格式（XXXX-XXXX-XXXX-XXXX）
func isValidLicenseKeyFormat(key string) bool {
	if len(key) != 19 { // 16 chars + 3 hyphens
		return false
	}
	parts := strings.Split(key, "-")
	if len(parts) != 4 {
		return false
	}
	for _, part := range parts {
		if len(part) != 4 {
			return false
		}
		for _, c := range part {
			if !((c >= 'A' && c <= 'Z') || (c >= '0' && c <= '9')) {
				return false
			}
		}
	}
	return true
}
