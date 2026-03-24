"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getCurrentUser } from "@/lib/user-store";
import type { AlertEvent, AlertTriggerLog } from "@/lib/im";
import AppHeader from "@/components/AppHeader";

export default function AlertsPage() {
  const router = useRouter();
  const [tenantId, setTenantId] = useState("");
  const [events, setEvents] = useState<AlertEvent[]>([]);
  const [logs, setLogs] = useState<AlertTriggerLog[]>([]);
  const [tab, setTab] = useState<"active" | "history">("active");

  useEffect(() => {
    const user = getCurrentUser();
    if (!user?.isOnboarded) { router.replace("/"); return; }
    setTenantId(user.id);
  }, [router]);

  useEffect(() => {
    if (!tenantId) return;
    Promise.all([
      fetch(`/api/tenants/${tenantId}/alerts`).then(r => r.ok ? r.json() : []),
      fetch(`/api/tenants/${tenantId}/alerts/logs`).then(r => r.ok ? r.json() : []),
    ]).then(([e, l]) => {
      setEvents(Array.isArray(e) ? e : []);
      setLogs(Array.isArray(l) ? l : []);
    });
  }, [tenantId]);

  const enabledEvents = events.filter(e => e.enabled);
  const recentLogs = logs.slice(0, 20);
  const condLabel = (t: string) => {
    const map: Record<string, string> = { greater: ">", less: "<", equals: "=", change: "~", custom: "?" };
    return map[t] || t;
  };

  return (
    <div className="min-h-screen bg-zinc-950 bg-grid">
      <AppHeader title="智能告警" backHref="/" />

      <main className="p-6 max-w-4xl mx-auto">
        {/* 概览卡片 */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          {[
            { value: events.length, label: "告警规则", color: "text-indigo-400" },
            { value: enabledEvents.length, label: "已启用", color: "text-emerald-400" },
            { value: logs.length, label: "触发次数", color: "text-amber-400" },
          ].map((item) => (
            <div key={item.label} className="glass-card rounded-xl p-5 text-center">
              <div className={`text-3xl font-bold ${item.color} tracking-tight`}>{item.value}</div>
              <div className="text-xs text-zinc-500 mt-1">{item.label}</div>
            </div>
          ))}
        </div>

        {/* 提示 */}
        <div className="glass-card rounded-xl p-4 mb-6 border-indigo-500/20">
          <p className="text-sm text-zinc-400">
            在 <Link href="/chat" className="text-indigo-400 hover:text-indigo-300 underline underline-offset-2">AI 对话</Link> 中用自然语言创建告警，例如：
          </p>
          <p className="text-xs text-zinc-500 mt-1 font-mono">
            "当日销售额超过 1000 时，发钉钉通知" / "库存低于 50 件时告警"
          </p>
        </div>

        {/* Tab */}
        <div className="flex gap-1 bg-zinc-900/80 rounded-xl p-1 w-fit mb-5 border border-zinc-800/50">
          {(["active", "history"] as const).map((t) => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                tab === t ? "bg-zinc-800 text-zinc-100 shadow-sm" : "text-zinc-500 hover:text-zinc-300"
              }`}>
              {t === "active" ? "活跃规则" : "触发历史"}
            </button>
          ))}
        </div>

        {tab === "active" && (
          <div className="space-y-3">
            {enabledEvents.length === 0 && (
              <div className="text-center py-16 text-zinc-500">
                暂无活跃告警规则，
                <Link href="/alerts/config" className="text-indigo-400 hover:underline ml-1">去配置</Link>
                或在 <Link href="/chat" className="text-indigo-400 hover:underline ml-1">AI 对话</Link> 中创建
              </div>
            )}
            {enabledEvents.map(event => (
              <div key={event.id} className="glass-card rounded-xl p-4 flex items-center justify-between animate-fade-in">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-zinc-200">{event.name}</span>
                    <span className="badge-success">启用</span>
                  </div>
                  <p className="text-xs text-zinc-500 mt-1 font-mono">
                    {event.metric} {condLabel(event.conditionType)} {event.threshold}
                  </p>
                  {event.description && <p className="text-xs text-zinc-600 mt-0.5">{event.description}</p>}
                </div>
                <Link href="/alerts/config" className="btn-ghost text-xs">管理</Link>
              </div>
            ))}
          </div>
        )}

        {tab === "history" && (
          <div className="space-y-3">
            {recentLogs.length === 0 && (
              <p className="text-center py-16 text-zinc-500">暂无触发记录</p>
            )}
            {recentLogs.map(log => (
              <div key={log.id} className="glass-card rounded-xl p-4 animate-fade-in">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium text-zinc-200">{log.eventName}</span>
                  <span className={log.status === "sent" ? "badge-success" : "badge-error"}>
                    {log.status === "sent" ? "已通知" : "失败"}
                  </span>
                </div>
                <p className="text-xs text-zinc-500 font-mono">
                  {log.metric}: {log.actualValue} (阈值 {log.threshold})
                </p>
                {log.error && <p className="text-xs text-red-400/80 mt-1">{log.error}</p>}
                <p className="text-xs text-zinc-600 mt-1">{new Date(log.triggeredAt).toLocaleString("zh-CN")}</p>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
