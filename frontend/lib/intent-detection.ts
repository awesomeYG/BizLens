import OpenAI from "openai";

/**
 * 用户意图类型
 */
export type UserIntent =
  | "send_dingtalk"   // 发送钉钉消息
  | "chat"            // 普通聊天
  | "dashboard"       // 生成大屏
  | "notification"    // 创建通知规则
  | "alert"          // 创建告警
  | "report"          // 生成报表
  | "datasource"     // 配置数据源
  | "unknown";        // 未知意图

/**
 * AI 配置
 */
export interface AIConfig {
  apiKey?: string;
  baseUrl?: string;
  modelType?: string;
  model?: string;
}

/**
 * 意图识别结果
 */
export interface IntentResult {
  intent: UserIntent;
  confidence: number;       // 0-1
  extractedContent?: string; // 提取的内容（如钉钉消息内容）
  reasoning?: string;       // AI 的推理过程
}

/**
 * 意图识别的系统提示词
 */
const INTENT_SYSTEM_PROMPT = `你是一个用户意图识别助手。用户可能通过各种自然的说法表达他们的需求，你需要准确识别。

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
- 发送钉钉消息的特征：包含"发"、"发送"、"通知"等动作词 + "钉钉"、"dingtalk"等目标
- 如果消息内容是纯文本且看起来像是要发送的通知/提醒，识别为 send_dingtalk
- 如果包含分析、查询、计算类动词（分析、查询、计算、看看），识别为 chat
- 如果包含创建、生成 + 大屏/看板/dashboard，识别为 dashboard

请以 JSON 格式返回结果：
{"intent": "意图类型", "confidence": 0.0-1.0, "extractedContent": "提取的消息内容（仅send_dingtalk时需要）", "reasoning": "判断理由"}`;

/**
 * 意图识别的用户消息模板
 */
function buildIntentPrompt(userMessage: string): string {
  return `用户消息：${userMessage}\n\n请识别用户意图并返回 JSON。`;
}

/**
 * 从后端获取 AI 配置
 */
async function fetchAIConfig(tenantId: string): Promise<AIConfig | null> {
  try {
    const token = localStorage.getItem("access_token");
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (token) headers.Authorization = `Bearer ${token}`;

    // 尝试从后端获取 AI 配置
    const res = await fetch(`/api/tenants/${tenantId}/ai-config`, {
      headers,
      cache: "no-store",
    });

    if (res.ok) {
      const data = await res.json();
      return {
        apiKey: data?.apiKey,
        baseUrl: data?.baseUrl,
        modelType: data?.modelType,
        model: data?.model,
      };
    }
  } catch {
    // 忽略错误
  }
  return null;
}

/**
 * 调用 AI 进行意图识别
 */
async function detectIntentWithAI(
  userMessage: string,
  apiKey?: string,
  baseURL?: string,
  model?: string
): Promise<IntentResult | null> {
  if (!apiKey) {
    return null;
  }

  try {
    const openai = new OpenAI({
      apiKey,
      baseURL: baseURL || undefined,
    });

    const response = await openai.chat.completions.create({
      model: model || "gpt-4o-mini",
      messages: [
        { role: "system", content: INTENT_SYSTEM_PROMPT },
        { role: "user", content: buildIntentPrompt(userMessage) },
      ],
      max_tokens: 200,
      temperature: 0,
    }, { signal: AbortSignal.timeout(5000) });

    const content = response.choices[0]?.message?.content?.trim();
    if (!content) {
      return null;
    }

    // 尝试解析 JSON
    let parsed: any;
    try {
      // 处理可能的 markdown 代码块
      const jsonStr = content.replace(/^```json\n?/, "").replace(/\n?```$/, "");
      parsed = JSON.parse(jsonStr);
    } catch {
      return null;
    }

    const intent = parsed.intent as UserIntent;
    if (!intent) {
      return null;
    }

    return {
      intent,
      confidence: parsed.confidence || 0.8,
      extractedContent: parsed.extractedContent || parsed.content || parsed.message,
      reasoning: parsed.reasoning,
    };
  } catch (err) {
    console.error("Intent detection AI call failed:", err);
    return null;
  }
}

