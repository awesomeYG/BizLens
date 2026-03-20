"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getCurrentUser } from "@/lib/user-store";
import { IM_PLATFORM_REGISTRY, type AlertEvent, type AlertTriggerLog } from "@/lib/im";

export default function AlertsPage() {
  const router = useRouter();
  const [tenantId, setTenantId] = useState("demo-tenant");
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
    <div className="min-h-screen bg-slate-900">
      <nav className="flex items-center justify-between px-6 py-3 border-b border-slate-700/50 bg-slate-800/80">
        <Link href="/" className="text-cyan-400 hover:text-cyan-300 font-medium">← AI BI</Link>
        <div className="flex gap-4 items-center">
          <Link href="/chat" className="text-slate-400 hover:text-slate-300">AI 对话</Link>
          <Link href="/alerts" className="text-cyan-400 font-medium border-b-2 border-cyan-400 pb-1">智能告警</Link>
          <Link href="/alerts/config" className="text-slate-400 hover:text-slate-300 text-sm">告警配置</Link>
        </div>
      </nav>

      <main className="p-6 max-w-4xl mx-auto">
        {/* 概览卡片 */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="rounded-xl border border-slate-700 bg-slate-800/60 p-4 text-center">
            <div className="text-2xl font-bold text-cyan-400">{events.length}</div>
            <div className="text-xs text-slate-400 mt-1">告警规则</div>
          </div>
          <div className="rounded-xl border border-slate-700 bg-slate-800/60 p-4 text-center">
            <div className="text-2xl font-bold text-emerald-400">{enabledEvents.length}</div>
            <div className="text-xs text-slate-400 mt-1">已启用</div>
          </div>
          <div className="rounded-xl border border-slate-700 bg-slate-800/60 p-4 text-center">
            <div className="text-2xl font-bold text-orange-400">{logs.length}</div>
            <div className="text-xs text-slate-400 mt-1">触发次数</div>
          </div>
        </div>

        {/* 提示 */}
        <div className="rounded-xl border border-cyan-500/30 bg-cyan-500/10 p-4 mb-6">
          <p className="text-sm text-cyan-300">
            你可以在 <Link href="/chat" className="underline font-medium">AI 对话</Link> 中用自然语言创建告警，例如：
          </p>
          <p className="text-xs text-cyan-400/70 mt-1">
            "当日销售额超过 1000 时，发钉钉通知" / "库存低于 50 件时告警"
          </p>
        </div>

        {/* Tab */}
        <div className="flex gap-1 bg-slate-800/60 rounded-lg p-1 w-fit mb-4">
          <button onClick={() => setTab("active")} className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${tab === "active" ? "bg-cyan-600 text-white" : "text-slate-400 hover:text-slate-200"}`}>
            活跃规则
          </button>
          <button onClick={() => setTab("history")} className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${tab === "history" ? "bg-cyan-600 text-white" : "text-slate-400 hover:text-slate-200"}`}>
            触发历史
          </button>
        </div>

        {tab === "active" && (
          <div className="space-y-3">
            {enabledEvents.length === 0 && (
              <div className="text-center py-12 text-slate-400">
                暂无活跃告警规则，
                <Link href="/alerts/config" className="text-cyan-400 hover:underline ml-1">去配置</Link>
                或在 <Link href="/chat" className="text-cyan-400 hover:underline ml-1">AI 对话</Link> 中创建
              </div>
            )}
            {enabledEvents.map(event => (
              <div key={event.id} className="rounded-xl border border-slate-700 bg-slate-800/60 p-4 flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-slate-100">{event.name}</span>
                    <span className="text-xs px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400">启用</span>
                  </div>
                  <p className="text-xs text-slate-400 mt-1">
                    {event.metric} {condLabel(event.conditionType)} {event.threshold}
                  </p>
                  {event.description && <p className="text-xs text-slate-500 mt-0.5">{event.description}</p>}
                </div>
                <Link href="/alerts/config" className="text-xs px-2 py-1 rounded bg-slate-700 hover:bg-slate-600 text-slate-300">
                  管理
                </Link>
              </div>
            ))}
          </div>
        )}

        {tab === "history" && (
          <div className="space-y-3">
            {recentLogs.length === 0 && (
              <p className="text-center py-12 text-slate-400">暂无触发记录</p>
            )}
            {recentLogs.map(log => (
              <div key={log.id} className="rounded-xl border border-slate-700 bg-slate-800/60 p-4">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium text-slate-200">{log.eventName}</span>
                  <span className={`text-xs px-1.5 py-0.5 rounded ${log.status === "sent" ? "bg-emerald-500/20 text-emerald-400" : "bg-red-500/20 text-red-400"}`}>
                    {log.status === "sent" ? "已通知" : "失败"}
                  </span>
                </div>
                <p className="text-xs text-slate-400">
                  {log.metric}: 实际值 {log.actualValue}（阈值 {log.threshold}）
                </p>
                {log.error && <p className="text-xs text-red-400 mt-1">{log.error}</p>}
                <p className="text-xs text-slate-500 mt-1">{new Date(log.triggeredAt).toLocaleString("zh-CN")}</p>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
