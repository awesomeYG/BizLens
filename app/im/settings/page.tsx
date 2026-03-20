"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getCurrentUser } from "@/lib/user-store";
import { IM_PLATFORMS_LIST, type IMPlatformConfig, type IMPlatformType, type IMConfigCreateRequest } from "@/lib/im";

export default function IMSettingsPage() {
  const router = useRouter();
  const [hydrated, setHydrated] = useState(false);
  const [tenantId, setTenantId] = useState<string>("demo-tenant");
  const [configs, setConfigs] = useState<IMPlatformConfig[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<IMConfigCreateRequest>({
    type: "dingtalk",
    name: "",
    webhookUrl: "",
    secret: "",
    enabled: true,
  });

  useEffect(() => {
    const user = getCurrentUser();
    if (user) {
      setTenantId(user.id);
    }
    setHydrated(true);
    loadConfigs();
  }, []);

  const loadConfigs = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/tenants/${tenantId}/im-configs`);
      if (res.ok) {
        const data = await res.json();
        setConfigs(data);
      }
    } catch (err) {
      console.error("加载配置失败:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!formData.name || !formData.webhookUrl) {
      setError("名称和 Webhook 地址必填");
      return;
    }

    try {
      const url = editingId
        ? `/api/tenants/${tenantId}/im-configs/${editingId}`
        : `/api/tenants/${tenantId}/im-configs`;
      const method = editingId ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      if (!res.ok) throw new Error("操作失败");

      await loadConfigs();
      setShowForm(false);
      setEditingId(null);
      setFormData({ type: "dingtalk", name: "", webhookUrl: "", secret: "", enabled: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "操作失败");
    }
  };

  const handleEdit = (config: IMPlatformConfig) => {
    setEditingId(config.id);
    setFormData({
      type: config.type,
      name: config.name,
      webhookUrl: config.webhookUrl,
      secret: config.secret || "",
      enabled: config.enabled,
    });
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("确定删除此配置？")) return;
    try {
      const res = await fetch(`/api/tenants/${tenantId}/im-configs/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("删除失败");
      await loadConfigs();
    } catch (err) {
      setError(err instanceof Error ? err.message : "删除失败");
    }
  };

  const handleTest = async (id: string) => {
    try {
      const res = await fetch(`/api/tenants/${tenantId}/im-configs/${id}/test`, { method: "POST" });
      const data = await res.json();
      if (data.success) {
        alert("连接测试成功！");
        await loadConfigs();
      } else {
        alert(`连接失败：${data.error}`);
      }
    } catch (err) {
      alert("测试失败：" + (err instanceof Error ? err.message : "未知错误"));
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "connected": return "text-emerald-400 bg-emerald-500/20 border-emerald-500/50";
      case "error": return "text-red-400 bg-red-500/20 border-red-500/50";
      default: return "text-slate-400 bg-slate-500/20 border-slate-500/50";
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case "connected": return "已连接";
      case "error": return "异常";
      default: return "未连接";
    }
  };

  if (!hydrated) return <div className="min-h-screen bg-slate-900" />;

  return (
    <div className="min-h-screen bg-slate-900">
      <header className="px-6 py-4 border-b border-slate-700/50 bg-slate-800/50">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-semibold text-cyan-400">IM 平台设置</h1>
          <div className="flex gap-3">
            <button
              onClick={() => router.push("/chat")}
              className="px-4 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-300 text-sm"
            >
              返回对话
            </button>
            <button
              onClick={() => setShowForm(true)}
              className="px-4 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-sm font-medium"
            >
              + 添加平台
            </button>
          </div>
        </div>
      </header>

      <main className="p-6">
        {/* 平台卡片列表 */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
          {configs.map((config) => {
            const meta = IM_PLATFORMS_LIST.find((p) => p.type === config.type);
            return (
              <div
                key={config.id}
                className="rounded-xl border border-slate-700 bg-slate-800/60 p-4 space-y-3"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-lg ${meta?.iconBg} flex items-center justify-center`}>
                      <span className="text-lg font-bold" style={{ color: meta?.color }}>
                        {meta?.label.charAt(0)}
                      </span>
                    </div>
                    <div>
                      <h3 className="font-medium text-slate-100">{config.name}</h3>
                      <p className="text-xs text-slate-400">{meta?.label}</p>
                    </div>
                  </div>
                  <span className={`text-xs px-2 py-1 rounded border ${getStatusColor(config.status)}`}>
                    {getStatusText(config.status)}
                  </span>
                </div>

                <div className="text-xs text-slate-500 break-all">
                  {config.webhookUrl}
                </div>

                <div className="flex items-center justify-between">
                  <span className={`text-xs ${config.enabled ? "text-emerald-400" : "text-slate-500"}`}>
                    {config.enabled ? "已启用" : "已禁用"}
                  </span>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleTest(config.id)}
                      className="text-xs px-2 py-1 rounded bg-slate-700 hover:bg-slate-600 text-slate-300"
                    >
                      测试
                    </button>
                    <button
                      onClick={() => handleEdit(config)}
                      className="text-xs px-2 py-1 rounded bg-cyan-600/20 hover:bg-cyan-600/30 text-cyan-300"
                    >
                      编辑
                    </button>
                    <button
                      onClick={() => handleDelete(config.id)}
                      className="text-xs px-2 py-1 rounded bg-red-600/20 hover:bg-red-600/30 text-red-300"
                    >
                      删除
                    </button>
                  </div>
                </div>
              </div>
            );
          })}

          {configs.length === 0 && !loading && (
            <div className="col-span-full text-center py-12 text-slate-400">
              暂无 IM 平台配置，点击右上角添加
            </div>
          )}
        </div>

        {/* 通知历史入口 */}
        <div className="mt-8">
          <button
            onClick={() => router.push("/im/notifications")}
            className="w-full py-4 rounded-xl border border-slate-700 bg-slate-800/60 hover:bg-slate-800 text-slate-300 font-medium transition-all"
          >
            📤 发送通知 / 查看历史
          </button>
        </div>
      </main>

      {/* 添加/编辑弹窗 */}
      {showForm && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50">
          <div className="w-full max-w-md rounded-2xl border border-slate-700 bg-slate-800 p-6 space-y-4">
            <h2 className="text-lg font-semibold text-slate-100">
              {editingId ? "编辑平台" : "添加平台"}
            </h2>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm text-slate-400 mb-1">平台类型</label>
                <select
                  value={formData.type}
                  onChange={(e) => setFormData({ ...formData, type: e.target.value as IMPlatformType })}
                  className="w-full rounded-lg bg-slate-700 border border-slate-600 px-3 py-2 text-slate-100"
                  disabled={!!editingId}
                >
                  {IM_PLATFORMS_LIST.map((p) => (
                    <option key={p.type} value={p.type}>{p.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm text-slate-400 mb-1">名称</label>
                <input
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="如：研发群机器人"
                  className="w-full rounded-lg bg-slate-700 border border-slate-600 px-3 py-2 text-slate-100"
                />
              </div>

              <div>
                <label className="block text-sm text-slate-400 mb-1">Webhook 地址</label>
                <input
                  value={formData.webhookUrl}
                  onChange={(e) => setFormData({ ...formData, webhookUrl: e.target.value })}
                  placeholder="https://..."
                  type="url"
                  className="w-full rounded-lg bg-slate-700 border border-slate-600 px-3 py-2 text-slate-100"
                />
              </div>

              <div>
                <label className="block text-sm text-slate-400 mb-1">签名密钥（可选）</label>
                <input
                  value={formData.secret}
                  onChange={(e) => setFormData({ ...formData, secret: e.target.value })}
                  placeholder="SEC..."
                  type="password"
                  className="w-full rounded-lg bg-slate-700 border border-slate-600 px-3 py-2 text-slate-100"
                />
              </div>

              <div className="flex items-center gap-2">
                <input
                  id="enabled"
                  type="checkbox"
                  checked={formData.enabled}
                  onChange={(e) => setFormData({ ...formData, enabled: e.target.checked })}
                  className="rounded bg-slate-700 border-slate-600"
                />
                <label htmlFor="enabled" className="text-sm text-slate-300">启用此平台</label>
              </div>

              {error && <p className="text-red-400 text-sm">{error}</p>}

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => { setShowForm(false); setEditingId(null); }}
                  className="flex-1 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-300"
                >
                  取消
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-medium"
                >
                  {editingId ? "保存" : "添加"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
