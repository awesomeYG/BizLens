/**
 * BizLens 数据大屏模板库
 *
 * 每个模板定义为一组 DashboardSection[] + 元信息，
 * 由通用 SectionRenderer 渲染引擎驱动。
 * 新增模板 = 新增一份 JSON 配置，零代码。
 */

import type { DashboardTemplate, DashboardSection, DashboardTemplateId } from "./types";

// ============================================================
// 1. 销售分析
// ============================================================
const salesSections: DashboardSection[] = [
  {
    id: "sales-kpi",
    type: "kpi",
    title: "核心指标",
    colSpan: 12,
    data: {
      kpiItems: [
        { label: "总销售额", value: "1,280", unit: "万", trend: "up", trendValue: "+12.5%", color: "#38bdf8" },
        { label: "订单量", value: "8,623", unit: "单", trend: "up", trendValue: "+8.3%", color: "#34d399" },
        { label: "客单价", value: "148.5", unit: "元", trend: "down", trendValue: "-2.1%", color: "#fbbf24" },
        { label: "退货率", value: "3.2", unit: "%", trend: "down", trendValue: "-0.5%", color: "#f87171" },
      ],
    },
  },
  {
    id: "sales-trend",
    type: "line",
    title: "销售趋势",
    subtitle: "近6个月销售额与利润走势",
    colSpan: 7,
    data: {
      categories: ["1月", "2月", "3月", "4月", "5月", "6月"],
      series: [
        { name: "销售额", values: [120, 200, 150, 280, 220, 300], color: "#38bdf8" },
        { name: "利润", values: [40, 60, 55, 90, 70, 100], color: "#34d399" },
      ],
    },
  },
  {
    id: "sales-channels",
    type: "pie",
    title: "渠道分布",
    subtitle: "各销售渠道占比",
    colSpan: 5,
    data: {
      pieItems: [
        { name: "线上直营", value: 335 },
        { name: "线下门店", value: 234 },
        { name: "代理分销", value: 135 },
        { name: "企业团购", value: 96 },
      ],
    },
  },
  {
    id: "sales-regions",
    type: "bar",
    title: "区域销售额",
    subtitle: "各大区业绩排行",
    colSpan: 6,
    data: {
      categories: ["华东", "华南", "华北", "西南", "西北"],
      series: [{ name: "销售额", values: [320, 280, 200, 150, 80], color: "#38bdf8" }],
    },
  },
  {
    id: "sales-ranking",
    type: "ranking",
    title: "TOP 5 商品",
    subtitle: "按销售额排行",
    colSpan: 6,
    data: {
      rankingItems: [
        { label: "智能手表 Pro", value: 156, maxValue: 200 },
        { label: "无线耳机 S3", value: 132, maxValue: 200 },
        { label: "便携充电宝", value: 98, maxValue: 200 },
        { label: "运动手环 Lite", value: 87, maxValue: 200 },
        { label: "蓝牙音箱 X1", value: 65, maxValue: 200 },
      ],
    },
  },
];

