"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import HealthScoreCard from "./HealthScoreCard";
import MetricKpiCard from "./MetricKpiCard";
import AnomalyFeed from "./AnomalyFeed";
import InsightCarousel from "./InsightCarousel";
import DailySummarySection from "./DailySummarySection";
import OnboardingGuide from "./OnboardingGuide";
import {
  getHealthScore,
  getCoreMetrics,
  listAnomalies,
  listInsights,
  listSummaries,
  generateSummary,
  acknowledgeAnomaly,
  resolveAnomaly,
  markFalsePositive,
  type HealthScoreResponse,
  type CoreMetric,
  type AnomalyEventDTO,
  type InsightItem,
  type DailySummaryDTO,
} from "@/lib/observability-api";

export default function ObservabilityCenter() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [needsOnboarding, setNeedsOnboarding] = useState(false);
  const [onboardingState, setOnboardingState] = useState({ hasDataSource: false, hasMetrics: false });

  const [healthScore, setHealthScore] = useState<HealthScoreResponse | null>(null);
  const [coreMetrics, setCoreMetrics] = useState<CoreMetric[]>([]);
  const [anomalies, setAnomalies] = useState<AnomalyEventDTO[]>([]);
  const [insights, setInsights] = useState<InsightItem[]>([]);
  const [summaries, setSummaries] = useState<DailySummaryDTO[]>([]);
  const [generating, setGenerating] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      // 并行加载所有数据
      const [healthRes, metricsRes, anomalyRes, insightRes, summaryRes] = await Promise.allSettled([
        getHealthScore(),
        getCoreMetrics(),
        listAnomalies(),
        listInsights(),
        listSummaries(),
      ]);

      // 处理健康评分
      if (healthRes.status === "fulfilled") {
        const data = healthRes.value;
        // 检查是否需要引导
        if (data.message && (data.message.includes("no_active_data_source") || data.message.includes("no_metrics"))) {
          setNeedsOnboarding(true);
          setOnboardingState({
            hasDataSource: !data.message.includes("no_active_data_source"),
            hasMetrics: !data.message.includes("no_metrics"),
          });
        } else {
          setNeedsOnboarding(false);
          setHealthScore(data);
        }
      }

      if (metricsRes.status === "fulfilled" && metricsRes.value?.metrics) {
        setCoreMetrics(metricsRes.value.metrics);
      }
      if (anomalyRes.status === "fulfilled") {
        setAnomalies(anomalyRes.value);
      }
      if (insightRes.status === "fulfilled") {
        setInsights(insightRes.value);
      }
      if (summaryRes.status === "fulfilled") {
        setSummaries(summaryRes.value);
      }
    } catch (err) {
      console.error("Failed to load observability data:", err);
      setNeedsOnboarding(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleAcknowledge = async (id: string) => {
    try {
      await acknowledgeAnomaly(id);
      setAnomalies((prev) => prev.map((a) => (a.id === id ? { ...a, status: "acknowledged" as const } : a)));
    } catch (err) {
      console.error("Failed to acknowledge anomaly:", err);
    }
  };

  const handleResolve = async (id: string) => {
    try {
      await resolveAnomaly(id);
      setAnomalies((prev) => prev.map((a) => (a.id === id ? { ...a, status: "resolved" as const } : a)));
    } catch (err) {
      console.error("Failed to resolve anomaly:", err);
    }
  };

  const handleMarkFalsePositive = async (id: string) => {
    try {
      await markFalsePositive(id);
      setAnomalies((prev) => prev.map((a) => (a.id === id ? { ...a, status: "false_positive" as const } : a)));
    } catch (err) {
      console.error("Failed to mark false positive:", err);
    }
  };

  const handleAskAI = (anomaly: AnomalyEventDTO) => {
    const query = encodeURIComponent(
      `分析一下 ${anomaly.metricId} 指标的异常，当前值 ${anomaly.actualValue}，基线值 ${anomaly.expectedValue}，偏离 ${anomaly.deviation.toFixed(1)} 倍标准差，方向: ${anomaly.direction}`
    );
    router.push(`/chat?q=${query}`);
  };

  const handleGenerateSummary = async () => {
    setGenerating(true);
    try {
      const summary = await generateSummary();
      if (summary) {
        setSummaries((prev) => [summary, ...prev]);
      }
    } catch (err) {
      console.error("Failed to generate summary:", err);
    } finally {
      setGenerating(false);
    }
  };

  // 引导状态
  if (needsOnboarding && !loading) {
    return <OnboardingGuide hasDataSource={onboardingState.hasDataSource} hasMetrics={onboardingState.hasMetrics} />;
  }

  const openAnomalies = anomalies.filter((a) => a.status === "open");

  return (
    <div className="space-y-6">
      {/* 第一行: 健康评分 + 核心指标 */}
      <div className="grid grid-cols-12 gap-4">
        <div className="col-span-12 lg:col-span-4">
          <HealthScoreCard data={healthScore} loading={loading} />
        </div>
        <div className="col-span-12 lg:col-span-8">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {loading
              ? Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 animate-pulse">
                    <div className="h-3 w-16 bg-white/[0.05] rounded mb-3" />
                    <div className="h-6 w-24 bg-white/[0.05] rounded mb-2" />
                    <div className="h-3 w-20 bg-white/[0.05] rounded" />
                  </div>
                ))
              : coreMetrics.slice(0, 8).map((metric, i) => (
                  <MetricKpiCard key={metric.metricId || i} metric={metric} />
                ))}
          </div>
        </div>
      </div>

      {/* AI 洞察轮播 */}
      {(loading || insights.length > 0) && (
        <div>
          <h3 className="text-sm font-medium text-white/50 mb-3">AI 洞察</h3>
          <InsightCarousel insights={insights} loading={loading} />
        </div>
      )}

      {/* 第二行: 异常事件 + 每日摘要 */}
      <div className="grid grid-cols-12 gap-4">
        <div className="col-span-12 lg:col-span-7">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-medium text-white/50">
              异常事件
              {openAnomalies.length > 0 && (
                <span className="ml-2 text-xs px-1.5 py-0.5 rounded bg-red-500/10 text-red-400">
                  {openAnomalies.length}
                </span>
              )}
            </h3>
          </div>
          <AnomalyFeed
            anomalies={openAnomalies}
            onAcknowledge={handleAcknowledge}
            onResolve={handleResolve}
            onMarkFalsePositive={handleMarkFalsePositive}
            onAskAI={handleAskAI}
            loading={loading}
          />
        </div>
        <div className="col-span-12 lg:col-span-5">
          <h3 className="text-sm font-medium text-white/50 mb-3">业务摘要</h3>
          <DailySummarySection
            summaries={summaries}
            onGenerate={handleGenerateSummary}
            loading={loading}
            generating={generating}
          />
        </div>
      </div>
    </div>
  );
}