/**
 * 根据关键词做快速判断（作为 AI 判断的补充）
 * 如果命中明确关键词，直接返回意图，避免不必要的 AI 调用
 */
function quickIntentCheck(userMessage: string): UserIntent | null {
  const lower = userMessage.toLowerCase();

  // 明确的钉钉发送关键词
  const dingtalkKeywords = [
    "给钉钉发", "发钉钉", "钉钉发", "发到钉钉",
    "发送到钉钉", "钉钉通知", "给dingtalk", "dingtalk发",
    "send to dingtalk", "钉钉消息",
  ];

  for (const keyword of dingtalkKeywords) {
    if (lower.includes(keyword)) {
      return "send_dingtalk";
    }
  }

  // 明确的大屏关键词
  const dashboardKeywords = ["生成大屏", "创建大屏", "大屏", "dashboard", "看板"];
  for (const keyword of dashboardKeywords) {
    if (lower.includes(keyword)) {
      return "dashboard";
    }
  }

  // 明确的通知规则关键词
  const notificationKeywords = ["通知我", "通知规则", "提醒我"];
  for (const keyword of notificationKeywords) {
    if (lower.includes(keyword)) {
      return "notification";
    }
  }

  // 明确的报表关键词
  const reportKeywords = ["生成报表", "创建报表", "日报", "周报", "月报"];
  for (const keyword of reportKeywords) {
    if (lower.includes(keyword)) {
      return "report";
    }
  }

  return null;
}

/**
 * 提取钉钉消息内容（当意图为 send_dingtalk 时）
 */
function extractDingtalkContent(userMessage: string, aiExtracted?: string): string {
  // 如果 AI 已经提取了内容，直接使用
  if (aiExtracted && aiExtracted.trim()) {
    return aiExtracted.trim();
  }

  // 否则用简单的方式提取：找到消息内容（引号内或冒号后的内容）
  const patterns = [
    // 引号内的内容
    /['"「]([^'"」]+)['"」]/,
    // 冒号后的内容
    /[:：]\s*([^\n]+)/,
  ];

  for (const pattern of patterns) {
    const match = userMessage.match(pattern);
    if (match && match[1] && match[1].trim()) {
      return match[1].trim();
    }
  }

  // 最后尝试：去掉"给钉钉发个消息"等前缀，返回剩余部分
  return userMessage
    .replace(/给钉钉发(?:个|句|条)?(?:消息|通知)?/gi, "")
    .replace(/发(?:送到?)?钉钉/gi, "")
    .replace(/钉钉发(?:个|句|条)?(?:消息|通知)?/gi, "")
    .replace(/dingtalk(?:发|发送)?/gi, "")
    .replace(/[:：]/g, "")
    .trim() || userMessage;
}

/**
 * 综合意图识别函数
 *
 * 策略：
 * 1. 先用关键词快速判断（零成本）
 * 2. 如果命中明确关键词，直接返回
 * 3. 如果不确定，调用 AI 做意图识别
 * 4. 如果 AI 也无法确定，返回 chat（默认意图）
 *
 * @param userMessage 用户消息
 * @param tenantId 租户 ID（用于获取 AI 配置）
 * @returns 意图识别结果
 */
export async function detectUserIntent(
  userMessage: string,
  tenantId?: string
): Promise<IntentResult> {
  // 第一步：快速关键词判断
  const quickResult = quickIntentCheck(userMessage);
  if (quickResult) {
    const extracted = quickResult === "send_dingtalk"
      ? extractDingtalkContent(userMessage)
      : undefined;
    return {
      intent: quickResult,
      confidence: 1.0,
      extractedContent: extracted,
      reasoning: "Quick keyword match",
    };
  }

  // 第二步：获取 AI 配置并调用意图识别
  if (tenantId) {
    const aiConfig = await fetchAIConfig(tenantId);
    if (aiConfig?.apiKey) {
      const aiResult = await detectIntentWithAI(
        userMessage,
        aiConfig.apiKey,
        aiConfig.baseUrl,
        aiConfig.model
      );
      if (aiResult) {
        // 如果 AI 识别为 send_dingtalk，尝试提取消息内容
        if (aiResult.intent === "send_dingtalk" && !aiResult.extractedContent) {
          aiResult.extractedContent = extractDingtalkContent(userMessage);
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
