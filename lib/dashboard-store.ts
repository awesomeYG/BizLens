"use client";

import type { DashboardConfig } from "./types";

const STORAGE_KEY = "ai-bi-dashboards";

export function getDashboards(): DashboardConfig[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveDashboard(dashboard: DashboardConfig): void {
  const list = getDashboards();
  const idx = list.findIndex((d) => d.id === dashboard.id);
  const updated = { ...dashboard, updatedAt: Date.now() };
  if (idx >= 0) {
    list[idx] = updated;
  } else {
    list.unshift(updated);
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
}

export function deleteDashboard(id: string): void {
  const list = getDashboards().filter((d) => d.id !== id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
}

export function getDashboard(id: string): DashboardConfig | undefined {
  return getDashboards().find((d) => d.id === id);
}
