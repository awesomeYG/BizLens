"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/user-store";
import { IM_PLATFORMS_LIST, type IMPlatformConfig, type IMPlatformType, type IMConfigCreateRequest } from "@/lib/im";

export default function IMSettingsPage() {
  const router = useRouter();
  const [hydrated, setHydrated] = useState(false);
  const [tenantId, setTenantId] = useState("demo-tenant");
  const [configs, setConfigs] = useState<IMPlatformConfig[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<IMConfigCreateRequest>({ type: "dingtalk", name: "", webhookUrl: "", secret: "", enabled: true });

  useEffect(() => {
    const user = getCurrentUser();
    if (user) setTenantId(user.id);
    setHydrated(true);
    loadConfigs();
  }, []);

  const loadConfigs = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/tenants/${tenantId}/im-configs`);
      if (res.ok) setConfigs(await res.json());
    } catch {} finally { setLoading(false); }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setError("");
    if (!formData.name || !formData.webhookUrl) { setError("名称和 Webhook 地址必填"); return; }
    const url = editingId ? `/api/tenants/${tenantId}/im-configs/${editingId}` : `/api/tenants/${tenantId}/im-configs`;
    const res = await fetch(url, { method: editingId ? "PUT" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(formData) });
    if (!res.ok) { setError("操作失败"); return; }
    await loadConfigs(); setShowForm(false); setEditingId(null);
    setFormData({ type: "dingtalk", name: "", webhookUrl: "", secret: "", enabled: true });
  };

  const handleEdit = (config: IMPlatformConfig) => {
    setEditingId(config.id);
    setFormData({ type: config.type, name: config.name, webhookUrl: config.webhookUrl, secret: config.secret || "", enabled: config.enabled });
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("确定删除此配置？")) return;
    await fetch(`/api/tenants/${tenantId}/im-configs/${id}`, { method: "DELETE" });
    await loadConfigs();
  };

  const handleTest = async (id: string) => {
    const res = await fetch(`/api/tenants/${tenantId}/im-configs/${id}/test`, { method: "POST" });
    const data = await res.json();
    alert(data.success ? "连接测试成功！" : `连接失败：${data.error}`);
    await loadConfigs();
  };

  if (!hydrated) return <div className="min-h-screen bg-zinc-950" />;

  return (
    <div className="min-h-screen bg-zinc-950 bg-grid">
      <nav className="flex items-center justify-between px-6 py-3 border-b border-zinc-800/80 bg-zinc-950/90 backdrop-blur-md sticky top-0 z-40">
        <Link href="/" className="flex items-center gap-2 text-zinc-400 hover:text-zinc-200 transition-colors">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
          </svg>
          <span className="font-medium text-sm bg-gradient-to-r from-white to-zinc-400 bg-clip-text text-transparent">BizLens</span>
        </Link>
        <div className="flex gap-2 items-center">
          <Link href="/im/notifications" className="btn-ghost text-sm">通知中心</Link>
          <button onClick={() => setShowForm(true)} className="btn-primary text-sm">+ 添加平台</button>
        </div>
      </nav>

      <main className="p-6 max-w-4xl mx-auto">
        <h1 className="text-xl font-semibold text-zinc-100 mb-6">IM 平台设置</h1>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {configs.map((config) => {
            const meta = IM_PLATFORMS_LIST.find((p) => p.type === config.type);
            return (
              <div key={config.id} className="glass-card rounded-xl p-5 space-y-3 animate-fade-in">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${meta?.color}15` }}>
                      <span className="text-lg font-bold" style={{ color: meta?.color }}>{meta?.label.charAt(0)}</span>
                    </div>
                    <div>
                      <h3 className="font-medium text-zinc-100 text-sm">{config.name}</h3>
                      <p className="text-xs text-zinc-500">{meta?.label}</p>
                    </div>
                  </div>
                  <span className={config.status === "connected" ? "badge-success" : config.status === "error" ? "badge-error" : "badge-neutral"}>
                    {config.status === "connected" ? "已连接" : config.status === "error" ? "异常" : "未连接"}
                  </span>
                </div>
                <div className="text-xs text-zinc-600 break-all font-mono bg-zinc-900/50 rounded-lg px-3 py-2">{config.webhookUrl}</div>
                <div className="flex items-center justify-between pt-1">
                  <span className={`text-xs ${config.enabled ? "text-emerald-400" : "text-zinc-600"}`}>
                    {config.enabled ? "已启用" : "已禁用"}
                  </span>
                  <div className="flex gap-1">
                    <button onClick={() => handleTest(config.id)} className="btn-ghost text-xs">测试</button>
                    <button onClick={() => handleEdit(config)} className="btn-ghost text-xs text-indigo-400">编辑</button>
                    <button onClick={() => handleDelete(config.id)} className="btn-ghost text-xs text-red-400">删除</button>
                  </div>
                </div>
              </div>
            );
          })}
          {configs.length === 0 && !loading && (
            <div className="col-span-full text-center py-16 text-zinc-500">暂无 IM 平台配置，点击右上角添加</div>
          )}
        </div>
      </main>

      {showForm && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="w-full max-w-md glass-card rounded-2xl p-6 space-y-5 border-zinc-700/50">
            <h2 className="text-lg font-semibold text-zinc-100">{editingId ? "编辑平台" : "添加平台"}</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs text-zinc-500 mb-1.5">平台类型</label>
                <select value={formData.type} onChange={(e) => setFormData({ ...formData, type: e.target.value as IMPlatformType })}
                  className="input-base" disabled={!!editingId}>
                  {IM_PLATFORMS_LIST.map((p) => (<option key={p.type} value={p.type}>{p.label}</option>))}
                </select>
              </div>
              <div>
                <label className="block text-xs text-zinc-500 mb-1.5">名称</label>
                <input value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="如：研发群机器人" className="input-base" />
              </div>
              <div>
                <label className="block text-xs text-zinc-500 mb-1.5">Webhook 地址</label>
                <input value={formData.webhookUrl} onChange={(e) => setFormData({ ...formData, webhookUrl: e.target.value })}
                  placeholder="https://..." type="url" className="input-base" />
              </div>
              <div>
                <label className="block text-xs text-zinc-500 mb-1.5">签名密钥（可选）</label>
                <input value={formData.secret} onChange={(e) => setFormData({ ...formData, secret: e.target.value })}
                  placeholder="SEC..." type="password" className="input-base" />
              </div>
              <div className="flex items-center gap-2">
                <input id="enabled" type="checkbox" checked={formData.enabled}
                  onChange={(e) => setFormData({ ...formData, enabled: e.target.checked })}
                  className="rounded bg-zinc-800 border-zinc-600" />
                <label htmlFor="enabled" className="text-sm text-zinc-400">启用此平台</label>
              </div>
              {error && <p className="text-red-400 text-sm">{error}</p>}
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => { setShowForm(false); setEditingId(null); }} className="btn-secondary flex-1">取消</button>
                <button type="submit" className="btn-primary flex-1">{editingId ? "保存" : "添加"}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
