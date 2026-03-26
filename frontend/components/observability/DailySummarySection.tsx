"use client";

import { useState } from "react";
import type { DailySummaryDTO } from "@/lib/observability-api";

interface DailySummarySectionProps {
  summaries: DailySummaryDTO[];
  onGenerate: () => void;
  loading?: boolean;
  generating?: boolean;
}

interface ParsedContent {
  healthScore: number;
  metrics?: { name: string; displayName?: string; currentValue: number; change: number; direction: string; unit?: string }[];
  trends?: string[];
  concerns?: { metricName?: string; analysis?: string; severity?: string }[];
  positives?: { metricName?: string; reason?: string }[];
}

function parseSummaryContent(content: string): ParsedContent | null {
  try {
    return JSON.parse(content) as ParsedContent;
  } catch {
    return null;
  }
}

export default function DailySummarySection({ summaries, onGenerate, loading, generating }: DailySummarySectionProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  if (loading) {
    return (
      <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 animate-pulse">
        <div className="h-4 w-32 bg-white/[0.05] rounded" />
      </div>
    );
  }

  const latest = summaries.length > 0 ? summaries[0] : null;
  const latestParsed = latest ? parseSummaryContent(latest.content) : null;

  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.02]">
      {/* 标题栏 */}
      <div
        className="flex items-center justify-between p-4 cursor-pointer hover:bg-white/[0.02] transition-colors"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-medium text-white/60">每日业务摘要</h3>
          {latest && (
            <span className="text-[10px] text-white/30">{latest.summaryDate}</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={(e) => { e.stopPropagation(); onGenerate(); }}
            disabled={generating}
            className="text-[11px] px-2.5 py-1 rounded-lg bg-indigo-500/10 text-indigo-400 hover:bg-indigo-500/20 transition-colors disabled:opacity-50"
          >
            {generating ? "生成中..." : "生成今日摘要"}
          </button>
          <span className={`text-white/30 text-xs transition-transform ${isExpanded ? "rotate-180" : ""}`}>
            v
          </span>
        </div>
      </div>

      {/* 展开内容 */}
      {isExpanded && (
        <div className="border-t border-white/[0.04] p-4 space-y-4">
          {!latest ? (
            <p className="text-xs text-white/30 text-center py-4">暂无摘要记录，点击上方按钮生成</p>
          ) : (
            <>
              {/* 健康评分 */}
              {latestParsed && (
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-white/40">健康评分:</span>
                  <span className={`font-bold ${
                    latestParsed.healthScore >= 80 ? "text-emerald-400" :
                    latestParsed.healthScore >= 60 ? "text-yellow-400" : "text-red-400"
                  }`}>
                    {latestParsed.healthScore}/100
                  </span>
                </div>
              )}

              {/* 趋势 */}
              {latestParsed?.trends && latestParsed.trends.length > 0 && (
                <div className="space-y-1">
                  <h4 className="text-xs text-white/40 font-medium">趋势概要</h4>
                  {latestParsed.trends.map((trend, i) => (
                    <p key={i} className="text-xs text-white/50 pl-3 border-l border-white/[0.06]">
                      {trend}
                    </p>
                  ))}
                </div>
              )}

              {/* 需关注 */}
              {latestParsed?.concerns && latestParsed.concerns.length > 0 && (
                <div className="space-y-1">
                  <h4 className="text-xs text-red-400/80 font-medium">需要关注</h4>
                  {latestParsed.concerns.map((c, i) => (
                    <p key={i} className="text-xs text-white/50 pl-3 border-l border-red-500/20">
                      <span className="text-white/60">{c.metricName}</span>: {c.analysis}
                    </p>
                  ))}
                </div>
              )}

              {/* 正面 */}
              {latestParsed?.positives && latestParsed.positives.length > 0 && (
                <div className="space-y-1">
                  <h4 className="text-xs text-emerald-400/80 font-medium">正面趋势</h4>
                  {latestParsed.positives.map((p, i) => (
                    <p key={i} className="text-xs text-white/50 pl-3 border-l border-emerald-500/20">
                      <span className="text-white/60">{p.metricName}</span>: {p.reason}
                    </p>
                  ))}
                </div>
              )}

              {/* 历史摘要列表 */}
              {summaries.length > 1 && (
                <div className="border-t border-white/[0.04] pt-3">
                  <h4 className="text-xs text-white/40 font-medium mb-2">历史摘要</h4>
                  <div className="space-y-1">
                    {summaries.slice(1, 8).map((s) => (
                      <div key={s.id} className="flex items-center justify-between text-[11px] text-white/30">
                        <span>{s.summaryDate}</span>
                        <span>健康评分: {s.healthScore}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