// ============================================================
// 2. 电商运营
// ============================================================
const ecommerceSections: DashboardSection[] = [
  {
    id: "ecom-kpi",
    type: "kpi",
    title: "实时概览",
    colSpan: 12,
    data: {
      kpiItems: [
        { label: "今日 GMV", value: "326.8", unit: "万", trend: "up", trendValue: "+18.2%", color: "#38bdf8" },
        { label: "支付订单", value: "4,521", unit: "单", trend: "up", trendValue: "+15.6%", color: "#34d399" },
        { label: "UV", value: "12.3", unit: "万", trend: "up", trendValue: "+5.8%", color: "#a78bfa" },
        { label: "支付转化率", value: "3.67", unit: "%", trend: "up", trendValue: "+0.3%", color: "#fbbf24" },
      ],
    },
  },
  {
    id: "ecom-gmv-trend",
    type: "area",
    title: "GMV 趋势",
    subtitle: "近 7 天 GMV 与订单量",
    colSpan: 8,
    data: {
      categories: ["周一", "周二", "周三", "周四", "周五", "周六", "周日"],
      series: [
        { name: "GMV(万)", values: [280, 310, 295, 340, 380, 520, 490], color: "#38bdf8" },
        { name: "订单量(百)", values: [38, 42, 40, 46, 52, 71, 67], color: "#34d399" },
      ],
    },
  },
  {
    id: "ecom-category",
    type: "pie",
    title: "品类占比",
    subtitle: "销售额 TOP 品类",
    colSpan: 4,
    data: {
      pieItems: [
        { name: "数码3C", value: 420 },
        { name: "服饰鞋包", value: 310 },
        { name: "美妆个护", value: 250 },
        { name: "食品生鲜", value: 180 },
        { name: "家居家装", value: 120 },
      ],
    },
  },
  {
    id: "ecom-funnel",
    type: "funnel",
    title: "转化漏斗",
    subtitle: "浏览 -> 支付全链路",
    colSpan: 5,
    data: {
      funnelItems: [
        { name: "浏览", value: 12300 },
        { name: "加购", value: 3200 },
        { name: "下单", value: 1800 },
        { name: "支付", value: 1520 },
        { name: "签收", value: 1410 },
      ],
    },
  },
  {
    id: "ecom-top-products",
    type: "ranking",
    title: "爆款排行",
    subtitle: "实时销量 TOP 5",
    colSpan: 7,
    data: {
      rankingItems: [
        { label: "iPhone 16 Pro Max", value: 2860, maxValue: 3000 },
        { label: "MacBook Air M4", value: 1950, maxValue: 3000 },
        { label: "AirPods Pro 3", value: 1620, maxValue: 3000 },
        { label: "iPad Air 6", value: 1340, maxValue: 3000 },
        { label: "Apple Watch Ultra 3", value: 980, maxValue: 3000 },
      ],
    },
  },
];

// ============================================================
// 3. SaaS 指标
// ============================================================
const saasSections: DashboardSection[] = [
  {
    id: "saas-kpi",
    type: "kpi",
    title: "订阅指标",
    colSpan: 12,
    data: {
      kpiItems: [
        { label: "MRR", value: "48.6", unit: "万", trend: "up", trendValue: "+6.2%", color: "#a78bfa" },
        { label: "ARR", value: "583", unit: "万", trend: "up", trendValue: "+18.5%", color: "#38bdf8" },
        { label: "活跃用户", value: "3,256", unit: "", trend: "up", trendValue: "+12.1%", color: "#34d399" },
        { label: "Churn Rate", value: "2.1", unit: "%", trend: "down", trendValue: "-0.3%", color: "#f87171" },
      ],
    },
  },
  {
    id: "saas-mrr-trend",
    type: "line",
    title: "MRR 增长趋势",
    subtitle: "近 12 个月月度经常性收入",
    colSpan: 8,
    data: {
      categories: ["1月", "2月", "3月", "4月", "5月", "6月", "7月", "8月", "9月", "10月", "11月", "12月"],
      series: [
        { name: "MRR(万)", values: [28, 30, 32, 34, 36, 38, 39, 41, 43, 45, 47, 48.6], color: "#a78bfa" },
        { name: "新增MRR", values: [3, 3.5, 4, 3.8, 4.2, 4.5, 3.2, 4.8, 4.1, 4.6, 5.2, 4.8], color: "#34d399" },
      ],
    },
  },
  {
    id: "saas-plans",
    type: "pie",
    title: "套餐分布",
    subtitle: "付费用户套餐占比",
    colSpan: 4,
    data: {
      pieItems: [
        { name: "企业版", value: 45 },
        { name: "专业版", value: 30 },
        { name: "基础版", value: 20 },
        { name: "试用", value: 5 },
      ],
    },
  },
  {
    id: "saas-retention",
    type: "bar",
    title: "留存分析",
    subtitle: "月度用户留存率",
    colSpan: 6,
    data: {
      categories: ["M1", "M2", "M3", "M6", "M12"],
      series: [
        { name: "留存率(%)", values: [92, 85, 78, 68, 56], color: "#38bdf8" },
      ],
    },
  },
  {
    id: "saas-ltv",
    type: "gauge",
    title: "LTV / CAC 比率",
    subtitle: "客户终身价值与获客成本",
    colSpan: 6,
    data: {
      gaugeData: { name: "LTV/CAC", value: 3.8, min: 0, max: 6 },
    },
  },
];

