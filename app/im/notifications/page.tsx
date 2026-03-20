"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/user-store";
import { IM_PLATFORM_REGISTRY, type IMPlatformConfig, type NotificationRecord, type NotificationSendRequest } from "@/lib/im";

export default function NotificationsPage() {
  const router = useRouter();
  const [tenantId, setTenantId] = useState("demo-tenant");
  const [configs, setConfigs] = useState<IMPlatformConfig[]>([]);
  const [history, setHistory] = useState<NotificationRecord[]>([]);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [tab, setTab] = useState<"send" | "history">("send");
  const [form, setForm] = useState<NotificationSendRequest>({ platformIds: [], templateType: "custom", title: "", content: "", markdown: false });

  useEffect(() => {
    const user = getCurrentUser();
    if (user) setTenantId(user.id);
    loadData();
  }, []);

  const loadData = async () => {
    const [cfgRes, histRes] = await Promise.all([
      fetch(`/api/tenants/${tenantId}/im-configs`),
      fetch(`/api/tenants/${tenantId}/notifications`),
    ]);
    if (cfgRes.ok) setConfigs(await cfgRes.json());
    if (histRes.ok) setHistory(await histRes.json());
  };

  const togglePlatform = (id: string) => {
    setForm((prev) => ({
      ...prev,
      platformIds: prev.platformIds.includes(id) ? prev.platformIds.filter((p) => p !== id) : [...prev.platformIds, id],
    }));
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault(); setError(""); setSuccess("");
    if (form.platformIds.length === 0) { setError("请选择至少一个发送平台"); return; }
    if (!form.content.trim()) { setError("消息内容不能为空"); return; }
    setSending(true);
    try {
      const res = await fetch(`/api/tenants/${tenantId}/notifications/send`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "发送失败");
      const records = data.records || [];
      const sentCount = records.filter((r: NotificationRecord) => r.status === "sent").length;
      const failCount = records.filter((r: NotificationRecord) => r.status === "failed").length;
      setSuccess(failCount === 0 ? `全部发送成功（${sentCount} 条）` : `${sentCount} 成功，${failCount} 失败`);
      setForm({ ...form, title: "", content: "" });
      await loadData();
    } catch (err) { setError(err instanceof Error ? err.message : "发送失败"); }
    finally { setSending(false); }
  };

  const enabledConfigs = configs.filter((c) => c.enabled);
  const TEMPLATE_OPTIONS = [
    { value: "custom", label: "自定义消息" },
    { value: "data_alert", label: "数据告警" },
    { value: "report_ready", label: "报告就绪" },
    { value: "dashboard_update", label: "大屏更新" },
  ];

  return (
    <div className="min-h-screen bg-zinc-950 bg-grid">
      <nav className="flex items-center justify-between px-6 py-3 border-b border-zinc-800/80 bg-zinc-950/90 backdrop-blur-md sticky top-0 z-40">
        <Link href="/im/settings" className="flex items-center gap-2 text-zinc-400 hover:text-zinc-200 transition-colors">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
          </svg>
          <span className="text-sm">IM 设置</span>
        </Link>
      </nav>

      <main className="p-6 max-w-2xl mx-auto">
        <h1 className="text-xl font-semibold text-zinc-100 mb-6">通知中心</h1>

        <div className="flex gap-1 bg-zinc-900/80 rounded-xl p-1 w-fit mb-5 border border-zinc-800/50">
          {(["send", "history"] as const).map((t) => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${tab === t ? "bg-zinc-800 text-zinc-100 shadow-sm" : "text-zinc-500 hover:text-zinc-300"}`}>
              {t === "send" ? "发送通知" : "发送历史"}
            </button>
          ))}
        </div>

        {tab === "send" && (
          <form onSubmit={handleSend} className="space-y-5">
            <div>
              <label className="block text-xs text-zinc-500 mb-2">选择发送平台</label>
              {enabledConfigs.length === 0 ? (
                <p className="text-sm text-zinc-600">暂无可用平台，请先 <Link href="/im/settings" className="text-indigo-400">添加配置</Link></p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {enabledConfigs.map((cfg) => {
                    const meta = IM_PLATFORM_REGISTRY[cfg.type];
                    const selected = form.platformIds.includes(cfg.id);
                    return (
                      <button key={cfg.id} type="button" onClick={() => togglePlatform(cfg.id)}
                        className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm transition-all ${
                          selected ? "border-indigo-500/50 bg-indigo-500/10 text-indigo-300" : "border-zinc-700/50 bg-zinc-800/30 text-zinc-400"
                        }`}>
                        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: meta?.color }} />
                        {cfg.name}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
            <div>
              <label className="block text-xs text-zinc-500 mb-2">通知类型</label>
              <div className="flex flex-wrap gap-2">
                {TEMPLATE_OPTIONS.map((opt) => (
                  <button key={opt.value} type="button" onClick={() => setForm({ ...form, templateType: opt.value as NotificationSendRequest["templateType"] })}
                    className={`px-3 py-1.5 rounded-lg border text-sm transition-all ${
                      form.templateType === opt.value ? "border-indigo-500/50 bg-indigo-500/10 text-indigo-300" : "border-zinc-700/50 bg-zinc-800/30 text-zinc-400"
                    }`}>
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-xs text-zinc-500 mb-1.5">标题</label>
              <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="通知标题" className="input-base" />
            </div>
            <div>
              <label className="block text-xs text-zinc-500 mb-1.5">内容</label>
              <textarea value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} placeholder="输入通知内容..." rows={5} className="input-base" />
            </div>
            <div className="flex items-center gap-2">
              <input id="markdown" type="checkbox" checked={form.markdown} onChange={(e) => setForm({ ...form, markdown: e.target.checked })} className="rounded bg-zinc-800 border-zinc-600" />
              <label htmlFor="markdown" className="text-sm text-zinc-400">Markdown 格式</label>
            </div>
            {error && <p className="text-red-400 text-sm">{error}</p>}
            {success && <p className="text-emerald-400 text-sm">{success}</p>}
            <button type="submit" disabled={sending} className="btn-primary w-full disabled:opacity-50">
              {sending ? "发送中..." : "发送通知"}
            </button>
          </form>
        )}

        {tab === "history" && (
          <div className="space-y-3">
            {history.length === 0 && <p className="text-center py-16 text-zinc-500">暂无发送记录</p>}
            {history.map((record) => {
              const meta = IM_PLATFORM_REGISTRY[record.platformType];
              return (
                <div key={record.id} className="glass-card rounded-xl p-4 flex items-start gap-4 animate-fade-in">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: `${meta?.color}15` }}>
                    <span className="text-sm font-bold" style={{ color: meta?.color }}>{meta?.label.charAt(0)}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-medium text-zinc-200">{record.title || "无标题"}</span>
                      <span className={record.status === "sent" ? "badge-success" : record.status === "failed" ? "badge-error" : "badge-neutral"}>
                        {record.status === "sent" ? "已发送" : record.status === "failed" ? "失败" : "待发送"}
                      </span>
                    </div>
                    <p className="text-xs text-zinc-500 truncate">{record.content}</p>
                    {record.error && <p className="text-xs text-red-400/80 mt-1">{record.error}</p>}
                    <p className="text-xs text-zinc-600 mt-1">{new Date(record.sentAt).toLocaleString("zh-CN")}</p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
