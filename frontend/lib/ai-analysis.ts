export type AnalysisIntentType = "current" | "comparison" | "attribution" | "forecast" | "alert" | "unknown";

export interface AnalysisIntent {
  type: AnalysisIntentType;
  metrics: string[];
  dimensions: string[];
  filters: Array<{ field: string; operator: string; value: string | number }>;
  timeRange: string;
  granularity: "day" | "week" | "month" | "quarter" | "year" | "none";
  compareMode?: "mom" | "yoy" | "channel" | "none";
  missingSlots: string[];
}

export interface AnalysisPlan {
  objective: string;
  metricNames: string[];
  dimensionNames: string[];
  filters: Array<{ field: string; operator: string; value: string | number }>;
  timeRange: string;
  granularity: AnalysisIntent["granularity"];
  steps: string[];
  assumptions: string[];
}

export interface AnalysisQualityReport {
  checks: Array<{ name: string; ok: boolean; reason?: string }>;
  confidence: "high" | "medium" | "low";
  issues: string[];
}

export interface AnalysisInsight {
  conclusion: string;
  evidence: string[];
  breakdown: string[];
  suggestions: string[];
  chartRecommendation: "line" | "bar" | "stacked_bar" | "pie" | "table";
}

export interface AnalysisResultPacket {
  intent: AnalysisIntent;
  semanticMapping: {
    metrics: string[];
    dimensions: string[];
    timeRange: string;
    synonymsHit: string[];
  };
  plan: AnalysisPlan;
  sql: string;
  quality: AnalysisQualityReport;
  insight: AnalysisInsight;
  clarificationQuestion?: string;
  evaluation: EvaluationSummary;
}

const METRIC_SEMANTIC_DICTIONARY: Record<string, string[]> = {
  gmv: ["gmv", "销售额", "销售金额", "成交额", "交易额", "营收", "revenue"],
  order_count: ["订单", "订单量", "单量", "order count"],
  conversion_rate: ["转化率", "下单转化", "支付转化"],
  customer_count: ["客户数", "用户数", "买家数", "客户量"],
};

const DIMENSION_DICTIONARY: Record<string, string[]> = {
  category: ["品类", "类别", "分类"],
  channel: ["渠道", "来源渠道", "流量来源"],
  region: ["地区", "区域", "省份", "城市", "大区"],
  user_segment: ["用户分层", "人群", "新客", "老客"],
  date: ["日期", "按天", "日"],
  week: ["按周", "周"],
  month: ["按月", "月"],
};

const TIME_RULES: Array<{ pattern: RegExp; value: string; granularity?: AnalysisIntent["granularity"] }> = [
  { pattern: /近\s*7\s*天|最近\s*7\s*天|last\s*7\s*days/i, value: "last_7_days", granularity: "day" },
  { pattern: /近\s*30\s*天|最近\s*30\s*天|last\s*30\s*days/i, value: "last_30_days", granularity: "day" },
  { pattern: /本周|这周/i, value: "this_week", granularity: "day" },
  { pattern: /上周/i, value: "last_week", granularity: "day" },
  { pattern: /本月|这个月/i, value: "this_month", granularity: "day" },
  { pattern: /上月/i, value: "last_month", granularity: "day" },
  { pattern: /本年|今年/i, value: "this_year", granularity: "month" },
];

type InteractionLog = {
  timestamp: number;
  question: string;
  intentType: AnalysisIntentType;
  hadClarification: boolean;
  success: boolean;
  durationMs: number;
  qualityConfidence: AnalysisQualityReport["confidence"];
};

type EvalState = {
  total: number;
  success: number;
  withClarification: number;
  avgDurationMs: number;
  confidenceCount: Record<AnalysisQualityReport["confidence"], number>;
};

const logs: InteractionLog[] = [];
const evalState: EvalState = {
  total: 0,
  success: 0,
  withClarification: 0,
  avgDurationMs: 0,
  confidenceCount: { high: 0, medium: 0, low: 0 },
};

export interface EvaluationSummary {
  totalQueries: number;
  querySuccessRate: number;
  clarificationRate: number;
  avgResponseMs: number;
  confidenceDistribution: Record<AnalysisQualityReport["confidence"], number>;
  recentQueries: Array<{ ts: number; intentType: AnalysisIntentType; success: boolean }>;
}

export function analyzeQuestion(question: string): Omit<AnalysisResultPacket, "evaluation"> {
  const intent = parseIntent(question);
  const semanticMapping = mapToSemantic(intent, question);
  const plan = buildPlan(intent);
  const sql = generateSafeSQL(plan);
  const quality = runQualityChecks(sql, intent);
  const insight = buildInsight(intent, quality);
  const clarificationQuestion = buildClarification(intent);

  return {
    intent,
    semanticMapping,
    plan,
    sql,
    quality,
    insight,
    clarificationQuestion,
  };
}

