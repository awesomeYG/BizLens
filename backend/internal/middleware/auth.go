package middleware

import (
	"ai-bi-server/internal/service"
	"context"
	"net/http"
	"strings"
)

// Auth JWT 认证中间件
func Auth(authService *service.AuthService) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			var tokenString string

			// 优先从 Authorization 头获取 Token
			authHeader := r.Header.Get("Authorization")
			if authHeader != "" {
				parts := strings.Split(authHeader, " ")
				if len(parts) != 2 || parts[0] != "Bearer" {
					http.Error(w, `{"error":"认证令牌格式无效"}`, http.StatusUnauthorized)
					return
				}
				tokenString = parts[1]
			}

			// Fallback: 从 URL query 参数 _token 获取（用于 navigator.sendBeacon 场景，
			// 因为 sendBeacon 不支持自定义 Header）
			if tokenString == "" {
				tokenString = r.URL.Query().Get("_token")
			}

			if tokenString == "" {
				http.Error(w, `{"error":"未提供认证令牌"}`, http.StatusUnauthorized)
				return
			}

			// 验证 Token
			claims, err := authService.ValidateToken(tokenString)
			if err != nil {
				http.Error(w, `{"error":"`+err.Error()+`"}`, http.StatusUnauthorized)
				return
			}

			// 将用户信息注入上下文
			ctx := context.WithValue(r.Context(), "userID", claims.UserID)
			ctx = context.WithValue(ctx, "tenantID", claims.TenantID)
			ctx = context.WithValue(ctx, "userEmail", claims.Email)
			ctx = context.WithValue(ctx, "userRole", claims.Role)

			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}

// OptionalAuth 可选认证中间件（有 Token 则验证，无 Token 也放行）
func OptionalAuth(authService *service.AuthService) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			authHeader := r.Header.Get("Authorization")
			if authHeader == "" {
				// 没有 Token，继续执行
				next.ServeHTTP(w, r)
				return
			}

			// 尝试验证 Token
			parts := strings.Split(authHeader, " ")
			if len(parts) == 2 && parts[0] == "Bearer" {
				claims, err := authService.ValidateToken(parts[1])
				if err == nil {
					// Token 有效，注入用户信息
					ctx := context.WithValue(r.Context(), "userID", claims.UserID)
					ctx = context.WithValue(ctx, "tenantID", claims.TenantID)
					ctx = context.WithValue(ctx, "userEmail", claims.Email)
					ctx = context.WithValue(ctx, "userRole", claims.Role)
					r = r.WithContext(ctx)
				}
				// Token 无效也继续执行（可选认证）
			}

			next.ServeHTTP(w, r)
		})
	}
}

// RequireRole 角色权限中间件
func RequireRole(roles ...string) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			userRole := r.Context().Value("userRole")
			if userRole == nil {
				http.Error(w, `{"error":"未认证"}`, http.StatusUnauthorized)
				return
			}

			// 检查角色是否在允许列表中
			roleStr := userRole.(string)
			for _, role := range roles {
				if roleStr == role {
					next.ServeHTTP(w, r)
					return
				}
			}

			http.Error(w, `{"error":"权限不足"}`, http.StatusForbidden)
		})
	}
}
