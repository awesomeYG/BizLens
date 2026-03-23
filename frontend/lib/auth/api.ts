import type {
  LoginRequest,
  RegisterRequest,
  AuthResponse,
  User,
  Tokens,
  RefreshTokenRequest,
} from "../types";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "/api";

// Token 存储键
const ACCESS_TOKEN_KEY = "auth_access_token";
const REFRESH_TOKEN_KEY = "auth_refresh_token";
const TOKEN_EXPIRES_AT_KEY = "auth_token_expires_at";

/**
 * 存储 Token
 */
export function saveTokens(tokens: Tokens): void {
  if (typeof window === "undefined") return;
  
  localStorage.setItem(ACCESS_TOKEN_KEY, tokens.accessToken);
  localStorage.setItem(REFRESH_TOKEN_KEY, tokens.refreshToken);
  localStorage.setItem(TOKEN_EXPIRES_AT_KEY, String(Date.now() + tokens.expiresIn * 1000));
}

/**
 * 获取 Access Token
 */
export function getAccessToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(ACCESS_TOKEN_KEY);
}

/**
 * 获取 Refresh Token
 */
export function getRefreshToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(REFRESH_TOKEN_KEY);
}

/**
 * 检查 Token 是否过期
 */
export function isTokenExpired(): boolean {
  if (typeof window === "undefined") return true;
  
  const expiresAt = localStorage.getItem(TOKEN_EXPIRES_AT_KEY);
  if (!expiresAt) return true;
  
  return Date.now() >= parseInt(expiresAt, 10);
}

/**
 * 清除 Token
 */
export function clearTokens(): void {
  if (typeof window === "undefined") return;
  
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
  localStorage.removeItem(TOKEN_EXPIRES_AT_KEY);
}

/**
 * 通用的 API 请求函数（自动注入 Token）
 */
export async function request<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${API_BASE_URL}${endpoint}`;
  const accessToken = getAccessToken();

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  // 注入 Access Token
  if (accessToken) {
    headers["Authorization"] = `Bearer ${accessToken}`;
  }

  // 合并用户提供的 headers
  if (options.headers) {
    Object.assign(headers, options.headers);
  }

  const response = await fetch(url, {
    ...options,
    headers,
  });

  // 处理 401 错误（尝试刷新 Token）
  if (response.status === 401) {
    const refreshToken = getRefreshToken();
    if (refreshToken) {
      try {
        const newTokens = await refreshAccessToken(refreshToken);
        saveTokens(newTokens);
        
        // 重试原请求
        const retryResponse = await fetch(url, {
          ...options,
          headers: {
            ...headers,
            Authorization: `Bearer ${newTokens.accessToken}`,
          },
        });

        if (!retryResponse.ok) {
          throw new Error(await retryResponse.text() || "请求失败");
        }

        return retryResponse.json();
      } catch (err) {
        // 刷新失败，清除 Token
        clearTokens();
        throw new Error("认证已过期，请重新登录");
      }
    }
  }

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || response.statusText || "请求失败");
  }

  return response.json();
}

/**
 * 刷新 Access Token
 */
export async function refreshAccessToken(refreshToken: string): Promise<Tokens> {
  const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ refreshToken }),
  });

  if (!response.ok) {
    throw new Error("刷新令牌无效或已过期");
  }

  return response.json();
}

/**
 * 用户注册
 */
export async function register(data: RegisterRequest): Promise<AuthResponse> {
  return request<AuthResponse>("/auth/register", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

/**
 * 用户登录
 */
export async function login(data: LoginRequest): Promise<AuthResponse> {
  return request<AuthResponse>("/auth/login", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

/**
 * 用户登出
 */
export async function logout(): Promise<void> {
  const refreshToken = getRefreshToken();
  if (refreshToken) {
    try {
      await request("/auth/logout", {
        method: "POST",
        body: JSON.stringify({ refreshToken }),
      });
    } catch (err) {
      // 忽略登出错误
    }
  }
  clearTokens();
}

/**
 * 获取当前用户信息
 */
export async function getCurrentUser(): Promise<User> {
  return request<User>("/auth/me");
}

/**
 * 更新用户信息
 */
export async function updateUser(data: {
  name?: string;
  email?: string;
}): Promise<User> {
  return request<User>("/auth/me", {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

/**
 * 修改密码
 */
export async function changePassword(data: {
  oldPassword: string;
  newPassword: string;
}): Promise<void> {
  return request("/auth/change-password", {
    method: "POST",
    body: JSON.stringify(data),
  });
}
