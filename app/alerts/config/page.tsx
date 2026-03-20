"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getCurrentUser } from "@/lib/user-store";
import {
  ALERT_CONDITION_OPTIONS,
  IM_PLATFORM_REGISTRY,
  type AlertConditionType,
  type AlertEvent,
  type AlertEventCreateRequest,
  type IMPlatformConfig,
} from "@/lib/im";

export default function AlertConfigPage() {
  const router = useRouter();
  const [tenantId, setTenantId] = useState("demo-tenant");
  const [events, setEvents] = useState<AlertEvent[]>([]);
  const [configs, setConfigs] = useState<IMPlatformConfig[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [form, setForm] = useState<AlertEventCreateRequest>({
    name: "", metric: "", conditionType: "greater", threshold: 0,
    message: "", platformIds: "", enabled: true,
  });

  useEffect(() => {
    const user = getCurrentUser();
    if (!user?.isOnboarded) { router.replace("/"); return; }
    setTenantId(user.id);
  }, [router]);

  useEffect(() => {
    if (!tenantId) return;
    loadData();
  }, [tenantId]);

  const loadData = async () => {
    const [evtRes, cfgRes] = await Promise.all([
      fetch(`/api/tenants/${tenantId}/alerts`),
      fetch(`/api/tenants/${tenantId}/im-configs`),
    ]);
    if (evtRes.ok) { const d = await evtRes.json(); setEvents(Array.isArray(d) ? d : []); }
    if (cfgRes.ok) { const d = await cfgRes.json(); setConfigs(Array.isArray(d) ? d : []); }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!form.name || !form.metric || !form.message) {
      setError("名称、指标、通知内容必填");
      return;
    }
    const url = editingId
      ? `/api/tenants/${tenantId}/alerts/${editingId}`
      : `/api/tenants/${tenantId}/alerts`;
    const res = await fetch(url, {
      method: editingId ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    if (!res.ok) { setError("操作失败"); return; }
    setShowForm(false);
    setEditingId(null);
    setForm({ name: "", metric: "", conditionType: "greater", threshold: 0, message: "", platformIds: "", enabled: true });
    await loadData();
  };

  const handleEdit = (evt: AlertEvent) => {
    setEditingId(evt.id);
    setForm({
      name: evt.name, description: evt.description, metric: evt.metric,
      conditionType: evt.conditionType, threshold: evt.threshold,
      message: evt.message, platformIds: evt.platformIds, enabled: evt.enabled,
    });
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("确定删除此告警规则？")) return;
    await fetch(`/api/tenants/${tenantId}/alerts/${id}`, { method: "DELETE" });
    await loadData();
  };

  const handleToggle = async (evt: AlertEvent) => {
    await fetch(`/api/tenants/${tenantId}/alerts/${evt.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled: !evt.enabled }),
    });
    await loadData();
  };

  const condLabel = (t: string) => ALERT_CONDITION_OPTIONS.find(o => o.value === t)?.label || t;
  const condSymbol = (t: string) => ALERT_CONDITION_OPTIONS.find(o => o.value === t)?.symbol || t;

  const enabledConfigs = configs.filter(c => c.enabled);

  const selectedPlatformIds = form.platformIds ? form.platformIds.split(",").map(s => s.trim()).filter(Boolean) : [];
  const togglePlatform = (id: string) => {
    const next = selectedPlatformIds.includes(id)
      ? selectedPlatformIds.filter(p => p !== id)
      : [...selectedPlatformIds, id];
    setForm({ ...form, platformIds: next.join(",") });
  };

  return (
    <div className="min-h-screen bg-slate-900">
      <nav className="flex items-center justify-between px-6 py-3 border-b border-slate-700/50 bg-slate-800/80">
        <Link href="/alerts" className="text-cyan-400 hover:text-cyan-300 font-medium">← 智能告警</Link>
        <button onClick={() => { setEditingId(null); setForm({ name: "", metric: "", conditionType: "greater", threshold: 0, message: "", platformIds: "", enabled: true }); setShowForm(true); }}
          className="px-4 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-sm font-medium">
          + 新建规则
        </button>
      </nav>

      <main className="p-6 max-w-3xl mx-auto space-y-3">
        {events.length === 0 && (
          <div className="text-center py-16 text-slate-400">
            暂无告警规则，点击右上角新建，或在 <Link href="/chat" className="text-cyan-400 hover:underline">AI 对话</Link> 中用自然语言创建
          </div>
        )}
        {events.map(evt => (
          <div key={evt.id} className="rounded-xl border border-slate-700 bg-slate-800/60 p-4">
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-medium text-slate-100">{evt.name}</span>
                  <span className={`text-xs px-1.5 py-0.5 rounded ${evt.enabled ? "bg-emerald-500/20 text-emerald-400" : "bg-slate-500/20 text-slate-400"}`}>
                    {evt.enabled ? "启用" : "禁用"}
                  </span>
                </div>
                <p className="text-sm text-slate-300">
                  当 <span className="text-cyan-300 font-mono">{evt.metric}</span>{" "}
                  <span className="text-orange-300">{condSymbol(evt.conditionType)}</span>{" "}
                  <span className="text-orange-300 font-mono">{evt.threshold}</span> 时触发
                </p>
                {evt.description && <p className="text-xs text-slate-500 mt-1">{evt.description}</p>}
                <p className="text-xs text-slate-500 mt-1">通知：{evt.message.slice(0, 60)}{evt.message.length > 60 ? "..." : ""}</p>
              </div>
              <div className="flex gap-2 shrink-0">
                <button onClick={() => handleToggle(evt)} className={`text-xs px-2 py-1 rounded ${evt.enabled ? "bg-slate-700 text-slate-300" : "bg-emerald-600/20 text-emerald-300"}`}>
                  {evt.enabled ? "禁用" : "启用"}
                </button>
                <button onClick={() => handleEdit(evt)} className="text-xs px-2 py-1 rounded bg-cyan-600/20 text-cyan-300">编辑</button>
                <button onClick={() => handleDelete(evt.id)} className="text-xs px-2 py-1 rounded bg-red-600/20 text-red-300">删除</button>
              </div>
            </div>
          </div>
        ))}
      </main>

      {/* 新建/编辑弹窗 */}
      {showForm && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50">
          <div className="w-full max-w-lg rounded-2xl border border-slate-700 bg-slate-800 p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <h2 className="text-lg font-semibold text-slate-100">{editingId ? "编辑告警规则" : "新建告警规则"}</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm text-slate-400 mb-1">规则名称</label>
                <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
                  placeholder="如：日销售额破千通知" className="w-full rounded-lg bg-slate-700 border border-slate-600 px-3 py-2 text-slate-100" />
              </div>
              <div>
                <label className="block text-sm text-slate-400 mb-1">描述（可选）</label>
                <input value={form.description || ""} onChange={e => setForm({ ...form, description: e.target.value })}
                  placeholder="简要描述这个告警的用途" className="w-full rounded-lg bg-slate-700 border border-slate-600 px-3 py-2 text-slate-100" />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-sm text-slate-400 mb-1">监控指标</label>
                  <input value={form.metric} onChange={e => setForm({ ...form, metric: e.target.value })}
                    placeholder="daily_sales" className="w-full rounded-lg bg-slate-700 border border-slate-600 px-3 py-2 text-slate-100 font-mono text-sm" />
                </div>
                <div>
                  <label className="block text-sm text-slate-400 mb-1">条件</label>
                  <select value={form.conditionType} onChange={e => setForm({ ...form, conditionType: e.target.value as AlertConditionType })}
                    className="w-full rounded-lg bg-slate-700 border border-slate-600 px-3 py-2 text-slate-100">
                    {ALERT_CONDITION_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label} ({o.symbol})</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-slate-400 mb-1">阈值</label>
                  <input type="number" value={form.threshold} onChange={e => setForm({ ...form, threshold: parseFloat(e.target.value) || 0 })}
                    className="w-full rounded-lg bg-slate-700 border border-slate-600 px-3 py-2 text-slate-100 font-mono" />
                </div>
              </div>
              <div>
                <label className="block text-sm text-slate-400 mb-1">通知内容</label>
                <textarea value={form.message} onChange={e => setForm({ ...form, message: e.target.value })}
                  placeholder="告警触发时发送的消息内容" rows={3}
                  className="w-full rounded-lg bg-slate-700 border border-slate-600 px-3 py-2 text-slate-100" />
              </div>
              <div>
                <label className="block text-sm text-slate-400 mb-2">通知平台</label>
                {enabledConfigs.length === 0 ? (
                  <p className="text-xs text-slate-500">暂无可用平台，请先 <Link href="/im/settings" className="text-cyan-400">添加 IM 配置</Link></p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {enabledConfigs.map(cfg => {
                      const meta = IM_PLATFORM_REGISTRY[cfg.type];
                      const selected = selectedPlatformIds.includes(cfg.id);
                      return (
                        <button key={cfg.id} type="button" onClick={() => togglePlatform(cfg.id)}
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-sm transition-all ${selected ? "border-cyan-500 bg-cyan-500/20 text-cyan-200" : "border-slate-600 bg-slate-700/50 text-slate-300"}`}>
                          <span className="font-bold text-xs" style={{ color: meta?.color }}>{meta?.label.charAt(0)}</span>
                          {cfg.name}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
              {error && <p className="text-red-400 text-sm">{error}</p>}
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => { setShowForm(false); setEditingId(null); }}
                  className="flex-1 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-300">取消</button>
                <button type="submit" className="flex-1 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-medium">
                  {editingId ? "保存" : "创建"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
