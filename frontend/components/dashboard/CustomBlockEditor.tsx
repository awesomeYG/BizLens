"use client";

/**
 * CustomBlockEditor -- 自定义区块编辑器
 *
 * 提供可视化编辑器让用户配置自定义 ECharts 图表，包含：
 * - 基础配置：图表类型、标题、配色
 * - 数据配置：表单编辑 / JSON 编辑
 * - 高级配置：直接编辑 ECharts option
 * - 实时预览：所见即所得
 */

import { useState, useEffect, useCallback } from "react";
import ReactECharts from "echarts-for-react";
import type { SectionData, SeriesData, PieItem, FunnelItem, GaugeData, RadarSeriesData, ScatterSeries, RankingItem, TableData } from "@/lib/types";

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

// ==================== 图表类型定义 ====================

export type EditorChartType = "line" | "bar" | "pie" | "area" | "funnel" | "gauge" | "radar" | "scatter" | "heatmap" | "kpi" | "ranking" | "table";

const CHART_TYPE_OPTIONS: { value: EditorChartType; label: string; icon: string }[] = [
  { value: "line", label: "折线图", icon: "L" },
  { value: "bar", label: "柱状图", icon: "B" },
  { value: "pie", label: "饼图", icon: "P" },
  { value: "area", label: "面积图", icon: "A" },
  { value: "funnel", label: "漏斗图", icon: "F" },
  { value: "gauge", label: "仪表盘", icon: "G" },
  { value: "radar", label: "雷达图", icon: "D" },
  { value: "scatter", label: "散点图", icon: "S" },
  { value: "heatmap", label: "热力图", icon: "H" },
  { value: "kpi", label: "KPI 卡片", icon: "K" },
  { value: "ranking", label: "排行榜", icon: "R" },
  { value: "table", label: "表格", icon: "T" },
];

const COLOR_PRESETS = [
  { id: "科技蓝", value: "#38bdf8", secondary: "#0ea5e9" },
  { id: "活力橙", value: "#fb923c", secondary: "#f97316" },
  { id: "森林绿", value: "#34d399", secondary: "#10b981" },
  { id: "浪漫紫", value: "#a78bfa", secondary: "#8b5cf6" },
  { id: "玫瑰粉", value: "#f87171", secondary: "#ef4444" },
];

// ==================== ECharts Option 构建器 ====================

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
      progress: { show: true, width: 14, itemStyle: { color: gauge.color || "#38bdf8" } },
      axisLine: { lineStyle: { width: 14, color: [[1, "#1e293b"]] } },
      axisTick: { show: false },
      splitLine: { length: 8, lineStyle: { width: 2, color: "#334155" } },
      axisLabel: { color: "#64748b", fontSize: 10, distance: 20 },
      pointer: { length: "60%", width: 4, itemStyle: { color: gauge.color || "#38bdf8" } },
      anchor: { show: true, size: 12, itemStyle: { borderWidth: 2, borderColor: gauge.color || "#38bdf8", color: "#0f172a" } },
      title: { show: true, offsetCenter: [0, "70%"], color: "#94a3b8", fontSize: 12 },
      detail: {
        valueAnimation: true,
        fontSize: 24,
        fontWeight: "bold",
        color: gauge.color || "#38bdf8",
        offsetCenter: [0, "40%"],
        formatter: `{value}`,
      },
      data: [{ value: gauge.value, name: gauge.name }],
    }],
  };
}

function buildRadarOption(data: SectionData) {
  const indicator = (data.radarIndicator || data.categories || []).map((name: string) => ({
    name,
    max: 100,
  }));
  return {
    tooltip: { ...darkTooltip },
    legend: { ...darkLegend, data: data.radarSeries?.map((s) => s.name) || [] },
    radar: {
      indicator,
      splitNumber: 4,
      axisName: { color: "#94a3b8", fontSize: 11 },
      splitLine: { lineStyle: { color: "#1e293b" } },
      splitArea: { areaStyle: { color: ["#0f172a", "#0f172a"] } },
      axisLine: { lineStyle: { color: "#334155" } },
    },
    series: [{
      type: "radar",
      data: (data.radarSeries || []).map((s, i) => ({
        name: s.name,
        value: s.values,
        lineStyle: { color: COLORS[i % COLORS.length], width: 2 },
        areaStyle: { color: `${COLORS[i % COLORS.length]}30` },
        itemStyle: { color: COLORS[i % COLORS.length] },
        symbol: "circle",
        symbolSize: 4,
      })),
    }],
  };
}

function buildScatterOption(data: SectionData) {
  const seriesData = (data.scatterSeries || []).map((s, i) => ({
    name: s.name,
    type: "scatter",
    data: (s.values as any[]).map((v) => {
      if (Array.isArray(v)) return v as number[];
      return [v.x, v.y];
    }),
    itemStyle: { color: COLORS[i % COLORS.length] },
    symbolSize: 8,
  }));

  return {
    tooltip: { ...darkTooltip, trigger: "item", formatter: (params: any) => `${params.seriesName}: (${params.value[0]}, ${params.value[1]})` },
    legend: { ...darkLegend, data: data.scatterSeries?.map((s) => s.name) || [] },
    grid: { left: 12, right: 16, top: 40, bottom: 8, containLabel: true },
    xAxis: { type: "value", ...darkAxis, name: "X" },
    yAxis: { type: "value", ...darkAxis, name: "Y" },
    series: seriesData,
  };
}