// ============================================================
// 4. 运营监控
// ============================================================
const operationsSections: DashboardSection[] = [
  {
    id: "ops-kpi",
    type: "kpi",
    title: "运营概览",
    colSpan: 12,
    data: {
      kpiItems: [
        { label: "DAU", value: "12,580", unit: "", trend: "up", trendValue: "+5.2%", color: "#38bdf8" },
        { label: "转化率", value: "4.2", unit: "%", trend: "up", trendValue: "+0.3%", color: "#34d399" },
        { label: "7日留存", value: "68.5", unit: "%", trend: "flat", trendValue: "+0.1%", color: "#fbbf24" },
        { label: "ARPU", value: "25.6", unit: "元", trend: "up", trendValue: "+2.8%", color: "#a78bfa" },
      ],
    },
  },
  {
    id: "ops-dau-trend",
    type: "area",
    title: "活跃用户趋势",
    subtitle: "近30天 DAU/MAU",
    colSpan: 7,
    data: {
      categories: Array.from({ length: 30 }, (_, i) => `${i + 1}日`),
      series: [
        {
          name: "DAU",
          values: [
            10200, 10500, 10800, 11200, 11500, 13200, 13800,
            11000, 11300, 11600, 12000, 12200, 14000, 14500,
            11800, 12000, 12300, 12500, 12800, 14800, 15200,
            12200, 12400, 12600, 12800, 13000, 15500, 16000,
            12580, 12800,
          ],
          color: "#38bdf8",
        },
      ],
    },
  },
  {
    id: "ops-channels",
    type: "bar",
    title: "渠道来源",
    subtitle: "各渠道新增用户占比",
    colSpan: 5,
    data: {
      categories: ["自然搜索", "社交媒体", "付费广告", "推荐裂变", "直接访问"],
      series: [{ name: "新增用户", values: [3500, 2800, 2200, 1800, 1500], color: "#a78bfa" }],
    },
  },
  {
    id: "ops-funnel",
    type: "funnel",
    title: "激活漏斗",
    subtitle: "注册 -> 核心行为",
    colSpan: 6,
    data: {
      funnelItems: [
        { name: "访问", value: 50000 },
        { name: "注册", value: 12000 },
        { name: "激活", value: 8500 },
        { name: "首次付费", value: 3200 },
        { name: "复购", value: 1600 },
      ],
    },
  },
  {
    id: "ops-feature-usage",
    type: "ranking",
    title: "功能使用率",
    subtitle: "核心功能 TOP 5",
    colSpan: 6,
    data: {
      rankingItems: [
        { label: "数据报表", value: 89, maxValue: 100 },
        { label: "AI 对话", value: 76, maxValue: 100 },
        { label: "告警配置", value: 62, maxValue: 100 },
        { label: "数据源管理", value: 55, maxValue: 100 },
        { label: "团队协作", value: 41, maxValue: 100 },
      ],
    },
  },
];

// ============================================================
// 5. 财务概览
// ============================================================
const financeSections: DashboardSection[] = [
  {
    id: "fin-kpi",
    type: "kpi",
    title: "财务指标",
    colSpan: 12,
    data: {
      kpiItems: [
        { label: "总收入", value: "1,280", unit: "万", trend: "up", trendValue: "+15.3%", color: "#38bdf8" },
        { label: "总成本", value: "820", unit: "万", trend: "up", trendValue: "+8.6%", color: "#fbbf24" },
        { label: "净利润", value: "460", unit: "万", trend: "up", trendValue: "+28.1%", color: "#34d399" },
        { label: "利润率", value: "35.9", unit: "%", trend: "up", trendValue: "+3.5%", color: "#a78bfa" },
      ],
    },
  },
  {
    id: "fin-revenue-trend",
    type: "line",
    title: "收入与成本趋势",
    subtitle: "近 6 个月",
    colSpan: 7,
    data: {
      categories: ["1月", "2月", "3月", "4月", "5月", "6月"],
      series: [
        { name: "收入", values: [180, 200, 195, 230, 220, 255], color: "#38bdf8" },
        { name: "成本", values: [110, 125, 118, 140, 135, 150], color: "#f87171" },
        { name: "利润", values: [70, 75, 77, 90, 85, 105], color: "#34d399" },
      ],
    },
  },
  {
    id: "fin-cost-breakdown",
    type: "pie",
    title: "成本结构",
    subtitle: "各类费用占比",
    colSpan: 5,
    data: {
      pieItems: [
        { name: "人力成本", value: 420 },
        { name: "服务器/云", value: 180 },
        { name: "营销推广", value: 120 },
        { name: "办公行政", value: 60 },
        { name: "其他", value: 40 },
      ],
    },
  },
  {
    id: "fin-dept-budget",
    type: "bar",
    title: "部门预算执行",
    subtitle: "预算 vs 实际支出",
    colSpan: 6,
    data: {
      categories: ["研发", "市场", "销售", "运营", "行政"],
      series: [
        { name: "预算", values: [300, 180, 150, 100, 80], color: "#64748b" },
        { name: "实际", values: [280, 195, 140, 95, 75], color: "#38bdf8" },
      ],
    },
  },
  {
    id: "fin-cashflow",
    type: "area",
    title: "现金流",
    subtitle: "经营/投资/筹资",
    colSpan: 6,
    data: {
      categories: ["Q1", "Q2", "Q3", "Q4"],
      series: [
        { name: "经营活动", values: [120, 150, 180, 200], color: "#34d399" },
        { name: "投资活动", values: [-50, -80, -60, -40], color: "#fbbf24" },
        { name: "筹资活动", values: [30, -20, 10, -30], color: "#a78bfa" },
      ],
    },
  },
];

