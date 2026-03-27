"use client";

import { useEffect, useState, useCallback } from "react";
import type { Metric, MetricStatus } from "@/lib/semantic-types";
import type { DataSourceConfig, DataSourceType } from "@/lib/types";
import { getAccessToken } from "@/lib/auth/api";
import { getCurrentUser } from "@/lib/user-store";
import MetricDiscoveryModal from "./MetricDiscoveryModal";

type FilterStatus = "all" | MetricStatus;

const STATUS_CONFIG: Record<
  MetricStatus,
  { label: string; className: string }
> = {
  active: {
    label: "已激活",
    className: "border-emerald-500/30 bg-emerald-500/10 text-emerald-200",
  },
  draft: {
    label: "草稿",
    className: "border-amber-500/30 bg-amber-500/10 text-amber-200",
  },
  inactive: {
    label: "未激活",
    className: "border-zinc-500/30 bg-zinc-500/10 text-zinc-400",
  },
};

const AGGREGATION_LABELS: Record<string, string> = {
  sum: "求和",
  count: "计数",
  avg: "平均值",
  min: "最小值",
  max: "最大值",
  distinct_count: "去重计数",
  custom: "自定义",
};

const DATA_TYPE_LABELS: Record<string, string> = {
  currency: "金额",
  number: "数字",
  percentage: "百分比",
  datetime: "日期时间",
  string: "字符串",
};

function normalizeDataSourceFromApi(raw: Record<string, unknown>): DataSourceConfig {
  const type = raw.type as DataSourceType;
  const nested = raw.connection as { host?: string; port?: number; database?: string } | undefined;
  const id = String(raw.id ?? "");
  return {
    id,
    type,
    name: String(raw.name ?? ""),
    description: raw.description ? String(raw.description) : undefined,
    status: raw.status as DataSourceConfig["status"],
    connection: nested
      ? { host: String(nested.host ?? ""), port: Number(nested.port ?? 0), database: String(nested.database ?? ""), username: "", password: "", ssl: false }
      : undefined,
  };
}

