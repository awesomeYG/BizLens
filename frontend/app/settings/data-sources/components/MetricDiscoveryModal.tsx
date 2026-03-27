"use client";

import { useState, useEffect, useCallback } from "react";
import type { DataSourceConfig } from "@/lib/types";
import { getAccessToken } from "@/lib/auth/api";
import { getCurrentUser } from "@/lib/user-store";

/** AI 智能推荐的关键指标 */
export interface KeyMetricRecommendation {
  table: string;
  field: string;
  displayName: string;
  metricName: string;
  dataType: string;
  aggregation: string;
  formula?: string;
  confidence: number;
  reason: string;
  isComposite: boolean;
  dependencies?: string[];
  category: string;
}

/** 发现上下文状态 */
export interface DiscoverContext {
  schemaAnalyzed: boolean;
  analysisModel?: string;
  analyzedAt?: string;
  tableCount: number;
  availableTables: string[];
  sampleReady: boolean;
}

/** 智能推荐响应 */
export interface SmartRecommendResponse {
  recommendations: KeyMetricRecommendation[];
  totalCount: number;
  analysisModel: string;
  discoveredAt: string;
  byCategory?: Record<string, KeyMetricRecommendation[]>;
}

const AGGREGATION_LABELS: Record<string, string> = {
  SUM: "求和",
  COUNT: "计数",
  AVG: "平均值",
  MAX: "最大值",
  MIN: "最小值",
  "COUNT(DISTINCT)": "去重计数",
  COMPOSITE: "复合指标",
};

const DATA_TYPE_LABELS: Record<string, string> = {
  number: "数字",
  currency: "金额",
  percentage: "百分比",
  ratio: "比率",
};

const CATEGORY_ICONS: Record<string, string> = {
  用户: "👥",
  交易: "🛒",
  收入: "💰",
  库存: "📦",
  流量: "📊",
  其他: "📈",
};

const CATEGORY_COLORS: Record<string, { border: string; bg: string; badge: string }> = {
  用户: { border: "border-cyan-500/30", bg: "bg-cyan-500/5", badge: "text-cyan-300 bg-cyan-500/15 border border-cyan-500/30" },
  交易: { border: "border-violet-500/30", bg: "bg-violet-500/5", badge: "text-violet-300 bg-violet-500/15 border border-violet-500/30" },
  收入: { border: "border-amber-500/30", bg: "bg-amber-500/5", badge: "text-amber-300 bg-amber-500/15 border border-amber-500/30" },
  库存: { border: "border-emerald-500/30", bg: "bg-emerald-500/5", badge: "text-emerald-300 bg-emerald-500/15 border border-emerald-500/30" },
  流量: { border: "border-sky-500/30", bg: "bg-sky-500/5", badge: "text-sky-300 bg-sky-500/15 border border-sky-500/30" },
  其他: { border: "border-zinc-500/30", bg: "bg-zinc-500/5", badge: "text-zinc-300 bg-zinc-500/15 border border-zinc-500/30" },
};

interface MetricDiscoveryModalProps {
  open: boolean;
  onClose: () => void;
  dataSources: DataSourceConfig[];
  onDiscoverComplete: () => void;
}

type Step = "select" | "analyzing" | "preview" | "saving";

