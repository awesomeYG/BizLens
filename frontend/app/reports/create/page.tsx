"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { getCurrentUser } from "@/lib/user-store";
import { request } from "@/lib/auth/api";
import AppHeader from "@/components/AppHeader";
import SectionRenderer from "@/components/dashboard/SectionRenderer";
import CustomBlockEditor from "@/components/dashboard/CustomBlockEditor";
import type {
  Report,
  CreateReportRequest,
  CreateReportSectionRequest,
  DashboardSectionType,
  DashboardSection,
  SectionData,
} from "@/lib/types";

const REPORT_TYPES = [
  { id: "custom", name: "自定义" },
  { id: "daily", name: "日报" },
  { id: "weekly", name: "周报" },
  { id: "monthly", name: "月报" },
  { id: "realtime", name: "实时" },
];

const REPORT_CATEGORIES = [
  { id: "custom", name: "自定义" },
  { id: "sales", name: "销售" },
  { id: "finance", name: "财务" },
  { id: "operations", name: "运营" },
  { id: "marketing", name: "营销" },
];

// SECTION_TYPE_INFO 从 types.ts 中的 DashboardSectionType 枚举动态映射，
// 避免与 SectionRenderer 支持的区块类型不一致。
// 列表来源：backend/internal/model/section_type.go AllSectionTypes
const SECTION_TYPE_INFO: { id: DashboardSectionType; name: string; icon: string; category: "basic" | "advanced" }[] = [
  { id: "kpi",     name: "KPI 卡片", icon: "K", category: "basic" },
  { id: "line",    name: "折线图", icon: "L", category: "basic" },
  { id: "bar",     name: "柱状图", icon: "B", category: "basic" },
  { id: "pie",     name: "饼图",   icon: "P", category: "basic" },
  { id: "area",    name: "面积图", icon: "A", category: "basic" },
  { id: "table",   name: "表格",   icon: "T", category: "basic" },
  { id: "funnel",  name: "漏斗图", icon: "F", category: "basic" },
  { id: "gauge",   name: "仪表盘", icon: "G", category: "basic" },
  { id: "ranking", name: "排行榜", icon: "R", category: "basic" },
  { id: "trend",   name: "趋势图", icon: "N", category: "basic" },
  { id: "radar",   name: "雷达图", icon: "D", category: "advanced" },
  { id: "scatter", name: "散点图", icon: "S", category: "advanced" },
  { id: "heatmap", name: "热力图", icon: "H", category: "advanced" },
  { id: "map",     name: "地图",   icon: "M", category: "advanced" },
  { id: "insight", name: "AI 洞察", icon: "I", category: "advanced" },
  { id: "alert",   name: "告警",   icon: "!", category: "advanced" },
  { id: "custom",  name: "自定义", icon: "+", category: "advanced" },
];

