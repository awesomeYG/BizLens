/**
 * 用户意图识别服务
 * 封装意图识别逻辑，支持服务端和客户端调用
 */

import OpenAI from "openai";

// ============================================================================
// 类型定义
// ============================================================================

export type UserIntent =
  | "send_dingtalk"   // 发送钉钉消息
  | "chat"            // 普通聊天
  | "dashboard"       // 生成大屏
  | "notification"    // 创建通知规则
  | "alert"           // 创建告警
  | "report"          // 生成报表
  | "datasource"     // 配置数据源
  | "unknown";        // 未知意图

export interface IntentResult {
  intent: UserIntent;
  confidence: number;       // 0-1
  extractedContent?: string; // 提取的内容（如钉钉消息内容）
  reasoning?: string;        // 推理过程
}

// ============================================================================
// 快速关键词匹配
// ============================================================================

const INTENT_KEYWORDS: Record<UserIntent, { patterns: string[]; weight: number }> = {
  send_dingtalk: {
    weight: 1.0,
    patterns: [
      "给钉钉发", "发钉钉", "钉钉发", "发到钉钉", "发送到钉钉", "钉钉通知",
      "给dingtalk", "dingtalk发", "send to dingtalk", "钉钉消息",
      "send to dingtalk", "发个钉钉",
    ],
  },
  dashboard: {
    weight: 1.0,
    patterns: [
      "生成大屏", "创建大屏", "大屏", "dashboard", "看板",
      "生成看板", "创建看板",
    ],
  },
  notification: {
    weight: 0.9,
    patterns: [
      "通知我", "通知规则", "提醒我", "当", "时通知", "时提醒",
      "设置通知", "配置通知",
    ],
  },
  alert: {
    weight: 0.9,
    patterns: [
      "告警", "警报", "阈值告警", "异常告警",
    ],
  },
  report: {
    weight: 0.9,
    patterns: [
      "生成报表", "创建报表", "日报", "周报", "月报", "报告",
      "生成报告", "数据分析报告",
    ],
  },
  datasource: {
    weight: 0.8,
    patterns: [
      "连接数据库", "配置数据源", "接入数据库", "连接串", "连接字符串",
      "postgres://", "postgresql://", "mysql://", "数据库连接",
      "connect database", "data source",
    ],
  },
  chat: { weight: 0, patterns: [] },
  unknown: { weight: 0, patterns: [] },
};

/**
 * 快速关键词判断（零成本）
 */
function quickIntentCheck(text: string): UserIntent | null {
  const lower = text.toLowerCase();

  for (const [intent, config] of Object.entries(INTENT_KEYWORDS) as [UserIntent, { patterns: string[]; weight: number }][] ) {
    if (intent === "chat" || intent === "unknown") continue;
    for (const keyword of config.patterns) {
      if (lower.includes(keyword.toLowerCase())) {
        return intent;
      }
    }
  }

  return null;
}

/**
 * 提取钉钉消息内容
 */
function extractDingtalkContent(text: string, aiExtracted?: string): string {
  if (aiExtracted && aiExtracted.trim()) return aiExtracted.trim();

  const patterns = [
    /['"「]([^'"」]+)['"」]/,
    /[:：]\s*([^\n]+)/,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match && match[1]?.trim()) return match[1].trim();
  }

  return text
    .replace(/给钉钉发(?:个|句|条)?(?:消息|通知)?/gi, "")
    .replace(/发(?:送到?)?钉钉/gi, "")
    .replace(/钉钉发(?:个|句|条)?(?:消息|通知)?/gi, "")
    .replace(/dingtalk(?:发|发送)?/gi, "")
    .replace(/[:：]/g, "")
    .trim() || text;
}

// ============================================================================
// AI 意图识别（服务端）
// ============================================================================

const SYSTEM_PROMPT = `你是一个用户意图识别助手。用户可能通过各种自然的说法表达他们的需求，你需要准确识别。

支持的意图类型：
1. send_dingtalk - 用户想发送消息到钉钉（如"给钉钉发个消息"、"发到钉钉"、"钉钉通知"、"发个钉钉"等）
2. chat - 用户在进行普通问答或对话
3. dashboard - 用户想生成数据大屏或可视化
4. notification - 用户想创建通知规则（如"当xxx时通知我"）
5. alert - 用户想创建告警
6. report - 用户想生成报表或报告
7. datasource - 用户想配置数据库连接
8. unknown - 无法确定意图

关键判断标准：
- 发送钉钉消息的特征：必须同时包含①动作词（"发"、"发送"、"通知"）+ ②目标词（"钉钉"、"dingtalk"）。仅有通知/提醒类内容但无钉钉关键词，识别为 chat。
- 如果消息内容是纯文本且看起来像是要发送的通知/提醒，识别为 chat（除非明确包含钉钉目标词）
- 如果包含分析、查询、计算类动词（分析、查询、计算、看看），识别为 chat
- 如果包含创建、生成 + 大屏/看板/dashboard，识别为 dashboard
- 如果包含"报表"、"日报"、"周报"、"月报"，识别为 report
- 如果包含数据库连接串（postgres://、mysql://、postgresql://），识别为 datasource

请以 JSON 格式返回结果：
{"intent": "意图类型", "confidence": 0.0-1.0, "extractedContent": "提取的消息内容（仅send_dingtalk时需要）", "reasoning": "判断理由"}`;

