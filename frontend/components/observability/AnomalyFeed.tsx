"use client";

import { useState } from "react";
import type { AnomalyEventDTO } from "@/lib/observability-api";

interface AnomalyFeedProps {
  anomalies: AnomalyEventDTO[];
  onAcknowledge: (id: string) => void;
  onResolve: (id: string) => void;
  onMarkFalsePositive: (id: string) => void;
  onAskAI: (anomaly: AnomalyEventDTO) => void;
  loading?: boolean;
}

const SEVERITY_CONFIG = {
  critical: { dot: "bg-red-400", border: "border-l-red-500", label: "严重", bg: "bg-red-500/5" },
  warning: { dot: "bg-orange-400", border: "border-l-orange-400", label: "警告", bg: "bg-orange-500/5" },
  info: { dot: "bg-blue-400", border: "border-l-blue-400", label: "信息", bg: "bg-blue-500/5" },
};

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 60) return `${minutes} 分钟前`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} 小时前`;
  const days = Math.floor(hours / 24);
  return `${days} 天前`;
}

export default function AnomalyFeed({
  anomalies,
  onAcknowledge,
  onResolve,
  onMarkFalsePositive,
  onAskAI,
  loading,
}: AnomalyFeedProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 animate-pulse">
            <div className="flex gap-3">
              <div className="w-3 h-3 rounded-full bg-white/[0.05] mt-1" />
              <div className="flex-1 space-y-2">
                <div className="h-4 w-48 bg-white/[0.05] rounded" />
                <div className="h-3 w-64 bg-white/[0.05] rounded" />
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (anomalies.length === 0) {
    return (
      <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-8 text-center">
        <div className="text-white/30 text-sm">暂无异常事件</div>
        <div className="text-white/20 text-xs mt-1">业务指标运行正常</div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {anomalies.map((anomaly) => {
        const config = SEVERITY_CONFIG[anomaly.severity] || SEVERITY_CONFIG.info;
        const isExpanded = expandedId === anomaly.id;
        const changePercent = anomaly.expectedValue !== 0
          ? ((anomaly.actualValue - anomaly.expectedValue) / anomaly.expectedValue) * 100
          : 0;

        return (
          <div
            key={anomaly.id}
            className={`rounded-xl border border-white/[0.06] ${config.bg} border-l-2 ${config.border}
              transition-all duration-200 cursor-pointer`}
            onClick={() => setExpandedId(isExpanded ? null : anomaly.id)}
          >
            <div className="p-4">
              <div className="flex items-start gap-3">
                <span className={`w-2.5 h-2.5 rounded-full ${config.dot} mt-1.5 flex-shrink-0`} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-medium text-white/80">
                      {anomaly.metricId}
                    </span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded ${config.dot.replace("bg-", "text-")} bg-white/[0.05]`}>
                      {config.label}
                    </span>
                    <span className="text-[10px] text-white/25 ml-auto flex-shrink-0">
                      {timeAgo(anomaly.detectedAt || anomaly.createdAt)}
                    </span>
                  </div>
                  <p className="text-xs text-white/50">
                    {anomaly.direction === "up" ? "上涨" : "下降"}{" "}
                    <span className={anomaly.direction === "up" ? "text-emerald-400" : "text-red-400"}>
                      {Math.abs(changePercent).toFixed(1)}%
                    </span>
                    {" "}偏离基线 {anomaly.deviation.toFixed(1)} 倍标准差，
                    当前值 {anomaly.actualValue.toFixed(1)}，基线 {anomaly.expectedValue.toFixed(1)}
                  </p>
                </div>
              </div>
            </div>

            {/* 展开详情 */}
            {isExpanded && (
              <div className="px-4 pb-4 border-t border-white/[0.04] pt-3 ml-5">
                {anomaly.rootCause && (
                  <div className="text-xs text-white/40 mb-3 whitespace-pre-wrap">
                    {anomaly.rootCause}
                  </div>
                )}
                <div className="flex items-center gap-2 flex-wrap">
                  {anomaly.status === "open" && (
                    <>
                      <button
                        onClick={(e) => { e.stopPropagation(); onAcknowledge(anomaly.id); }}
                        className="text-xs px-3 py-1 rounded-lg bg-white/[0.06] text-white/60 hover:text-white/80 hover:bg-white/[0.1] transition-colors"
                      >
                        已确认
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); onResolve(anomaly.id); }}
                        className="text-xs px-3 py-1 rounded-lg bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 transition-colors"
                      >
                        已解决
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); onMarkFalsePositive(anomaly.id); }}
                        className="text-xs px-3 py-1 rounded-lg bg-white/[0.06] text-white/40 hover:text-white/60 transition-colors"
                      >
                        误报
                      </button>
                    </>
                  )}
                  <button
                    onClick={(e) => { e.stopPropagation(); onAskAI(anomaly); }}
                    className="text-xs px-3 py-1 rounded-lg bg-indigo-500/10 text-indigo-400 hover:bg-indigo-500/20 transition-colors ml-auto"
                  >
                    AI 追问
                  </button>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
