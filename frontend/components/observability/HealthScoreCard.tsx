"use client";

import { useEffect, useState } from "react";
import type { HealthScoreResponse } from "@/lib/observability-api";

const LEVEL_CONFIG = {
  excellent: { color: "text-emerald-400", ring: "stroke-emerald-400", bg: "bg-emerald-500/10", label: "优秀" },
  good: { color: "text-teal-400", ring: "stroke-teal-400", bg: "bg-teal-500/10", label: "良好" },
  attention: { color: "text-yellow-400", ring: "stroke-yellow-400", bg: "bg-yellow-500/10", label: "注意" },
  warning: { color: "text-orange-400", ring: "stroke-orange-400", bg: "bg-orange-500/10", label: "警告" },
  danger: { color: "text-red-400", ring: "stroke-red-400", bg: "bg-red-500/10", label: "危险" },
  unknown: { color: "text-gray-400", ring: "stroke-gray-500", bg: "bg-gray-500/10", label: "未知" },
};

interface HealthScoreCardProps {
  data: HealthScoreResponse | null;
  loading?: boolean;
}

export default function HealthScoreCard({ data, loading }: HealthScoreCardProps) {
  const [animatedScore, setAnimatedScore] = useState(0);

  useEffect(() => {
    if (!data) return;
    const target = data.score;
    let current = 0;
    const step = Math.ceil(target / 30);
    const timer = setInterval(() => {
      current += step;
      if (current >= target) {
        current = target;
        clearInterval(timer);
      }
      setAnimatedScore(current);
    }, 30);
    return () => clearInterval(timer);
  }, [data?.score]);

  if (loading || !data) {
    return (
      <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-6 animate-pulse">
        <div className="flex items-center gap-6">
          <div className="w-28 h-28 rounded-full bg-white/[0.05]" />
          <div className="flex-1 space-y-3">
            <div className="h-5 w-32 bg-white/[0.05] rounded" />
            <div className="h-4 w-48 bg-white/[0.05] rounded" />
          </div>
        </div>
      </div>
    );
  }

  const config = LEVEL_CONFIG[data.level] || LEVEL_CONFIG.unknown;
  const circumference = 2 * Math.PI * 44;
  const offset = circumference - (animatedScore / 100) * circumference;

  return (
    <div className={`rounded-2xl border border-white/[0.06] bg-white/[0.02] p-6 ${config.bg}`}>
      <div className="flex items-center gap-6">
        {/* 圆环进度条 */}
        <div className="relative w-28 h-28 flex-shrink-0">
          <svg className="w-28 h-28 -rotate-90" viewBox="0 0 100 100">
            <circle cx="50" cy="50" r="44" fill="none" strokeWidth="6" className="stroke-white/[0.06]" />
            <circle
              cx="50" cy="50" r="44"
              fill="none" strokeWidth="6"
              className={`${config.ring} transition-all duration-1000 ease-out`}
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={offset}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className={`text-3xl font-bold ${config.color}`}>{animatedScore}</span>
            <span className="text-[10px] text-white/40 mt-0.5">/ 100</span>
          </div>
        </div>

        {/* 右侧信息 */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="text-sm font-medium text-white/70">业务健康评分</h3>
            <span className={`text-xs px-2 py-0.5 rounded-full border ${config.color} border-current/20`}>
              {config.label}
            </span>
          </div>

          {/* 趋势变化 */}
          <div className="flex items-center gap-1.5 text-sm mb-3">
            {data.delta !== 0 && (
              <>
                <span className={data.delta > 0 ? "text-emerald-400" : "text-red-400"}>
                  {data.delta > 0 ? "+" : ""}{data.delta}
                </span>
                <span className="text-white/30">较昨日</span>
              </>
            )}
            {data.delta === 0 && <span className="text-white/30">与昨日持平</span>}
          </div>

          {/* Sparkline 趋势 */}
          {data.trend && data.trend.length > 1 && (
            <div className="flex items-end gap-1 h-8">
              {data.trend.map((point, i) => {
                const max = Math.max(...data.trend.map(t => t.score), 1);
                const min = Math.min(...data.trend.map(t => t.score));
                const range = max - min || 1;
                const height = ((point.score - min) / range) * 28 + 4;
                return (
                  <div
                    key={i}
                    className={`w-2 rounded-full ${i === data.trend.length - 1 ? config.ring.replace("stroke-", "bg-") : "bg-white/10"}`}
                    style={{ height: `${height}px` }}
                    title={`${point.date}: ${point.score}`}
                  />
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