/**
 * 从后端获取 AI 配置
 */
async function fetchAIConfig(tenantId: string): Promise<{ apiKey?: string; baseUrl?: string; modelType?: string; model?: string } | null> {
  const backendBase = process.env.BACKEND_INTERNAL_URL || "http://localhost:3001";
  try {
    const res = await fetch(`${backendBase}/api/tenants/${tenantId}/ai-config`, {
      method: "GET",
      headers: { "Content-Type": "application/json", "X-Tenant-ID": tenantId },
      cache: "no-store",
    });
    if (res.ok) {
      const data = await res.json();
      return { apiKey: data?.apiKey, baseUrl: data?.baseUrl, modelType: data?.modelType, model: data?.model };
    }
  } catch { /* ignore */ }
  return null;
}

/**
 * 使用 AI 进行意图识别
 */
async function detectIntentWithAI(
  text: string,
  apiKey?: string,
  baseURL?: string,
  model?: string
): Promise<IntentResult | null> {
  if (!apiKey) return null;

  try {
    const openai = new OpenAI({ apiKey, baseURL: baseURL || undefined });

    const response = await openai.chat.completions.create({
      model: model || "gpt-4o-mini",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: `用户消息：${text}\n\n请识别用户意图并返回 JSON。` },
      ],
      max_tokens: 200,
      temperature: 0,
    }, { signal: AbortSignal.timeout(5000) });

    const content = response.choices[0]?.message?.content?.trim();
    if (!content) return null;

    let parsed: Record<string, unknown>;
    try {
      const jsonStr = content.replace(/^```json\n?/, "").replace(/\n?```$/, "");
      parsed = JSON.parse(jsonStr);
    } catch {
      return null;
    }

    const intent = parsed.intent as UserIntent;
    if (!intent) return null;

    return {
      intent,
      confidence: typeof parsed.confidence === "number" ? parsed.confidence : 0.8,
      extractedContent: (parsed.extractedContent as string) || (parsed.content as string) || (parsed.message as string),
      reasoning: parsed.reasoning as string,
    };
  } catch (err) {
    console.error("Intent detection AI call failed:", err);
    return null;
  }
}

// ============================================================================
// 主入口
// ============================================================================

/**
 * 综合意图识别
 * 策略：
 * 1. 快速关键词判断（零成本）
 * 2. 如果命中明确关键词，直接返回
 * 3. 如果不确定，调用 AI 识别
 * 4. 如果 AI 也无法确定，返回 chat（默认意图）
 */
export async function detectUserIntent(
  text: string,
  tenantId?: string
): Promise<IntentResult> {
  if (!text?.trim()) {
    return { intent: "unknown", confidence: 0, reasoning: "空消息" };
  }

  // 第一步：快速关键词判断
  const quickResult = quickIntentCheck(text);
  if (quickResult) {
    const extracted = quickResult === "send_dingtalk" ? extractDingtalkContent(text) : undefined;
    return {
      intent: quickResult,
      confidence: 1.0,
      extractedContent: extracted,
      reasoning: "Quick keyword match",
    };
  }

  // 第二步：获取 AI 配置并调用 AI 意图识别
  if (tenantId) {
    const aiConfig = await fetchAIConfig(tenantId);
    if (aiConfig?.apiKey) {
      const aiResult = await detectIntentWithAI(text, aiConfig.apiKey, aiConfig.baseUrl, aiConfig.model);
      if (aiResult) {
        if (aiResult.intent === "send_dingtalk" && !aiResult.extractedContent) {
          aiResult.extractedContent = extractDingtalkContent(text);
        }
        return aiResult;
      }
    }
  }

  // 第三步：降级为普通聊天
  return {
    intent: "chat",
    confidence: 0.5,
    reasoning: "Fallback to chat after detection failure",
  };
}

/**
 * 便捷函数：客户端调用意图识别（通过服务端 API）
 */
export async function detectUserIntentClient(
  text: string,
  tenantId?: string
): Promise<IntentResult> {
  try {
    const res = await fetch("/api/intent-detection", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, tenantId }),
    });
    if (res.ok) {
      return await res.json();
    }
  } catch (err) {
    console.error("Intent detection API call failed:", err);
  }

  // 服务端不可用时的降级
  const quickResult = quickIntentCheck(text);
  if (quickResult) {
    return { intent: quickResult, confidence: 1.0, reasoning: "Client-side quick match" };
  }

  return { intent: "chat", confidence: 0.3, reasoning: "降级为 chat（API 不可用）" };
}
