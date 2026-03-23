import type { DashboardTemplate } from "./types";

export const DASHBOARD_TEMPLATES: DashboardTemplate[] = [
  {
    id: "sales",
    name: "销售分析",
    description: "销售额、渠道、区域分布",
    layout: "sales",
    category: "sales",
  },
  {
    id: "operations",
    name: "运营监控",
    description: "核心指标、趋势、告警",
    layout: "operations",
    category: "operations",
  },
  {
    id: "finance",
    name: "财务概览",
    description: "收入、成本、利润",
    layout: "finance",
    category: "finance",
  },
  {
    id: "custom",
    name: "自定义",
    description: "自由布局",
    layout: "custom",
    category: "custom",
  },
];
