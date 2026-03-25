"use client";

import { useState, useEffect, useCallback } from "react";
import AppHeader from "@/components/AppHeader";
import { getAccessToken } from "@/lib/auth/api";

interface MetricSummaryData {
  name: string;
  displayName?: string;
  metricId?: string;
  currentValue: number;
  prevValue?: number;
  change: number;
  direction: string;
  unit?: string;
}

interface AnomalySummaryData {
  metricId: string;
  metricName?: string;
  severity: string;
  change: number;
}

interface PredictionData {
  metricId: string;
  metricName: string;
  currentValue: number;
  predictedNext: number;
  trend: string;
  confidence: number;
  historyValues: number[];
  description: string;
}

// 需要关注的异常项（含 AI 分析和建议）
interface ConcernItem {
  metricId: string;
  metricName?: string;
  severity: string;
  currentValue: number;
  baselineValue?: number;
  change: number;
  analysis?: string;
  suggestions?: string[];
  drillDown?: string;
}

// 正面趋势
interface PositiveItem {
  metricId: string;
  metricName?: string;
  currentValue: number;
  change: number;
  reason?: string;
}

// 每周目标达成
interface WeeklyTarget {
  metricId: string;
  metricName: string;
  currentValue: number;
  targetValue: number;
  achievementRate: number;
  trend: string; // on_track / at_risk / ahead / behind
  daysLeft: number;
  description: string;
}

interface SummaryContent {
  healthScore: number;
  metrics: MetricSummaryData[];
  anomalies: AnomalySummaryData[];
  trends: string[];
  predictions?: PredictionData[];
  topChanges?: MetricSummaryData[];
  concerns?: ConcernItem[];     // 需要关注（含 AI 分析）
  positives?: PositiveItem[];   // 正面趋势
  weeklyTargets?: WeeklyTarget[]; // 每周目标达成
}

interface DailySummaryData {
  id: string;
  tenantId: string;
  summaryDate: string;
  healthScore: number;
  content: string;
  sentAt?: string;
  createdAt: string;
}