/** 生成示例数据 */
function generateSampleData(type: DashboardSectionType): Record<string, any> {
  const months = ["1月", "2月", "3月", "4月", "5月", "6月"];

  switch (type) {
    case "kpi":
      return {
        kpiItems: [
          { label: "总营收", value: "128.5万", unit: "元", trend: "up", trendValue: "+12.5%", color: "#38bdf8" },
          { label: "订单量", value: "3,842", trend: "up", trendValue: "+8.2%", color: "#34d399" },
          { label: "客单价", value: "334", unit: "元", trend: "down", trendValue: "-2.1%", color: "#fbbf24" },
          { label: "转化率", value: "3.6%", trend: "up", trendValue: "+0.4%", color: "#a78bfa" },
        ],
      };
    case "line":
    case "area":
    case "trend":
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
        gaugeData: { name: "完成率", value: 72, min: 0, max: 100 },
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
    case "radar":
      return {
        categories: ["销售", "营销", "技术", "运营", "客服", "财务"],
        series: [{
          name: "当前",
          values: [80, 75, 65, 85, 60, 70],
        }],
      };
    case "scatter":
      return {
        categories: months,
        series: [{
          name: "数据点",
          values: [
            [120, 200], [132, 180], [101, 220], [134, 160],
            [90, 240], [150, 190],
          ],
        }],
      };
    case "heatmap":
      return {
        categories: ["周一", "周二", "周三", "周四", "周五", "周六", "周日"],
        series: [{
          name: "访问量",
          values: [
            [120, 340, 650], [230, 450, 800], [180, 320, 700],
            [300, 500, 900], [280, 420, 750], [150, 300, 600], [80, 150, 300],
          ],
        }],
      };
    case "map":
      return {
        pieItems: [
          { name: "华东", value: 420 },
          { name: "华北", value: 280 },
          { name: "华南", value: 350 },
          { name: "西南", value: 180 },
          { name: "西北", value: 90 },
        ],
      };
    case "insight":
      return {
        kpiItems: [
          { label: "发现", value: "3", trend: "up", trendValue: "+2", color: "#38bdf8" },
          { label: "异常", value: "1", trend: "down", trendValue: "-1", color: "#f87171" },
          { label: "建议", value: "5", trend: "up", trendValue: "+3", color: "#34d399" },
        ],
      };
    case "alert":
      return {
        kpiItems: [
          { label: "活跃告警", value: "2", trend: "down", trendValue: "-1", color: "#f87171" },
          { label: "已确认", value: "3", trend: "flat", trendValue: "0", color: "#fbbf24" },
          { label: "已恢复", value: "8", trend: "up", trendValue: "+5", color: "#34d399" },
        ],
      };
    case "custom":
      return {
        kpiItems: [
          { label: "自定义指标", value: "--", color: "#38bdf8" },
        ],
      };
    default:
      return {};
  }
}

export default function ReportCreatePage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-zinc-950" />}>
      <ReportCreateContent />
    </Suspense>
  );
}

function ReportCreateContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const editId = searchParams.get("edit");
  const isEditing = !!editId;

  const [tenantId, setTenantId] = useState("");
  const [saving, setSaving] = useState(false);
  const [loadingEdit, setLoadingEdit] = useState(false);

  // 表单状态
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [type, setType] = useState("custom");
  const [category, setCategory] = useState("custom");
  const [sections, setSections] = useState<CreateReportSectionRequest[]>([]);

  // 预览模式
  const [showPreview, setShowPreview] = useState(false);

  useEffect(() => {
    const user = getCurrentUser();
    if (!user) {
      router.replace("/auth/login");
      return;
    }
    setTenantId(user.id?.split("@")[0] || "demo");
  }, [router]);

  // 加载编辑模式数据
  useEffect(() => {
    if (!editId || !tenantId) return;
    setLoadingEdit(true);
    request<Report>(`/tenants/${tenantId}/reports/${editId}`)
      .then((data) => {
        setTitle(data.title);
        setDescription(data.description || "");
        setType(data.type || "custom");
        setCategory(data.category || "custom");
        if (data.sections) {
          setSections(
            data.sections.map((s) => ({
              type: s.type as DashboardSectionType,
              title: s.title || "",
              metrics: s.metrics,
              dimensions: s.dimensions,
              chartConfig: s.chartConfig,
              dataConfig: s.dataConfig,
              sortOrder: s.sortOrder,
              colSpan: s.colSpan || 12,
              rowSpan: s.rowSpan || 1,
              timeGrain: s.timeGrain,
              topN: s.topN,
              comparison: s.comparison,
              filterExpr: s.filterExpr,
            }))
          );
        }
      })
      .catch((err) => {
        console.error("加载报表失败:", err);
      })
      .finally(() => setLoadingEdit(false));
  }, [editId, tenantId]);

  const addSection = (chartType: DashboardSectionType) => {
    const newSection: CreateReportSectionRequest = {
      type: chartType,
      title: SECTION_TYPE_INFO.find((c) => c.id === chartType)?.name || "新区块",
      colSpan: chartType === "kpi" ? 12 : 6,
      rowSpan: 1,
      sortOrder: sections.length,
      dataConfig: generateSampleData(chartType),
    };
    setSections((prev) => [...prev, newSection]);
  };

  const updateSection = (index: number, updates: Partial<CreateReportSectionRequest>) => {
    setSections((prev) =>
      prev.map((s, i) => (i === index ? { ...s, ...updates } : s))
    );
  };

  const removeSection = (index: number) => {
    setSections((prev) => prev.filter((_, i) => i !== index));
  };

  const moveSection = (index: number, direction: "up" | "down") => {
    const newIndex = direction === "up" ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= sections.length) return;
    setSections((prev) => {
      const arr = [...prev];
      [arr[index], arr[newIndex]] = [arr[newIndex], arr[index]];
      return arr.map((s, i) => ({ ...s, sortOrder: i }));
    });
  };

  const handleSave = async () => {
    if (!title.trim()) return;
    setSaving(true);
    try {
      if (isEditing) {
        await request(`/tenants/${tenantId}/reports/${editId}`, {
          method: "PUT",
          body: JSON.stringify({
            title,
            description,
            type,
            category,
            sections,
          }),
        });
        router.push(`/reports/${editId}`);
      } else {
        const req: CreateReportRequest = {
          title,
          description,
          type: type as any,
          category,
          sections,
        };
        const created = await request<Report>(
          `/tenants/${tenantId}/reports`,
          {
            method: "POST",
            body: JSON.stringify(req),
          }
        );
        router.push(`/reports/${created.id}`);
      }
    } catch (err) {
      console.error("保存报表失败:", err);
    } finally {
      setSaving(false);
    }
  };

  // 转换为预览用的 DashboardSection
  const previewSections: DashboardSection[] = sections.map((s, i) => ({
    id: `preview-${i}`,
    type: s.type as DashboardSection["type"],
    title: s.title,
    colSpan: s.colSpan || 12,
    rowSpan: s.rowSpan || 1,
    priority: i,
    data: s.dataConfig as SectionData | undefined,
  }));

  if (loadingEdit) {
    return (
      <div className="min-h-screen bg-zinc-950">
        <AppHeader title="加载中..." backHref="/reports" />
        <main className="max-w-6xl mx-auto p-6 animate-pulse">
          <div className="h-8 bg-zinc-800 rounded w-1/3 mb-4" />
          <div className="h-4 bg-zinc-800/60 rounded w-2/3" />
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950">
      <AppHeader
        title={isEditing ? "编辑报表" : "新建报表"}
        backHref={isEditing ? `/reports/${editId}` : "/reports"}
        actions={
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowPreview(!showPreview)}
              className="px-3 py-1.5 rounded-lg border border-zinc-700 bg-zinc-800 text-zinc-300 text-xs font-medium hover:bg-zinc-700 transition-all"
            >
              {showPreview ? "编辑" : "预览"}
            </button>
            <button
              onClick={handleSave}
              disabled={saving || !title.trim()}
              className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:bg-zinc-700 disabled:text-zinc-500 text-white text-xs font-medium transition-all shadow-lg shadow-indigo-500/30 disabled:shadow-none"
            >
              {saving ? "保存中..." : "保存"}
            </button>
          </div>
        }
      />

      <main className="max-w-6xl mx-auto p-6">
        {showPreview ? (
          /* 预览模式 */
          <div>
            <div className="mb-4">
              <h2 className="text-xl font-semibold text-zinc-100">{title || "未命名报表"}</h2>
              {description && (
                <p className="text-sm text-zinc-500 mt-1">{description}</p>
              )}
            </div>
            {previewSections.length === 0 ? (
              <div className="text-center py-16 text-zinc-500">
                还没有添加图表区块
              </div>
            ) : (
              <div className="grid grid-cols-12 gap-4">
                {previewSections.map((section) => (
                  <div
                    key={section.id}
                    style={{
                      gridColumn: `span ${section.colSpan || 12} / span ${section.colSpan || 12}`,
                    }}
                  >
                    <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] overflow-hidden">
                      {section.title && (
                        <div className="px-5 pt-4 pb-2">
                          <h3 className="text-sm font-medium text-zinc-300">
                            {section.title}
                          </h3>
                        </div>
                      )}
                      <div className="px-4 pb-4">
                        <SectionRenderer section={section} />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          /* 编辑模式 */
          <div className="space-y-6">
            {/* 基础信息 */}
            <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-6">
              <h3 className="text-sm font-medium text-zinc-300 mb-4">基础信息</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-xs text-zinc-500 mb-1.5">
                    报表标题 *
                  </label>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="输入报表标题"
                    className="w-full px-4 py-2.5 rounded-lg bg-zinc-800 border border-zinc-700 text-zinc-100 placeholder-zinc-600 text-sm focus:outline-none focus:border-indigo-500 transition-colors"
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs text-zinc-500 mb-1.5">
                    描述
                  </label>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="输入报表描述"
                    rows={2}
                    className="w-full px-4 py-2.5 rounded-lg bg-zinc-800 border border-zinc-700 text-zinc-100 placeholder-zinc-600 text-sm focus:outline-none focus:border-indigo-500 transition-colors resize-none"
                  />
                </div>
                <div>
                  <label className="block text-xs text-zinc-500 mb-1.5">
                    报表类型
                  </label>
                  <select
                    value={type}
                    onChange={(e) => setType(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-lg bg-zinc-800 border border-zinc-700 text-zinc-100 text-sm focus:outline-none focus:border-indigo-500 transition-colors"
                  >
                    {REPORT_TYPES.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-zinc-500 mb-1.5">
                    分类
                  </label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-lg bg-zinc-800 border border-zinc-700 text-zinc-100 text-sm focus:outline-none focus:border-indigo-500 transition-colors"
                  >
                    {REPORT_CATEGORIES.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* 图表区块 */}
            <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-medium text-zinc-300">
                  图表区块 ({sections.length})
                </h3>
              </div>

              {/* 添加区块按钮网格 */}
              <div className="grid grid-cols-3 sm:grid-cols-5 lg:grid-cols-9 gap-2 mb-6">
                {SECTION_TYPE_INFO.map((chart) => (
                  <button
                    key={chart.id}
                    onClick={() => addSection(chart.id)}
                    className="flex flex-col items-center gap-1 p-3 rounded-lg border border-zinc-800 hover:border-indigo-500/50 hover:bg-indigo-500/5 text-zinc-400 hover:text-indigo-400 transition-all"
                  >
                    <span className="w-8 h-8 rounded-lg bg-zinc-800 flex items-center justify-center text-xs font-bold">
                      {chart.icon}
                    </span>
                    <span className="text-xs">{chart.name}</span>
                  </button>
                ))}
              </div>

              {/* 已添加的区块列表 */}
              {sections.length === 0 ? (
                <div className="text-center py-8 text-zinc-600 text-sm">
                  点击上方按钮添加图表区块
                </div>
              ) : (
                <div className="space-y-3">
                  {sections.map((sec, index) => (
                    <div key={index}>
                      {sec.type === "custom" ? (
                        /* 自定义区块：展开编辑器 */
                        <div className="rounded-xl border border-zinc-800 bg-zinc-900 overflow-hidden">
                          {/* 紧凑顶栏 */}
                          <div className="flex items-center gap-3 px-4 py-3 border-b border-zinc-800">
                            <span className="px-2 py-1 rounded text-xs font-medium bg-indigo-900/40 text-indigo-400 whitespace-nowrap">
                              自定义
                            </span>
                            <input
                              type="text"
                              value={sec.title || ""}
                              onChange={(e) =>
                                updateSection(index, { title: e.target.value })
                              }
                              placeholder="区块标题"
                              className="flex-1 px-3 py-1.5 rounded-md bg-zinc-800 border border-zinc-700 text-zinc-200 text-sm focus:outline-none focus:border-indigo-500 transition-colors"
                            />
                            <div className="flex items-center gap-1">
                              <label className="text-xs text-zinc-600 whitespace-nowrap">宽度:</label>
                              <select
                                value={sec.colSpan || 12}
                                onChange={(e) =>
                                  updateSection(index, {
                                    colSpan: parseInt(e.target.value),
                                  })
                                }
                                className="px-2 py-1 rounded-md bg-zinc-800 border border-zinc-700 text-zinc-300 text-xs focus:outline-none focus:border-indigo-500"
                              >
                                <option value={4}>1/3</option>
                                <option value={6}>1/2</option>
                                <option value={8}>2/3</option>
                                <option value={12}>整行</option>
                              </select>
                            </div>
                            <button
                              onClick={() => removeSection(index)}
                              className="text-zinc-600 hover:text-red-400 transition-colors p-1"
                            >
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="CurrentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                              </svg>
                            </button>
                          </div>
                          {/* 自定义编辑器 */}
                          <CustomBlockEditor
                            initialData={sec.dataConfig}
                            initialOption={sec.chartConfig}
                            title={sec.title}
                            onChange={(dataConfig, chartConfig) => {
                              updateSection(index, {
                                dataConfig,
                                chartConfig,
                              });
                            }}
                          />
                        </div>
                      ) : (
                        /* 普通区块：紧凑编辑行 */
                        <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-4">
                          <div className="flex items-center gap-3">
                            {/* 排序 */}
                            <div className="flex flex-col gap-0.5">
                              <button
                                onClick={() => moveSection(index, "up")}
                                disabled={index === 0}
                                className="text-zinc-600 hover:text-zinc-300 disabled:opacity-30 transition-colors"
                              >
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="CurrentColor" strokeWidth={2}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 15.75 7.5-7.5 7.5 7.5" />
                                </svg>
                              </button>
                              <button
                                onClick={() => moveSection(index, "down")}
                                disabled={index === sections.length - 1}
                                className="text-zinc-600 hover:text-zinc-300 disabled:opacity-30 transition-colors"
                              >
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="CurrentColor" strokeWidth={2}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
                                </svg>
                              </button>
                            </div>

                            {/* 类型标签 */}
                            <span className="px-2 py-1 rounded text-xs font-medium bg-indigo-900/40 text-indigo-400 whitespace-nowrap">
                              {SECTION_TYPE_INFO.find((c) => c.id === sec.type)?.name || sec.type}
                            </span>

                            {/* 标题输入 */}
                            <input
                              type="text"
                              value={sec.title || ""}
                              onChange={(e) =>
                                updateSection(index, { title: e.target.value })
                              }
                              placeholder="区块标题"
                              className="flex-1 px-3 py-1.5 rounded-md bg-zinc-800 border border-zinc-700 text-zinc-200 text-sm focus:outline-none focus:border-indigo-500 transition-colors"
                            />

                            {/* 宽度控制 */}
                            <div className="flex items-center gap-1">
                              <label className="text-xs text-zinc-600 whitespace-nowrap">宽度:</label>
                              <select
                                value={sec.colSpan || 12}
                                onChange={(e) =>
                                  updateSection(index, {
                                    colSpan: parseInt(e.target.value),
                                  })
                                }
                                className="px-2 py-1 rounded-md bg-zinc-800 border border-zinc-700 text-zinc-300 text-xs focus:outline-none focus:border-indigo-500"
                              >
                                <option value={4}>1/3</option>
                                <option value={6}>1/2</option>
                                <option value={8}>2/3</option>
                                <option value={12}>整行</option>
                              </select>
                            </div>

                            {/* 删除 */}
                            <button
                              onClick={() => removeSection(index)}
                              className="text-zinc-600 hover:text-red-400 transition-colors p-1"
                            >
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="CurrentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                              </svg>
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
