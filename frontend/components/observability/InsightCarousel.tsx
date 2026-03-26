"use client";

import type { InsightItem } from "@/lib/observability-api";

interface InsightCarouselProps {
  insights: InsightItem[];
  loading?: boolean;
}

const TYPE_CONFIG = {
  positive: { icon: "^", color: "text-emerald-400", border: "border-emerald-500/20", bg: "bg-emerald-500/5" },
  negative: { icon: "!", color: "text-red-400", border: "border-red-500/20", bg: "bg-red-500/5" },
  neutral: { icon: "~", color: "text-blue-400", border: "border-blue-500/20", bg: "bg-blue-500/5" },
};

export default function InsightCarousel({ insights, loading }: InsightCarouselProps) {
  if (loading) {
    return (
      <div className="flex gap-3 overflow-x-auto pb-2">
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex-shrink-0 w-64 rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 animate-pulse">
            <div className="h-4 w-32 bg-white/[0.05] rounded mb-2" />
            <div className="h-3 w-48 bg-white/[0.05] rounded" />
          </div>
        ))}
      </div>
    );
  }

  if (insights.length === 0) {
    return null;
  }

  return (
    <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-thin scrollbar-track-transparent scrollbar-thumb-white/10">
      {insights.map((insight, i) => {
        const config = TYPE_CONFIG[insight.type] || TYPE_CONFIG.neutral;
        return (
          <div
            key={i}
            className={`flex-shrink-0 w-72 rounded-xl border ${config.border} ${config.bg} p-4
              hover:bg-white/[0.04] transition-all duration-200`}
          >
            <div className="flex items-start gap-2 mb-2">
              <span className={`text-lg font-bold ${config.color} leading-none`}>{config.icon}</span>
              <h4 className="text-sm font-medium text-white/70 line-clamp-1">{insight.title}</h4>
            </div>
            <p className="text-xs text-white/40 line-clamp-2 mb-2">{insight.description}</p>
            {insight.confidence > 0 && (
              <div className="flex items-center gap-1.5">
                <div className="h-1 flex-1 bg-white/[0.06] rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${config.color.replace("text-", "bg-")}`}
                    style={{ width: `${insight.confidence * 100}%` }}
                  />
                </div>
                <span className="text-[10px] text-white/30">{(insight.confidence * 100).toFixed(0)}%</span>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
