"use client";

import type { DashboardConfig } from "@/lib/types";

interface DashboardThumbnailProps {
  config: DashboardConfig;
  active?: boolean;
  onClick?: () => void;
}

const TEMPLATE_COLORS: Record<string, string[]> = {
  sales: ["#38bdf8", "#34d399", "#fbbf24"],
  operations: ["#34d399", "#38bdf8", "#a78bfa"],
  finance: ["#38bdf8", "#fbbf24", "#34d399"],
  custom: ["#64748b", "#94a3b8", "#cbd5e1"],
};

export default function DashboardThumbnail({
  config,
  active,
  onClick,
}: DashboardThumbnailProps) {
  const colors = TEMPLATE_COLORS[config.templateId] || TEMPLATE_COLORS.custom;
  return (
    <button
      onClick={onClick}
      className={`flex-shrink-0 w-48 h-28 rounded-lg overflow-hidden border-2 transition-all ${
        active
          ? "border-cyan-500 ring-2 ring-cyan-500/30"
          : "border-slate-600 hover:border-slate-500"
      }`}
    >
      <div className="w-full h-full bg-slate-800 relative flex">
        <div className="flex-1 grid grid-cols-3 gap-1 p-2">
          {colors.map((c, i) => (
            <div
              key={i}
              className="rounded bg-opacity-80"
              style={{ backgroundColor: c + "40" }}
            />
          ))}
        </div>
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-2">
          <span className="text-xs text-white truncate block">{config.title}</span>
        </div>
      </div>
    </button>
  );
}
