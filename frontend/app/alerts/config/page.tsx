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
import AppHeader from "@/components/AppHeader";
import IMSectionNav from "@/components/IMSectionNav";

export default function AlertConfigPage() {
  const router = useRouter();
  const [tenantId, setTenantId] = useState("");
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

  useEffect(() => { if (tenantId) loadData(); }, [tenantId]);

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
    if (!form.name || !form.metric || !form.message) { setError("名称、指标、通知内容必填"); return; }
    const url = editingId ? `/api/tenants/${tenantId}/alerts/${editingId}` : `/api/tenants/${tenantId}/alerts`;
    const res = await fetch(url, { method: editingId ? "PUT" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
    if (!res.ok) { setError("操作失败"); return; }
    setShowForm(false); setEditingId(null);
    setForm({ name: "", metric: "", conditionType: "greater", threshold: 0, message: "", platformIds: "", enabled: true });
    await loadData();
  };

  const handleEdit = (evt: AlertEvent) => {
    setEditingId(evt.id);
    setForm({ name: evt.name, description: evt.description, metric: evt.metric, conditionType: evt.conditionType, threshold: evt.threshold, message: evt.message, platformIds: evt.platformIds, enabled: evt.enabled });
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("确定删除此告警规则？")) return;
    await fetch(`/api/tenants/${tenantId}/alerts/${id}`, { method: "DELETE" });
    await loadData();
  };

  const handleToggle = async (evt: AlertEvent) => {
    await fetch(`/api/tenants/${tenantId}/alerts/${evt.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ enabled: !evt.enabled }) });
    await loadData();
  };

  const condSymbol = (t: string) => ALERT_CONDITION_OPTIONS.find(o => o.value === t)?.symbol || t;
  const enabledConfigs = configs.filter(c => c.enabled);
  const selectedPlatformIds = form.platformIds ? form.platformIds.split(",").map(s => s.trim()).filter(Boolean) : [];
  const togglePlatform = (id: string) => {
    const next = selectedPlatformIds.includes(id) ? selectedPlatformIds.filter(p => p !== id) : [...selectedPlatformIds, id];
    setForm({ ...form, platformIds: next.join(",") });
  };

  const openNew = () => {
    setEditingId(null);
    setForm({ name: "", metric: "", conditionType: "greater", threshold: 0, message: "", platformIds: "", enabled: true });
    setShowForm(true);
  };

  return (
    <div className="min-h-screen bg-zinc-950 bg-grid">
      <AppHeader
        title="告警规则配置"
        backHref="/alerts"
        backLabel="智能告警"
        actions={
          <button onClick={openNew} className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium transition-all shadow-lg shadow-indigo-500/30">
            + 新建规则
          </button>
        }
      />

      <main className="p-6 max-w-3xl mx-auto space-y-3">
        <IMSectionNav current="alerts" />
        {events.length === 0 && (
          <div className="text-center py-20 text-zinc-500">
            暂无告警规则，点击右上角新建，或在 <Link href="/chat" className="text-indigo-400 hover:underline">AI 对话</Link> 中用自然语言创建
          </div>
        )}
        {events.map(evt => (
          <div key={evt.id} className="glass-card rounded-xl p-5 animate-fade-in">
            <div className="flex items-start justify-between">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="font-medium text-zinc-100 truncate">{evt.name}</span>
                  <span className={evt.enabled ? "badge-success" : "badge-neutral"}>
                    {evt.enabled ? "启用" : "禁用"}
                  </span>
                </div>
                <p className="text-sm text-zinc-400">
                  当 <span className="text-indigo-400 font-mono text-xs bg-indigo-500/10 px-1.5 py-0.5 rounded">{evt.metric}</span>
                  {" "}<span className="text-amber-400 font-bold">{condSymbol(evt.conditionType)}</span>{" "}
                  <span className="text-amber-400 font-mono">{evt.threshold}</span> 时触发
                </p>
                {evt.description && <p className="text-xs text-zinc-600 mt-1">{evt.description}</p>}
                <p className="text-xs text-zinc-600 mt-1 truncate">通知：{evt.message}</p>
              </div>
              <div className="flex gap-2 shrink-0 ml-4">
                <button onClick={() => handleToggle(evt)}
                  className={`btn-ghost text-xs ${evt.enabled ? "text-zinc-500" : "text-emerald-400"}`}>
                  {evt.enabled ? "禁用" : "启用"}
                </button>
                <button onClick={() => handleEdit(evt)} className="btn-ghost text-xs text-indigo-400">编辑</button>
                <button onClick={() => handleDelete(evt.id)} className="btn-ghost text-xs text-red-400">删除</button>
              </div>
            </div>
          </div>
        ))}
      </main>

      {/* 弹窗 */}
      {showForm && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="w-full max-w-lg glass-card rounded-2xl p-6 space-y-5 max-h-[90vh] overflow-y-auto border-zinc-700/50">
            <h2 className="text-lg font-semibold text-zinc-100">{editingId ? "编辑告警规则" : "新建告警规则"}</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs text-zinc-500 mb-1.5">规则名称</label>
                <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
                  placeholder="如：日销售额破千通知" className="input-base" />
              </div>
              <div>
                <label className="block text-xs text-zinc-500 mb-1.5">描述（可选）</label>
                <input value={form.description || ""} onChange={e => setForm({ ...form, description: e.target.value })}
                  placeholder="简要描述这个告警的用途" className="input-base" />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs text-zinc-500 mb-1.5">监控指标</label>
                  <input value={form.metric} onChange={e => setForm({ ...form, metric: e.target.value })}
                    placeholder="daily_sales" className="input-base font-mono text-sm" />
                </div>
                <div>
                  <label className="block text-xs text-zinc-500 mb-1.5">条件</label>
                  <select value={form.conditionType} onChange={e => setForm({ ...form, conditionType: e.target.value as AlertConditionType })}
                    className="input-base">
                    {ALERT_CONDITION_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label} ({o.symbol})</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-zinc-500 mb-1.5">阈值</label>
                  <input type="number" value={form.threshold} onChange={e => setForm({ ...form, threshold: parseFloat(e.target.value) || 0 })}
                    className="input-base font-mono" />
                </div>
              </div>
              <div>
                <label className="block text-xs text-zinc-500 mb-1.5">通知内容</label>
                <textarea value={form.message} onChange={e => setForm({ ...form, message: e.target.value })}
                  placeholder="告警触发时发送的消息内容" rows={3} className="input-base" />
              </div>
              <div>
                <label className="block text-xs text-zinc-500 mb-2">通知平台</label>
                {enabledConfigs.length === 0 ? (
                  <p className="text-xs text-zinc-600">暂无可用平台，请先 <Link href="/im/settings" className="text-indigo-400">添加 IM 配置</Link></p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {enabledConfigs.map(cfg => {
                      const meta = IM_PLATFORM_REGISTRY[cfg.type];
                      const selected = selectedPlatformIds.includes(cfg.id);
                      return (
                        <button key={cfg.id} type="button" onClick={() => togglePlatform(cfg.id)}
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-sm transition-all ${
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
              {error && <p className="text-red-400 text-sm">{error}</p>}
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => { setShowForm(false); setEditingId(null); }} className="btn-secondary flex-1">取消</button>
                <button type="submit" className="btn-primary flex-1">{editingId ? "保存" : "创建"}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
