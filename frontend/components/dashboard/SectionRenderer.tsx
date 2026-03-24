"use client";

/**
 * SectionRenderer -- 通用大屏区块渲染引擎
 *
 * 根据 DashboardSection.type 自动选择对应的图表/组件渲染。
 * 所有数据从 section.data 中获取，零硬编码。
 */

import ReactECharts from "echarts-for-react";
import type {
  DashboardSection,
  SectionData,
  KpiItem,
  RankingItem,
} from "@/lib/types";

// ==================== 深色主题公共配置 ====================

const COLORS = [
  "#38bdf8", "#34d399", "#a78bfa", "#fbbf24", "#f87171",
  "#fb923c", "#2dd4bf", "#818cf8", "#e879f9", "#22d3ee",
];

const darkAxis = {
  axisLine: { lineStyle: { color: "#334155" } },
  axisLabel: { color: "#94a3b8", fontSize: 11 },
  splitLine: { lineStyle: { color: "#1e293b", type: "dashed" as const } },
};

const darkTooltip = {
  backgroundColor: "rgba(15,23,42,0.95)",
  borderColor: "#334155",
  textStyle: { color: "#e2e8f0", fontSize: 12 },
};

const darkLegend = {
  textStyle: { color: "#94a3b8", fontSize: 11 },
  icon: "roundRect",
  itemWidth: 12,
  itemHeight: 8,
};

// ==================== 子组件 ====================

