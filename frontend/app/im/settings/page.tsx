"use client";

import { useEffect, useState } from "react";
import { request } from "@/lib/auth/api";
import { getCurrentUser } from "@/lib/user-store";
import { IM_PLATFORMS_LIST, type IMPlatformConfig, type IMConfigCreateRequest } from "@/lib/im";
import IMPlatformCard from "@/components/IMPlatformCard";
import IMPlatformForm from "@/components/IMPlatformForm";
import AppHeader from "@/components/AppHeader";
import IMSectionNav from "@/components/IMSectionNav";

export default function IMSettingsPage() {
  const [hydrated, setHydrated] = useState(false);
  const [tenantId, setTenantId] = useState("");
  const [configs, setConfigs] = useState<IMPlatformConfig[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<IMConfigCreateRequest>({ type: "dingtalk", name: "", webhookUrl: "", secret: "", keyword: "", enabled: true });
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  useEffect(() => {
    const user = getCurrentUser();
    if (user?.tenantId || user?.id) {
      setTenantId(user.tenantId || user.id);
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated || !tenantId) return;
    loadConfigs();
  }, [hydrated, tenantId]);

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  const loadConfigs = async () => {
    setLoading(true);
    try {
      const data = await request<IMPlatformConfig[]>(`/tenants/${tenantId}/im-configs`);
      setConfigs(data);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "加载失败";
      setError(msg);
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
    const endpoint = editingId ? `/tenants/${tenantId}/im-configs/${editingId}` : `/tenants/${tenantId}/im-configs`;
    try {
      await request<IMPlatformConfig>(endpoint, {
        method: editingId ? "PUT" : "POST",
        body: JSON.stringify(formData),
      });
      await loadConfigs();
      setShowForm(false);
      setEditingId(null);
      setFormData({ type: "dingtalk", name: "", webhookUrl: "", secret: "", keyword: "", enabled: true });
      setToast({ message: editingId ? "配置已更新" : "平台已添加", type: "success" });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "操作失败";
      setError(msg);
    }
  };

  const handleEdit = (config: IMPlatformConfig) => {
    setEditingId(config.id);
    setFormData({
      type: config.type,
      name: config.name,
      webhookUrl: config.webhookUrl,
      secret: config.secret || "",
      keyword: config.keyword || "",
      enabled: config.enabled,
    });
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("确定删除此配置？")) return;
    try {
      await request(`/tenants/${tenantId}/im-configs/${id}`, { method: "DELETE" });
      await loadConfigs();
      setToast({ message: "配置已删除", type: "success" });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "删除失败";
      setToast({ message: msg, type: "error" });
    }
  };

  const handleTest = async (id: string) => {
    try {
      const data = await request<{ success: boolean; message?: string; error?: string }>(
        `/tenants/${tenantId}/im-configs/${id}/test`,
        { method: "POST" }
      );
      setToast({
        message: data.success ? "连接测试成功！" : `连接失败：${data.error || "未知错误"}`,
        type: data.success ? "success" : "error",
      });
      await loadConfigs();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "测试失败";
      setToast({ message: msg, type: "error" });
    }
  };

  const handleToggle = async (id: string, enabled: boolean) => {
    const config = configs.find(c => c.id === id);
    if (!config) return;

    try {
      await request<IMPlatformConfig>(`/tenants/${tenantId}/im-configs/${id}`, {
        method: "PUT",
        body: JSON.stringify({ ...config, enabled }),
      });
      await loadConfigs();
      setToast({ message: enabled ? "平台已启用" : "平台已禁用", type: "success" });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "更新失败";
      setToast({ message: msg, type: "error" });
    }
  };

  if (!hydrated) return <div className="min-h-screen bg-zinc-950" />;

  const connectedCount = configs.filter(c => c.status === "connected" && c.enabled).length;
  const totalCount = configs.length;

  return (
    <div className="min-h-screen bg-zinc-950 bg-grid">
      {/* Navigation */}
      <AppHeader
        title="IM 平台集成"
        backHref="/"
      />

      {/* Hero Section */}
      <div className="relative overflow-hidden border-b border-zinc-800/50">
        <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/5 via-purple-500/5 to-pink-500/5" />
        <div className="relative max-w-7xl mx-auto px-6 py-12">
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-2xl font-bold text-zinc-100 mb-2">IM 平台集成</h1>
              <p className="text-zinc-400 text-sm max-w-xl">
                配置和管理您的即时通讯平台，实现 AI 消息推送、告警通知和自动化报告
              </p>
            </div>
            <div className="flex gap-6">
              <div className="text-right">
                <div className="text-2xl font-bold text-emerald-400">{connectedCount}</div>
                <div className="text-xs text-zinc-500">运行中</div>
              </div>
              <div className="w-px h-10 bg-zinc-800" />
              <div className="text-right">
                <div className="text-2xl font-bold text-zinc-100">{totalCount}</div>
                <div className="text-xs text-zinc-500">总计</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-6 py-8">
        <IMSectionNav current="settings" />

        {/* Platform Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
          {/* 添加平台卡片 */}
          <button
            onClick={() => setShowForm(true)}
            className="rounded-2xl border-2 border-dashed border-zinc-700/50 hover:border-indigo-500/50 bg-zinc-900/50 hover:bg-zinc-900/80 flex flex-col items-center justify-center gap-3 p-8 transition-all aspect-[4/3] group"
          >
            <div className="w-12 h-12 rounded-xl bg-zinc-800 group-hover:bg-indigo-500/10 flex items-center justify-center transition-colors">
              <svg className="w-6 h-6 text-zinc-500 group-hover:text-indigo-400 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
            </div>
            <span className="text-sm text-zinc-500 group-hover:text-zinc-300 transition-colors">添加平台</span>
          </button>

          {configs.map((config) => {
            const meta = IM_PLATFORMS_LIST.find((p) => p.type === config.type);
            if (!meta) return null;
            return (
              <IMPlatformCard
                key={config.id}
                config={config}
                meta={meta}
                onEdit={handleEdit}
                onDelete={handleDelete}
                onTest={handleTest}
                onToggle={handleToggle}
              />
            );
          })}
        </div>

        {/* Empty State */}
        {configs.length === 0 && !loading && (
          <div className="text-center py-20">
            <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-zinc-900 flex items-center justify-center">
              <svg className="w-10 h-10 text-zinc-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-zinc-200 mb-2">暂无 IM 平台配置</h3>
            <p className="text-zinc-500 text-sm mb-6">添加您的第一个即时通讯平台，开始接收智能通知</p>
            <button
              onClick={() => setShowForm(true)}
              className="group relative inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-medium text-zinc-100 transition-all duration-200 bg-zinc-900/80 border border-zinc-700/60 hover:border-indigo-500/50 hover:bg-zinc-800/90 hover:shadow-lg hover:shadow-indigo-500/10 active:scale-[0.97]"
            >
              <span className="flex h-5 w-5 items-center justify-center rounded-md bg-indigo-500/15 text-indigo-400 transition-colors group-hover:bg-indigo-500/25">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                </svg>
              </span>
              添加平台
            </button>
          </div>
        )}

        {/* Loading State */}
        {loading && (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
            {[1, 2, 3].map((i) => (
              <div key={i} className="glass-card rounded-2xl p-5 space-y-4 animate-pulse">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-zinc-800" />
                  <div className="flex-1">
                    <div className="h-4 bg-zinc-800 rounded w-24 mb-2" />
                    <div className="h-3 bg-zinc-800 rounded w-16" />
                  </div>
                </div>
                <div className="h-8 bg-zinc-800 rounded" />
                <div className="h-4 bg-zinc-800 rounded w-32" />
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Form Modal */}
      {showForm && (
        <IMPlatformForm
          editingId={editingId}
          formData={formData}
          error={error}
          onSubmit={handleSubmit}
          onFormDataChange={setFormData}
          onClose={() => { setShowForm(false); setEditingId(null); setError(""); }}
        />
      )}

      {/* Toast Notification */}
      {toast && (
        <div className="fixed bottom-24 right-6 z-50 animate-fade-in">
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
