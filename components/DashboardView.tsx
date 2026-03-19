"use client";

import ReactECharts from "echarts-for-react";
import type { DashboardConfig, DashboardData } from "@/lib/types";

interface DashboardViewProps {
  config: DashboardConfig;
  compact?: boolean;
}

export default function DashboardView({ config, compact }: DashboardViewProps) {
  const data = config.data as DashboardData;
  const templateId = config.templateId;

  const salesChart = {
    tooltip: { trigger: "axis" },
    legend: { data: ["销售额", "利润"], textStyle: { color: "#94a3b8" } },
    grid: { left: "3%", right: "4%", bottom: "3%", containLabel: true },
    xAxis: {
      type: "category",
      data: (data.months as string[]) || ["1月", "2月", "3月", "4月", "5月", "6月"],
      axisLine: { lineStyle: { color: "#475569" } },
      axisLabel: { color: "#94a3b8" },
    },
    yAxis: {
      type: "value",
      axisLine: { show: false },
      splitLine: { lineStyle: { color: "#334155" } },
      axisLabel: { color: "#94a3b8" },
    },
    series: [
      {
        name: "销售额",
        type: "line",
        smooth: true,
        data: (data.sales as number[]) || [120, 200, 150, 280, 220, 300],
        itemStyle: { color: "#38bdf8" },
      },
      {
        name: "利润",
        type: "line",
        smooth: true,
        data: (data.profit as number[]) || [40, 60, 55, 90, 70, 100],
        itemStyle: { color: "#34d399" },
      },
    ],
  };

  const pieChart = {
    tooltip: { trigger: "item" },
    legend: { orient: "vertical", left: "left", textStyle: { color: "#94a3b8" } },
    series: [
      {
        name: "渠道",
        type: "pie",
        radius: "60%",
        data: (data.channels as { value: number; name: string }[]) || [
          { value: 335, name: "线上" },
          { value: 234, name: "线下" },
          { value: 135, name: "代理" },
        ],
        emphasis: { itemStyle: { shadowBlur: 10, shadowOffsetX: 0 } },
        itemStyle: {
          color: (params: { dataIndex: number }) =>
            ["#38bdf8", "#34d399", "#fbbf24"][params.dataIndex % 3],
        },
      },
    ],
  };

  const barChart = {
    tooltip: { trigger: "axis" },
    grid: { left: "3%", right: "4%", bottom: "3%", containLabel: true },
    xAxis: {
      type: "category",
      data: (data.regions as string[]) || ["华东", "华南", "华北", "西南", "西北"],
      axisLine: { lineStyle: { color: "#475569" } },
      axisLabel: { color: "#94a3b8" },
    },
    yAxis: {
      type: "value",
      axisLine: { show: false },
      splitLine: { lineStyle: { color: "#334155" } },
      axisLabel: { color: "#94a3b8" },
    },
    series: [
      {
        type: "bar",
        data: (data.regionSales as number[]) || [320, 280, 200, 150, 80],
        itemStyle: {
          color: {
            type: "linear",
            x: 0,
            y: 0,
            x2: 0,
            y2: 1,
            colorStops: [
              { offset: 0, color: "#38bdf8" },
              { offset: 1, color: "#0ea5e9" },
            ],
          },
        },
      },
    ],
  };

  const kpiCards = [
    { label: "总销售额", value: (data.totalSales as number) || 1280, unit: "万" },
    { label: "同比增长", value: (data.growth as number) || 23.5, unit: "%" },
    { label: "客户数", value: (data.customers as number) || 1256, unit: "" },
  ];

  const isCompact = compact;

  if (templateId === "sales") {
    return (
      <div className={`dashboard-screen p-6 ${isCompact ? "scale-50 origin-top-left w-[200%] h-[200%]" : ""}`}>
        <div className="grid grid-cols-3 gap-4 mb-6">
          {kpiCards.map((k) => (
            <div
              key={k.label}
              className="bg-slate-800/60 rounded-xl p-4 border border-slate-600/50"
            >
              <div className="text-slate-400 text-sm">{k.label}</div>
              <div className="text-2xl font-bold text-cyan-400">
                {k.value}
                {k.unit}
              </div>
            </div>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-6">
          <div className="bg-slate-800/40 rounded-xl p-4 border border-slate-600/30">
            <ReactECharts option={salesChart} style={{ height: 280 }} />
          </div>
          <div className="bg-slate-800/40 rounded-xl p-4 border border-slate-600/30">
            <ReactECharts option={pieChart} style={{ height: 280 }} />
          </div>
          <div className="col-span-2 bg-slate-800/40 rounded-xl p-4 border border-slate-600/30">
            <ReactECharts option={barChart} style={{ height: 260 }} />
          </div>
        </div>
      </div>
    );
  }

  if (templateId === "operations") {
    return (
      <div className={`dashboard-screen p-6 ${isCompact ? "scale-50 origin-top-left w-[200%] h-[200%]" : ""}`}>
        <div className="grid grid-cols-4 gap-4 mb-6">
          {["DAU", "转化率", "留存", "GMV"].map((label, i) => (
            <div
              key={label}
              className="bg-slate-800/60 rounded-xl p-4 border border-slate-600/50"
            >
              <div className="text-slate-400 text-sm">{label}</div>
              <div className="text-xl font-bold text-emerald-400">
                {[12500, "4.2%", "68%", "320万"][i]}
              </div>
            </div>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-6">
          <div className="bg-slate-800/40 rounded-xl p-4 border border-slate-600/30">
            <ReactECharts option={salesChart} style={{ height: 300 }} />
          </div>
          <div className="bg-slate-800/40 rounded-xl p-4 border border-slate-600/30">
            <ReactECharts option={barChart} style={{ height: 300 }} />
          </div>
        </div>
      </div>
    );
  }

  if (templateId === "finance") {
    return (
      <div className={`dashboard-screen p-6 ${isCompact ? "scale-50 origin-top-left w-[200%] h-[200%]" : ""}`}>
        <div className="grid grid-cols-3 gap-4 mb-6">
          {[
            { label: "总收入", value: "1,280万", color: "text-cyan-400" },
            { label: "总成本", value: "820万", color: "text-amber-400" },
            { label: "净利润", value: "460万", color: "text-emerald-400" },
          ].map((k) => (
            <div
              key={k.label}
              className="bg-slate-800/60 rounded-xl p-4 border border-slate-600/50"
            >
              <div className="text-slate-400 text-sm">{k.label}</div>
              <div className={`text-2xl font-bold ${k.color}`}>{k.value}</div>
            </div>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-6">
          <div className="bg-slate-800/40 rounded-xl p-4 border border-slate-600/30">
            <ReactECharts option={pieChart} style={{ height: 300 }} />
          </div>
          <div className="bg-slate-800/40 rounded-xl p-4 border border-slate-600/30">
            <ReactECharts option={salesChart} style={{ height: 300 }} />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`dashboard-screen p-6 ${isCompact ? "scale-50 origin-top-left w-[200%] h-[200%]" : ""}`}>
      <div className="grid grid-cols-2 gap-6">
        <div className="bg-slate-800/40 rounded-xl p-4 border border-slate-600/30">
          <ReactECharts option={salesChart} style={{ height: 280 }} />
        </div>
        <div className="bg-slate-800/40 rounded-xl p-4 border border-slate-600/30">
          <ReactECharts option={pieChart} style={{ height: 280 }} />
        </div>
      </div>
    </div>
  );
}
