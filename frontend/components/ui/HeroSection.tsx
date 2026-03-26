"use client";

import React from "react";

interface StatItem {
  label: string;
  value: number | string;
  color?: string;
}

interface HeroSectionProps {
  title: string;
  description: string;
  stats?: StatItem[];
  maxWidth?: "5xl" | "7xl";
  actions?: React.ReactNode;
  className?: string;
}

export default function HeroSection({
  title,
  description,
  stats,
  maxWidth = "5xl",
  actions,
  className = "",
}: HeroSectionProps) {
  const maxWidthClass = maxWidth === "5xl" ? "max-w-7xl" : "max-w-7xl";
  const paddingY = stats ? "py-12" : "py-10";

  return (
    <div className={`relative overflow-hidden border-b border-zinc-800/50 ${className}`}>
      <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/5 via-transparent to-purple-500/5" />
      <div className={`relative ${maxWidthClass} mx-auto px-6 ${paddingY}`}>
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl font-bold text-zinc-100 mb-2">{title}</h1>
            <p className="text-zinc-400 text-sm">{description}</p>
          </div>
          {stats && stats.length > 0 && (
            <div className="flex items-center gap-6 ml-8">
              {stats.map((stat, index) => (
                <React.Fragment key={stat.label}>
                  {index > 0 && <div className="w-px h-10 bg-zinc-800" />}
                  <div className="text-right">
                    <div className={`text-2xl font-bold ${stat.color || "text-zinc-100"}`}>
                      {stat.value}
                    </div>
                    <div className="text-xs text-zinc-500">{stat.label}</div>
                  </div>
                </React.Fragment>
              ))}
            </div>
          )}
          {actions && <div className="ml-8">{actions}</div>}
        </div>
      </div>
    </div>
  );
}