// ============================================================
// 6. 营销效果
// ============================================================
const marketingSections: DashboardSection[] = [
  {
    id: "mkt-kpi",
    type: "kpi",
    title: "营销总览",
    colSpan: 12,
    data: {
      kpiItems: [
        { label: "广告花费", value: "86.5", unit: "万", trend: "up", trendValue: "+12%", color: "#f87171" },
        { label: "获客数", value: "5,230", unit: "", trend: "up", trendValue: "+22%", color: "#34d399" },
        { label: "CAC", value: "165", unit: "元", trend: "down", trendValue: "-8%", color: "#38bdf8" },
        { label: "ROI", value: "3.2", unit: "x", trend: "up", trendValue: "+0.4", color: "#a78bfa" },
      ],
    },
  },
  {
    id: "mkt-channel-roi",
    type: "bar",
    title: "渠道 ROI 对比",
    subtitle: "各投放渠道回报率",
    colSpan: 7,
    data: {
      categories: ["搜索引擎", "信息流", "社交媒体", "KOL 合作", "邮件营销"],
      series: [
        { name: "花费(万)", values: [30, 25, 18, 8, 5.5], color: "#f87171" },
        { name: "回报(万)", values: [120, 85, 52, 35, 20], color: "#34d399" },
      ],
    },
  },
  {
    id: "mkt-conversion",
    type: "funnel",
    title: "营销转化漏斗",
    subtitle: "曝光 -> 成交",
    colSpan: 5,
    data: {
      funnelItems: [
        { name: "曝光", value: 500000 },
        { name: "点击", value: 35000 },
        { name: "注册", value: 8200 },
        { name: "试用", value: 5230 },
        { name: "付费", value: 1850 },
      ],
    },
  },
  {
    id: "mkt-trend",
    type: "line",
    title: "获客成本趋势",
    subtitle: "近 12 个月 CAC 走势",
    colSpan: 6,
    data: {
      categories: ["1月", "2月", "3月", "4月", "5月", "6月", "7月", "8月", "9月", "10月", "11月", "12月"],
      series: [
        { name: "CAC(元)", values: [210, 205, 198, 190, 185, 180, 178, 175, 172, 170, 168, 165], color: "#38bdf8" },
      ],
    },
  },
  {
    id: "mkt-content-ranking",
    type: "ranking",
    title: "内容转化 TOP 5",
    subtitle: "按带来注册数排行",
    colSpan: 6,
    data: {
      rankingItems: [
        { label: "产品使用教程视频", value: 1280, maxValue: 1500 },
        { label: "行业白皮书下载", value: 960, maxValue: 1500 },
        { label: "客户案例访谈", value: 720, maxValue: 1500 },
        { label: "技术博客文章", value: 540, maxValue: 1500 },
        { label: "线上直播回放", value: 380, maxValue: 1500 },
      ],
    },
  },
];

