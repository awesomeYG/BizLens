"use client";

import type {
  CompanyInfo,
  CompanyProfile,
  DataSourceConfig,
  UserSession,
  UserSessionWithAuth,
  User,
} from "./types";
import {
  getAccessToken,
  getRefreshToken,
  isTokenExpired,
  clearTokens,
  saveTokens,
  getCurrentUser as fetchCurrentUser,
} from "./auth/api";

const USER_STORAGE_KEY = "ai-bi-user-session";

export function getCurrentUser(): UserSessionWithAuth | null {
  if (globalThis.window === undefined) return null;
  
  // 首先检查是否有有效的 Token
  const accessToken = getAccessToken();
  const refreshToken = getRefreshToken();
  const tokenExpired = isTokenExpired();
  
  if (accessToken && refreshToken && !tokenExpired) {
    // 有有效 Token，尝试从 localStorage 加载用户信息
    try {
      const raw = localStorage.getItem(USER_STORAGE_KEY);
      const session = raw ? (JSON.parse(raw) as UserSessionWithAuth) : null;
      
      // 更新 Token 信息
      if (session) {
        session.accessToken = accessToken;
        session.refreshToken = refreshToken;
        session.tokenExpiresAt = parseInt(localStorage.getItem("auth_token_expires_at") || "0", 10);
      }
      
      return session;
    } catch {
      return null;
    }
  }
  
  // Token 无效或过期
  return null;
}

export function saveCurrentUser(user: UserSessionWithAuth): void {
  if (globalThis.window === undefined) return;
  
  // 如果用户带有 Token 信息，保存到 auth storage
  if (user.accessToken || user.refreshToken) {
    // Token 已经由 api.ts 管理，这里只保存用户基本信息
    const session: UserSession = {
      id: user.id,
      name: user.name,
      email: user.email,
      createdAt: user.createdAt,
      isOnboarded: user.isOnboarded,
      companyInfo: user.companyInfo,
      dataSources: user.dataSources,
      companyProfile: user.companyProfile,
    };
    localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(session));
  } else {
    localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(user));
  }
}

export async function loginUser(email: string, password: string): Promise<UserSessionWithAuth | null> {
  try {
    const { login } = await import("./auth/api");
    const response = await login({ email, password });
    saveTokens(response.tokens);
    
    const user: UserSessionWithAuth = {
      id: response.user.id,
      name: response.user.name,
      email: response.user.email,
      createdAt: new Date(response.user.createdAt).getTime(),
      isOnboarded: false, // 默认未 onboarding
      accessToken: response.tokens.accessToken,
      refreshToken: response.tokens.refreshToken,
      tokenExpiresAt: Date.now() + response.tokens.expiresIn * 1000,
    };
    
    saveCurrentUser(user);
    return user;
  } catch (error) {
    console.error("登录失败:", error);
    if (error instanceof Error) {
      throw error;
    }
    throw new Error("登录失败，请稍后重试");
  }
}

export function completeOnboarding(
  companyInfo: CompanyInfo,
  dataSources: DataSourceConfig[],
  companyProfile: CompanyProfile
): UserSession | null {
  const current = getCurrentUser();
  if (!current) return null;
  const next: UserSession = {
    ...current,
    isOnboarded: true,
    companyInfo,
    dataSources,
    companyProfile,
  };
  saveCurrentUser(next);
  return next;
}

export function logoutUser(): void {
  if (globalThis.window === undefined) return;
  
  // 清除 Token
  clearTokens();
  
  // 清除用户会话
  localStorage.removeItem(USER_STORAGE_KEY);
}

/**
 * 检查用户是否已认证
 */
export function isAuthenticated(): boolean {
  const user = getCurrentUser();
  return user !== null && !isTokenExpired();
}

/**
 * 从服务器同步当前用户信息
 */
