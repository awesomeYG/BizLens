"use client";

import { useEffect, useState, Suspense } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getAccessToken } from "@/lib/auth/api";
import { getCurrentUser } from "@/lib/user-store";
import {
  ALERT_CONDITION_OPTIONS,
  RULE_TYPE_OPTIONS,
  FREQUENCY_OPTIONS,
  TIME_RANGE_OPTIONS,
  IM_PLATFORM_REGISTRY,
  type UnifiedAlertItem,
  type AlertTriggerLog,
  type AlertConditionType,
  type NotificationRuleType,
  type NotificationFrequency,
  type AlertSourceType,
  type IMPlatformConfig,
} from "@/lib/im";
import AppHeader from "@/components/AppHeader";
import IMSectionNav from "@/components/IMSectionNav";
import EmptyState from "@/components/ui/EmptyState";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import { Toast } from "@/components/ui/Toast";
import TabSwitcher from "@/components/ui/TabSwitcher";
import { SkeletonCard } from "@/components/ui/Skeleton";
import HeroSection from "@/components/ui/HeroSection";

type TabType = "quick_alert" | "auto_rule" | "history";

export default function AlertsPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-zinc-950" />}>
      <AlertsContent />
    </Suspense>
  );
}

function AlertsContent() {
  const router = useRouter();
  const [tenantId, setTenantId] = useState("");
  const [tab, setTab] = useState<TabType>("quick_alert");
  const [quickAlerts, setQuickAlerts] = useState<UnifiedAlertItem[]>([]);
  const [autoRules, setAutoRules] = useState<UnifiedAlertItem[]>([]);
  const [logs, setLogs] = useState<AlertTriggerLog[]>([]);
  const [imConfigs, setImConfigs] = useState<IMPlatformConfig[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingItem, setEditingItem] = useState<UnifiedAlertItem | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string } | null>(null);

  // 表单状态
  const [formType, setFormType] = useState<AlertSourceType>("quick_alert");
  const [form, setForm] = useState({
    name: "",
    description: "",
    enabled: true,
    // 快速告警
    metric: "",
    conditionType: "greater" as AlertConditionType,
    threshold: 0,
    message: "",
    platformIds: "",
    // 自动规则
    ruleType: "data_threshold" as NotificationRuleType,
    frequency: "daily" as NotificationFrequency,
    dataSourceId: "",
    tableName: "",
    metricField: "",
    conditionExpr: "",
    scheduleTime: "",
    timeRange: "",
    messageTemplate: "",
    messageTitle: "",
  });

  useEffect(() => {
    const user = getCurrentUser();
    if (!user) { router.replace("/auth/login"); return; }
    setTenantId(user.tenantId || user.id);
  }, [router]);

  const authHeaders = (json = false): Record<string, string> => {
    const h: Record<string, string> = {};
    const token = getAccessToken();
    if (token) h.Authorization = `Bearer ${token}`;
    if (json) h["Content-Type"] = "application/json";
    return h;
  };

  useEffect(() => {
    if (!tenantId) return;
    loadData();
  }, [tenantId]);

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  const loadData = async () => {
    setLoading(true);
    try {
      const headers = authHeaders();
      const [qaRes, arRes, logRes, imRes] = await Promise.all([
        fetch(`/api/tenants/${tenantId}/alerts?type=quick_alert`, { headers }),
        fetch(`/api/tenants/${tenantId}/alerts?type=auto_rule`, { headers }),
        fetch(`/api/tenants/${tenantId}/alerts/logs`, { headers }),
        fetch(`/api/tenants/${tenantId}/im-configs`, { headers }),
      ]);
      if (qaRes.ok) setQuickAlerts(Array.isArray(await qaRes.json()) ? await qaRes.json() : []);
      if (arRes.ok) setAutoRules(Array.isArray(await arRes.json()) ? await arRes.json() : []);
      if (logRes.ok) setLogs(Array.isArray(await logRes.json()) ? await logRes.json() : []);
      if (imRes.ok) setImConfigs(Array.isArray(await imRes.json()) ? await imRes.json() : []);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!form.name) { setError("名称必填"); return; }

    const payload: Record<string, unknown> = {
      type: formType,
      name: form.name,
      description: form.description,
      enabled: form.enabled,
    };

    if (formType === "quick_alert") {
      if (!form.metric || !form.message) { setError("指标和通知内容必填"); return; }
      payload.metric = form.metric;
      payload.conditionType = form.conditionType;
      payload.threshold = form.threshold;
      payload.message = form.message;
      payload.platformIds = form.platformIds;
    } else {
      if (!form.ruleType) { setError("规则类型必填"); return; }
      payload.ruleType = form.ruleType;
      payload.frequency = form.frequency;
      payload.dataSourceId = form.dataSourceId;
      payload.tableName = form.tableName;
      payload.metricField = form.metricField;
      payload.conditionType = form.conditionType;
      payload.threshold = form.threshold;
      payload.conditionExpr = form.conditionExpr;
      payload.scheduleTime = form.scheduleTime;
      payload.timeRange = form.timeRange;
      payload.messageTemplate = form.messageTemplate;
      payload.messageTitle = form.messageTitle;
      payload.platformIds = form.platformIds;
    }

    const url = editingItem
      ? `/api/tenants/${tenantId}/alerts/${editingItem.id}`
      : `/api/tenants/${tenantId}/alerts`;
    const res = await fetch(url, {
      method: editingItem ? "PUT" : "POST",
      headers: authHeaders(true),
      body: JSON.stringify(payload),
    });

    if (!res.ok) { setError("操作失败"); return; }
    setShowForm(false);
    setEditingItem(null);
    resetForm();
    setToast({ message: editingItem ? "规则已更新" : "规则已创建", type: "success" });
    await loadData();
  };

  const handleEdit = (item: UnifiedAlertItem) => {
    setEditingItem(item);
    setFormType(item.type);
    setForm({
      name: item.name,
      description: item.description || "",
      enabled: item.enabled,
      metric: item.metric || "",
      conditionType: (item.conditionType as AlertConditionType) || "greater",
      threshold: item.threshold || 0,
      message: item.message || "",
      platformIds: item.platformIds || "",
      ruleType: (item.ruleType as NotificationRuleType) || "data_threshold",
      frequency: (item.frequency as NotificationFrequency) || "daily",
      dataSourceId: item.dataSourceId || "",
      tableName: item.tableName || "",
      metricField: item.metricField || "",
      conditionExpr: item.conditionExpr || "",
      scheduleTime: item.scheduleTime || "",
      timeRange: item.timeRange || "",
      messageTemplate: item.messageTemplate || "",
      messageTitle: item.messageTitle || "",
    });
    setShowForm(true);
  };

  const executeDelete = async (id: string) => {
    await fetch(`/api/tenants/${tenantId}/alerts/${id}`, {
      method: "DELETE",
      headers: authHeaders(),
    });
    setToast({ message: "规则已删除", type: "success" });
    await loadData();
  };

  const handleDelete = (id: string) => {
    setDeleteConfirm({ id });
  };

  const handleToggle = async (item: UnifiedAlertItem) => {
    await fetch(`/api/tenants/${tenantId}/alerts/${item.id}/toggle`, {
      method: "POST",
      headers: authHeaders(true),
    });
    await loadData();
  };

  const resetForm = () => {
    setForm({
      name: "", description: "", enabled: true,
      metric: "", conditionType: "greater", threshold: 0, message: "", platformIds: "",
      ruleType: "data_threshold", frequency: "daily", dataSourceId: "", tableName: "",
      metricField: "", conditionExpr: "", scheduleTime: "", timeRange: "",
      messageTemplate: "", messageTitle: "",
    });
  };

  const openNew = (type: AlertSourceType) => {
    setEditingItem(null);
    setFormType(type);
    resetForm();
    setShowForm(true);
  };

  const condSymbol = (t: string) => ALERT_CONDITION_OPTIONS.find(o => o.value === t)?.symbol || t;
  const enabledConfigs = imConfigs.filter(c => c.enabled);
  const selectedPlatformIds = form.platformIds ? form.platformIds.split(",").map(s => s.trim()).filter(Boolean) : [];
  const togglePlatform = (id: string) => {
    const next = selectedPlatformIds.includes(id) ? selectedPlatformIds.filter(p => p !== id) : [...selectedPlatformIds, id];
    setForm({ ...form, platformIds: next.join(",") });
  };

  const enabledQuickAlerts = quickAlerts.filter(e => e.enabled);
  const enabledAutoRules = autoRules.filter(e => e.enabled);
  const recentLogs = logs.slice(0, 30);

  return (
    <div className="min-h-screen bg-zinc-950 bg-grid">
      <AppHeader
        title="告警与通知"
        backHref="/"
      />

      {/* Hero Section */}
      <HeroSection
        title="告警与通知"
        description="设置智能告警规则，当指标异常时自动发送通知"
        stats={[
          { label: "快速告警", value: quickAlerts.length },
          { label: "自动规则", value: autoRules.length },
          { label: "触发次数", value: logs.length, color: "text-amber-400" },
        ]}
        actions={
          <button
            onClick={() => openNew(tab === "history" ? "quick_alert" : tab)}
            className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium transition-all shadow-lg shadow-indigo-500/30"
          >
            + 新建
          </button>
        }
      />

      <main className="p-6 max-w-7xl mx-auto">
        <IMSectionNav current="alerts" />

        {/* Tab 导航 */}
        <TabSwitcher
          tabs={[
            { key: "quick_alert", label: "快速告警", count: enabledQuickAlerts.length },
            { key: "auto_rule", label: "自动规则", count: enabledAutoRules.length },
            { key: "history", label: "触发历史", count: logs.length },
          ]}
          activeTab={tab}
          onTabChange={(key) => setTab(key as TabType)}
          className="mb-6"
        />

        {/* 提示信息 */}
        <div className="glass-card rounded-xl p-4 mb-6 border-indigo-500/20">
          <p className="text-sm text-zinc-400">
            在 <Link href="/chat" className="text-indigo-400 hover:text-indigo-300 underline underline-offset-2">AI 对话</Link> 中用自然语言创建告警，例如：
          </p>
          <p className="text-xs text-zinc-500 mt-1 font-mono">
            "当日销售额超过 1000 时，发钉钉通知" / "每天早上 9 点发送昨日数据报表"
          </p>
        </div>

        {/* ========== 快速告警 Tab ========== */}
        {tab === "quick_alert" && (
          <div>
            {/* Loading State */}
            {loading ? (
              <div className="space-y-6">
                <div className="grid grid-cols-3 gap-4">
                  {[1, 2, 3].map(i => <SkeletonCard key={i} />)}
                </div>
                <div className="space-y-3">
                  {[1, 2].map(i => <SkeletonCard key={i} rows={2} />)}
                </div>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-3 gap-4 mb-6">
                  {[
                    { value: quickAlerts.length, label: "快速告警", color: "text-indigo-400" },
                    { value: enabledQuickAlerts.length, label: "已启用", color: "text-emerald-400" },
                    { value: logs.filter(l => l.sourceType === "quick_alert").length, label: "触发次数", color: "text-amber-400" },
                  ].map((item) => (
                    <div key={item.label} className="glass-card rounded-xl p-5 text-center">
                      <div className={`text-3xl font-bold ${item.color} tracking-tight`}>{item.value}</div>
                      <div className="text-xs text-zinc-500 mt-1">{item.label}</div>
                    </div>
                  ))}
                </div>

                <div className="space-y-3">
                  {quickAlerts.length === 0 && (
                <EmptyState
                  title="暂无快速告警"
                  description={
                    <>
                      点击右上角新建，或在{" "}
                      <Link href="/chat" className="text-indigo-400 hover:underline">
                        AI 对话
                      </Link>{" "}
                      中创建
                    </>
                  }
                  className="py-16"
                />
              )}
              {quickAlerts.map(item => (
                <div key={item.id} className="glass-card rounded-xl p-5 animate-fade-in hover:border-zinc-700/50 transition-all">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1.5">
                        <span className="font-medium text-zinc-100 truncate">{item.name}</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${item.enabled ? "badge-success" : "badge-neutral"}`}>
                          {item.enabled ? "启用" : "禁用"}
                        </span>
                        <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400">快速告警</span>
                      </div>
                      <p className="text-sm text-zinc-400">
                        当 <span className="text-indigo-400 font-mono text-xs bg-indigo-500/10 px-1.5 py-0.5 rounded">{item.metric}</span>
                        {" "}<span className="text-amber-400 font-bold">{condSymbol(item.conditionType || "")}</span>{" "}
                        <span className="text-amber-400 font-mono">{item.threshold}</span> 时触发
                      </p>
                      {item.description && <p className="text-xs text-zinc-600 mt-1">{item.description}</p>}
                      <p className="text-xs text-zinc-600 mt-1 truncate">通知：{item.message}</p>
                    </div>
                    <div className="flex gap-2 shrink-0 ml-4">
                      <button onClick={() => handleToggle(item)}
                        className={`btn-ghost text-xs ${item.enabled ? "text-zinc-500" : "text-emerald-400"}`}>
                        {item.enabled ? "禁用" : "启用"}
                      </button>
                      <button onClick={() => handleEdit(item)} className="btn-ghost text-xs text-indigo-400">编辑</button>
                      <button onClick={() => handleDelete(item.id)} className="btn-ghost text-xs text-red-400">删除</button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
              </>
            )}
          </div>
        )}

        {/* ========== 自动规则 Tab ========== */}
        {tab === "auto_rule" && (
          <div>
            {loading ? (
              <div className="space-y-6">
                <div className="grid grid-cols-3 gap-4">
                  {[1, 2, 3].map(i => <SkeletonCard key={i} />)}
                </div>
                <div className="space-y-3">
                  {[1, 2].map(i => <SkeletonCard key={i} rows={2} />)}
                </div>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-3 gap-4 mb-6">
                  {[
                    { value: autoRules.length, label: "自动规则", color: "text-purple-400" },
                    { value: enabledAutoRules.length, label: "已启用", color: "text-emerald-400" },
                    { value: logs.filter(l => l.sourceType === "auto_rule").length, label: "触发次数", color: "text-amber-400" },
                  ].map((item) => (
                    <div key={item.label} className="glass-card rounded-xl p-5 text-center">
                      <div className={`text-3xl font-bold ${item.color} tracking-tight`}>{item.value}</div>
                      <div className="text-xs text-zinc-500 mt-1">{item.label}</div>
                    </div>
                  ))}
                </div>

                <div className="space-y-3">
                  {autoRules.length === 0 && (
                <EmptyState
                  title="暂无自动规则"
                  description={
                    <>
                      点击右上角新建，或在{" "}
                      <Link href="/chat" className="text-indigo-400 hover:underline">
                        AI 对话
                      </Link>{" "}
                      中创建
                    </>
                  }
                  className="py-16"
                />
              )}
              {autoRules.map(item => (
                <div key={item.id} className="glass-card rounded-xl p-5 animate-fade-in hover:border-zinc-700/50 transition-all">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1.5">
                        <span className="font-medium text-zinc-100 truncate">{item.name}</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${item.enabled ? "badge-success" : "badge-neutral"}`}>
                          {item.enabled ? "启用" : "禁用"}
                        </span>
                        <span className="text-xs px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-400">自动规则</span>
                      </div>
                      <div className="text-sm text-zinc-400 space-y-0.5">
                        <p>类型：{RULE_TYPE_OPTIONS.find(o => o.value === item.ruleType)?.label || item.ruleType}</p>
                        <p>频率：{FREQUENCY_OPTIONS.find(o => o.value === item.frequency)?.label || item.frequency}</p>
                        {item.metricField && <p>字段：<span className="font-mono text-xs">{item.metricField}</span> {condSymbol(item.conditionType || "")} {item.threshold}</p>}
                        {item.scheduleTime && <p>定时：{item.scheduleTime}</p>}
                        {item.timeRange && <p>时间范围：{TIME_RANGE_OPTIONS.find(o => o.value === item.timeRange)?.label || item.timeRange}</p>}
                      </div>
                      {item.description && <p className="text-xs text-zinc-600 mt-1">{item.description}</p>}
                    </div>
                    <div className="flex gap-2 shrink-0 ml-4">
                      <button onClick={() => handleToggle(item)}
                        className={`btn-ghost text-xs ${item.enabled ? "text-zinc-500" : "text-emerald-400"}`}>
                        {item.enabled ? "禁用" : "启用"}
                      </button>
                      <button onClick={() => handleEdit(item)} className="btn-ghost text-xs text-indigo-400">编辑</button>
                      <button onClick={() => handleDelete(item.id)} className="btn-ghost text-xs text-red-400">删除</button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
              </>
            )}
          </div>
        )}

        {/* ========== 触发历史 Tab ========== */}
        {tab === "history" && (
          <div>
            {loading ? (
              <div className="space-y-6">
                <div className="grid grid-cols-3 gap-4">
                  {[1, 2, 3].map(i => <SkeletonCard key={i} />)}
                </div>
                <div className="space-y-3">
                  {[1, 2, 3].map(i => <SkeletonCard key={i} rows={2} />)}
                </div>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-3 gap-4 mb-6">
                  {[
                    { value: logs.length, label: "总触发次数", color: "text-zinc-400" },
                    { value: logs.filter(l => l.status === "sent").length, label: "成功", color: "text-emerald-400" },
                    { value: logs.filter(l => l.status === "failed").length, label: "失败", color: "text-red-400" },
                  ].map((item) => (
                    <div key={item.label} className="glass-card rounded-xl p-5 text-center">
                      <div className={`text-3xl font-bold ${item.color} tracking-tight`}>{item.value}</div>
                      <div className="text-xs text-zinc-500 mt-1">{item.label}</div>
                    </div>
                  ))}
                </div>

                <div className="space-y-3">
                  {recentLogs.length === 0 && (
                    <EmptyState
                      icon={
                        <svg className="w-10 h-10 text-zinc-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                        </svg>
                      }
                      title="暂无触发记录"
                      description="当告警规则被触发时，记录将显示在这里"
                      className="py-16"
                    />
                  )}
                  {recentLogs.map(log => (
                    <div key={log.id} className="glass-card rounded-xl p-4 animate-fade-in hover:border-zinc-700/50 transition-all">
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-zinc-200">{log.eventName}</span>
                          <span className={`text-xs px-2 py-0.5 rounded-full ${log.sourceType === "quick_alert" ? "bg-indigo-500/10 text-indigo-400" : "bg-purple-500/10 text-purple-400"}`}>
                            {log.sourceType === "quick_alert" ? "快速告警" : "自动规则"}
                          </span>
                        </div>
                        <span className={log.status === "sent" ? "badge-success" : "badge-error"}>
                          {log.status === "sent" ? "已通知" : "失败"}
                        </span>
                      </div>
                      <p className="text-xs text-zinc-500 font-mono">
                        {log.metric}: {log.actualValue} (阈值 {log.threshold})
                      </p>
                      {log.error && <p className="text-xs text-red-400/80 mt-1">{log.error}</p>}
                      <p className="text-xs text-zinc-600 mt-1">{new Date(log.triggeredAt).toLocaleString("zh-CN")}</p>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        )}
      </main>

      {/* ========== 创建/编辑弹窗 ========== */}
      {showForm && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="w-full max-w-lg glass-card rounded-2xl p-6 space-y-5 max-h-[90vh] overflow-y-auto border-zinc-700/50">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-zinc-100">
                {editingItem ? "编辑" : "新建"}{formType === "quick_alert" ? "快速告警" : "自动规则"}
              </h2>
              <button onClick={() => { setShowForm(false); setEditingItem(null); }} className="text-zinc-500 hover:text-zinc-300">✕</button>
            </div>

            {/* 类型切换（仅新建时显示） */}
            {!editingItem && (
              <div className="flex gap-1 bg-zinc-900/80 rounded-lg p-1">
                {([
                  { key: "quick_alert" as AlertSourceType, label: "快速告警" },
                  { key: "auto_rule" as AlertSourceType, label: "自动规则" },
                ] as const).map(t => (
                  <button key={t.key} onClick={() => setFormType(t.key)}
                    className={`flex-1 px-3 py-2 rounded-md text-sm transition-all ${
                      formType === t.key ? "bg-zinc-800 text-zinc-100" : "text-zinc-500 hover:text-zinc-300"
                    }`}>
                    {t.label}
                  </button>
                ))}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* 通用字段 */}
              <div>
                <label className="block text-xs text-zinc-500 mb-1.5">规则名称 *</label>
                <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
                  placeholder={formType === "quick_alert" ? "如：日销售额破千通知" : "如：每日销售报表"}
                  className="input-base" />
              </div>
              <div>
                <label className="block text-xs text-zinc-500 mb-1.5">描述（可选）</label>
                <input value={form.description} onChange={e => setForm({ ...form, description: e.target.value })}
                  placeholder="简要描述这个规则"
                  className="input-base" />
              </div>

              {/* ========== 快速告警字段 ========== */}
              {formType === "quick_alert" && (
                <>
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs text-zinc-500 mb-1.5">监控指标 *</label>
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
                    <label className="block text-xs text-zinc-500 mb-1.5">通知内容 *</label>
                    <textarea value={form.message} onChange={e => setForm({ ...form, message: e.target.value })}
                      placeholder="告警触发时发送的消息内容" rows={3} className="input-base" />
                  </div>
                </>
              )}

              {/* ========== 自动规则字段 ========== */}
              {formType === "auto_rule" && (
                <>
                  <div>
                    <label className="block text-xs text-zinc-500 mb-1.5">规则类型 *</label>
                    <select value={form.ruleType} onChange={e => setForm({ ...form, ruleType: e.target.value as NotificationRuleType })}
                      className="input-base">
                      {RULE_TYPE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label} - {o.description}</option>)}
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs text-zinc-500 mb-1.5">触发频率</label>
                      <select value={form.frequency} onChange={e => setForm({ ...form, frequency: e.target.value as NotificationFrequency })}
                        className="input-base">
                        {FREQUENCY_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs text-zinc-500 mb-1.5">定时时间</label>
                      <input value={form.scheduleTime} onChange={e => setForm({ ...form, scheduleTime: e.target.value })}
                        placeholder="09:00" className="input-base font-mono" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs text-zinc-500 mb-1.5">数据源 ID</label>
                      <input value={form.dataSourceId} onChange={e => setForm({ ...form, dataSourceId: e.target.value })}
                        placeholder="ds_xxx" className="input-base font-mono text-sm" />
                    </div>
                    <div>
                      <label className="block text-xs text-zinc-500 mb-1.5">表名</label>
                      <input value={form.tableName} onChange={e => setForm({ ...form, tableName: e.target.value })}
                        placeholder="orders" className="input-base font-mono text-sm" />
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs text-zinc-500 mb-1.5">指标字段</label>
                      <input value={form.metricField} onChange={e => setForm({ ...form, metricField: e.target.value })}
                        placeholder="sales_amount" className="input-base font-mono text-sm" />
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
                    <label className="block text-xs text-zinc-500 mb-1.5">时间范围</label>
                    <select value={form.timeRange} onChange={e => setForm({ ...form, timeRange: e.target.value })}
                      className="input-base">
                      <option value="">不限制</option>
                      {TIME_RANGE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-zinc-500 mb-1.5">消息标题</label>
                    <input value={form.messageTitle} onChange={e => setForm({ ...form, messageTitle: e.target.value })}
                      placeholder="每日数据报告" className="input-base" />
                  </div>
                  <div>
                    <label className="block text-xs text-zinc-500 mb-1.5">消息模板</label>
                    <textarea value={form.messageTemplate} onChange={e => setForm({ ...form, messageTemplate: e.target.value })}
                      placeholder="支持变量占位符：{{current_value}}, {{threshold}}, {{trigger_time}}"
                      rows={3} className="input-base" />
                  </div>
                </>
              )}

              {/* 通知平台 */}
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
                <button type="button" onClick={() => { setShowForm(false); setEditingItem(null); }} className="btn-secondary flex-1">取消</button>
                <button type="submit" className="btn-primary flex-1">{editingItem ? "保存" : "创建"}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && <Toast message={toast.message} type={toast.type} />}

      <ConfirmDialog
        open={Boolean(deleteConfirm)}
        title="确认删除此规则"
        description="删除后该告警规则会立即失效，且无法撤销。"
        confirmText="确认删除"
        tone="danger"
        details={
          <div className="rounded-2xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-rose-100">
            如果该规则仍在生产环境使用，删除后将不再产生告警通知。
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