function KpiCards({ items }: { items: KpiItem[] }) {
  return (
    <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${Math.min(items.length, 4)}, 1fr)` }}>
      {items.map((item) => (
        <div
          key={item.label}
          className="relative overflow-hidden rounded-xl border border-white/[0.06] bg-white/[0.03] p-4"
        >
          <div className="absolute top-0 right-0 w-20 h-20 opacity-[0.04] rounded-full"
            style={{ background: `radial-gradient(circle, ${item.color || "#38bdf8"}, transparent)` }}
          />
          <div className="text-xs text-zinc-400 mb-1.5">{item.label}</div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-2xl font-bold tracking-tight" style={{ color: item.color || "#38bdf8" }}>
              {item.value}
            </span>
            {item.unit && <span className="text-sm text-zinc-400">{item.unit}</span>}
          </div>
          {item.trendValue && (
            <div className={`mt-1.5 flex items-center gap-1 text-xs ${
              item.trend === "up" ? "text-emerald-400" :
              item.trend === "down" ? "text-rose-400" : "text-zinc-400"
            }`}>
              <span>
                {item.trend === "up" ? "↑" : item.trend === "down" ? "↓" : "→"}
              </span>
              <span>{item.trendValue}</span>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function RankingList({ items, title }: { items: RankingItem[]; title?: string }) {
  const maxVal = Math.max(...items.map((i) => i.maxValue || i.value));
  return (
    <div className="space-y-3">
      {items.map((item, idx) => (
        <div key={item.label} className="space-y-1">
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2">
              <span className={`inline-flex items-center justify-center w-5 h-5 rounded text-[10px] font-bold ${
                idx < 3
                  ? "bg-gradient-to-br from-amber-500/30 to-orange-500/30 text-amber-300 border border-amber-500/30"
                  : "bg-white/5 text-zinc-500 border border-white/5"
              }`}>
                {idx + 1}
              </span>
              <span className="text-zinc-200 truncate max-w-[160px]">{item.label}</span>
            </div>
            <span className="text-zinc-300 font-medium tabular-nums">{item.value.toLocaleString()}</span>
          </div>
          <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-700"
              style={{
                width: `${(item.value / maxVal) * 100}%`,
                background: `linear-gradient(90deg, ${COLORS[idx % COLORS.length]}88, ${COLORS[idx % COLORS.length]})`,
              }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

// ==================== ECharts 配置生成 ====================

function buildLineOption(data: SectionData) {
  return {
    tooltip: { ...darkTooltip, trigger: "axis" },
    legend: { ...darkLegend, data: data.series?.map((s) => s.name) || [] },
    grid: { left: 12, right: 16, top: 40, bottom: 8, containLabel: true },
    xAxis: { type: "category", data: data.categories || [], ...darkAxis, boundaryGap: false },
    yAxis: { type: "value", ...darkAxis },
    series: (data.series || []).map((s, i) => ({
      name: s.name,
      type: "line",
      smooth: true,
      symbol: "circle",
      symbolSize: 4,
      data: s.values,
      itemStyle: { color: s.color || COLORS[i % COLORS.length] },
      lineStyle: { width: 2 },
    })),
  };
}

function buildAreaOption(data: SectionData) {
  return {
    tooltip: { ...darkTooltip, trigger: "axis" },
    legend: { ...darkLegend, data: data.series?.map((s) => s.name) || [] },
    grid: { left: 12, right: 16, top: 40, bottom: 8, containLabel: true },
    xAxis: { type: "category", data: data.categories || [], ...darkAxis, boundaryGap: false },
    yAxis: { type: "value", ...darkAxis },
    series: (data.series || []).map((s, i) => ({
      name: s.name,
      type: "line",
      smooth: true,
      symbol: "none",
      data: s.values,
      itemStyle: { color: s.color || COLORS[i % COLORS.length] },
      lineStyle: { width: 2 },
      areaStyle: {
        color: {
          type: "linear",
          x: 0, y: 0, x2: 0, y2: 1,
          colorStops: [
            { offset: 0, color: `${s.color || COLORS[i % COLORS.length]}40` },
            { offset: 1, color: `${s.color || COLORS[i % COLORS.length]}05` },
          ],
        },
      },
    })),
  };
}

function buildBarOption(data: SectionData) {
  return {
    tooltip: { ...darkTooltip, trigger: "axis" },
    legend: (data.series?.length || 0) > 1 ? { ...darkLegend, data: data.series?.map((s) => s.name) || [] } : undefined,
    grid: { left: 12, right: 16, top: (data.series?.length || 0) > 1 ? 40 : 16, bottom: 8, containLabel: true },
    xAxis: { type: "category", data: data.categories || [], ...darkAxis },
    yAxis: { type: "value", ...darkAxis },
    series: (data.series || []).map((s, i) => ({
      name: s.name,
      type: "bar",
      barMaxWidth: 28,
      data: s.values,
      itemStyle: {
        borderRadius: [4, 4, 0, 0],
        color: {
          type: "linear",
          x: 0, y: 0, x2: 0, y2: 1,
          colorStops: [
            { offset: 0, color: s.color || COLORS[i % COLORS.length] },
            { offset: 1, color: `${s.color || COLORS[i % COLORS.length]}60` },
          ],
        },
      },
    })),
  };
}

function buildPieOption(data: SectionData) {
  return {
    tooltip: { ...darkTooltip, trigger: "item", formatter: "{b}: {c} ({d}%)" },
    legend: { ...darkLegend, orient: "vertical", right: 12, top: "center" },
    series: [{
      type: "pie",
      radius: ["40%", "65%"],
      center: ["35%", "50%"],
      avoidLabelOverlap: true,
      label: { show: false },
      emphasis: {
        label: { show: true, color: "#e2e8f0", fontSize: 13, fontWeight: "bold" },
        itemStyle: { shadowBlur: 20, shadowColor: "rgba(0,0,0,0.5)" },
      },
      data: (data.pieItems || []).map((item, i) => ({
        ...item,
        itemStyle: { color: COLORS[i % COLORS.length] },
      })),
    }],
  };
}

function buildFunnelOption(data: SectionData) {
  return {
    tooltip: { ...darkTooltip, trigger: "item", formatter: "{b}: {c}" },
    series: [{
      type: "funnel",
      left: "10%",
      top: 16,
      bottom: 16,
      width: "80%",
      sort: "descending",
      gap: 4,
      label: {
        show: true,
        position: "inside",
        color: "#e2e8f0",
        fontSize: 12,
        formatter: "{b}\n{c}",
      },
      itemStyle: { borderWidth: 0 },
      data: (data.funnelItems || []).map((item, i) => ({
        ...item,
        itemStyle: { color: COLORS[i % COLORS.length] },
      })),
    }],
  };
}

function buildGaugeOption(data: SectionData) {
  const gauge = data.gaugeData;
  if (!gauge) return {};
  const min = gauge.min ?? 0;
  const max = gauge.max ?? 100;
  return {
    series: [{
      type: "gauge",
      min,
      max,
      progress: { show: true, width: 14, itemStyle: { color: "#38bdf8" } },
      axisLine: { lineStyle: { width: 14, color: [[1, "#1e293b"]] } },
      axisTick: { show: false },
      splitLine: { length: 8, lineStyle: { width: 2, color: "#334155" } },
      axisLabel: { color: "#64748b", fontSize: 10, distance: 20 },
      pointer: { length: "60%", width: 4, itemStyle: { color: "#38bdf8" } },
      anchor: { show: true, size: 12, itemStyle: { borderWidth: 2, borderColor: "#38bdf8", color: "#0f172a" } },
      title: { show: true, offsetCenter: [0, "70%"], color: "#94a3b8", fontSize: 12 },
      detail: {
        valueAnimation: true,
        fontSize: 24,
        fontWeight: "bold",
        color: "#38bdf8",
        offsetCenter: [0, "40%"],
        formatter: `{value}`,
      },
      data: [{ value: gauge.value, name: gauge.name }],
    }],
  };
}

// ==================== 主组件 ====================

interface SectionRendererProps {
  section: DashboardSection;
  compact?: boolean;
}

export default function SectionRenderer({ section, compact }: SectionRendererProps) {
  const data = section.data || {};
  const chartHeight = compact ? 160 : 260;

  // 区块外壳
  const Wrapper = ({ children, noPadChart }: { children: React.ReactNode; noPadChart?: boolean }) => (
    <div className="h-full rounded-2xl border border-white/[0.06] bg-white/[0.02] backdrop-blur-sm overflow-hidden flex flex-col">
      {section.title && (
        <div className={`px-4 pt-3 ${noPadChart ? "pb-0" : "pb-1"}`}>
          <h3 className="text-sm font-semibold text-zinc-100 leading-tight">{section.title}</h3>
          {section.subtitle && !compact && (
            <p className="text-[11px] text-zinc-500 mt-0.5">{section.subtitle}</p>
          )}
        </div>
      )}
      <div className="flex-1 px-4 pb-3 min-h-0">{children}</div>
    </div>
  );

  switch (section.type) {
    case "kpi":
      return (
        <div className="h-full flex flex-col justify-center">
          <KpiCards items={data.kpiItems || []} />
        </div>
      );

    case "line":
    case "trend":
      return (
        <Wrapper noPadChart>
          <ReactECharts option={buildLineOption(data)} style={{ height: chartHeight, width: "100%" }} opts={{ renderer: "canvas" }} />
        </Wrapper>
      );

    case "area":
      return (
        <Wrapper noPadChart>
          <ReactECharts option={buildAreaOption(data)} style={{ height: chartHeight, width: "100%" }} opts={{ renderer: "canvas" }} />
        </Wrapper>
      );

    case "bar":
      return (
        <Wrapper noPadChart>
          <ReactECharts option={buildBarOption(data)} style={{ height: chartHeight, width: "100%" }} opts={{ renderer: "canvas" }} />
        </Wrapper>
      );

    case "pie":
      return (
        <Wrapper noPadChart>
          <ReactECharts option={buildPieOption(data)} style={{ height: chartHeight, width: "100%" }} opts={{ renderer: "canvas" }} />
        </Wrapper>
      );

    case "funnel":
      return (
        <Wrapper noPadChart>
          <ReactECharts option={buildFunnelOption(data)} style={{ height: chartHeight, width: "100%" }} opts={{ renderer: "canvas" }} />
        </Wrapper>
      );

    case "gauge":
      return (
        <Wrapper noPadChart>
          <ReactECharts option={buildGaugeOption(data)} style={{ height: chartHeight, width: "100%" }} opts={{ renderer: "canvas" }} />
        </Wrapper>
      );

    case "ranking":
      return (
        <Wrapper>
          <RankingList items={data.rankingItems || []} title={section.title} />
        </Wrapper>
      );

    case "table":
      if (!data.tableData) return null;
      return (
        <Wrapper>
          <div className="overflow-auto max-h-full">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-white/10">
                  {data.tableData.columns.map((col) => (
                    <th key={col} className="text-left py-2 px-2 text-zinc-400 font-medium">{col}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.tableData.rows.map((row, ri) => (
                  <tr key={ri} className="border-b border-white/5 hover:bg-white/[0.02]">
                    {row.map((cell, ci) => (
                      <td key={ci} className="py-1.5 px-2 text-zinc-300">{cell}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Wrapper>
      );

    default:
      return (
        <Wrapper>
          <div className="flex items-center justify-center h-full text-zinc-600 text-sm">
            暂不支持的区块类型: {section.type}
          </div>
        </Wrapper>
      );
  }
}