export async function syncCurrentUser(): Promise<UserSessionWithAuth | null> {
  if (!isAuthenticated()) {
    return null;
  }
  
  try {
    const user = await fetchCurrentUser();
    const session: UserSessionWithAuth = {
      id: user.id,
      name: user.name,
      email: user.email,
      createdAt: new Date(user.createdAt).getTime(),
      isOnboarded: false,
      accessToken: getAccessToken() || undefined,
      refreshToken: getRefreshToken() || undefined,
    };
    
    saveCurrentUser(session);
    return session;
  } catch (error) {
    console.error("同步用户信息失败:", error);
    logoutUser();
    return null;
  }
}

/**
 * Mock 数据 - 用于快速测试
 * 包含一家电商公司的完整配置
 */
export const MOCK_DATA = {
  companyInfo: {
    companyName: "杭州智选电商有限公司",
    industry: "电商零售",
    size: "200-500 人",
    region: "华东地区 + 东南亚",
    businessModel: "B2C D2C 混合模式",
    coreGoals: "提升复购率至 35%，优化库存周转至 15 天，降低获客成本 20%",
  } as CompanyInfo,

  companyProfile: {
    summary: "智选电商是一家专注于家居生活品类的电商企业，主营天猫、京东、抖音多渠道，年 GMV 约 3 亿元。当前处于成长期向成熟期过渡阶段，需精细化运营提升盈利能力。",
    analysisFocuses: [
      "销售增长趋势与渠道贡献分析",
      "库存周转效率与滞销预警",
      "客户复购率与生命周期价值",
    ],
    recommendedMetrics: [
      "GMV、毛利率、客单价、ROI",
      "库存周转天数、动销率、滞销占比",
      "新客占比、复购率、客诉率",
    ],
  } as CompanyProfile,

  dataSources: [
    {
      id: "mock-mysql-001",
      type: "mysql" as const,
      name: "生产数据库 - MySQL",
      description: "核心交易数据库，包含订单、商品、用户数据",
      status: "connected" as const,
      tables: [
        "orders", "order_items", "products", "categories",
        "customers", "inventory", "shipments",
      ],
      lastSyncAt: Date.now() - 3600000, // 1 小时前
    } as DataSourceConfig,
    {
      id: "mock-csv-001",
      type: "csv" as const,
      name: "营销投放数据",
      description: "从巨量引擎导出的广告投放数据",
      status: "connected" as const,
      lastSyncAt: Date.now() - 7200000, // 2 小时前
    } as DataSourceConfig,
  ],
};

/**
 * 快速登录 - 使用 Mock 数据，跳过 onboarding
 * 用于测试环境快速进入主界面
 */
export function quickLoginWithMockData(): UserSession {
  const now = Date.now();
  const user: UserSession = {
    id: "mock-user-" + now,
    name: "测试用户",
    email: "test@bizlens.demo",
    createdAt: now,
    isOnboarded: true,
    companyInfo: MOCK_DATA.companyInfo,
    dataSources: MOCK_DATA.dataSources,
    companyProfile: MOCK_DATA.companyProfile,
  };
  saveCurrentUser(user);
  return user;
}

/**
 * 检查是否启用 Mock 数据模式
 * 通过 URL 参数 ?mock=true 或 localStorage 配置启用
 */
export function isMockMode(): boolean {
  if (globalThis.window === undefined) return false;
  
  // 检查 URL 参数
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.get("mock") === "true") {
    return true;
  }
  
  // 检查 localStorage 配置
  try {
    const config = localStorage.getItem("bizlens-config");
    if (config) {
      const parsed = JSON.parse(config);
      return parsed.mockMode === true;
    }
  } catch {
    // ignore
  }
  
  return false;
}

/**
 * 设置 Mock 模式
 */
export function setMockMode(enabled: boolean): void {
  if (globalThis.window === undefined) return;
  
  const config = {
    mockMode: enabled,
    updatedAt: Date.now(),
  };
  localStorage.setItem("bizlens-config", JSON.stringify(config));
}
