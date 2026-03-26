"use client";

import { request } from "./auth/api";
import { getCurrentUser } from "./user-store";

// ========== 类型定义 ==========

export interface HealthScoreResponse {
  score: number;
  delta: number;
  level: "excellent" | "good" | "attention" | "warning" | "danger" | "unknown";
  trend: { date: string; score: number }[];
  message?: string;
}

export interface CoreMetric {
  name: string;
  displayName?: string;
  metricId?: string;
  currentValue: number;
  prevValue?: number;
  change: number;
  direction: "up" | "down" | "stable";
  unit?: string;
}

export interface MetricPrediction {
  metricId: string;
  metricName: string;
  currentValue: number;
  predictedNext: number;
  trend: "rising" | "falling" | "stable";
  confidence: number;
  historyValues: number[];
  description: string;
}

export interface CoreMetricsResponse {
  metrics: CoreMetric[];
  predictions: MetricPrediction[];
  topChanges: CoreMetric[];
}

export interface AnomalyEventDTO {
  id: string;
  tenantId: string;
  metricId: string;
  detectedAt: string;
  actualValue: number;
  expectedValue: number;
  deviation: number;
  severity: "critical" | "warning" | "info";
  confidence: number;
  direction: "up" | "down";
  rootCause?: string;
  status: "open" | "acknowledged" | "resolved" | "false_positive";
  notifiedAt?: string;
  resolvedAt?: string;
  userFeedback?: string;
  createdAt: string;
}

export interface InsightItem {
  type: "positive" | "negative" | "neutral";
  title: string;
  description: string;
  metricName?: string;
  severity?: string;
  confidence: number;
}

export interface DailySummaryDTO {
  id: string;
  tenantId: string;
  summaryDate: string;
  healthScore: number;
  content: string;
  sentAt?: string;
  createdAt: string;
}

export interface RCARequest {
  metricId: string;
  anomalyId?: string;
  timeRange?: string;
  maxDepth?: number;
}

export interface DrillDownItem {
  value: string;
  currentValue: number;
  baseValue: number;
  change: number;
  changeRate: number;
  contribution: number;
  isAnomaly: boolean;
}

export interface DrillDownResult {
  dimensionName: string;
  dimensionField: string;
  totalImpact: number;
  items: DrillDownItem[];
}

export interface RCAResult {
  metricId: string;
  metricName: string;
  summary: string;
  currentValue: number;
  baseValue: number;
  changeRate: number;
  direction: string;
  drillDowns: DrillDownResult[];
  suggestions: string[];
  analyzedAt: string;
}

// ========== API 函数 ==========

function getTenantId(): string {
  const user = getCurrentUser();
  return user?.tenantId || "demo";
}

/** 获取健康评分 */
export async function getHealthScore(): Promise<HealthScoreResponse> {
  const tenantId = getTenantId();
  const res = await request<{ success: boolean; data: HealthScoreResponse }>(
    `/tenants/${tenantId}/observability/health-score`
  );
  return res.data;
}

/** 获取核心指标 */
export async function getCoreMetrics(): Promise<CoreMetricsResponse> {
  const tenantId = getTenantId();
  const res = await request<{ success: boolean; data: CoreMetricsResponse }>(
    `/tenants/${tenantId}/observability/core-metrics`
  );
  return res.data;
}

/** 获取异常事件列表 */
export async function listAnomalies(status?: string): Promise<AnomalyEventDTO[]> {
  const tenantId = getTenantId();
  const params = status ? `?status=${status}` : "";
  const res = await request<{ success: boolean; anomalies: AnomalyEventDTO[] }>(
    `/tenants/${tenantId}/observability/anomalies${params}`
  );
  return res.anomalies || [];
}

/** 确认异常 */
export async function acknowledgeAnomaly(id: string): Promise<void> {
  const tenantId = getTenantId();
  await request(`/tenants/${tenantId}/observability/anomalies/${id}/acknowledge`, {
    method: "PUT",
  });
}

/** 标记异常已解决 */
export async function resolveAnomaly(id: string): Promise<void> {
  const tenantId = getTenantId();
  await request(`/tenants/${tenantId}/observability/anomalies/${id}/resolve`, {
    method: "PUT",
  });
}

/** 标记误报 */
export async function markFalsePositive(id: string): Promise<void> {
  const tenantId = getTenantId();
  await request(`/tenants/${tenantId}/observability/anomalies/${id}/false-positive`, {
    method: "PUT",
  });
}

/** 获取 AI 洞察 */
export async function listInsights(): Promise<InsightItem[]> {
  const tenantId = getTenantId();
  const res = await request<{ success: boolean; insights: InsightItem[] }>(
    `/tenants/${tenantId}/observability/insights`
  );
  return res.insights || [];
}

/** 获取每日摘要列表 */
export async function listSummaries(limit?: number): Promise<DailySummaryDTO[]> {
  const tenantId = getTenantId();
  const res = await request<{ success: boolean; summaries: DailySummaryDTO[] }>(
    `/tenants/${tenantId}/observability/summaries`
  );
  return res.summaries || [];
}

/** 获取最新摘要 */
export async function getLatestSummary(): Promise<DailySummaryDTO | null> {
  const tenantId = getTenantId();
  const res = await request<{ success: boolean; summary: DailySummaryDTO }>(
    `/tenants/${tenantId}/observability/summaries/latest`
  );
  return res.summary || null;
}

/** 手动触发摘要生成 */
export async function generateSummary(): Promise<DailySummaryDTO> {
  const tenantId = getTenantId();
  const res = await request<{ success: boolean; summary: DailySummaryDTO }>(
    `/tenants/${tenantId}/observability/summaries/generate`,
    { method: "POST" }
  );
  return res.summary;
}

/** 执行根因分析 */
export async function analyzeRootCause(req: RCARequest): Promise<RCAResult> {
  const tenantId = getTenantId();
  const res = await request<{ success: boolean; result: RCAResult }>(
    `/tenants/${tenantId}/observability/rca/analyze`,
    { method: "POST", body: JSON.stringify(req) }
  );
  return res.result;
}
