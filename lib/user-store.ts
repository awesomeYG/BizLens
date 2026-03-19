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