// ============================================================
// 7. 供应链
// ============================================================
const supplyChainSections: DashboardSection[] = [
  {
    id: "sc-kpi",
    type: "kpi",
    title: "供应链健康度",
    colSpan: 12,
    data: {
      kpiItems: [
        { label: "库存周转天数", value: "32.5", unit: "天", trend: "down", trendValue: "-3天", color: "#34d399" },
        { label: "采购成本", value: "520", unit: "万", trend: "up", trendValue: "+2.3%", color: "#f87171" },
        { label: "准时交付率", value: "94.8", unit: "%", trend: "up", trendValue: "+1.2%", color: "#38bdf8" },
        { label: "缺货率", value: "1.8", unit: "%", trend: "down", trendValue: "-0.5%", color: "#fbbf24" },
      ],
    },
  },
  {
    id: "sc-inventory-trend",
    type: "line",
    title: "库存变动趋势",
    subtitle: "近 6 个月库存金额",
    colSpan: 7,
    data: {
      categories: ["1月", "2月", "3月", "4月", "5月", "6月"],
      series: [
        { name: "库存金额(万)", values: [680, 720, 650, 610, 590, 560], color: "#38bdf8" },
        { name: "安全库存线", values: [500, 500, 500, 500, 500, 500], color: "#f87171" },
      ],
    },
  },
  {
    id: "sc-supplier-score",
    type: "ranking",
    title: "供应商评分",
    subtitle: "TOP 5 供应商表现",
    colSpan: 5,
    data: {
      rankingItems: [
        { label: "华科精密", value: 96, maxValue: 100 },
        { label: "盛达物流", value: 93, maxValue: 100 },
        { label: "瑞诚材料", value: 89, maxValue: 100 },
        { label: "新宇电子", value: 85, maxValue: 100 },
        { label: "德邦供应链", value: 82, maxValue: 100 },
      ],
    },
  },
  {
    id: "sc-category-cost",
    type: "pie",
    title: "采购品类结构",
    subtitle: "各品类采购金额占比",
    colSpan: 6,
    data: {
      pieItems: [
        { name: "原材料", value: 280 },
        { name: "包装材料", value: 95 },
        { name: "辅料", value: 75 },
        { name: "设备维护", value: 45 },
        { name: "物流费用", value: 25 },
      ],
    },
  },
  {
    id: "sc-delivery",
    type: "gauge",
    title: "交付达标率",
    subtitle: "本月准时交付表现",
    colSpan: 6,
    data: {
      gaugeData: { name: "准时率", value: 94.8, min: 0, max: 100 },
    },
  },
];

// ============================================================
// 8. 客户分析
// ============================================================
const customerSections: DashboardSection[] = [
  {
    id: "cust-kpi",
    type: "kpi",
    title: "客户概览",
    colSpan: 12,
    data: {
      kpiItems: [
        { label: "总客户数", value: "18,620", unit: "", trend: "up", trendValue: "+8.5%", color: "#38bdf8" },
        { label: "活跃客户", value: "6,230", unit: "", trend: "up", trendValue: "+12.3%", color: "#34d399" },
        { label: "客户满意度", value: "4.6", unit: "/5", trend: "up", trendValue: "+0.2", color: "#fbbf24" },
        { label: "NPS", value: "72", unit: "", trend: "up", trendValue: "+5", color: "#a78bfa" },
      ],
    },
  },
  {
    id: "cust-lifecycle",
    type: "funnel",
    title: "客户生命周期",
    subtitle: "从潜客到忠诚客户",
    colSpan: 5,
    data: {
      funnelItems: [
        { name: "潜在客户", value: 50000 },
        { name: "新客户", value: 18620 },
        { name: "活跃客户", value: 6230 },
        { name: "高价值客户", value: 2100 },
        { name: "忠诚客户", value: 850 },
      ],
    },
  },
  {
    id: "cust-segment",
    type: "pie",
    title: "RFM 客户分群",
    subtitle: "基于消费行为分层",
    colSpan: 7,
    data: {
      pieItems: [
        { name: "高价值活跃", value: 2100 },
        { name: "中等价值", value: 4800 },
        { name: "低频消费", value: 6200 },
        { name: "沉睡客户", value: 3520 },
        { name: "流失风险", value: 2000 },
      ],
    },
  },
  {
    id: "cust-trend",
    type: "area",
    title: "客户增长趋势",
    subtitle: "近 12 个月新增与流失",
    colSpan: 7,
    data: {
      categories: ["1月", "2月", "3月", "4月", "5月", "6月", "7月", "8月", "9月", "10月", "11月", "12月"],
      series: [
        { name: "新增客户", values: [420, 380, 450, 520, 480, 560, 610, 580, 620, 650, 700, 720], color: "#34d399" },
        { name: "流失客户", values: [120, 130, 110, 140, 125, 135, 150, 140, 130, 120, 115, 110], color: "#f87171" },
      ],
    },
  },
  {
    id: "cust-source",
    type: "bar",
    title: "客户来源",
    subtitle: "各获客渠道贡献",
    colSpan: 5,
    data: {
      categories: ["老客推荐", "搜索引擎", "社交媒体", "线下活动", "合作伙伴"],
      series: [{ name: "客户数", values: [5200, 4800, 3600, 2800, 2220], color: "#a78bfa" }],
    },
  },
];