function buildHeatmapOption(data: SectionData) {
  type HeatmapValue = number[] | { x: number; y: number; value: number };
  const seriesData = (data.heatmapSeries || data.scatterSeries || []).flatMap((s): number[][] =>
    (s.values as HeatmapValue[]).map((v) => {
      if (Array.isArray(v)) return v as number[];
      return [v.x, v.y, v.value];
    })
  );

  const xData = data.categories || ["类目"];
  const yData = data.radarIndicator || ["维度"];

  return {
    tooltip: { ...darkTooltip, position: "top" as const },
    grid: { left: 12, right: 16, top: 8, bottom: 12, containLabel: true },
    xAxis: {
      type: "category",
      data: xData,
      splitArea: { show: true, areaStyle: { color: ["#0f172a", "#0f172a"] } },
      ...darkAxis,
    },
    yAxis: {
      type: "category",
      data: yData,
      splitArea: { show: true, areaStyle: { color: ["#0f172a", "#0f172a"] } },
      ...darkAxis,
    },
    visualMap: {
      min: 0,
      max: Math.max(...seriesData.map((v) => v[2])),
      calculable: true,
      orient: "horizontal",
      left: "center",
      bottom: 0,
      inRange: { color: ["#1e293b", "#38bdf8", "#34d399"] },
      textStyle: { color: "#94a3b8", fontSize: 10 },
    },
    series: [{
      type: "heatmap",
      data: seriesData,
      label: { show: false },
      emphasis: {
        itemStyle: { shadowBlur: 10, shadowColor: "rgba(0,0,0,0.5)" },
      },
    }],
  };
}

function buildChartOption(chartType: EditorChartType, data: SectionData): Record<string, any> {
  switch (chartType) {
    case "line": return buildLineOption(data);
    case "area": return buildAreaOption(data);
    case "bar": return buildBarOption(data);
    case "pie": return buildPieOption(data);
    case "funnel": return buildFunnelOption(data);
    case "gauge": return buildGaugeOption(data);
    case "radar": return buildRadarOption(data);
    case "scatter": return buildScatterOption(data);
    case "heatmap": return buildHeatmapOption(data);
    default: return {};
  }
}

// ==================== 默认数据生成器 ====================

function getDefaultData(chartType: EditorChartType): SectionData {
  const months = ["1月", "2月", "3月", "4月", "5月", "6月"];
  switch (chartType) {
    case "line":
    case "area":
      return {
        categories: months,
        series: [
          { name: "本月", values: [120, 132, 101, 134, 90, 150] },
          { name: "上月", values: [95, 110, 88, 120, 85, 130] },
        ],
      };
    case "bar":
      return {
        categories: months,
        series: [
          { name: "销售额", values: [320, 302, 341, 374, 390, 450] },
          { name: "利润", values: [120, 132, 101, 134, 90, 150] },
        ],
      };
    case "pie":
      return {
        pieItems: [
          { name: "直接访问", value: 335 },
          { name: "搜索引擎", value: 580 },
          { name: "社交媒体", value: 234 },
          { name: "邮件营销", value: 135 },
          { name: "其他", value: 48 },
        ],
      };
    case "funnel":
      return {
        funnelItems: [
          { name: "访问", value: 100 },
          { name: "咨询", value: 60 },
          { name: "下单", value: 30 },
          { name: "支付", value: 20 },
          { name: "完成", value: 15 },
        ],
      };
    case "gauge":
      return {
        gaugeData: { name: "完成率", value: 72, min: 0, max: 100, color: "#38bdf8" },
      };
    case "radar":
      return {
        categories: ["销售", "营销", "技术", "运营", "客服", "财务"],
        radarIndicator: ["销售", "营销", "技术", "运营", "客服", "财务"],
        radarSeries: [
          { name: "当前", values: [80, 75, 65, 85, 60, 70] },
        ],
      };
    case "scatter":
      return {
        categories: months,
        scatterSeries: [
          {
            name: "数据点",
            values: [
              [120, 200], [132, 180], [101, 220], [134, 160],
              [90, 240], [150, 190],
            ] as any[],
          },
        ],
      };
    case "heatmap":
      return {
        categories: ["周一", "周二", "周三", "周四", "周五", "周六", "周日"],
        radarIndicator: ["访问量", "下单量", "支付量"],
        heatmapSeries: [
          {
            name: "热力数据",
            values: [
              [0, 0, 120], [0, 1, 340], [0, 2, 650],
              [1, 0, 230], [1, 1, 450], [1, 2, 800],
              [2, 0, 180], [2, 1, 320], [2, 2, 700],
            ] as any[],
          },
        ],
      };
    case "kpi":
      return {
        kpiItems: [
          { label: "总营收", value: "128.5万", unit: "元", trend: "up", trendValue: "+12.5%", color: "#38bdf8" },
          { label: "订单量", value: "3,842", trend: "up", trendValue: "+8.2%", color: "#34d399" },
          { label: "客单价", value: "334", unit: "元", trend: "down", trendValue: "-2.1%", color: "#fbbf24" },
          { label: "转化率", value: "3.6%", trend: "up", trendValue: "+0.4%", color: "#a78bfa" },
        ],
      };
    case "ranking":
      return {
        rankingItems: [
          { label: "产品 A", value: 1250, maxValue: 1500 },
          { label: "产品 B", value: 980, maxValue: 1500 },
          { label: "产品 C", value: 750, maxValue: 1500 },
          { label: "产品 D", value: 520, maxValue: 1500 },
          { label: "产品 E", value: 380, maxValue: 1500 },
        ],
      };
    case "table":
      return {
        tableData: {
          columns: ["名称", "数量", "金额", "占比"],
          rows: [
            ["产品A", 150, 45000, "35%"],
            ["产品B", 120, 36000, "28%"],
            ["产品C", 95, 28500, "22%"],
            ["产品D", 60, 18000, "15%"],
          ],
        },
      };
    default:
      return {};
  }
}

// ==================== Props ====================