export default function InsightsPage() {
  const [summary, setSummary] = useState<DailySummaryData | null>(null);
  const [parsedContent, setParsedContent] = useState<SummaryContent | null>(null);
  const [historySummaries, setHistorySummaries] = useState<DailySummaryData[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  const tenantId = typeof window !== "undefined" ? localStorage.getItem("tenantId") || "demo" : "demo";

  const authFetch = useCallback(async (url: string, options?: RequestInit) => {
    const token = getAccessToken();
    const headers: Record<string, string> = {};
    if (token) headers["Authorization"] = `Bearer ${token}`;
    if (options?.method === "POST") headers["Content-Type"] = "application/json";
    return fetch(url, { ...options, headers: { ...headers, ...options?.headers } });
  }, []);

  const fetchLatest = useCallback(async () => {
    try {
      const res = await authFetch(`/api/tenants/${tenantId}/daily-summary/latest`);
      if (res.ok) {
        const data = await res.json();
        if (data.success && data.summary) {
          setSummary(data.summary);
          try {
            setParsedContent(JSON.parse(data.summary.content));
          } catch {
            setParsedContent(null);
          }
        }
      }
    } catch {
      // ignore
    }
  }, [tenantId, authFetch]);

  const fetchHistory = useCallback(async () => {
    try {
      const res = await authFetch(`/api/tenants/${tenantId}/daily-summary`);
      if (res.ok) {
        const data = await res.json();
        if (data.success && data.summaries) {
          setHistorySummaries(data.summaries);
        }
      }
    } catch {
      // ignore
    }
  }, [tenantId, authFetch]);

  useEffect(() => {
    setLoading(true);
    Promise.all([fetchLatest(), fetchHistory()]).finally(() => setLoading(false));
  }, [fetchLatest, fetchHistory]);

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const res = await authFetch(`/api/tenants/${tenantId}/daily-summary/generate`, {
        method: "POST",
      });
      if (res.ok) {
        const data = await res.json();
        if (data.success && data.summary) {
          setSummary(data.summary);
          try {
            setParsedContent(JSON.parse(data.summary.content));
          } catch {
            setParsedContent(null);
          }
          // Refresh history
          fetchHistory();
        }
      }
    } catch {
      // ignore
    } finally {
      setGenerating(false);
    }
  };

  const getHealthColor = (score: number) => {
    if (score >= 80) return "text-emerald-400";
    if (score >= 60) return "text-yellow-400";
    if (score >= 40) return "text-orange-400";
    return "text-red-400";
  };

  const getHealthBg = (score: number) => {
    if (score >= 80) return "from-emerald-500/20 to-emerald-500/5";
    if (score >= 60) return "from-yellow-500/20 to-yellow-500/5";
    if (score >= 40) return "from-orange-500/20 to-orange-500/5";
    return "from-red-500/20 to-red-500/5";
  };

  const getDirectionArrow = (dir: string) => {
    if (dir === "up") return { icon: "+", color: "text-emerald-400" };
    if (dir === "down") return { icon: "-", color: "text-red-400" };
    return { icon: "~", color: "text-zinc-400" };
  };

  const getTrendIcon = (trend: string) => {
    if (trend === "rising") return { text: "UP", color: "text-emerald-400" };
    if (trend === "falling") return { text: "DOWN", color: "text-red-400" };
    return { text: "FLAT", color: "text-zinc-400" };
  };

  const getSeverityBadge = (severity: string) => {
    if (severity === "critical") return "bg-red-500/20 text-red-400 border-red-500/30";
    if (severity === "warning") return "bg-yellow-500/20 text-yellow-400 border-yellow-500/30";
    return "bg-blue-500/20 text-blue-400 border-blue-500/30";
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      <AppHeader title="BizLens" subtitle="Business Insights" />

      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold">Business Insights</h1>
            <p className="text-zinc-400 mt-1">
              {summary ? `${summary.summaryDate}` : "Core metrics overview, anomaly alerts & trend predictions"}
            </p>
          </div>
          <button
            onClick={handleGenerate}
            disabled={generating}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
          >
            {generating ? "Generating..." : "Generate Summary"}
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : !parsedContent ? (
          <div className="text-center py-20">
            <div className="text-6xl mb-4 opacity-50">[i]</div>
            <h3 className="text-lg font-medium mb-2">No Summary Available</h3>
            <p className="text-zinc-400 mb-6">
              Click &quot;Generate Summary&quot; to create today&apos;s business insights report
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Health Score Card */}
            <div className={`relative rounded-xl border border-zinc-800 bg-gradient-to-br ${getHealthBg(parsedContent.healthScore)} p-6`}>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-zinc-400 text-sm mb-1">Business Health Score</p>
                  <div className="flex items-end gap-2">
                    <span className={`text-5xl font-bold ${getHealthColor(parsedContent.healthScore)}`}>
                      {parsedContent.healthScore}
                    </span>
                    <span className="text-zinc-400 text-lg mb-1">/ 100</span>
                  </div>
                  {/* 健康评分状态标签 */}
                  <div className="mt-2">
                    {parsedContent.healthScore >= 80 ? (
                      <span className="inline-flex items-center gap-1 text-xs text-emerald-400">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />业务运行良好
                      </span>
                    ) : parsedContent.healthScore >= 60 ? (
                      <span className="inline-flex items-center gap-1 text-xs text-yellow-400">
                        <span className="w-1.5 h-1.5 rounded-full bg-yellow-400" />存在轻微异常
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-xs text-red-400">
                        <span className="w-1.5 h-1.5 rounded-full bg-red-400" />需要关注
                      </span>
                    )}
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-zinc-400 text-sm">{summary?.summaryDate}</p>
                  <p className="text-zinc-500 text-xs mt-1">
                    {parsedContent.metrics.length} metrics monitored
                  </p>
                  {parsedContent.concerns && parsedContent.concerns.length > 0 && (
                    <p className="text-red-400 text-xs mt-1">
                      {parsedContent.concerns.length} concerns
                    </p>
                  )}
                </div>
              </div>

              {/* Trend tags */}
              {parsedContent.trends.length > 0 && (
                <div className="mt-4 flex flex-wrap gap-2">
                  {parsedContent.trends.map((t, i) => (
                    <span key={i} className="px-3 py-1 bg-zinc-800/80 rounded-full text-xs text-zinc-300">
                      {t}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Core Metrics Grid */}
            {parsedContent.metrics.length > 0 && (
              <div>
                <h2 className="text-lg font-semibold mb-4">
                  Core Metrics
                  <span className="text-zinc-500 text-sm font-normal ml-2">今日 vs 昨日</span>
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {parsedContent.metrics.map((m, i) => {
                    const arrow = getDirectionArrow(m.direction);
                    return (
                      <div key={i} className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4 hover:border-zinc-700 transition-colors">
                        <div className="flex items-center justify-between mb-1">
                          <p className="text-zinc-400 text-sm truncate">{m.displayName || m.name}</p>
                          <span className={`text-xs font-medium px-1.5 py-0.5 rounded ${arrow.color} bg-zinc-800`}>
                            {arrow.icon}{Math.abs(m.change).toFixed(1)}%
                          </span>
                        </div>
                        <div className="flex items-end gap-2 mt-1">
                          <span className="text-2xl font-bold">
                            {m.currentValue.toLocaleString()}
                          </span>
                          {m.unit && (
                            <span className="text-zinc-500 text-sm mb-0.5">{m.unit}</span>
                          )}
                        </div>
                        {m.prevValue !== undefined && m.prevValue > 0 && (
                          <div className="mt-2 flex items-center gap-2">
                            <div className="flex-1 h-1 bg-zinc-800 rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full ${arrow.color === "text-emerald-400" ? "bg-emerald-500" : arrow.color === "text-red-400" ? "bg-red-500" : "bg-zinc-600"}`}
                                style={{ width: `${Math.min(Math.abs(m.change), 100)}%` }}
                              />
                            </div>
                            <span className="text-xs text-zinc-500">
                              昨日 {m.prevValue.toLocaleString()}
                            </span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Top Changes */}
            {parsedContent.topChanges && parsedContent.topChanges.length > 0 && (
              <div>
                <h2 className="text-lg font-semibold mb-4">Top Changes</h2>
                <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-zinc-800 text-zinc-400">
                        <th className="text-left px-4 py-3">Metric</th>
                        <th className="text-right px-4 py-3">Current</th>
                        <th className="text-right px-4 py-3">Change</th>
                        <th className="text-right px-4 py-3">Direction</th>
                      </tr>
                    </thead>
                    <tbody>
                      {parsedContent.topChanges.map((m, i) => {
                        const arrow = getDirectionArrow(m.direction);
                        return (
                          <tr key={i} className="border-b border-zinc-800/50 hover:bg-zinc-800/30">
                            <td className="px-4 py-3">{m.displayName || m.name}</td>
                            <td className="px-4 py-3 text-right font-mono">
                              {m.currentValue.toLocaleString()}
                            </td>
                            <td className={`px-4 py-3 text-right font-mono ${arrow.color}`}>
                              {arrow.icon}{Math.abs(m.change).toFixed(1)}%
                            </td>
                            <td className="px-4 py-3 text-right">
                              <span className={`px-2 py-0.5 rounded text-xs ${arrow.color} bg-zinc-800`}>
                                {m.direction.toUpperCase()}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Anomalies */}
            {parsedContent.anomalies.length > 0 && (
              <div>
                <h2 className="text-lg font-semibold mb-4">
                  Anomaly Alerts
                  <span className="ml-2 px-2 py-0.5 bg-red-500/20 text-red-400 text-xs rounded-full">
                    {parsedContent.anomalies.length}
                  </span>
                </h2>
                <div className="space-y-3">
                  {parsedContent.anomalies.map((a, i) => (
                    <div
                      key={i}
                      className="flex items-center justify-between rounded-xl border border-zinc-800 bg-zinc-900/50 p-4"
                    >
                      <div className="flex items-center gap-3">
                        <span className={`px-2 py-1 rounded border text-xs font-medium ${getSeverityBadge(a.severity)}`}>
                          {a.severity.toUpperCase()}
                        </span>
                        <span>{a.metricName || a.metricId}</span>
                      </div>
                      <span className={`text-sm font-mono ${a.change > 0 ? "text-emerald-400" : "text-red-400"}`}>
                        {a.change > 0 ? "+" : ""}{a.change.toFixed(1)}%
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Trend Predictions */}
            {parsedContent.predictions && parsedContent.predictions.length > 0 && (
              <div>
                <h2 className="text-lg font-semibold mb-4">Trend Predictions</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {parsedContent.predictions.map((p, i) => {
                    const trendInfo = getTrendIcon(p.trend);
                    return (
                      <div key={i} className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-medium">{p.metricName}</span>
                          <span className={`text-xs font-bold ${trendInfo.color}`}>
                            [{trendInfo.text}]
                          </span>
                        </div>
                        <div className="flex items-end gap-4 mb-3">
                          <div>
                            <p className="text-xs text-zinc-500">Current</p>
                            <p className="text-lg font-bold">{p.currentValue.toLocaleString()}</p>
                          </div>
                          <div className="text-zinc-500">--&gt;</div>
                          <div>
                            <p className="text-xs text-zinc-500">Predicted</p>
                            <p className="text-lg font-bold text-indigo-400">
                              {p.predictedNext.toLocaleString()}
                            </p>
                          </div>
                        </div>

                        {/* Mini sparkline (ASCII style) */}
                        {p.historyValues && p.historyValues.length > 0 && (
                          <div className="h-8 flex items-end gap-px">
                            {p.historyValues.map((v, j) => {
                              const max = Math.max(...p.historyValues);
                              const min = Math.min(...p.historyValues);
                              const range = max - min || 1;
                              const height = ((v - min) / range) * 100;
                              return (
                                <div
                                  key={j}
                                  className="flex-1 bg-indigo-500/40 rounded-t"
                                  style={{ height: `${Math.max(height, 5)}%` }}
                                />
                              );
                            })}
                          </div>
                        )}

                        <p className="text-xs text-zinc-500 mt-2">{p.description}</p>
                        <p className="text-xs text-zinc-600 mt-1">
                          Confidence: {(p.confidence * 100).toFixed(0)}%
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* 每周目标达成 */}
            {parsedContent.weeklyTargets && parsedContent.weeklyTargets.length > 0 && (
              <div>
                <h2 className="text-lg font-semibold mb-4">Weekly Targets</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {parsedContent.weeklyTargets.map((t, i) => {
                    const trendColors: Record<string, string> = {
                      ahead: "text-emerald-400",
                      on_track: "text-blue-400",
                      at_risk: "text-orange-400",
                      behind: "text-red-400",
                    };
                    const trendLabels: Record<string, string> = {
                      ahead: "领先",
                      on_track: "正常",
                      at_risk: "有风险",
                      behind: "落后",
                    };
                    const barColor: Record<string, string> = {
                      ahead: "bg-emerald-500",
                      on_track: "bg-blue-500",
                      at_risk: "bg-orange-500",
                      behind: "bg-red-500",
                    };
                    return (
                      <div key={i} className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-medium text-sm truncate">{t.metricName}</span>
                          <span className={`text-xs font-medium ${trendColors[t.trend] || "text-zinc-400"}`}>
                            {trendLabels[t.trend] || t.trend}
                          </span>
                        </div>
                        <div className="mb-2">
                          <div className="flex items-baseline justify-between text-xs text-zinc-500 mb-1">
                            <span>{t.currentValue.toLocaleString()}</span>
                            <span>/ {t.targetValue.toLocaleString()}</span>
                          </div>
                          <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all ${barColor[t.trend] || "bg-blue-500"}`}
                              style={{ width: `${Math.min(t.achievementRate, 120)}%` }}
                            />
                          </div>
                        </div>
                        <p className="text-xs text-zinc-500">
                          {t.achievementRate > 0 ? `${t.achievementRate.toFixed(0)}%` : "--"}
                          {t.daysLeft > 0 ? ` · ${t.daysLeft}d left` : ""}
                        </p>
                        {t.description && (
                          <p className="text-xs text-zinc-600 mt-1 line-clamp-2">{t.description}</p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* 需要关注（含 AI 分析和建议） */}
            {parsedContent.concerns && parsedContent.concerns.length > 0 && (
              <div>
                <h2 className="text-lg font-semibold mb-4">
                  需要关注
                  <span className="ml-2 px-2 py-0.5 bg-red-500/20 text-red-400 text-xs rounded-full">
                    {parsedContent.concerns.length}
                  </span>
                </h2>
                <div className="space-y-3">
                  {parsedContent.concerns.map((c, i) => {
                    const severityColors: Record<string, string> = {
                      critical: "bg-red-500/20 text-red-400 border-red-500/30",
                      warning: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
                      info: "bg-blue-500/20 text-blue-400 border-blue-500/30",
                    };
                    return (
                      <div key={i} className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-start gap-3 flex-1">
                            <span className={`px-2 py-0.5 rounded border text-xs font-medium mt-0.5 shrink-0 ${severityColors[c.severity] || "bg-zinc-700 text-zinc-300"}`}>
                              {c.severity.toUpperCase()}
                            </span>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-medium">{c.metricName || c.metricId}</span>
                                <span className="text-sm text-zinc-400">
                                  当前 {c.currentValue.toLocaleString()}
                                  {c.baselineValue ? ` / 基线 ${c.baselineValue.toLocaleString()}` : ""}
                                </span>
                                <span className={`text-sm font-mono ${c.change > 0 ? "text-emerald-400" : "text-red-400"}`}>
                                  {c.change > 0 ? "+" : ""}{c.change.toFixed(1)}%
                                </span>
                              </div>
                              {c.analysis && (
                                <p className="text-xs text-zinc-400 mt-1.5 leading-relaxed">
                                  <span className="text-indigo-400 mr-1">AI:</span>{c.analysis}
                                </p>
                              )}
                              {c.drillDown && (
                                <p className="text-xs text-zinc-500 mt-1">
                                  <span className="text-amber-400 mr-1">下钻:</span>{c.drillDown}
                                </p>
                              )}
                              {c.suggestions && c.suggestions.length > 0 && (
                                <div className="mt-2 flex flex-wrap gap-1.5">
                                  {c.suggestions.slice(0, 2).map((sug, j) => (
                                    <span key={j} className="inline-flex items-center gap-1 px-2 py-0.5 bg-zinc-800 rounded text-xs text-zinc-300">
                                      <span className="text-emerald-400">-&gt;</span>{sug}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* 正面趋势 */}
            {parsedContent.positives && parsedContent.positives.length > 0 && (
              <div>
                <h2 className="text-lg font-semibold mb-4">
                  正面趋势
                  <span className="ml-2 px-2 py-0.5 bg-emerald-500/20 text-emerald-400 text-xs rounded-full">
                    {parsedContent.positives.length}
                  </span>
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {parsedContent.positives.map((p, i) => (
                    <div key={i} className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-2 h-2 rounded-full bg-emerald-400" />
                        <span className="font-medium text-sm">{p.metricName || p.metricId}</span>
                      </div>
                      <div className="flex items-end gap-3">
                        <span className="text-2xl font-bold text-emerald-400">
                          {p.currentValue.toLocaleString()}
                        </span>
                        <span className="text-sm font-medium text-emerald-400 mb-0.5">
                          +{p.change.toFixed(1)}%
                        </span>
                      </div>
                      {p.reason && (
                        <p className="text-xs text-zinc-400 mt-2">{p.reason}</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* History */}
            {historySummaries.length > 1 && (
              <div>
                <h2 className="text-lg font-semibold mb-4">History</h2>
                <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-zinc-800 text-zinc-400">
                        <th className="text-left px-4 py-3">Date</th>
                        <th className="text-right px-4 py-3">Health Score</th>
                        <th className="text-right px-4 py-3">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {historySummaries.slice(0, 10).map((s, i) => (
                        <tr key={i} className="border-b border-zinc-800/50 hover:bg-zinc-800/30">
                          <td className="px-4 py-3">{s.summaryDate}</td>
                          <td className={`px-4 py-3 text-right font-bold ${getHealthColor(s.healthScore)}`}>
                            {s.healthScore}
                          </td>
                          <td className="px-4 py-3 text-right">
                            {s.sentAt ? (
                              <span className="text-xs text-emerald-400">Sent</span>
                            ) : (
                              <span className="text-xs text-zinc-500">Generated</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
