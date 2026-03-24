"use client";

/**
 * DashboardView -- 配置驱动的大屏渲染组件
 *
 * 通过 DashboardTemplate.sections 配置自动渲染，
 * 不再硬编码各模板的布局和图表。
 * 同时保持对旧版 DashboardConfig (templateId + DashboardData) 的向后兼容。
 */

import SectionRenderer from "@/components/dashboard/SectionRenderer";
import { getTemplateById } from "@/lib/dashboard-templates";
import type {
  DashboardConfig,
  DashboardData,
  DashboardSection,
  DashboardTemplate,
} from "@/lib/types";

// ==================== Props ====================

interface DashboardViewProps {
  /** 传入旧版 DashboardConfig（兼容已保存的大屏） */
  config?: DashboardConfig;
  /** 直接传入模板（用于预览场景） */
  template?: DashboardTemplate;
  /** 直接传入 sections（用于 AI 生成场景） */
  sections?: DashboardSection[];
  /** 缩略模式 */
  compact?: boolean;
}

// ==================== 旧数据 -> sections 兼容转换 ====================

function legacySalesToSections(data: DashboardData): DashboardSection[] {
  return [
    {
      id: "compat-kpi",
      type: "kpi",
      title: "核心指标",
      colSpan: 12,
      data: {
        kpiItems: [
          { label: "总销售额", value: data.totalSales || 1280, unit: "万", color: "#38bdf8" },
          { label: "同比增长", value: data.growth || 23.5, unit: "%", color: "#34d399" },
          { label: "客户数", value: data.customers || 1256, unit: "", color: "#fbbf24" },
        ],
      },
    },
    {
      id: "compat-trend",
      type: "line",
      title: "销售趋势",
      colSpan: 7,
      data: {
        categories: data.months || ["1月", "2月", "3月", "4月", "5月", "6月"],
        series: [
          { name: "销售额", values: data.sales || [120, 200, 150, 280, 220, 300], color: "#38bdf8" },
          { name: "利润", values: data.profit || [40, 60, 55, 90, 70, 100], color: "#34d399" },
        ],
      },
    },
    {
      id: "compat-pie",
      type: "pie",
      title: "渠道分布",
      colSpan: 5,
      data: {
        pieItems: data.channels || [
          { name: "线上", value: 335 },
          { name: "线下", value: 234 },
          { name: "代理", value: 135 },
        ],
      },
    },
    {
      id: "compat-bar",
      type: "bar",
      title: "区域销售",
      colSpan: 12,
      data: {
        categories: data.regions || ["华东", "华南", "华北", "西南", "西北"],
        series: [
          { name: "销售额", values: data.regionSales || [320, 280, 200, 150, 80], color: "#38bdf8" },
        ],
      },
    },
  ];
}

// ==================== 主组件 ====================

export default function DashboardView({
  config,
  template,
  sections: propSections,
  compact,
}: DashboardViewProps) {
  // 优先级: propSections > template > config
  let sections: DashboardSection[] = [];

  if (propSections && propSections.length > 0) {
    sections = propSections;
  } else if (template?.sections && template.sections.length > 0) {
    sections = template.sections;
  } else if (config) {
    // 尝试从模板库查找
    const tpl = getTemplateById(config.templateId);
    if (tpl?.sections && tpl.sections.length > 0) {
      sections = tpl.sections;
    } else {
      // 回退到旧版兼容转换
      sections = legacySalesToSections(config.data);
    }
  }

  if (sections.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-zinc-500 text-sm">
        暂无区块配置，请选择模板或通过 AI 对话生成大屏
      </div>
    );
  }

  return (
    <div className={`dashboard-screen ${compact ? "scale-[0.48] origin-top-left w-[208%] h-[208%]" : "p-5"}`}>
      <div className="grid grid-cols-12 gap-4 auto-rows-auto">
        {sections.map((section) => (
          <div
            key={section.id}
            className="min-h-0"
            style={{
              gridColumn: `span ${section.colSpan || 12}`,
            }}
          >
            <SectionRenderer section={section} compact={compact} />
          </div>
        ))}
      </div>
    </div>
  );
}