export default function MetricsTab() {
  const [loading, setLoading] = useState(true);
  const [metrics, setMetrics] = useState<Metric[]>([]);
  const [dataSources, setDataSources] = useState<DataSourceConfig[]>([]);
  const [filterStatus, setFilterStatus] = useState<FilterStatus>("all");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [discovering, setDiscovering] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [discoverDsId, setDiscoverDsId] = useState<string>("");
  const [discoverResult, setDiscoverResult] = useState<{ count: number } | null>(null);
  const [showSmartModal, setShowSmartModal] = useState(false);

  const getTenantId = useCallback(() => {
    const user = getCurrentUser();
    return user?.tenantId || user?.id || "demo-tenant";
  }, []);

  const getAuthHeaders = useCallback((): Record<string, string> => {
    const token = getAccessToken();
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (token) headers["Authorization"] = `Bearer ${token}`;
    return headers;
  }, []);

  const fetchDataSources = useCallback(async () => {
    try {
      const tenantId = getTenantId();
      const response = await fetch(`/api/tenants/${tenantId}/data-sources`, {
        headers: getAuthHeaders(),
      });
      if (response.ok) {
        const data = await response.json();
        const list = Array.isArray(data) ? data : [];
        setDataSources(list.map((row: Record<string, unknown>) => normalizeDataSourceFromApi(row)));
        if (list.length > 0 && !discoverDsId) {
          setDiscoverDsId(String(list[0].id));
        }
      }
    } catch (err) {
      console.error("获取数据源列表失败:", err);
    }
  }, [getTenantId, getAuthHeaders, discoverDsId]);

  const fetchMetrics = useCallback(async () => {
    setLoading(true);
    try {
      const tenantId = getTenantId();
      const params = new URLSearchParams();
      if (filterStatus !== "all") params.append("status", filterStatus);
      const response = await fetch(
        `/api/tenants/${tenantId}/metrics${params.size > 0 ? `?${params.toString()}` : ""}`,
        { headers: getAuthHeaders() }
      );
      if (response.ok) {
        const data = await response.json();
        setMetrics(data.metrics || []);
      }
    } catch (err) {
      console.error("获取指标列表失败:", err);
    } finally {
      setLoading(false);
    }
  }, [getTenantId, getAuthHeaders, filterStatus]);

  useEffect(() => {
    fetchDataSources();
  }, [fetchDataSources]);

  useEffect(() => {
    fetchMetrics();
  }, [fetchMetrics]);

  const handleDiscover = async () => {
    if (!discoverDsId) {
      setMessage({ type: "error", text: "请先选择一个数据源" });
      return;
    }
    setDiscovering(true);
    setMessage(null);
    setDiscoverResult(null);
    try {
      const tenantId = getTenantId();
      const response = await fetch(
        `/api/tenants/${tenantId}/metrics/auto-discover?dataSourceId=${discoverDsId}`,
        { method: "POST", headers: getAuthHeaders() }
      );
      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        setMessage({ type: "error", text: (err as { error?: string }).error || "发现指标失败" });
        return;
      }
      const result = await response.json();
      setDiscoverResult({ count: result.count || result.items?.length || 0 });
      setMessage({ type: "success", text: `成功发现 ${result.count || result.items?.length || 0} 个指标` });
      await fetchMetrics();
    } catch {
      setMessage({ type: "error", text: "发现指标失败，请稍后重试" });
    } finally {
      setDiscovering(false);
    }
  };

  const handleConfirm = async () => {
    if (selectedIds.size === 0) {
      setMessage({ type: "error", text: "请先选择要激活的指标" });
      return;
    }
    setConfirming(true);
    setMessage(null);
    try {
      const tenantId = getTenantId();
      const response = await fetch(`/api/tenants/${tenantId}/metrics/confirm`, {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify({ metricIds: Array.from(selectedIds) }),
      });
      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        setMessage({ type: "error", text: (err as { error?: string }).error || "激活指标失败" });
        return;
      }
      setMessage({ type: "success", text: `已激活 ${selectedIds.size} 个指标` });
      setSelectedIds(new Set());
      await fetchMetrics();
    } catch {
      setMessage({ type: "error", text: "激活指标失败，请稍后重试" });
    } finally {
      setConfirming(false);
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    const draftIds = metrics.filter((m) => m.status === "draft").map((m) => m.id);
    const allSelected = draftIds.every((id) => selectedIds.has(id));
    if (allSelected) {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        draftIds.forEach((id) => next.delete(id));
        return next;
      });
    } else {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        draftIds.forEach((id) => next.add(id));
        return next;
      });
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!window.confirm(`确定删除指标「${name}」？此操作不可撤销。`)) return;
    try {
      const tenantId = getTenantId();
      const response = await fetch(`/api/tenants/${tenantId}/metrics/${id}`, {
        method: "DELETE",
        headers: getAuthHeaders(),
      });
      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        setMessage({ type: "error", text: (err as { error?: string }).error || "删除失败" });
        return;
      }
      setMessage({ type: "success", text: `已删除「${name}」` });
      await fetchMetrics();
    } catch {
      setMessage({ type: "error", text: "删除失败，请稍后重试" });
    }
  };

  const draftMetrics = metrics.filter((m) => m.status === "draft");
  const activeMetrics = metrics.filter((m) => m.status === "active");
  const inactiveMetrics = metrics.filter((m) => m.status === "inactive");

  return (
    <div className="space-y-6">
      {/* 标题区 */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-medium text-zinc-100">指标管理</h2>
          <p className="mt-1 text-sm text-zinc-500">
            发现并管理你的业务指标，确认后的指标将进入观测中心监控。
          </p>
        </div>
      </div>

      {/* 统计概览 */}
      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-5">
          <div className="text-3xl font-semibold text-zinc-100">{metrics.length}</div>
          <div className="mt-1 text-sm text-zinc-500">全部指标</div>
        </div>
        <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-5">
          <div className="text-3xl font-semibold text-emerald-400">{activeMetrics.length}</div>
          <div className="mt-1 text-sm text-emerald-200/70">已激活</div>
        </div>
        <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-5">
          <div className="text-3xl font-semibold text-amber-400">{draftMetrics.length}</div>
          <div className="mt-1 text-sm text-amber-200/70">待确认</div>
        </div>
      </div>

      {/* 自动发现区域 */}
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
          <div className="flex-1">
            <label className="mb-2 block text-sm font-medium text-zinc-300">
              选择数据源
            </label>
            <select
              value={discoverDsId}
              onChange={(e) => setDiscoverDsId(e.target.value)}
              className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-sm text-zinc-100 outline-none transition focus:border-cyan-500"
            >
              <option value="">-- 请选择数据源 --</option>
              {dataSources.map((ds) => (
                <option key={ds.id} value={ds.id}>
                  {ds.name} ({ds.type})
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={handleDiscover}
              disabled={discovering || !discoverDsId}
              className="rounded-xl border border-zinc-600/50 bg-zinc-800/50 px-5 py-3 text-sm font-medium text-zinc-300 transition hover:border-zinc-500 hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {discovering ? (
                <span className="flex items-center gap-2">
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-zinc-500 border-t-transparent" />
                  发现中…
                </span>
              ) : (
                "快速发现"
              )}
            </button>
            <button
              type="button"
              onClick={() => setShowSmartModal(true)}
              disabled={!discoverDsId}
              className="rounded-xl border border-cyan-500/40 bg-gradient-to-r from-cyan-500/10 to-violet-500/10 px-5 py-3 text-sm font-medium text-cyan-200 transition hover:border-cyan-400 hover:from-cyan-500/20 hover:to-violet-500/20 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <span className="flex items-center gap-2">
                <span>🧠</span>
                AI 智能发现
              </span>
            </button>
          </div>
        </div>
        {discoverResult && (
          <div className="mt-3 rounded-xl border border-emerald-500/20 bg-emerald-500/5 px-4 py-3 text-sm text-emerald-200">
            本次发现 {discoverResult.count} 个新指标，请在下方的列表中确认。
          </div>
        )}
      </div>

      {/* 消息提示 */}
      {message ? (
        <p
          className={`rounded-xl border px-4 py-3 text-sm ${
            message.type === "success"
              ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-200"
              : "border-rose-500/30 bg-rose-500/10 text-rose-200"
          }`}
        >
          {message.text}
        </p>
      ) : null}

      {/* 操作栏 */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          {(["all", "active", "draft", "inactive"] as FilterStatus[]).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setFilterStatus(s)}
              className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition ${
                filterStatus === s
                  ? "border-cyan-500/40 bg-cyan-500/15 text-cyan-300"
                  : "border-zinc-700 bg-zinc-900/50 text-zinc-400 hover:border-zinc-600 hover:text-zinc-200"
              }`}
            >
              {s === "all" ? `全部 (${metrics.length})` : `${STATUS_CONFIG[s as MetricStatus].label} (${
                s === "active" ? activeMetrics.length :
                s === "draft" ? draftMetrics.length :
                inactiveMetrics.length
              })`}
            </button>
          ))}
        </div>
        {draftMetrics.length > 0 && (
          <button
            type="button"
            onClick={handleConfirm}
            disabled={confirming || selectedIds.size === 0}
            className="shrink-0 rounded-xl bg-emerald-500 px-5 py-2.5 text-sm font-medium text-slate-950 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {confirming ? "激活中…" : `激活选中指标 (${selectedIds.size})`}
          </button>
        )}
      </div>

      {/* 指标列表 */}
      <div className="overflow-x-auto rounded-2xl border border-zinc-800 bg-zinc-900/40">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-zinc-700 border-t-cyan-500" />
          </div>
        ) : metrics.length === 0 ? (
          <div className="p-10 text-center text-sm text-zinc-400">
            {filterStatus === "all"
              ? "暂无指标，请先连接数据源并点击「AI 发现指标」"
              : `没有「${STATUS_CONFIG[filterStatus as MetricStatus].label}」状态的指标`}
          </div>
        ) : (
          <table className="w-full min-w-[800px] text-left text-sm">
            <thead className="border-b border-zinc-800 bg-zinc-950/80 text-xs uppercase tracking-wide text-zinc-500">
              <tr>
                <th className="px-4 py-3 w-10">
                  {draftMetrics.length > 0 && (
                    <input
                      type="checkbox"
                      checked={draftMetrics.length > 0 && draftMetrics.every((m) => selectedIds.has(m.id))}
                      onChange={toggleSelectAll}
                      className="h-4 w-4 rounded border-zinc-600 bg-zinc-900 accent-cyan-500"
                    />
                  )}
                </th>
                <th className="px-4 py-3 font-medium">指标名称</th>
                <th className="px-4 py-3 font-medium">显示名</th>
                <th className="px-4 py-3 font-medium">类型</th>
                <th className="px-4 py-3 font-medium">聚合方式</th>
                <th className="px-4 py-3 font-medium">状态</th>
                <th className="px-4 py-3 font-medium">置信度</th>
                <th className="px-4 py-3 text-right font-medium">操作</th>
              </tr>
            </thead>
            <tbody>
              {metrics.map((metric) => {
                const statusCfg = STATUS_CONFIG[metric.status] || STATUS_CONFIG.inactive;
                return (
                  <tr
                    key={metric.id}
                    className={`border-b border-zinc-800/80 last:border-0 hover:bg-zinc-950/40 ${
                      metric.status === "draft" ? "" : ""
                    }`}
                  >
                    <td className="px-4 py-3">
                      {metric.status === "draft" && (
                        <input
                          type="checkbox"
                          checked={selectedIds.has(metric.id)}
                          onChange={() => toggleSelect(metric.id)}
                          className="h-4 w-4 rounded border-zinc-600 bg-zinc-900 accent-cyan-500"
                        />
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-zinc-100">{metric.name}</div>
                      {metric.isAutoDetected && (
                        <div className="mt-0.5 text-xs text-cyan-400/70">AI 发现</div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-zinc-300">{metric.displayName || "—"}</td>
                    <td className="px-4 py-3">
                      <span className="text-xs text-zinc-400">
                        {DATA_TYPE_LABELS[metric.dataType] || metric.dataType}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="rounded border border-zinc-700 bg-zinc-900/60 px-2 py-0.5 text-xs text-zinc-400">
                        {AGGREGATION_LABELS[metric.aggregation] || metric.aggregation}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex rounded-full border px-2 py-0.5 text-xs ${statusCfg.className}`}>
                        {statusCfg.label}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {metric.isAutoDetected ? (
                        <div className="flex items-center gap-2">
                          <div className="h-1.5 w-16 overflow-hidden rounded-full bg-zinc-700">
                            <div
                              className="h-full rounded-full bg-cyan-500/70"
                              style={{ width: `${Math.round(metric.confidenceScore * 100)}%` }}
                            />
                          </div>
                          <span className="text-xs text-zinc-500">{Math.round(metric.confidenceScore * 100)}%</span>
                        </div>
                      ) : (
                        <span className="text-xs text-zinc-600">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {metric.status === "draft" && (
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedIds((prev) => new Set(prev).add(metric.id));
                            handleConfirm();
                          }}
                          className="mr-2 rounded-lg border border-emerald-500/35 bg-emerald-500/10 px-3 py-1.5 text-xs font-medium text-emerald-200 transition hover:bg-emerald-500/20"
                        >
                          激活
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => handleDelete(metric.id, metric.name)}
                        className="rounded-lg border border-rose-500/35 bg-rose-500/10 px-3 py-1.5 text-xs font-medium text-rose-200 transition hover:bg-rose-500/20"
                      >
                        删除
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* 底部说明 */}
      {metrics.length > 0 && (
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/20 p-4 text-xs text-zinc-500">
          <strong className="text-zinc-400">说明：</strong>
          AI 自动发现的指标默认为「草稿」状态，请选择后点击「激活」确认。已激活的指标将出现在观测中心的核心指标看板中。
          指标是观测中心监控业务健康的基础，请确保至少激活 1 个指标。
        </div>
      )}

      {/* AI 智能发现弹窗 */}
      <MetricDiscoveryModal
        open={showSmartModal}
        onClose={() => setShowSmartModal(false)}
        dataSources={dataSources}
        onDiscoverComplete={() => {
          fetchMetrics();
          setDiscoverResult({ count: 0 });
        }}
      />
    </div>
  );
}
