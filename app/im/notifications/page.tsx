"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getCurrentUser } from "@/lib/user-store";
import { IM_PLATFORM_REGISTRY, type IMPlatformConfig, type NotificationRecord, type NotificationSendRequest } from "@/lib/im";

export default function NotificationsPage() {
  const router = useRouter();
  const [tenantId, setTenantId] = useState("demo-tenant");
  const [configs, setConfigs] = useState<IMPlatformConfig[]>([]);
  const [history, setHistory] = useState<NotificationRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [tab, setTab] = useState<"send" | "history">("send");

  const [form, setForm] = useState<NotificationSendRequest>({
    platformIds: [],
    templateType: "custom",
    title: "",
    content: "",
    markdown: false,
  });

  useEffect(() => {
    const user = getCurrentUser();
    if (user) setTenantId(user.id);
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [cfgRes, histRes] = await Promise.all([
        fetch(`/api/tenants/${tenantId}/im-configs`),
        fetch(`/api/tenants/${tenantId}/notifications`),
      ]);
      if (cfgRes.ok) setConfigs(await cfgRes.json());
      if (histRes.ok) setHistory(await histRes.json());
    } catch (err) {
      console.error("加载数据失败:", err);
    } finally {
      setLoading(false);
    }
  };

  const togglePlatform = (id: string) => {
    setForm((prev) => ({
      ...prev,
      platformIds: prev.platformIds.includes(id)
        ? prev.platformIds.filter((p) => p !== id)
        : [...prev.platformIds, id],
    }));
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (form.platformIds.length === 0) {
      setError("请选择至少一个发送平台");
      return;
    }
    if (!form.content.trim()) {
      setError("消息内容不能为空");
      return;
    }

    setSending(true);
    try {
      const res = await fetch(`/api/tenants/${tenantId}/notifications/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "发送失败");

      const records = data.records || [];
      const sentCount = records.filter((r: NotificationRecord) => r.status === "sent").length;
      const failCount = records.filter((r: NotificationRecord) => r.status === "failed").length;

      if (failCount === 0) {
        setSuccess(`全部发送成功（${sentCount} 条）`);
      } else {
        setSuccess(`发送完成：${sentCount} 成功，${failCount} 失败`);
      }

      setForm({ ...form, title: "", content: "" });
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "发送失败");
    } finally {
      setSending(false);
    }
  };

  const enabledConfigs = configs.filter((c) => c.enabled);

  const TEMPLATE_OPTIONS = [
    { value: "custom", label: "自定义消息" },
    { value: "data_alert", label: "数据告警" },
    { value: "report_ready", label: "报告就绪" },
    { value: "dashboard_update", label: "大屏更新" },
  ];

  return (
    <div className="min-h-screen bg-slate-900">
      <header className="px-6 py-4 border-b border-slate-700/50 bg-slate-800/50">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-semibold text-cyan-400">通知中心</h1>
          <button
            onClick={() => router.push("/im/settings")}
            className="px-4 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-300 text-sm"
          >
            平台设置
          </button>
        </div>
      </header>

      {/* Tab 切换 */}
      <div className="px-6 pt-4">
        <div className="flex gap-1 bg-slate-800/60 rounded-lg p-1 w-fit">
          <button
            onClick={() => setTab("send")}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
              tab === "send" ? "bg-cyan-600 text-white" : "text-slate-400 hover:text-slate-200"
            }`}
          >
            发送通知
          </button>
          <button
            onClick={() => setTab("history")}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
              tab === "history" ? "bg-cyan-600 text-white" : "text-slate-400 hover:text-slate-200"
            }`}
          >
            发送历史
          </button>
        </div>
      </div>

      <main className="p-6">
        {tab === "send" && (
          <form onSubmit={handleSend} className="max-w-2xl space-y-5">
            {/* 选择平台 */}
            <div>
              <label className="block text-sm text-slate-300 mb-2">选择发送平台</label>
              {enabledConfigs.length === 0 ? (
                <p className="text-sm text-slate-500">
                  暂无可用平台，请先
                  <button type="button" onClick={() => router.push("/im/settings")} className="text-cyan-400 hover:underline ml-1">
                    添加配置
                  </button>
                </p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {enabledConfigs.map((cfg) => {
                    const meta = IM_PLATFORM_REGISTRY[cfg.type];
                    const selected = form.platformIds.includes(cfg.id);
                    return (
                      <button
                        key={cfg.id}
                        type="button"
                        onClick={() => togglePlatform(cfg.id)}
                        className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm transition-all ${
                          selected
                            ? "border-cyan-500 bg-cyan-500/20 text-cyan-200"
                            : "border-slate-600 bg-slate-700/50 text-slate-300 hover:border-slate-500"
                        }`}
                      >
                        <span className="font-bold text-xs" style={{ color: meta?.color }}>
                          {meta?.label.charAt(0)}
                        </span>
                        {cfg.name}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* 模板类型 */}
            <div>
              <label className="block text-sm text-slate-300 mb-2">通知类型</label>
              <div className="flex flex-wrap gap-2">
                {TEMPLATE_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setForm({ ...form, templateType: opt.value as NotificationSendRequest["templateType"] })}
                    className={`px-3 py-1.5 rounded-lg border text-sm ${
                      form.templateType === opt.value
                        ? "border-cyan-500 bg-cyan-500/20 text-cyan-200"
                        : "border-slate-600 bg-slate-700/50 text-slate-300"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* 标题 */}
            <div>
              <label className="block text-sm text-slate-300 mb-1">标题</label>
              <input
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="通知标题"
                className="w-full rounded-lg bg-slate-700 border border-slate-600 px-3 py-2 text-slate-100"
              />
            </div>

            {/* 内容 */}
            <div>
              <label className="block text-sm text-slate-300 mb-1">内容</label>
              <textarea
                value={form.content}
                onChange={(e) => setForm({ ...form, content: e.target.value })}
                placeholder="输入通知内容..."
                rows={5}
                className="w-full rounded-lg bg-slate-700 border border-slate-600 px-3 py-2 text-slate-100"
              />
            </div>

            {/* Markdown 开关 */}
            <div className="flex items-center gap-2">
              <input
                id="markdown"
                type="checkbox"
                checked={form.markdown}
                onChange={(e) => setForm({ ...form, markdown: e.target.checked })}
                className="rounded bg-slate-700 border-slate-600"
              />
              <label htmlFor="markdown" className="text-sm text-slate-300">使用 Markdown 格式</label>
            </div>

            {error && <p className="text-red-400 text-sm">{error}</p>}
            {success && <p className="text-emerald-400 text-sm">{success}</p>}

            <button
              type="submit"
              disabled={sending}
              className="w-full py-2.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white font-medium"
            >
              {sending ? "发送中..." : "发送通知"}
            </button>
          </form>
        )}

        {tab === "history" && (
          <div className="space-y-3">
            {history.length === 0 && (
              <p className="text-center py-12 text-slate-400">暂无发送记录</p>
            )}
            {history.map((record) => {
              const meta = IM_PLATFORM_REGISTRY[record.platformType];
              return (
                <div
                  key={record.id}
                  className="rounded-xl border border-slate-700 bg-slate-800/60 p-4 flex items-start gap-4"
                >
                  <div className={`w-8 h-8 rounded-lg ${meta?.iconBg} flex items-center justify-center shrink-0`}>
                    <span className="text-sm font-bold" style={{ color: meta?.color }}>
                      {meta?.label.charAt(0)}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-medium text-slate-200">{record.title || "无标题"}</span>
                      <span className={`text-xs px-1.5 py-0.5 rounded ${
                        record.status === "sent"
                          ? "bg-emerald-500/20 text-emerald-400"
                          : record.status === "failed"
                          ? "bg-red-500/20 text-red-400"
                          : "bg-slate-500/20 text-slate-400"
                      }`}>
                        {record.status === "sent" ? "已发送" : record.status === "failed" ? "失败" : "待发送"}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 truncate">{record.content}</p>
                    {record.error && <p className="text-xs text-red-400 mt-1">{record.error}</p>}
                    <p className="text-xs text-slate-500 mt-1">{new Date(record.sentAt).toLocaleString("zh-CN")}</p>
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
