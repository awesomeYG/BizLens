"use client";

import { useEffect, useMemo, useState, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import AppHeader from "@/components/AppHeader";
import IMSectionNav from "@/components/IMSectionNav";
import { getCurrentUser } from "@/lib/user-store";
import { getAccessToken } from "@/lib/auth/api";

interface NotificationRule {
  id: string;
  name: string;
  description?: string;
  enabled: boolean;
  ruleType: string;
  conditionType?: string;
  threshold?: number;
  frequency?: string;
  timeRange?: string;
  platformIds?: string;
  updatedAt?: string;
}

interface IMConfig {
  id: string;
  name: string;
  type: string;
  enabled: boolean;
}

export default function NotificationRulesPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-zinc-950" />}>
      <NotificationRulesContent />
    </Suspense>
  );
}

function NotificationRulesContent() {
  const searchParams = useSearchParams();
  const focusRuleId = searchParams.get("ruleId");
  const [tenantId, setTenantId] = useState("demo-tenant");
  const [rules, setRules] = useState<NotificationRule[]>([]);
  const [imConfigs, setImConfigs] = useState<IMConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const user = getCurrentUser();
    if (user?.tenantId || user?.id) {
      setTenantId(user.tenantId || user.id);
    }
  }, []);

  useEffect(() => {
    let disposed = false;
    const load = async () => {
      setLoading(true);
      setError("");
      try {
        const token = getAccessToken();
        const headers: HeadersInit = {};
        if (token) {
          headers.Authorization = `Bearer ${token}`;
        }
        const [rulesRes, imRes] = await Promise.all([
          fetch(`/api/tenants/${tenantId}/notification-rules`, { headers }),
          fetch(`/api/tenants/${tenantId}/im-configs`, { headers }),
        ]);

        if (!rulesRes.ok) {
          throw new Error(`加载通知规则失败: HTTP ${rulesRes.status}`);
        }
        const rulesData = await rulesRes.json();
        const imData = imRes.ok ? await imRes.json() : [];

        if (!disposed) {
          setRules(Array.isArray(rulesData) ? rulesData : []);
          setImConfigs(Array.isArray(imData) ? imData : []);
        }
      } catch (err) {
        if (!disposed) {
          setError(err instanceof Error ? err.message : "加载失败");
        }
      } finally {
        if (!disposed) {
          setLoading(false);
        }
      }
    };
    void load();
    return () => {
      disposed = true;
    };
  }, [tenantId]);

  const imMap = useMemo(() => {
    const map = new Map<string, IMConfig>();
    imConfigs.forEach((item) => map.set(item.id, item));
    return map;
  }, [imConfigs]);

  const getPairingLabel = (platformIds?: string) => {
    const ids = (platformIds || "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    if (ids.length === 0) {
      return { text: "未绑定平台", status: "warn" };
    }
    const matched = ids.map((id) => imMap.get(id)).filter((item): item is IMConfig => Boolean(item));
    if (matched.length === 0) {
      return { text: "平台 ID 无法匹配", status: "error" };
    }
    const names = matched.map((m) => `${m.name}(${m.type})`).join("、");
    return { text: names, status: "ok" };
  };

  return (
    <div className="min-h-screen bg-zinc-950 bg-grid">
      <AppHeader
        title="通知规则"
        backHref="/chat"
        backLabel="返回 AI 对话"
      />

      <main className="mx-auto max-w-5xl px-6 py-8">
        <IMSectionNav current="rules" />

        {loading ? <p className="text-sm text-zinc-400">正在加载通知规则...</p> : null}
        {error ? <p className="text-sm text-rose-400">{error}</p> : null}

        {!loading && !error && rules.length === 0 ? (
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 px-4 py-5 text-sm text-zinc-400">
            暂无通知规则。你可以回到 <Link className="text-indigo-400 hover:underline" href="/chat">AI 对话</Link> 通过自然语言创建。
          </div>
        ) : null}

        <div className="space-y-3">
          {rules.map((rule) => {
            const pairing = getPairingLabel(rule.platformIds);
            const isFocused = focusRuleId === rule.id;
            return (
              <section
                key={rule.id}
                className={`rounded-xl border px-4 py-4 ${
                  isFocused
                    ? "border-indigo-500/50 bg-indigo-500/10"
                    : "border-zinc-800 bg-zinc-900/40"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="text-sm font-semibold text-zinc-100">{rule.name}</h2>
                    <p className="mt-1 text-xs text-zinc-500">{rule.description || "无描述"}</p>
                  </div>
                  <span className={`text-xs ${rule.enabled ? "text-emerald-400" : "text-zinc-500"}`}>
                    {rule.enabled ? "启用中" : "已禁用"}
                  </span>
                </div>

                <div className="mt-3 grid gap-1 text-xs text-zinc-400">
                  <p>规则类型：{rule.ruleType || "-"}</p>
                  <p>触发条件：{rule.conditionType || "-"} {rule.threshold ?? "-"}</p>
                  <p>频率：{rule.frequency || "-"}</p>
                  <p>时间范围：{rule.timeRange || "-"}</p>
                  <p>
                    平台配对：{" "}
                    <span
                      className={
                        pairing.status === "ok"
                          ? "text-emerald-400"
                          : pairing.status === "warn"
                            ? "text-amber-400"
                            : "text-rose-400"
                      }
                    >
                      {pairing.text}
                    </span>
                  </p>
                </div>
              </section>
            );
          })}
        </div>
      </main>
    </div>
  );
}
