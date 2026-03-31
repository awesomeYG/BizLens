"use client";

import { useEffect, useState } from "react";
import { request } from "@/lib/auth/api";
import { getCurrentUser } from "@/lib/user-store";
import { IM_PLATFORMS_LIST, type IMPlatformConfig, type IMConfigCreateRequest } from "@/lib/im";
import IMPlatformCard from "@/components/IMPlatformCard";
import IMPlatformForm from "@/components/IMPlatformForm";
import AppHeader from "@/components/AppHeader";
import IMSectionNav from "@/components/IMSectionNav";
import EmptyState from "@/components/ui/EmptyState";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import { Toast } from "@/components/ui/Toast";
import { SkeletonGrid } from "@/components/ui/Skeleton";
import HeroSection from "@/components/ui/HeroSection";

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
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string } | null>(null);

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

  const executeDelete = async (id: string) => {
    try {
      await request(`/tenants/${tenantId}/im-configs/${id}`, { method: "DELETE" });
      await loadConfigs();
      setToast({ message: "配置已删除", type: "success" });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "删除失败";
      setToast({ message: msg, type: "error" });
    }
  };

  const handleDelete = (id: string) => {
    setDeleteConfirm({ id });
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
      <HeroSection
        title="IM 平台集成"
        description="配置和管理您的即时通讯平台，实现 AI 消息推送、告警通知和自动化报告"
        maxWidth="7xl"
        stats={[
          { label: "运行中", value: connectedCount, color: "text-emerald-400" },
          { label: "总计", value: totalCount },
        ]}
      />

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-6 py-8">
        <IMSectionNav current="settings" />

        {/* Platform Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
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
        </div>

        {/* Empty State */}
        {configs.length === 0 && !loading && (
          <EmptyState
            icon={
              <svg className="w-10 h-10 text-zinc-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
            }
            title="暂无 IM 平台配置"
            description="添加您的第一个即时通讯平台，开始接收智能通知"
            action={
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
            }
          />
        )}

        {/* Loading State */}
        {loading && (
          <SkeletonGrid count={3} columns={3} />
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
      {toast && <Toast message={toast.message} type={toast.type} />}

      <ConfirmDialog
        open={Boolean(deleteConfirm)}
        title="确认删除此配置"
        description="删除后该 IM 平台配置会立即失效，且无法撤销。"
        confirmText="确认删除"
        tone="danger"
        details={
          <div className="rounded-2xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-rose-100">
            与该平台相关的测试发送、告警通知和 AI 主动通知都会受到影响。
          </div>
        }
        onClose={() => setDeleteConfirm(null)}
        onConfirm={async () => {
          const target = deleteConfirm;
          if (!target) return;
          await executeDelete(target.id);
          setDeleteConfirm(null);
        }}
      />
    </div>
  );
}