// ============================================================
// 模板注册表
// ============================================================
export const DASHBOARD_TEMPLATES: DashboardTemplate[] = [
  {
    id: "sales",
    name: "销售分析",
    description: "销售额、渠道占比、区域排行、商品 TOP 榜",
    layout: "sales",
    category: "operations",
    icon: "📊",
    isSystem: true,
    tags: ["销售", "渠道", "区域"],
    usageCount: 1280,
    sections: salesSections,
    gridCols: 12,
    colorTone: "blue",
  },
  {
    id: "ecommerce",
    name: "电商运营",
    description: "GMV、转化漏斗、品类分析、爆款排行",
    layout: "ecommerce",
    category: "operations",
    icon: "🛒",
    isSystem: true,
    tags: ["电商", "GMV", "转化"],
    usageCount: 960,
    sections: ecommerceSections,
    gridCols: 12,
    colorTone: "cyan",
  },
  {
    id: "saas" as DashboardTemplateId,
    name: "SaaS 指标",
    description: "MRR/ARR、Churn Rate、LTV、留存分析",
    layout: "saas",
    category: "operations",
    icon: "☁️",
    isSystem: true,
    tags: ["SaaS", "MRR", "留存"],
    usageCount: 720,
    sections: saasSections,
    gridCols: 12,
    colorTone: "purple",
  },
  {
    id: "operations",
    name: "运营监控",
    description: "DAU、转化率、留存、功能使用率、渠道来源",
    layout: "operations",
    category: "operations",
    icon: "📈",
    isSystem: true,
    tags: ["运营", "DAU", "留存"],
    usageCount: 850,
    sections: operationsSections,
    gridCols: 12,
    colorTone: "green",
  },
  {
    id: "finance",
    name: "财务概览",
    description: "收入成本利润、预算执行、成本结构、现金流",
    layout: "finance",
    category: "finance",
    icon: "💰",
    isSystem: true,
    tags: ["财务", "利润", "预算"],
    usageCount: 680,
    sections: financeSections,
    gridCols: 12,
    colorTone: "amber",
  },
  {
    id: "marketing" as DashboardTemplateId,
    name: "营销效果",
    description: "广告 ROI、获客成本、渠道对比、内容转化",
    layout: "marketing",
    category: "channel",
    icon: "📣",
    isSystem: true,
    tags: ["营销", "ROI", "获客"],
    usageCount: 540,
    sections: marketingSections,
    gridCols: 12,
    colorTone: "rose",
  },
  {
    id: "supply-chain" as DashboardTemplateId,
    name: "供应链",
    description: "库存周转、采购成本、供应商评分、交付率",
    layout: "supply-chain",
    category: "product",
    icon: "📦",
    isSystem: true,
    tags: ["供应链", "库存", "采购"],
    usageCount: 320,
    sections: supplyChainSections,
    gridCols: 12,
    colorTone: "teal",
  },
  {
    id: "customer" as DashboardTemplateId,
    name: "客户分析",
    description: "RFM 分群、生命周期、NPS、客户增长趋势",
    layout: "customer",
    category: "channel",
    icon: "👥",
    isSystem: true,
    tags: ["客户", "RFM", "NPS"],
    usageCount: 450,
    sections: customerSections,
    gridCols: 12,
    colorTone: "indigo",
  },
  {
    id: "custom",
    name: "自定义大屏",
    description: "空白画布，自由组合图表和区块",
    layout: "custom",
    category: "custom",
    icon: "🎨",
    isSystem: true,
    tags: ["自定义", "自由布局"],
    usageCount: 2100,
    sections: [],
    gridCols: 12,
    colorTone: "slate",
  },
];

/** 根据 ID 获取模板 */
export function getTemplateById(id: string): DashboardTemplate | undefined {
  return DASHBOARD_TEMPLATES.find((t) => t.id === id);
}

/** 根据分类获取模板 */
export function getTemplatesByCategory(category: string): DashboardTemplate[] {
  if (category === "all") return DASHBOARD_TEMPLATES;
  return DASHBOARD_TEMPLATES.filter((t) => t.category === category);
}
