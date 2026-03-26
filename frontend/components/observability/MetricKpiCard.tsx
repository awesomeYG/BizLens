"use client";

import type { CoreMetric } from "@/lib/observability-api";

interface MetricKpiCardProps {
  metric: CoreMetric;
}

function formatValue(value: number, unit?: string): string {
  if (unit === "yuan" || unit === "CNY") {
    if (value >= 10000) return `${(value / 10000).toFixed(1)}万`;
    return `${value.toFixed(0)}`;
  }
  if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
  if (value >= 1000) return `${(value / 1000).toFixed(1)}K`;
  if (Number.isInteger(value)) return value.toString();
  return value.toFixed(2);
}

export default function MetricKpiCard({ metric }: MetricKpiCardProps) {
  const isAnomalyWarning = Math.abs(metric.change) >= 15;
  const isAnomalyCritical = Math.abs(metric.change) >= 30;

  const borderColor = isAnomalyCritical
    ? "border-l-red-500"
    : isAnomalyWarning
    ? "border-l-orange-400"
    : "border-l-transparent";

  return (
    <div
      className={`rounded-xl border border-white/[0.06] bg-white/[0.02] p-4
        border-l-2 ${borderColor}
        hover:bg-white/[0.04] transition-all duration-200
        ${isAnomalyCritical ? "animate-pulse-subtle" : ""}`}
    >
      <div className="flex items-start justify-between mb-2">
        <span className="text-xs text-white/50 truncate">
          {metric.displayName || metric.name}
        </span>
        {isAnomalyCritical && (
          <span className="w-2 h-2 rounded-full bg-red-400 animate-ping" />
        )}
        {isAnomalyWarning && !isAnomalyCritical && (
          <span className="w-2 h-2 rounded-full bg-orange-400" />
        )}
      </div>

      <div className="flex items-baseline gap-2 mb-3">
        <span className="text-2xl font-bold text-white/90">
          {formatValue(metric.currentValue, metric.unit)}
        </span>
        {metric.unit && (
          <span className="text-xs text-white/30">
            {metric.unit === "yuan" ? "元" : metric.unit}
          </span>
        )}
      </div>

      {/* 环比变化 */}
      <div className="flex items-center gap-1.5 text-sm">
        {metric.change !== 0 ? (
          <>
            <span
              className={
                metric.direction === "up" ? "text-emerald-400" : metric.direction === "down" ? "text-red-400" : "text-white/40"
              }
            >
              {metric.direction === "up" ? "+" : ""}
              {metric.change.toFixed(1)}%
            </span>
            <span className="text-white/30">较昨日</span>
          </>
        ) : (
          <span className="text-white/30">较昨日持平</span>
        )}
      </div>
    </div>
  );
}
