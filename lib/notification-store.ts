import type { NotificationRule } from "./types";

const STORAGE_KEY = "ai-bi-notification-rules";

export function getNotificationRules(): NotificationRule[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as NotificationRule[]) : [];
  } catch {
    return [];
  }
}

export function saveNotificationRules(rules: NotificationRule[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(rules));
}

export function addNotificationRule(
  rule: Omit<NotificationRule, "id" | "createdAt" | "updatedAt">
): NotificationRule {
  const rules = getNotificationRules();
  const now = Date.now();
  const newRule: NotificationRule = {
    ...rule,
    id: crypto.randomUUID(),
    createdAt: now,
    updatedAt: now,
  };
  rules.push(newRule);
  saveNotificationRules(rules);
  return newRule;
}

export function updateNotificationRule(
  id: string,
  patch: Partial<Omit<NotificationRule, "id" | "createdAt">>
): NotificationRule | null {
  const rules = getNotificationRules();
  const idx = rules.findIndex((r) => r.id === id);
  if (idx === -1) return null;
  rules[idx] = { ...rules[idx], ...patch, updatedAt: Date.now() };
  saveNotificationRules(rules);
  return rules[idx];
}

export function deleteNotificationRule(id: string): boolean {
  const rules = getNotificationRules();
  const filtered = rules.filter((r) => r.id !== id);
  if (filtered.length === rules.length) return false;
  saveNotificationRules(filtered);
  return true;
}

export function toggleNotificationRule(id: string): NotificationRule | null {
  const rules = getNotificationRules();
  const rule = rules.find((r) => r.id === id);
  if (!rule) return null;
  return updateNotificationRule(id, { enabled: !rule.enabled });
}