export function recordAnalysisInteraction(input: {
  question: string;
  packet: Omit<AnalysisResultPacket, "evaluation">;
  durationMs: number;
  success: boolean;
}): EvaluationSummary {
  const hasClarification = Boolean(input.packet.clarificationQuestion);
  logs.push({
    timestamp: Date.now(),
    question: input.question,
    intentType: input.packet.intent.type,
    hadClarification: hasClarification,
    success: input.success,
    durationMs: input.durationMs,
    qualityConfidence: input.packet.quality.confidence,
  });

  evalState.total += 1;
  evalState.success += input.success ? 1 : 0;
  evalState.withClarification += hasClarification ? 1 : 0;
  evalState.confidenceCount[input.packet.quality.confidence] += 1;
  evalState.avgDurationMs =
    Math.round(((evalState.avgDurationMs * (evalState.total - 1)) + input.durationMs) / evalState.total);

  return getEvaluationSummary();
}

export function getEvaluationSummary(): EvaluationSummary {
  const total = evalState.total || 1;
  return {
    totalQueries: evalState.total,
    querySuccessRate: Number(((evalState.success / total) * 100).toFixed(1)),
    clarificationRate: Number(((evalState.withClarification / total) * 100).toFixed(1)),
    avgResponseMs: evalState.avgDurationMs,
    confidenceDistribution: {
      high: evalState.confidenceCount.high,
      medium: evalState.confidenceCount.medium,
      low: evalState.confidenceCount.low,
    },
    recentQueries: logs.slice(-5).map((item) => ({
      ts: item.timestamp,
      intentType: item.intentType,
      success: item.success,
    })),
  };
}

function parseIntent(question: string): AnalysisIntent {
  const q = question.toLowerCase();
  const metrics = extractSemanticKeys(q, METRIC_SEMANTIC_DICTIONARY);
  const dimensions = extractSemanticKeys(q, DIMENSION_DICTIONARY);
  const time = TIME_RULES.find((rule) => rule.pattern.test(question));
  const compareMode: AnalysisIntent["compareMode"] =
    /环比|mom/i.test(question) ? "mom" :
      /同比|yoy/i.test(question) ? "yoy" :
        /渠道对比|渠道比较/.test(question) ? "channel" : "none";

  let type: AnalysisIntentType = "unknown";
  if (/为什么|原因|归因|下滑|下降|增长来源/.test(question)) type = "attribution";
  else if (/预测|预警|趋势|下周|下月|forecast|anomaly/i.test(question)) type = "forecast";
  else if (/告警|通知|超过|低于|阈值/.test(question)) type = "alert";
  else if (/环比|同比|对比|比较|vs/i.test(question)) type = "comparison";
  else if (metrics.length > 0) type = "current";

  const missingSlots: string[] = [];
  if (metrics.length === 0) missingSlots.push("metric");
  if (!time) missingSlots.push("timeRange");

  return {
    type,
    metrics,
    dimensions,
    filters: [],
    timeRange: time?.value ?? "last_30_days",
    granularity: time?.granularity ?? "day",
    compareMode,
    missingSlots,
  };
}

function mapToSemantic(intent: AnalysisIntent, question: string) {
  const synonymsHit: string[] = [];
  for (const [metric, words] of Object.entries(METRIC_SEMANTIC_DICTIONARY)) {
    if (intent.metrics.includes(metric)) {
      const hitWord = words.find((word) => question.toLowerCase().includes(word.toLowerCase()));
      if (hitWord) synonymsHit.push(`${hitWord}->${metric}`);
    }
  }

  return {
    metrics: intent.metrics.length > 0 ? intent.metrics : ["gmv"],
    dimensions: intent.dimensions,
    timeRange: intent.timeRange,
    synonymsHit,
  };
}

function buildPlan(intent: AnalysisIntent): AnalysisPlan {
  const metricNames = intent.metrics.length > 0 ? intent.metrics : ["gmv"];
  const dimensionNames = intent.dimensions;
  const assumptions = [];
  if (intent.missingSlots.includes("timeRange")) assumptions.push("未指定时间范围，默认近30天。");
  if (intent.missingSlots.includes("metric")) assumptions.push("未识别到指标，默认使用GMV。");

  return {
    objective: `围绕${metricNames.join("、")}进行${intent.type}分析`,
    metricNames,
    dimensionNames,
    filters: intent.filters,
    timeRange: intent.timeRange,
    granularity: intent.granularity,
    steps: [
      "确认指标口径与时间窗口",
      "构建汇总查询并输出主结论",
      "按核心维度进行贡献拆解",
      "生成业务建议与后续追问方向",
    ],
    assumptions,
  };
}

function generateSafeSQL(plan: AnalysisPlan): string {
  const metricExprMap: Record<string, string> = {
    gmv: "SUM(amount) AS gmv",
    order_count: "COUNT(*) AS order_count",
    conversion_rate: "SUM(converted_users) * 1.0 / NULLIF(SUM(visitor_users), 0) AS conversion_rate",
    customer_count: "COUNT(DISTINCT customer_id) AS customer_count",
  };

  const safeMetrics = plan.metricNames.map((name) => metricExprMap[name] ?? "COUNT(*) AS count_value");
  const dimExprMap: Record<string, string> = {
    category: "category",
    channel: "channel",
    region: "region",
    user_segment: "user_segment",
  };
  const safeDims = plan.dimensionNames.map((name) => dimExprMap[name]).filter(Boolean);
  const groupBy = safeDims.length > 0 ? ` GROUP BY ${safeDims.join(", ")}` : "";
  const selectPrefix = safeDims.length > 0 ? `${safeDims.join(", ")}, ` : "";
  const timeFilter = buildTimeFilter(plan.timeRange);

  return `SELECT ${selectPrefix}${safeMetrics.join(", ")} FROM orders WHERE ${timeFilter}${groupBy} LIMIT 200`;
}