export interface CustomBlockEditorProps {
  /** 初始数据配置 (来自 dataConfig) */
  initialData?: Record<string, any>;
  /** 初始 ECharts option (来自 chartConfig) */
  initialOption?: Record<string, any>;
  /** 图表类型 (来自 type 字段) */
  initialChartType?: EditorChartType;
  /** 区块标题 */
  title?: string;
  /** 变化回调 */
  onChange?: (dataConfig: Record<string, any>, chartConfig: Record<string, any>) => void;
}

// ==================== 主组件 ====================

type TabType = "basic" | "data" | "advanced";

export default function CustomBlockEditor({
  initialData,
  initialOption,
  initialChartType = "line",
  title = "自定义图表",
  onChange,
}: CustomBlockEditorProps) {
  const [activeTab, setActiveTab] = useState<TabType>("basic");
  const [chartType, setChartType] = useState<EditorChartType>(initialChartType);
  const [dataConfig, setDataConfig] = useState<SectionData>(
    (initialData as SectionData) || getDefaultData(initialChartType)
  );
  const [rawOption, setRawOption] = useState<string>(
    initialOption ? JSON.stringify(initialOption, null, 2) : ""
  );
  const [useRawOption, setUseRawOption] = useState(false);
  const [selectedColorPreset, setSelectedColorPreset] = useState(0);

  // 图表类型变化时，更新默认数据
  const handleChartTypeChange = useCallback((newType: EditorChartType) => {
    setChartType(newType);
    const newData = getDefaultData(newType);
    setDataConfig(newData);
    setRawOption("");
    setUseRawOption(false);
  }, []);

  // 数据变化时通知父组件
  useEffect(() => {
    if (!onChange) return;
    if (useRawOption && rawOption) {
      try {
        const parsed = JSON.parse(rawOption);
        onChange(dataConfig, parsed);
      } catch {
        onChange(dataConfig, {});
      }
    } else {
      const option = buildChartOption(chartType, dataConfig);
      onChange(dataConfig, option);
    }
  }, [dataConfig, chartType, rawOption, useRawOption, onChange]);

  // 构建预览 option
  const previewOption = useRawOption && rawOption
    ? (() => { try { return JSON.parse(rawOption); } catch { return {}; } })()
    : buildChartOption(chartType, dataConfig);

  // ==================== 数据编辑辅助函数 ====================

  const updateSeries = (index: number, field: keyof SeriesData, value: any) => {
    setDataConfig((prev) => ({
      ...prev,
      series: (prev.series || []).map((s, i) =>
        i === index ? { ...s, [field]: field === "values" ? (typeof value === "string" ? value.split(",").map((v: string) => parseFloat(v.trim()) || 0) : value) : value } : s
      ),
    }));
  };

  const updatePieItem = (index: number, field: keyof PieItem, value: any) => {
    setDataConfig((prev) => ({
      ...prev,
      pieItems: (prev.pieItems || []).map((item, i) =>
        i === index ? { ...item, [field]: field === "value" ? parseFloat(value) || 0 : value } : item
      ),
    }));
  };

  const updateFunnelItem = (index: number, field: keyof FunnelItem, value: any) => {
    setDataConfig((prev) => ({
      ...prev,
      funnelItems: (prev.funnelItems || []).map((item, i) =>
        i === index ? { ...item, [field]: field === "value" ? parseFloat(value) || 0 : value } : item
      ),
    }));
  };

  const updateKpiItem = (index: number, field: keyof any, value: any) => {
    setDataConfig((prev) => ({
      ...prev,
      kpiItems: (prev.kpiItems || []).map((item, i) =>
        i === index ? { ...item, [field]: value } : item
      ),
    }));
  };

  const updateRankingItem = (index: number, field: keyof RankingItem, value: any) => {
    setDataConfig((prev) => ({
      ...prev,
      rankingItems: (prev.rankingItems || []).map((item, i) =>
        i === index ? { ...item, [field]: field === "value" || field === "maxValue" ? parseFloat(value) || 0 : value } : item
      ),
    }));
  };

  const updateGaugeData = (field: keyof GaugeData, value: any) => {
    setDataConfig((prev) => ({
      ...prev,
      gaugeData: {
        name: prev.gaugeData?.name || "指标",
        value: prev.gaugeData?.value ?? 0,
        min: prev.gaugeData?.min,
        max: prev.gaugeData?.max,
        color: prev.gaugeData?.color,
        [field]: ["value", "min", "max"].includes(field) ? parseFloat(value) || 0 : value,
      } as GaugeData,
    }));
  };

  const updateTableData = (rowIndex: number, colIndex: number, value: any) => {
    setDataConfig((prev) => ({
      ...prev,
      tableData: {
        ...(prev.tableData || { columns: [], rows: [] }),
        rows: (prev.tableData?.rows || []).map((row, ri) =>
          ri === rowIndex
            ? row.map((cell, ci) => (ci === colIndex ? (colIndex === 1 || colIndex === 2 ? parseFloat(value) || 0 : value) : cell))
            : row
        ),
      },
    }));
  };

  // ==================== 渲染函数 ====================

  function renderDataEditor() {
    switch (chartType) {
      case "line":
      case "area":
      case "bar":
        return renderSeriesEditor();
      case "pie":
        return renderPieEditor();
      case "funnel":
        return renderFunnelEditor();
      case "gauge":
        return renderGaugeEditor();
      case "radar":
        return renderRadarEditor();
      case "scatter":
        return renderScatterEditor();
      case "heatmap":
        return renderHeatmapEditor();
      case "kpi":
        return renderKpiEditor();
      case "ranking":
        return renderRankingEditor();
      case "table":
        return renderTableEditor();
      default:
        return null;
    }
  }

  function renderSeriesEditor() {
    const series = dataConfig.series || [];
    const cats = dataConfig.categories?.join(", ") || "";
    return (
      <div className="space-y-4">
        {/* 类目轴 */}
        <div>
          <label className="block text-xs text-zinc-500 mb-1.5">类目 (X轴)</label>
          <input
            type="text"
            value={cats}
            onChange={(e) => setDataConfig((prev) => ({
              ...prev,
              categories: e.target.value.split(",").map((v) => v.trim()).filter(Boolean),
            }))}
            placeholder="1月, 2月, 3月, 4月"
            className="w-full px-3 py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-zinc-200 text-xs focus:outline-none focus:border-indigo-500"
          />
          <p className="text-[10px] text-zinc-600 mt-1">用逗号分隔，如：1月, 2月, 3月</p>
        </div>

        {/* 系列 */}
        {series.map((s, i) => (
          <div key={i} className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-3 space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-xs text-zinc-400 font-medium">系列 {i + 1}</span>
              <input
                type="text"
                value={s.name}
                onChange={(e) => updateSeries(i, "name", e.target.value)}
                placeholder="系列名称"
                className="flex-1 px-2 py-1 rounded bg-zinc-800 border border-zinc-700 text-zinc-200 text-xs focus:outline-none focus:border-indigo-500"
              />
              <button
                onClick={() => setDataConfig((prev) => ({
                  ...prev,
                  series: (prev.series || []).filter((_, idx) => idx !== i),
                }))}
                className="text-zinc-600 hover:text-red-400 text-xs px-2"
              >
                删除
              </button>
            </div>
            <div>
              <label className="block text-[10px] text-zinc-600 mb-1">数值 (逗号分隔)</label>
              <input
                type="text"
                value={s.values.join(", ")}
                onChange={(e) => updateSeries(i, "values", e.target.value)}
                placeholder="120, 132, 101, 134"
                className="w-full px-3 py-1.5 rounded bg-zinc-800 border border-zinc-700 text-zinc-200 text-xs focus:outline-none focus:border-indigo-500 font-mono"
              />
            </div>
          </div>
        ))}

        <button
          onClick={() => setDataConfig((prev) => ({
            ...prev,
            series: [...(prev.series || []), { name: `系列${(prev.series?.length || 0) + 1}`, values: [] }],
          }))}
          className="w-full py-2 rounded-lg border border-dashed border-zinc-700 text-zinc-500 text-xs hover:border-indigo-500/50 hover:text-indigo-400 transition-all"
        >
          + 添加系列
        </button>
      </div>
    );
  }

  function renderPieEditor() {
    const items = dataConfig.pieItems || [];
    return (
      <div className="space-y-3">
        {items.map((item, i) => (
          <div key={i} className="flex items-center gap-2">
            <span
              className="w-3 h-3 rounded-full flex-shrink-0"
              style={{ backgroundColor: COLORS[i % COLORS.length] }}
            />
            <input
              type="text"
              value={item.name}
              onChange={(e) => updatePieItem(i, "name", e.target.value)}
              placeholder="项目名称"
              className="flex-1 px-2 py-1 rounded bg-zinc-800 border border-zinc-700 text-zinc-200 text-xs focus:outline-none focus:border-indigo-500"
            />
            <input
              type="number"
              value={item.value}
              onChange={(e) => updatePieItem(i, "value", e.target.value)}
              placeholder="数值"
              className="w-24 px-2 py-1 rounded bg-zinc-800 border border-zinc-700 text-zinc-200 text-xs focus:outline-none focus:border-indigo-500"
            />
            <button
              onClick={() => setDataConfig((prev) => ({
                ...prev,
                pieItems: (prev.pieItems || []).filter((_, idx) => idx !== i),
              }))}
              className="text-zinc-600 hover:text-red-400 text-xs"
            >
              x
            </button>
          </div>
        ))}
        <button
          onClick={() => setDataConfig((prev) => ({
            ...prev,
            pieItems: [...(prev.pieItems || []), { name: `项目${(prev.pieItems?.length || 0) + 1}`, value: 0 }],
          }))}
          className="w-full py-2 rounded-lg border border-dashed border-zinc-700 text-zinc-500 text-xs hover:border-indigo-500/50 hover:text-indigo-400 transition-all"
        >
          + 添加数据项
        </button>
      </div>
    );
  }

  function renderFunnelEditor() {
    const items = dataConfig.funnelItems || [];
    return (
      <div className="space-y-3">
        {items.map((item, i) => (
          <div key={i} className="flex items-center gap-2">
            <span
              className="w-3 h-3 rounded-sm flex-shrink-0"
              style={{ backgroundColor: COLORS[i % COLORS.length] }}
            />
            <input
              type="text"
              value={item.name}
              onChange={(e) => updateFunnelItem(i, "name", e.target.value)}
              placeholder="阶段名称"
              className="flex-1 px-2 py-1 rounded bg-zinc-800 border border-zinc-700 text-zinc-200 text-xs focus:outline-none focus:border-indigo-500"
            />
            <input
              type="number"
              value={item.value}
              onChange={(e) => updateFunnelItem(i, "value", e.target.value)}
              placeholder="数值"
              className="w-24 px-2 py-1 rounded bg-zinc-800 border border-zinc-700 text-zinc-200 text-xs focus:outline-none focus:border-indigo-500"
            />
            <button
              onClick={() => setDataConfig((prev) => ({
                ...prev,
                funnelItems: (prev.funnelItems || []).filter((_, idx) => idx !== i),
              }))}
              className="text-zinc-600 hover:text-red-400 text-xs"
            >
              x
            </button>
          </div>
        ))}
        <button
          onClick={() => setDataConfig((prev) => ({
            ...prev,
            funnelItems: [...(prev.funnelItems || []), { name: "新阶段", value: 0 }],
          }))}
          className="w-full py-2 rounded-lg border border-dashed border-zinc-700 text-zinc-500 text-xs hover:border-indigo-500/50 hover:text-indigo-400 transition-all"
        >
          + 添加阶段
        </button>
      </div>
    );
  }

  function renderGaugeEditor() {
    const gauge = dataConfig.gaugeData || { name: "完成率", value: 0, min: 0, max: 100 };
    return (
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-zinc-500 mb-1.5">指标名称</label>
            <input
              type="text"
              value={gauge.name || ""}
              onChange={(e) => updateGaugeData("name", e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-zinc-200 text-xs focus:outline-none focus:border-indigo-500"
            />
          </div>
          <div>
            <label className="block text-xs text-zinc-500 mb-1.5">当前值</label>
            <input
              type="number"
              value={gauge.value ?? 0}
              onChange={(e) => updateGaugeData("value", e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-zinc-200 text-xs focus:outline-none focus:border-indigo-500"
            />
          </div>
          <div>
            <label className="block text-xs text-zinc-500 mb-1.5">最小值</label>
            <input
              type="number"
              value={gauge.min ?? 0}
              onChange={(e) => updateGaugeData("min", e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-zinc-200 text-xs focus:outline-none focus:border-indigo-500"
            />
          </div>
          <div>
            <label className="block text-xs text-zinc-500 mb-1.5">最大值</label>
            <input
              type="number"
              value={gauge.max ?? 100}
              onChange={(e) => updateGaugeData("max", e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-zinc-200 text-xs focus:outline-none focus:border-indigo-500"
            />
          </div>
        </div>
      </div>
    );
  }

  function renderRadarEditor() {
    const indicator = dataConfig.radarIndicator || dataConfig.categories || [];
    const series = dataConfig.radarSeries || [];
    return (
      <div className="space-y-4">
        <div>
          <label className="block text-xs text-zinc-500 mb-1.5">维度 (逗号分隔)</label>
          <input
            type="text"
            value={indicator.join(", ")}
            onChange={(e) => setDataConfig((prev) => ({
              ...prev,
              radarIndicator: e.target.value.split(",").map((v) => v.trim()).filter(Boolean),
              categories: e.target.value.split(",").map((v) => v.trim()).filter(Boolean),
            }))}
            placeholder="销售, 营销, 技术, 运营"
            className="w-full px-3 py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-zinc-200 text-xs focus:outline-none focus:border-indigo-500"
          />
        </div>
        {series.map((s, i) => (
          <div key={i} className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-3 space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-xs text-zinc-400 font-medium">系列 {i + 1}</span>
              <input
                type="text"
                value={s.name}
                onChange={(e) => setDataConfig((prev) => ({
                  ...prev,
                  radarSeries: (prev.radarSeries || []).map((rs, idx) =>
                    idx === i ? { ...rs, name: e.target.value } : rs
                  ),
                }))}
                placeholder="系列名称"
                className="flex-1 px-2 py-1 rounded bg-zinc-800 border border-zinc-700 text-zinc-200 text-xs focus:outline-none focus:border-indigo-500"
              />
            </div>
            <div>
              <label className="block text-[10px] text-zinc-600 mb-1">数值 (逗号分隔，顺序对应维度)</label>
              <input
                type="text"
                value={s.values.join(", ")}
                onChange={(e) => setDataConfig((prev) => ({
                  ...prev,
                  radarSeries: (prev.radarSeries || []).map((rs, idx) =>
                    idx === i
                      ? { ...rs, values: e.target.value.split(",").map((v) => Math.min(100, Math.max(0, parseFloat(v.trim()) || 0))) }
                      : rs
                  ),
                }))}
                placeholder="80, 75, 65, 85"
                className="w-full px-3 py-1.5 rounded bg-zinc-800 border border-zinc-700 text-zinc-200 text-xs focus:outline-none focus:border-indigo-500 font-mono"
              />
            </div>
          </div>
        ))}
        <button
          onClick={() => setDataConfig((prev) => ({
            ...prev,
            radarSeries: [...(prev.radarSeries || []), { name: `系列${(prev.radarSeries?.length || 0) + 1}`, values: [] }],
          }))}
          className="w-full py-2 rounded-lg border border-dashed border-zinc-700 text-zinc-500 text-xs hover:border-indigo-500/50 hover:text-indigo-400 transition-all"
        >
          + 添加系列
        </button>
      </div>
    );
  }

  function renderScatterEditor() {
    const series = dataConfig.scatterSeries || [];
    return (
      <div className="space-y-4">
        <p className="text-xs text-zinc-600">每个数据点格式: x值,y值，用逗号分隔多个点</p>
        {series.map((s, i) => (
          <div key={i} className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-3 space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-xs text-zinc-400 font-medium">系列 {i + 1}</span>
              <input
                type="text"
                value={s.name}
                onChange={(e) => setDataConfig((prev) => ({
                  ...prev,
                  scatterSeries: (prev.scatterSeries || []).map((ss, idx) =>
                    idx === i ? { ...ss, name: e.target.value } : ss
                  ),
                }))}
                placeholder="系列名称"
                className="flex-1 px-2 py-1 rounded bg-zinc-800 border border-zinc-700 text-zinc-200 text-xs focus:outline-none focus:border-indigo-500"
              />
            </div>
            <div>
              <label className="block text-[10px] text-zinc-600 mb-1">数据点 (逗号分隔，每点格式: x,y)</label>
              <textarea
                value={(s.values as unknown as number[][]).map((v) => v.join(",")).join(" | ")}
                onChange={(e) => setDataConfig((prev) => ({
                  ...prev,
                  scatterSeries: (prev.scatterSeries || []).map((ss, idx) =>
                    idx === i
                      ? {
                          ...ss,
                          values: e.target.value.split("|").map((v) => v.split(",").map((n) => parseFloat(n.trim()) || 0) as [number, number]).filter((pair) => pair.length === 2) as any[],
                        }
                      : ss
                  ),
                }))}
                placeholder="120,200 | 132,180 | 101,220"
                rows={2}
                className="w-full px-3 py-1.5 rounded bg-zinc-800 border border-zinc-700 text-zinc-200 text-xs focus:outline-none focus:border-indigo-500 font-mono resize-none"
              />
            </div>
          </div>
        ))}
      </div>
    );
  }

  function renderHeatmapEditor() {
    const xData = dataConfig.categories || [];
    const yData = dataConfig.radarIndicator || [];
    const series = dataConfig.heatmapSeries || [];
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-zinc-500 mb-1.5">X轴类目 (逗号分隔)</label>
            <input
              type="text"
              value={xData.join(", ")}
              onChange={(e) => setDataConfig((prev) => ({
                ...prev,
                categories: e.target.value.split(",").map((v) => v.trim()).filter(Boolean),
              }))}
              placeholder="周一, 周二, 周三"
              className="w-full px-3 py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-zinc-200 text-xs focus:outline-none focus:border-indigo-500"
            />
          </div>
          <div>
            <label className="block text-xs text-zinc-500 mb-1.5">Y轴类目 (逗号分隔)</label>
            <input
              type="text"
              value={yData.join(", ")}
              onChange={(e) => setDataConfig((prev) => ({
                ...prev,
                radarIndicator: e.target.value.split(",").map((v) => v.trim()).filter(Boolean),
              }))}
              placeholder="访问量, 下单量"
              className="w-full px-3 py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-zinc-200 text-xs focus:outline-none focus:border-indigo-500"
            />
          </div>
        </div>
        <p className="text-xs text-zinc-600">数据格式: x索引,y索引,数值，用逗号分隔多个点</p>
        {series.map((s, i) => (
          <div key={i} className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-3 space-y-2">
            <span className="text-xs text-zinc-400 font-medium">热力数据</span>
            <textarea
              value={(s.values as unknown as number[][]).map((v) => v.join(",")).join(" | ")}
              onChange={(e) => setDataConfig((prev) => ({
                ...prev,
                heatmapSeries: (prev.heatmapSeries || []).map((hs, idx) =>
                  idx === i
                    ? {
                        ...hs,
                        values: e.target.value.split("|").map((v) => v.split(",").map((n) => parseFloat(n.trim()) || 0)).filter((arr) => arr.length >= 2) as any[],
                      }
                    : hs
                ),
              }))}
              placeholder="0,0,120 | 0,1,340 | 0,2,650"
              rows={2}
              className="w-full px-3 py-1.5 rounded bg-zinc-800 border border-zinc-700 text-zinc-200 text-xs focus:outline-none focus:border-indigo-500 font-mono resize-none"
            />
          </div>
        ))}
      </div>
    );
  }

  function renderKpiEditor() {
    const items = dataConfig.kpiItems || [];
    return (
      <div className="space-y-3">
        {items.map((item, i) => (
          <div key={i} className="grid grid-cols-4 gap-2 items-center">
            <input
              type="text"
              value={item.label}
              onChange={(e) => updateKpiItem(i, "label", e.target.value)}
              placeholder="指标名称"
              className="px-2 py-1 rounded bg-zinc-800 border border-zinc-700 text-zinc-200 text-xs focus:outline-none focus:border-indigo-500"
            />
            <input
              type="text"
              value={item.value}
              onChange={(e) => updateKpiItem(i, "value", e.target.value)}
              placeholder="数值"
              className="px-2 py-1 rounded bg-zinc-800 border border-zinc-700 text-zinc-200 text-xs focus:outline-none focus:border-indigo-500"
            />
            <input
              type="text"
              value={item.unit || ""}
              onChange={(e) => updateKpiItem(i, "unit", e.target.value)}
              placeholder="单位(元/个/%)"
              className="px-2 py-1 rounded bg-zinc-800 border border-zinc-700 text-zinc-200 text-xs focus:outline-none focus:border-indigo-500"
            />
            <div className="flex items-center gap-1">
              <input
                type="color"
                value={item.color || COLORS[i % COLORS.length]}
                onChange={(e) => updateKpiItem(i, "color", e.target.value)}
                className="w-8 h-7 rounded cursor-pointer bg-transparent border border-zinc-700"
              />
              <button
                onClick={() => setDataConfig((prev) => ({
                  ...prev,
                  kpiItems: (prev.kpiItems || []).filter((_, idx) => idx !== i),
                }))}
                className="text-zinc-600 hover:text-red-400 text-xs"
              >
                x
              </button>
            </div>
          </div>
        ))}
        <button
          onClick={() => setDataConfig((prev) => ({
            ...prev,
            kpiItems: [...(prev.kpiItems || []), {
              label: `指标${(prev.kpiItems?.length || 0) + 1}`,
              value: "--",
              color: COLORS[(prev.kpiItems?.length || 0) % COLORS.length],
            }],
          }))}
          className="w-full py-2 rounded-lg border border-dashed border-zinc-700 text-zinc-500 text-xs hover:border-indigo-500/50 hover:text-indigo-400 transition-all"
        >
          + 添加 KPI 指标
        </button>
      </div>
    );
  }

  function renderRankingEditor() {
    const items = dataConfig.rankingItems || [];
    return (
      <div className="space-y-3">
        {items.map((item, i) => (
          <div key={i} className="grid grid-cols-3 gap-2 items-center">
            <input
              type="text"
              value={item.label}
              onChange={(e) => updateRankingItem(i, "label", e.target.value)}
              placeholder="名称"
              className="px-2 py-1 rounded bg-zinc-800 border border-zinc-700 text-zinc-200 text-xs focus:outline-none focus:border-indigo-500"
            />
            <input
              type="number"
              value={item.value}
              onChange={(e) => updateRankingItem(i, "value", e.target.value)}
              placeholder="数值"
              className="px-2 py-1 rounded bg-zinc-800 border border-zinc-700 text-zinc-200 text-xs focus:outline-none focus:border-indigo-500"
            />
            <div className="flex items-center gap-1">
              <input
                type="number"
                value={item.maxValue || 100}
                onChange={(e) => updateRankingItem(i, "maxValue", e.target.value)}
                placeholder="最大值"
                className="w-16 px-2 py-1 rounded bg-zinc-800 border border-zinc-700 text-zinc-200 text-xs focus:outline-none focus:border-indigo-500"
              />
              <button
                onClick={() => setDataConfig((prev) => ({
                  ...prev,
                  rankingItems: (prev.rankingItems || []).filter((_, idx) => idx !== i),
                }))}
                className="text-zinc-600 hover:text-red-400 text-xs"
              >
                x
              </button>
            </div>
          </div>
        ))}
        <button
          onClick={() => setDataConfig((prev) => ({
            ...prev,
            rankingItems: [...(prev.rankingItems || []), { label: `排名${(prev.rankingItems?.length || 0) + 1}`, value: 0, maxValue: 100 }],
          }))}
          className="w-full py-2 rounded-lg border border-dashed border-zinc-700 text-zinc-500 text-xs hover:border-indigo-500/50 hover:text-indigo-400 transition-all"
        >
          + 添加排名项
        </button>
      </div>
    );
  }

  function renderTableEditor() {
    const tableData = dataConfig.tableData || { columns: [], rows: [] };
    return (
      <div className="space-y-3">
        <div>
          <label className="block text-xs text-zinc-500 mb-1.5">列名 (逗号分隔)</label>
          <input
            type="text"
            value={tableData.columns.join(", ")}
            onChange={(e) => setDataConfig((prev) => ({
              ...prev,
              tableData: {
                ...(prev.tableData || { columns: [], rows: [] }),
                columns: e.target.value.split(",").map((v) => v.trim()).filter(Boolean),
              },
            }))}
            placeholder="名称, 数量, 金额, 占比"
            className="w-full px-3 py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-zinc-200 text-xs focus:outline-none focus:border-indigo-500"
          />
        </div>
        <div>
          <label className="block text-xs text-zinc-500 mb-1.5">数据行 (每行逗号分隔，回车换行)</label>
          <textarea
            value={tableData.rows.map((r) => r.join(",")).join("\n")}
            onChange={(e) => setDataConfig((prev) => ({
              ...prev,
              tableData: {
                ...(prev.tableData || { columns: [], rows: [] }),
                rows: e.target.value.split("\n").map((line) => line.split(",").map((v) => v.trim())).filter((row) => row.some((c) => c)),
              },
            }))}
            placeholder={"产品A, 150, 45000, 35%\n产品B, 120, 36000, 28%"}
            rows={5}
            className="w-full px-3 py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-zinc-200 text-xs focus:outline-none focus:border-indigo-500 font-mono resize-none"
          />
        </div>
      </div>
    );
  }

  // ==================== KPI 卡片预览渲染 ====================

  function renderKpiPreview() {
    const items = dataConfig.kpiItems || [];
    return (
      <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${Math.min(items.length, 4)}, 1fr)` }}>
        {items.map((item, i) => (
          <div
            key={i}
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
                  {item.trend === "up" ? "\u2191" : item.trend === "down" ? "\u2193" : "\u2192"}
                </span>
                <span>{item.trendValue}</span>
              </div>
            )}
          </div>
        ))}
      </div>
    );
  }

  function renderRankingPreview() {
    const items = dataConfig.rankingItems || [];
    const maxVal = Math.max(...items.map((i) => i.maxValue || i.value));
    return (
      <div className="space-y-3">
        {items.map((item, idx) => (
          <div key={idx} className="space-y-1">
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

  function renderTablePreview() {
    const tableData = dataConfig.tableData;
    if (!tableData) return null;
    return (
      <div className="overflow-auto max-h-full">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-white/10">
              {tableData.columns.map((col) => (
                <th key={col} className="text-left py-2 px-2 text-zinc-400 font-medium">{col}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {tableData.rows.map((row, ri) => (
              <tr key={ri} className="border-b border-white/5 hover:bg-white/[0.02]">
                {row.map((cell, ci) => (
                  <td key={ci} className="py-1.5 px-2 text-zinc-300">{cell}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  // ==================== 渲染 ====================

  return (
    <div className="rounded-xl border border-indigo-500/20 bg-indigo-950/10 overflow-hidden">
      {/* Tab 导航 */}
      <div className="flex border-b border-zinc-800">
        {([
          { id: "basic" as TabType, label: "基础配置" },
          { id: "data" as TabType, label: "数据配置" },
          { id: "advanced" as TabType, label: "高级配置" },
        ]).map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-5 py-2.5 text-xs font-medium transition-all border-b-2 -mb-px ${
              activeTab === tab.id
                ? "text-indigo-400 border-indigo-500"
                : "text-zinc-500 border-transparent hover:text-zinc-300"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="flex">
        {/* 左侧编辑面板 */}
        <div className="flex-1 p-4 space-y-4 max-h-[480px] overflow-y-auto">
          {activeTab === "basic" && (
            <div className="space-y-4">
              {/* 图表类型 */}
              <div>
                <label className="block text-xs text-zinc-500 mb-2">图表类型</label>
                <div className="grid grid-cols-4 gap-1.5">
                  {CHART_TYPE_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => handleChartTypeChange(opt.value)}
                      className={`flex flex-col items-center gap-1 p-2 rounded-lg border text-xs transition-all ${
                        chartType === opt.value
                          ? "border-indigo-500/50 bg-indigo-500/10 text-indigo-400"
                          : "border-zinc-800 bg-zinc-900/50 text-zinc-400 hover:border-zinc-700"
                      }`}
                    >
                      <span className="w-6 h-6 rounded bg-zinc-800 flex items-center justify-center text-[10px] font-bold">
                        {opt.icon}
                      </span>
                      <span className="text-[10px] leading-tight text-center">{opt.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* 配色方案 */}
              <div>
                <label className="block text-xs text-zinc-500 mb-2">配色方案</label>
                <div className="flex gap-2">
                  {COLOR_PRESETS.map((preset, i) => (
                    <button
                      key={preset.id}
                      onClick={() => setSelectedColorPreset(i)}
                      className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs transition-all ${
                        selectedColorPreset === i
                          ? "border-indigo-500/50 bg-indigo-500/10"
                          : "border-zinc-800 bg-zinc-900/50 hover:border-zinc-700"
                      }`}
                    >
                      <span
                        className="w-3 h-3 rounded-full"
                        style={{ background: `linear-gradient(135deg, ${preset.value}, ${preset.secondary})` }}
                      />
                      <span className="text-zinc-400">{preset.id}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {activeTab === "data" && (
            <div className="space-y-4">
              {/* 数据模式切换 */}
              <div className="flex gap-2">
                <button
                  onClick={() => setUseRawOption(false)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    !useRawOption
                      ? "bg-indigo-600 text-white"
                      : "bg-zinc-800 text-zinc-400 hover:text-zinc-300"
                  }`}
                >
                  表单编辑
                </button>
                <button
                  onClick={() => setUseRawOption(true)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    useRawOption
                      ? "bg-indigo-600 text-white"
                      : "bg-zinc-800 text-zinc-400 hover:text-zinc-300"
                  }`}
                >
                  JSON 编辑
                </button>
              </div>

              {!useRawOption ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-zinc-400 font-medium">
                      {CHART_TYPE_OPTIONS.find((c) => c.value === chartType)?.label || "图表"} 数据
                    </span>
                  </div>
                  {renderDataEditor()}
                </div>
              ) : (
                <div className="space-y-2">
                  <label className="block text-xs text-zinc-500">JSON 数据</label>
                  <textarea
                    value={JSON.stringify(dataConfig, null, 2)}
                    onChange={(e) => {
                      try {
                        setDataConfig(JSON.parse(e.target.value));
                      } catch {
                        /* 暂时忽略格式错误 */
                      }
                    }}
                    placeholder='{"categories": [...], "series": [...]}'
                    rows={12}
                    className="w-full px-3 py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-zinc-200 text-xs focus:outline-none focus:border-indigo-500 font-mono resize-none"
                  />
                </div>
              )}
            </div>
          )}

          {activeTab === "advanced" && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-xs text-zinc-500">ECharts Option (JSON)</label>
                <span className="text-[10px] text-zinc-600">覆盖表单配置</span>
              </div>
              <textarea
                value={rawOption}
                onChange={(e) => {
                  setRawOption(e.target.value);
                  setUseRawOption(true);
                }}
                placeholder={`{\n  "tooltip": {...},\n  "xAxis": {...},\n  "yAxis": {...},\n  "series": [...]\n}`}
                rows={16}
                className="w-full px-3 py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-zinc-200 text-xs focus:outline-none focus:border-indigo-500 font-mono resize-none"
              />
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    const opt = buildChartOption(chartType, dataConfig);
                    setRawOption(JSON.stringify(opt, null, 2));
                  }}
                  className="px-3 py-1.5 rounded-lg bg-zinc-800 border border-zinc-700 text-zinc-400 text-xs hover:text-zinc-200 hover:border-zinc-600 transition-all"
                >
                  从表单生成
                </button>
                <button
                  onClick={() => {
                    setRawOption("");
                    setUseRawOption(false);
                  }}
                  className="px-3 py-1.5 rounded-lg bg-zinc-800 border border-zinc-700 text-zinc-400 text-xs hover:text-zinc-200 hover:border-zinc-600 transition-all"
                >
                  重置
                </button>
              </div>
            </div>
          )}
        </div>

        {/* 右侧实时预览 */}
        <div className="w-72 border-l border-zinc-800 flex flex-col">
          <div className="px-3 py-2 border-b border-zinc-800">
            <span className="text-[10px] text-zinc-600 uppercase tracking-wider">实时预览</span>
          </div>
          <div className="flex-1 p-3 min-h-0">
            <div className="h-full rounded-lg border border-white/[0.06] bg-white/[0.02] overflow-hidden flex flex-col">
              {title && (
                <div className="px-3 pt-2 pb-1">
                  <h3 className="text-xs font-semibold text-zinc-100">{title}</h3>
                </div>
              )}
              <div className="flex-1 px-2 pb-2 min-h-0">
                {/* KPI 卡片特殊处理 */}
                {chartType === "kpi" && renderKpiPreview()}

                {/* 排行榜特殊处理 */}
                {chartType === "ranking" && renderRankingPreview()}

                {/* 表格特殊处理 */}
                {chartType === "table" && renderTablePreview()}

                {/* 其他图表用 ECharts */}
                {chartType !== "kpi" && chartType !== "ranking" && chartType !== "table" && (
                  <ReactECharts
                    option={previewOption}
                    style={{ height: "100%", width: "100%" }}
                    opts={{ renderer: "canvas" }}
                  />
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
