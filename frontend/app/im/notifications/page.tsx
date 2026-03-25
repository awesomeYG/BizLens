"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getAccessToken } from "@/lib/auth/api";
import { getCurrentUser } from "@/lib/user-store";
import { IM_PLATFORM_REGISTRY, type IMPlatformConfig, type NotificationRecord, type NotificationSendRequest } from "@/lib/im";
import IMPlatformIcon from "@/components/IMPlatformIcon";
import AppHeader from "@/components/AppHeader";
import IMSectionNav from "@/components/IMSectionNav";

export default function NotificationsPage() {
  const [tenantId, setTenantId] = useState("");
  const [hydrated, setHydrated] = useState(false);
  const [configs, setConfigs] = useState<IMPlatformConfig[]>([]);
  const [history, setHistory] = useState<NotificationRecord[]>([]);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [tab, setTab] = useState<"send" | "history">("send");
  const [form, setForm] = useState<NotificationSendRequest>({ platformIds: [], templateType: "custom", title: "", content: "", markdown: false });
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  const authFetchHeaders = (json = false): Record<string, string> => {
    const h: Record<string, string> = {};
    const token = getAccessToken();
    if (token) h.Authorization = `Bearer ${token}`;
    if (json) h["Content-Type"] = "application/json";
    return h;
  };

  useEffect(() => {
    const user = getCurrentUser();
    if (user?.tenantId || user?.id) {
      setTenantId(user.tenantId || user.id);
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated || !tenantId) return;
    loadData();
  }, [hydrated, tenantId]);

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  const loadData = async () => {
    const headers = authFetchHeaders();
    const [cfgRes, histRes] = await Promise.all([
      fetch(`/api/tenants/${tenantId}/im-configs`, { headers }),
      fetch(`/api/tenants/${tenantId}/notifications`, { headers }),
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
      const res = await fetch(`/api/tenants/${tenantId}/notifications/send`, {
        method: "POST",
        headers: authFetchHeaders(true),
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "发送失败");
      const records = data.records || [];
      const sentCount = records.filter((r: NotificationRecord) => r.status === "sent").length;
      const failCount = records.filter((r: NotificationRecord) => r.status === "failed").length;
      setSuccess(failCount === 0 ? `全部发送成功（${sentCount} 条）` : `${sentCount} 成功，${failCount} 失败`);
      setToast({ 
        message: failCount === 0 ? `全部发送成功（${sentCount} 条）` : `${sentCount} 成功，${failCount} 失败`, 
        type: failCount === 0 ? "success" : "error" 
      });
      setForm({ ...form, title: "", content: "" });
      await loadData();
    } catch (err) { setError(err instanceof Error ? err.message : "发送失败"); }
    finally { setSending(false); }
  };

  const enabledConfigs = configs.filter((c) => c.enabled);
  const sentCount = history.filter(h => h.status === "sent").length;
  const failCount = history.filter(h => h.status === "failed").length;

  const TEMPLATE_OPTIONS = [
    { value: "custom", label: "自定义消息", icon: "✏️" },
    { value: "data_alert", label: "数据告警", icon: "🚨" },
    { value: "report_ready", label: "报告就绪", icon: "📊" },
    { value: "dashboard_update", label: "大屏更新", icon: "📺" },
  ];

  return (
    <div className="min-h-screen bg-zinc-950 bg-grid">
      {/* Navigation */}
      <AppHeader
        title="通知中心"
        backHref="/im/settings"
        backLabel="返回设置"
        actions={
          <div className="flex items-center gap-4 text-xs text-zinc-500">
            <span>成功：<span className="text-emerald-400">{sentCount}</span></span>
            <span>失败：<span className="text-red-400">{failCount}</span></span>
          </div>
        }
      />

      {/* Hero Section */}
      <div className="relative overflow-hidden border-b border-zinc-800/50">
        <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/5 via-purple-500/5 to-pink-500/5" />
        <div className="relative max-w-5xl mx-auto px-6 py-10">
          <h1 className="text-2xl font-bold text-zinc-100 mb-2">通知中心</h1>
          <p className="text-zinc-400 text-sm">
            向多个 IM 平台发送通知消息，支持自定义模板和 Markdown 格式
          </p>
        </div>
      </div>

      {/* Main Content */}
      <main className="max-w-5xl mx-auto px-6 py-8">
        <IMSectionNav current="notifications" />

        {/* Tab Switcher */}
        <div className="flex gap-1 bg-zinc-900/80 rounded-xl p-1 w-fit mb-6 border border-zinc-800/50">
          {(["send", "history"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-5 py-2.5 rounded-lg text-sm font-medium transition-all ${
                tab === t ? "bg-zinc-800 text-zinc-100 shadow-sm" : "text-zinc-500 hover:text-zinc-300"
              }`}
            >
              <span className="flex items-center gap-2">
                {t === "send" ? (
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                  </svg>
                ) : (
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                )}
                {t === "send" ? "发送通知" : "发送历史"}
              </span>
            </button>
          ))}
        </div>

        {tab === "send" ? (
          <div className="grid lg:grid-cols-5 gap-6">
            {/* Left: Platform Selection */}
            <div className="lg:col-span-2 space-y-4">
              <div className="glass-card rounded-2xl p-5">
                <h2 className="text-sm font-semibold text-zinc-200 mb-4 flex items-center gap-2">
                  <svg className="w-4 h-4 text-zinc-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                  选择发送平台
                </h2>
                {enabledConfigs.length === 0 ? (
                  <div className="text-center py-8">
                    <svg className="w-12 h-12 mx-auto text-zinc-700 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                    </svg>
                    <p className="text-sm text-zinc-500 mb-3">暂无可用平台</p>
                    <Link href="/im/settings" className="text-xs text-indigo-400 hover:text-indigo-300">
                      去添加 →
                    </Link>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {enabledConfigs.map((cfg) => {
                      const meta = IM_PLATFORM_REGISTRY[cfg.type];
                      const selected = form.platformIds.includes(cfg.id);
                      return (
                        <button
                          key={cfg.id}
                          type="button"
                          onClick={() => togglePlatform(cfg.id)}
                          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border transition-all text-left ${
                            selected
                              ? "border-indigo-500/50 bg-indigo-500/10"
                              : "border-zinc-800/50 bg-zinc-900/30 hover:border-zinc-700"
                          }`}
                        >
                          <div
                            className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                            style={{ backgroundColor: `${meta?.color}20` }}
                          >
                            <IMPlatformIcon type={cfg.type} size="sm" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium text-zinc-200 truncate">{cfg.name}</div>
                            <div className="text-xs text-zinc-500">{meta?.label}</div>
                          </div>
                          {selected && (
                            <svg className="w-5 h-5 text-indigo-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Template Selection */}
              <div className="glass-card rounded-2xl p-5">
                <h2 className="text-sm font-semibold text-zinc-200 mb-4 flex items-center gap-2">
                  <svg className="w-4 h-4 text-zinc-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  通知类型
                </h2>
                <div className="grid grid-cols-2 gap-2">
                  {TEMPLATE_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setForm({ ...form, templateType: opt.value as NotificationSendRequest["templateType"] })}
                      className={`p-3 rounded-xl border text-sm transition-all text-left ${
                        form.templateType === opt.value
                          ? "border-indigo-500/50 bg-indigo-500/10 text-indigo-300"
                          : "border-zinc-800/50 bg-zinc-900/30 hover:border-zinc-700 text-zinc-400"
                      }`}
                    >
                      <div className="text-lg mb-1">{opt.icon}</div>
                      <div className="font-medium">{opt.label}</div>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Right: Message Form */}
            <div className="lg:col-span-3">
              <form onSubmit={handleSend} className="glass-card rounded-2xl p-6 space-y-5">
                <div>
                  <label className="block text-xs text-zinc-500 mb-1.5">消息标题</label>
                  <input
                    value={form.title}
                    onChange={(e) => setForm({ ...form, title: e.target.value })}
                    placeholder="可选，留空则无标题"
                    className="input-base"
                  />
                </div>

                <div>
                  <label className="block text-xs text-zinc-500 mb-1.5">
                    消息内容
                    <span className="text-zinc-600 ml-1">(支持 Markdown 语法)</span>
                  </label>
                  <textarea
                    value={form.content}
                    onChange={(e) => setForm({ ...form, content: e.target.value })}
                    placeholder="输入通知内容，支持 Markdown 格式..."
                    rows={12}
                    className="input-base font-mono text-sm"
                  />
                  <div className="flex items-center justify-between mt-2">
                    <div className="flex items-center gap-2">
                      <input
                        id="markdown"
                        type="checkbox"
                        checked={form.markdown}
                        onChange={(e) => setForm({ ...form, markdown: e.target.checked })}
                        className="w-4 h-4 rounded bg-zinc-800 border-zinc-600 text-indigo-500 focus:ring-indigo-500/20"
                      />
                      <label htmlFor="markdown" className="text-sm text-zinc-400 cursor-pointer">
                        启用 Markdown 渲染
                      </label>
                    </div>
                    <div className="text-xs text-zinc-600">
                      当前字数：{form.content.length}
                    </div>
                  </div>
                </div>

                {error && (
                  <div className="flex items-center gap-2 p-3 rounded-xl bg-red-500/10 border border-red-500/30">
                    <svg className="w-4 h-4 text-red-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span className="text-sm text-red-400">{error}</span>
                  </div>
                )}

                {success && (
                  <div className="flex items-center gap-2 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30">
                    <svg className="w-4 h-4 text-emerald-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <span className="text-sm text-emerald-400">{success}</span>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={sending || enabledConfigs.length === 0 || form.platformIds.length === 0}
                  className="btn-primary w-full disabled:opacity-50 disabled:cursor-not-allowed h-11 text-sm"
                >
                  {sending ? (
                    <span className="flex items-center justify-center gap-2">
                      <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      发送中...
                    </span>
                  ) : (
                    <span className="flex items-center justify-center gap-2">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                      </svg>
                      立即发送
                    </span>
                  )}
                </button>
              </form>
            </div>
          </div>
        ) : (
          /* History Tab */
          <div className="space-y-3">
            {history.length === 0 ? (
              <div className="text-center py-20">
                <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-zinc-900 flex items-center justify-center">
                  <svg className="w-10 h-10 text-zinc-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold text-zinc-200 mb-2">暂无发送记录</h3>
                <p className="text-zinc-500 text-sm">发送的通知消息将在此显示历史记录</p>
              </div>
            ) : (
              history.map((record) => {
                const meta = IM_PLATFORM_REGISTRY[record.platformType];
                return (
                  <div
                    key={record.id}
                    className="glass-card rounded-2xl p-5 flex items-start gap-4 animate-fade-in hover:border-zinc-700/50 transition-all"
                  >
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                      style={{ backgroundColor: `${meta?.color}20` }}
                    >
                      <IMPlatformIcon type={record.platformType} size="sm" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-2">
                        <span className="text-sm font-semibold text-zinc-200">{record.title || "无标题"}</span>
                        <span className={record.status === "sent" ? "badge-success" : record.status === "failed" ? "badge-error" : "badge-neutral"}>
                          {record.status === "sent" ? "已发送" : record.status === "failed" ? "失败" : "待发送"}
                        </span>
                        <span className="text-xs text-zinc-600 ml-auto">
                          {new Date(record.sentAt).toLocaleString("zh-CN")}
                        </span>
                      </div>
                      <p className="text-sm text-zinc-400 line-clamp-2 mb-2">{record.content}</p>
                      {record.error && (
                        <div className="flex items-center gap-2 text-xs text-red-400/80">
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          {record.error}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}
      </main>

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 animate-fade-in">
          <div className={`glass-card rounded-xl px-4 py-3 flex items-center gap-3 border ${
            toast.type === "success" ? "border-emerald-500/30 bg-emerald-500/10" : "border-red-500/30 bg-red-500/10"
          }`}>
            {toast.type === "success" ? (
              <svg className="w-5 h-5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            ) : (
              <svg className="w-5 h-5 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            )}
            <span className={`text-sm font-medium ${toast.type === "success" ? "text-emerald-400" : "text-red-400"}`}>
              {toast.message}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