export default function MetricDiscoveryModal({
  open,
  onClose,
  dataSources,
  onDiscoverComplete,
}: MetricDiscoveryModalProps) {
  const [step, setStep] = useState<Step>("select");
  const [selectedDsId, setSelectedDsId] = useState<string>("");
  const [discoverContext, setDiscoverContext] = useState<DiscoverContext | null>(null);
  const [recommendations, setRecommendations] = useState<KeyMetricRecommendation[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [analysisModel, setAnalysisModel] = useState<string>("");

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

  // 检查发现上下文
  const checkDiscoverContext = useCallback(async () => {
    if (!selectedDsId) return;
    setLoading(true);
    setError(null);
    try {
      const tenantId = getTenantId();
      const resp = await fetch(
        `/api/tenants/${tenantId}/metrics/discover-context?dataSourceId=${selectedDsId}`,
        { headers: getAuthHeaders() }
      );
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({ error: "检查失败" }));
        throw new Error((err as { error: string }).error);
      }
      const ctx = await resp.json();
      setDiscoverContext(ctx);

      // 如果 schema 已分析，直接开始智能推荐
      if (ctx.schemaAnalyzed) {
        setStep("select"); // 用户确认后就开始分析
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [selectedDsId, getTenantId, getAuthHeaders]);

  useEffect(() => {
    if (selectedDsId) {
      checkDiscoverContext();
    }
  }, [selectedDsId, checkDiscoverContext]);

  // 开始智能推荐
  const handleStartDiscovery = async () => {
    if (!selectedDsId) return;
    setStep("analyzing");
    setError(null);
    setRecommendations([]);
    setSelectedIds(new Set());

    try {
      const tenantId = getTenantId();
      const resp = await fetch(
        `/api/tenants/${tenantId}/metrics/smart-recommend?dataSourceId=${selectedDsId}`,
        { method: "POST", headers: getAuthHeaders() }
      );

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({ error: "推荐失败" }));
        throw new Error((err as { error: string }).error);
      }

      const data: SmartRecommendResponse = await resp.json();
      setRecommendations(data.recommendations || []);
      setAnalysisModel(data.analysisModel || "");

      // 默认全选
      setSelectedIds(new Set((data.recommendations || []).map((_, i) => `rec_${i}`)));

      setStep("preview");
    } catch (e) {
      setError((e as Error).message);
      setStep("select");
    }
  };

  // 保存选中的推荐
  const handleSave = async () => {
    if (selectedIds.size === 0) return;
    setStep("saving");
    setError(null);

    const selectedRecs = Array.from(selectedIds).map((id) => {
      const idx = parseInt(id.replace("rec_", ""));
      return recommendations[idx];
    });

    try {
      const tenantId = getTenantId();
      const resp = await fetch(`/api/tenants/${tenantId}/metrics/save-recommendations`, {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify({
          dataSourceId: selectedDsId,
          recommendations: selectedRecs,
        }),
      });

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({ error: "保存失败" }));
        throw new Error((err as { error: string }).error);
      }

      onDiscoverComplete();
      onClose();
    } catch (e) {
      setError((e as Error).message);
      setStep("preview");
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
    if (selectedIds.size === recommendations.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(recommendations.map((_, i) => `rec_${i}`)));
    }
  };

  // 按类别分组展示
  const categories = Array.from(
    new Set(recommendations.map((r) => r.category || "其他"))
  );

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* 遮罩 */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      {/* 弹窗 */}
      <div className="relative z-10 w-full max-w-3xl max-h-[85vh] overflow-hidden rounded-2xl border border-zinc-700/50 bg-zinc-900 shadow-2xl flex flex-col">
        {/* 头部 */}
        <div className="flex items-center justify-between border-b border-zinc-800 px-6 py-4 shrink-0">
          <div>
            <h2 className="text-lg font-semibold text-zinc-100">AI 智能发现关键指标</h2>
            <p className="mt-0.5 text-xs text-zinc-500">
              基于数据库 schema 和真实数据，AI 自动推断核心业务指标
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-zinc-700 bg-zinc-800/50 p-2 text-zinc-400 transition hover:border-zinc-600 hover:text-zinc-200"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* 内容区 */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* 步骤 1：选择数据源 */}
          {step === "select" && (
            <div className="space-y-5">
              {error && (
                <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
                  {error}
                </div>
              )}

              <div>
                <label className="mb-2 block text-sm font-medium text-zinc-300">
                  选择数据源
                </label>
                <select
                  value={selectedDsId}
                  onChange={(e) => setSelectedDsId(e.target.value)}
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

              {/* Schema 分析状态 */}
              {discoverContext && selectedDsId && (
                <div className="rounded-xl border border-zinc-800 bg-zinc-950/50 p-4">
                  <div className="mb-3 text-sm font-medium text-zinc-300">数据源分析状态</div>
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div className="flex items-center gap-2">
                      <div className={`h-2 w-2 rounded-full ${discoverContext.schemaAnalyzed ? "bg-emerald-400" : "bg-amber-400"}`} />
                      <span className="text-zinc-400">
                        Schema 分析：{discoverContext.schemaAnalyzed ? "已完成" : "未开始"}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-2 rounded-full bg-zinc-600" />
                      <span className="text-zinc-400">
                        发现表数：{discoverContext.tableCount}
                      </span>
                    </div>
                    {discoverContext.analysisModel && (
                      <div className="col-span-2 flex items-center gap-2">
                        <div className="h-2 w-2 rounded-full bg-sky-400" />
                        <span className="text-zinc-400">
                          AI 模型：{discoverContext.analysisModel}
                        </span>
                      </div>
                    )}
                    {discoverContext.analyzedAt && (
                      <div className="col-span-2 flex items-center gap-2">
                        <div className="h-2 w-2 rounded-full bg-zinc-600" />
                        <span className="text-zinc-500">
                          分析时间：{new Date(discoverContext.analyzedAt).toLocaleString("zh-CN")}
                        </span>
                      </div>
                    )}
                  </div>
                  {!discoverContext.schemaAnalyzed && (
                    <div className="mt-3 rounded-lg border border-amber-500/20 bg-amber-500/5 px-3 py-2 text-xs text-amber-200">
                      Schema 尚未分析。推荐完成后，后台会自动分析表结构，下次发现将更加准确。
                    </div>
                  )}
                </div>
              )}

              {/* 预览可用表 */}
              {discoverContext && discoverContext.availableTables.length > 0 && (
                <div>
                  <label className="mb-2 block text-sm font-medium text-zinc-300">
                    检测到的业务表
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {discoverContext.availableTables.map((table) => {
                      const isKey = /user|customer|member|order|payment|product/i.test(table);
                      return (
                        <span
                          key={table}
                          className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${
                            isKey
                              ? "border border-cyan-500/30 bg-cyan-500/10 text-cyan-300"
                              : "border border-zinc-700 bg-zinc-800/50 text-zinc-400"
                          }`}
                        >
                          {table}
                          {isKey && <span className="ml-1 text-cyan-400">✦</span>}
                        </span>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* 步骤 2：AI 分析中 */}
          {step === "analyzing" && (
            <div className="flex flex-col items-center justify-center py-16">
              <div className="relative mb-6">
                <div className="h-16 w-16 animate-spin rounded-full border-4 border-zinc-700 border-t-cyan-500" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-lg">🧠</span>
                </div>
              </div>
              <h3 className="mb-2 text-lg font-medium text-zinc-100">AI 正在分析数据...</h3>
              <p className="text-sm text-zinc-500">
                正在采样关键表的真实数据，推断业务指标
              </p>
              <div className="mt-4 flex items-center gap-2 text-xs text-zinc-500">
                <span>🔍</span>
                <span>分析表结构</span>
                <span className="mx-2 text-zinc-700">→</span>
                <span>采样真实数据</span>
                <span className="mx-2 text-zinc-700">→</span>
                <span>推断关键指标</span>
              </div>
            </div>
          )}

          {/* 步骤 3：预览推荐结果 */}
          {step === "preview" && (
            <div className="space-y-5">
              {/* 顶部统计 */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">✅</span>
                    <span className="text-sm text-zinc-300">
                      发现 <span className="font-semibold text-cyan-400">{recommendations.length}</span> 个关键指标
                    </span>
                  </div>
                  {analysisModel && (
                    <span className="rounded border border-zinc-700 bg-zinc-800/50 px-2 py-0.5 text-xs text-zinc-500">
                      {analysisModel}
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={toggleSelectAll}
                  className="text-xs text-cyan-400 hover:text-cyan-300"
                >
                  {selectedIds.size === recommendations.length ? "取消全选" : "全选"}
                </button>
              </div>

              {/* 推荐指标列表 */}
              {categories.map((cat) => {
                const catRecs = recommendations.filter((r) => r.category || "其他" === cat);
                const colors = CATEGORY_COLORS[cat] || CATEGORY_COLORS["其他"];
                const icon = CATEGORY_ICONS[cat] || CATEGORY_ICONS["其他"];

                return (
                  <div key={cat} className={`rounded-xl border ${colors.border} ${colors.bg} p-4`}>
                    <div className="mb-3 flex items-center gap-2">
                      <span className="text-sm">{icon}</span>
                      <span className={`rounded px-2 py-0.5 text-xs font-medium ${colors.badge}`}>{cat}</span>
                      <span className="text-xs text-zinc-500">({catRecs.length} 个指标)</span>
                    </div>
                    <div className="space-y-2">
                      {catRecs.map((rec, idx) => {
                        const globalIdx = recommendations.indexOf(rec);
                        const id = `rec_${globalIdx}`;
                        const isSelected = selectedIds.has(id);

                        return (
                          <div
                            key={id}
                            onClick={() => toggleSelect(id)}
                            className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition ${
                              isSelected
                                ? "border-cyan-500/40 bg-cyan-500/5"
                                : "border-zinc-800/60 bg-zinc-900/30 hover:border-zinc-700"
                            }`}
                          >
                            <div className={`mt-0.5 h-4 w-4 shrink-0 rounded border-2 transition ${
                              isSelected
                                ? "border-cyan-500 bg-cyan-500"
                                : "border-zinc-600 bg-transparent"
                            }`}>
                              {isSelected && (
                                <svg className="h-full w-full text-slate-950" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                </svg>
                              )}
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2">
                                <span className="font-medium text-zinc-100">{rec.displayName}</span>
                                <span className="rounded border border-zinc-700 bg-zinc-800/60 px-1.5 py-0.5 text-xs text-zinc-400">
                                  {AGGREGATION_LABELS[rec.aggregation] || rec.aggregation}
                                </span>
                                <span className="rounded border border-zinc-700 bg-zinc-800/60 px-1.5 py-0.5 text-xs text-zinc-500">
                                  {DATA_TYPE_LABELS[rec.dataType] || rec.dataType}
                                </span>
                                {rec.isComposite && (
                                  <span className="rounded border border-violet-500/30 bg-violet-500/10 px-1.5 py-0.5 text-xs text-violet-300">
                                    复合
                                  </span>
                                )}
                              </div>
                              <div className="mt-1 text-xs text-zinc-500">
                                <span className="font-mono text-zinc-600">{rec.formula || `${rec.table}.${rec.field}`}</span>
                              </div>
                              <div className="mt-1.5 flex items-start gap-2">
                                <div className="flex items-center gap-1">
                                  <div className="h-1 w-8 overflow-hidden rounded-full bg-zinc-700">
                                    <div
                                      className="h-full rounded-full bg-cyan-500/70"
                                      style={{ width: `${Math.round(rec.confidence * 100)}%` }}
                                    />
                                  </div>
                                  <span className="text-xs text-zinc-600">{Math.round(rec.confidence * 100)}%</span>
                                </div>
                                <p className="flex-1 text-xs leading-relaxed text-zinc-500">
                                  {rec.reason}
                                </p>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}

              {error && (
                <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
                  {error}
                </div>
              )}
            </div>
          )}

          {/* 步骤 4：保存中 */}
          {step === "saving" && (
            <div className="flex flex-col items-center justify-center py-16">
              <div className="mb-4 h-10 w-10 animate-spin rounded-full border-3 border-zinc-700 border-t-emerald-500" />
              <p className="text-sm text-zinc-300">正在保存指标...</p>
            </div>
          )}
        </div>

        {/* 底部操作 */}
        <div className="flex items-center justify-between border-t border-zinc-800 px-6 py-4 shrink-0">
          <div className="text-xs text-zinc-600">
            {step === "preview" && (
              <span>已选择 <strong className="text-cyan-400">{selectedIds.size}</strong> / {recommendations.length} 个指标</span>
            )}
          </div>
          <div className="flex items-center gap-3">
            {step === "select" && (
              <>
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-xl border border-zinc-700 bg-zinc-800 px-5 py-2.5 text-sm font-medium text-zinc-300 transition hover:border-zinc-600"
                >
                  取消
                </button>
                <button
                  type="button"
                  onClick={handleStartDiscovery}
                  disabled={!selectedDsId || loading}
                  className="rounded-xl bg-cyan-500 px-5 py-2.5 text-sm font-medium text-slate-950 transition hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {loading ? "检查中..." : "开始发现"}
                </button>
              </>
            )}
            {step === "preview" && (
              <>
                <button
                  type="button"
                  onClick={() => setStep("select")}
                  className="rounded-xl border border-zinc-700 bg-zinc-800 px-5 py-2.5 text-sm font-medium text-zinc-300 transition hover:border-zinc-600"
                >
                  重新选择
                </button>
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={selectedIds.size === 0}
                  className="rounded-xl bg-emerald-500 px-5 py-2.5 text-sm font-medium text-slate-950 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  保存选中指标 ({selectedIds.size})
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