function runQualityChecks(sql: string, intent: AnalysisIntent): AnalysisQualityReport {
  const checks: AnalysisQualityReport["checks"] = [
    { name: "sqlReadOnly", ok: !/\b(UPDATE|DELETE|INSERT|DROP|ALTER)\b/i.test(sql), reason: "仅允许只读查询" },
    { name: "hasTimeFilter", ok: /\bWHERE\b/i.test(sql), reason: "必须包含时间过滤避免全表扫描" },
    { name: "divisionGuard", ok: !/\/\s*SUM\(/i.test(sql) || /NULLIF/i.test(sql), reason: "除法计算需防止分母为0" },
    { name: "intentCompleteness", ok: intent.missingSlots.length <= 1, reason: "关键槽位缺失会降低结论可信度" },
  ];

  const issues = checks.filter((item) => !item.ok).map((item) => `${item.name}:${item.reason ?? "未通过"}`);
  const confidence: AnalysisQualityReport["confidence"] =
    issues.length === 0 ? "high" : issues.length <= 1 ? "medium" : "low";

  return { checks, confidence, issues };
}

function buildInsight(intent: AnalysisIntent, quality: AnalysisQualityReport): AnalysisInsight {
  const chartRecommendation = chooseChart(intent);
  const metricText = intent.metrics.length > 0 ? intent.metrics.join("、") : "GMV";
  return {
    conclusion: `当前问题可围绕 ${metricText} 在 ${formatTimeRange(intent.timeRange)} 内完成${intent.type}分析。`,
    evidence: [
      `已识别指标: ${metricText}`,
      `时间范围: ${formatTimeRange(intent.timeRange)}`,
      `可信度: ${quality.confidence}`,
    ],
    breakdown: intent.dimensions.length > 0
      ? [`建议按 ${intent.dimensions.join("、")} 进行贡献拆解`]
      : ["建议先从渠道与区域两个维度进行下钻"],
    suggestions: [
      "先确认异常是否由单一维度驱动，再决定运营动作。",
      "若出现明显波动，补充环比/同比视角验证是否季节性变化。",
    ],
    chartRecommendation,
  };
}

function buildClarification(intent: AnalysisIntent): string | undefined {
  if (intent.missingSlots.length === 0) return undefined;
  if (intent.missingSlots.includes("metric")) return "你希望重点分析哪个指标？例如 GMV、订单量或转化率。";
  if (intent.missingSlots.includes("timeRange")) return "你希望看哪个时间范围？例如本周、上周或近30天。";
  return "请补充分析指标和时间范围，我可以给出更准确的结论。";
}

function chooseChart(intent: AnalysisIntent): AnalysisInsight["chartRecommendation"] {
  if (intent.type === "comparison") return "bar";
  if (intent.type === "forecast") return "line";
  if (intent.dimensions.length > 0) return "stacked_bar";
  return "table";
}

function extractSemanticKeys(questionLower: string, dictionary: Record<string, string[]>): string[] {
  return Object.entries(dictionary)
    .filter(([, words]) => words.some((word) => questionLower.includes(word.toLowerCase())))
    .map(([key]) => key);
}

function buildTimeFilter(timeRange: string): string {
  const map: Record<string, string> = {
    last_7_days: "created_at >= DATE_SUB(CURRENT_DATE, INTERVAL 7 DAY)",
    last_30_days: "created_at >= DATE_SUB(CURRENT_DATE, INTERVAL 30 DAY)",
    this_week: "YEARWEEK(created_at) = YEARWEEK(CURRENT_DATE)",
    last_week: "YEARWEEK(created_at) = YEARWEEK(CURRENT_DATE - INTERVAL 1 WEEK)",
    this_month: "DATE_FORMAT(created_at, '%Y-%m') = DATE_FORMAT(CURRENT_DATE, '%Y-%m')",
    last_month: "DATE_FORMAT(created_at, '%Y-%m') = DATE_FORMAT(CURRENT_DATE - INTERVAL 1 MONTH, '%Y-%m')",
    this_year: "YEAR(created_at) = YEAR(CURRENT_DATE)",
  };
  return map[timeRange] ?? map.last_30_days;
}

function formatTimeRange(timeRange: string): string {
  const map: Record<string, string> = {
    last_7_days: "近7天",
    last_30_days: "近30天",
    this_week: "本周",
    last_week: "上周",
    this_month: "本月",
    last_month: "上月",
    this_year: "今年",
  };
  return map[timeRange] ?? timeRange;
}
