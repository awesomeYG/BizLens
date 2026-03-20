"use client";

import type {
  CompanyInfo,
  CompanyProfile,
  DataSourceConfig,
  UserSession,
} from "./types";

const USER_STORAGE_KEY = "ai-bi-user-session";

export function getCurrentUser(): UserSession | null {
  if (globalThis.window === undefined) return null;
  try {
    const raw = localStorage.getItem(USER_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as UserSession) : null;
  } catch {
    return null;
  }
}

export function saveCurrentUser(user: UserSession): void {
  if (globalThis.window === undefined) return;
  localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(user));
}

export function loginUser(name: string, email: string): UserSession {
  const existing = getCurrentUser();
  const now = Date.now();
  const user: UserSession = {
    id: existing?.id ?? crypto.randomUUID(),
    name,
    email,
    createdAt: existing?.createdAt ?? now,
    isOnboarded: existing?.isOnboarded ?? false,
    companyInfo: existing?.companyInfo,
    dataSources: existing?.dataSources,
    companyProfile: existing?.companyProfile,
  };
  saveCurrentUser(user);
  return user;
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
  localStorage.removeItem(USER_STORAGE_KEY);
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
