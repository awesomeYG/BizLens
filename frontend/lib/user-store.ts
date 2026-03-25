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

export const EMPTY_COMPANY_INFO: CompanyInfo = {
  companyName: "长亭科技",
  industry: "互联网",
  size: "8人",
  region: "全球",
  businessModel: "卖一款企业级 AI 开发平台",
  coreGoals: "实现收支平衡（支出主要是token消耗和人员工资）",
};

export const DEFAULT_COMPANY_PROFILE: CompanyProfile = {
  summary: "",
  analysisFocuses: ["注册用户增量", "用户粘度"],
  recommendedMetrics: ["DAU", "新增注册用户数", "用户留存率", "复购率"],
};

function hasCompletedOnboarding(session: Partial<UserSession> | null | undefined): boolean {
  if (!session) return false;
  if (session.isOnboarded) return true;

  const hasCompanyInfo = !!session.companyInfo && Object.values(session.companyInfo).some((v) => v.trim().length > 0);
  const hasDataSources = Array.isArray(session.dataSources) && session.dataSources.length > 0;
  const hasProfile =
    !!session.companyProfile &&
    ((session.companyProfile.summary || "").trim().length > 0 ||
      (session.companyProfile.analysisFocuses?.length || 0) > 0 ||
      (session.companyProfile.recommendedMetrics?.length || 0) > 0);

  return hasCompanyInfo || hasDataSources || hasProfile;
}

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
      tenantId: user.tenantId,
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

    const existing = getCurrentUser();
    const isSameUser = existing?.id === response.user.id;
    const inferredOnboarded = hasCompletedOnboarding(existing);
    
    const user: UserSessionWithAuth = {
      id: response.user.id,
      tenantId: response.user.tenantId,
      name: response.user.name,
      email: response.user.email,
      createdAt: new Date(response.user.createdAt).getTime(),
      isOnboarded: isSameUser ? inferredOnboarded : false,
      accessToken: response.tokens.accessToken,
      refreshToken: response.tokens.refreshToken,
      tokenExpiresAt: Date.now() + response.tokens.expiresIn * 1000,
      companyInfo: isSameUser ? existing?.companyInfo : undefined,
      dataSources: isSameUser ? existing?.dataSources : undefined,
      companyProfile: isSameUser ? existing?.companyProfile : undefined,
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

export function saveOnboardingDraft(draft: {
  companyInfo?: CompanyInfo;
  dataSources?: DataSourceConfig[];
  companyProfile?: CompanyProfile;
}): UserSession | null {
  const current = getCurrentUser();
  if (!current) return null;

  const next: UserSession = {
    ...current,
    companyInfo: draft.companyInfo ?? current.companyInfo,
    dataSources: draft.dataSources ?? current.dataSources,
    companyProfile: draft.companyProfile ?? current.companyProfile,
  };

  saveCurrentUser(next);
  return next;
}

export function updateCompanySettings(payload: {
  companyInfo?: CompanyInfo;
  companyProfile?: CompanyProfile;
}): UserSession | null {
  const current = getCurrentUser();
  if (!current) return null;

  const next: UserSession = {
    ...current,
    companyInfo: payload.companyInfo ?? current.companyInfo ?? EMPTY_COMPANY_INFO,
    companyProfile: payload.companyProfile ?? current.companyProfile ?? DEFAULT_COMPANY_PROFILE,
  };

  saveCurrentUser(next);
  return next;
}

export function finishOnboarding(): UserSession | null {
  const current = getCurrentUser();
  if (!current) return null;

  const next: UserSession = {
    ...current,
    isOnboarded: true,
    companyInfo: current.companyInfo ?? EMPTY_COMPANY_INFO,
    dataSources: current.dataSources ?? [],
    companyProfile: current.companyProfile ?? DEFAULT_COMPANY_PROFILE,
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
    const existing = getCurrentUser();
    const isSameUser = existing?.id === user.id;
    const inferredOnboarded = hasCompletedOnboarding(existing);
    const session: UserSessionWithAuth = {
      id: user.id,
      tenantId: user.tenantId,
      name: user.name,
      email: user.email,
      createdAt: new Date(user.createdAt).getTime(),
      isOnboarded: isSameUser ? inferredOnboarded : false,
      accessToken: getAccessToken() || undefined,
      refreshToken: getRefreshToken() || undefined,
      companyInfo: isSameUser ? existing?.companyInfo : undefined,
      dataSources: isSameUser ? existing?.dataSources : undefined,
      companyProfile: isSameUser ? existing?.companyProfile : undefined,
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
 * 包含长亭科技公司的完整配置
 */
export const MOCK_DATA = {
  companyInfo: {
    companyName: "长亭科技",
    industry: "互联网",
    size: "8人",
    region: "全球",
    businessModel: "卖一款企业级 AI 开发平台",
    coreGoals: "实现收支平衡（支出主要是token消耗和人员工资）",
  } as CompanyInfo,

  companyProfile: {
    summary: "长亭科技是一家企业级 AI 开发平台厂商，当前处于初创阶段，团队 8 人，市场覆盖全球。核心目标是在控制 token 成本和人员支出的前提下实现收支平衡，重点关注用户增长和平台粘性。",
    analysisFocuses: ["注册用户增量", "用户粘度"],
    recommendedMetrics: ["DAU", "新增注册用户数", "用户留存率", "复购率"],
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
