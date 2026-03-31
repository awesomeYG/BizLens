/**
 * AI Chat API Route
 * 核心 AI 对话接口，支持多模型、流式响应和工具调用
 */

import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { buildSystemPrompt } from "@/lib/chat/system-prompt";
import { mergeAIConfig, getModelConfig } from "@/lib/chat/ai-config";
import { analyzeQuestion, getEvaluationSummary } from "@/lib/ai-analysis";

// ============================================================================
// 类型定义
// ============================================================================

interface ChatRequestBody {
  messages: { role: string; content: string }[];
  dataSummary?: string;
  dataSchema?: unknown;
  companyProfile?: unknown;
  conversationContext?: unknown;
  tenantId?: string;
  aiConfig?: {
    apiKey?: string;
    baseUrl?: string;
    modelType?: string;
    model?: string;
  };
}

interface TenantDataSourceContext {
  total: number;
  connected: number;
  dataSources: Array<{
    id: string;
    name: string;
    type: string;
    status: string;
    database?: string;
    host?: string;
    lastSyncAt?: string;
    tables: string[];
    tablesInfo?: Array<{
      name: string;
      recordCount: number;
      columns: Array<{ field: string; type: string; nullable: boolean }>;
    }>;
  }>;
}

function resolveTenantIdFromAuthHeader(authHeader?: string | null): string | undefined {
  if (!authHeader?.startsWith("Bearer ")) return undefined;

  const token = authHeader.slice(7).trim();
  const parts = token.split(".");
  if (parts.length < 2) return undefined;

  try {
    const payload = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8")) as { tenantId?: string };
    return typeof payload.tenantId === "string" && payload.tenantId.trim() ? payload.tenantId : undefined;
  } catch {
    return undefined;
  }
}

const DEFAULT_TENANT_ID = "default";

// ============================================================================
// API 端点
// ============================================================================

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization");
    const tokenTenantId = resolveTenantIdFromAuthHeader(authHeader);
    const body = await req.json() as ChatRequestBody;
    const { messages, dataSummary, dataSchema, companyProfile, conversationContext, tenantId: clientTenantId, aiConfig: clientAiConfig } = body;

    // 参数验证
    if (!messages?.length) {
      return NextResponse.json({ error: "消息不能为空" }, { status: 400 });
    }

    const latestUserMessage = [...messages].reverse().find((m) => m.role === "user")?.content || "";
    const tenantId = tokenTenantId ||
      clientTenantId ||
      (typeof conversationContext === "object" && conversationContext !== null && "tenantId" in conversationContext
        ? (conversationContext as { tenantId?: string }).tenantId
        : undefined) ||
      (typeof companyProfile === "object" && companyProfile !== null && "tenantId" in companyProfile
        ? (companyProfile as { tenantId?: string }).tenantId
        : undefined) ||
      DEFAULT_TENANT_ID;

    // -------------------------------------------------------------------------
    // 1. 获取上下文数据
    // -------------------------------------------------------------------------
    const dataSourceContext = await getTenantDataSourcesContextFromBackend(tenantId, authHeader);
    const autoQueryData = await fetchAutoQueryData(tenantId, authHeader, dataSourceContext, latestUserMessage);
    const analysisPacket = await getAnalysisPacketFromBackend(tenantId, latestUserMessage);

    // -------------------------------------------------------------------------
    // 2. 合并 AI 配置
    // -------------------------------------------------------------------------
    const serverConfig = await getTenantAIConfigFromBackend(tenantId, authHeader);
    const config = mergeAIConfig(clientAiConfig, serverConfig ?? undefined);

    // 演示模式：无 API Key
    if (!config.apiKey) {
      const demoContent = dataSummary
        ? `根据你上传的数据：\n${dataSummary}\n\n**建议：**\n1. 配置 API Key 启用真实 AI 分析\n2. 尝试提问"帮我分析销售趋势"\n3. 说"生成数据大屏"创建可视化`
        : "请先上传数据文件，然后我可以帮你分析。";

      return NextResponse.json(
        { content: "⚠️ 演示模式：未配置 AI API Key\n\n" + demoContent, demoMode: true },
        { status: 200 }
      );
    }

    // -------------------------------------------------------------------------
    // 3. 构建 System Prompt
    // -------------------------------------------------------------------------
    const systemContent = buildSystemPrompt({
      companyProfile,
      dataSchema,
      dataSummary,
      conversationContext,
      dataSourceContext,
      autoQueryData,
      analysisPacket,
    });

    // -------------------------------------------------------------------------
    // 4. 调用 AI（流式响应）
    // -------------------------------------------------------------------------
    const modelConfig = getModelConfig(config.modelType);
    const openai = new OpenAI({ apiKey: config.apiKey, baseURL: config.baseUrl });

    const tools: OpenAI.Chat.ChatCompletionTool[] = [
      {
        type: "function",
        function: {
          name: "send_im_message",
          description: `仅用于向外部 IM 平台发送即时消息（钉钉、飞书、企业微信等），绝不可用于查询、分析、计划、推理、生成回复或与当前用户对话。

【禁止场景】以下情况绝对不可调用此工具：
1. 用户要求分析数据、查询指标、解释趋势、生成报表、生成大屏、做计划、给出建议、回答问题
2. 你只是想把中间结论、思考过程、执行计划或最终答案展示给当前用户
3. 你不确定是否需要发送外部通知

【使用条件】仅在以下情况才调用此工具：
1. 用户**明确要求**将消息发送到某个 IM 平台（如"帮我发条钉钉"、"发到飞书通知我"）
2. 或用户当前正在查看的数据中发现了核心指标的**严重异常**（如注册量/订单量/销售额突变为 0 或异常飙升，偏离历史基线 50% 以上）

如果你不确定是否应该发送，不要调用此工具。默认直接在聊天中回复用户，而不是调用此工具。`,
          parameters: {
            type: "object",
            properties: {
              platform: {
                type: "string",
                description: "目标 IM 平台：dingtalk（钉钉）、feishu（飞书）、wecom（企业微信）、slack、telegram、discord。仅在确认存在真实数据异常时才指定。",
                enum: ["dingtalk", "feishu", "wecom", "slack", "telegram", "discord"],
              },
              content: { type: "string", description: "要发送的消息内容，应简洁明了，去除 Markdown 格式标记" },
              markdown: { type: "boolean", description: "是否使用 Markdown 格式，默认为 false" },
            },
            required: ["platform", "content"],
          },
        },
      },
    ];

    const allMessages: OpenAI.Chat.ChatCompletionMessageParam[] = [
      { role: "system", content: systemContent },
      ...messages.map((m) => ({ role: m.role as "user" | "assistant" | "system", content: m.content })),
    ];

    // 流式响应
    return streamAIResponse({
      req,
      openai,
      model: config.model,
      modelConfig,
      messages: allMessages,
      tools,
      tenantId,
      finalModelType: config.modelType,
    });
  } catch (err: unknown) {
    return handleError(err);
  }
}

// ============================================================================
// 流式响应处理
// ============================================================================

interface StreamAIResponseOptions {
  req: NextRequest;
  openai: OpenAI;
  model: string;
  modelConfig: ReturnType<typeof getModelConfig>;
  messages: OpenAI.Chat.ChatCompletionMessageParam[];
  tools: OpenAI.Chat.ChatCompletionTool[];
  tenantId: string;
  finalModelType: string;
}

async function streamAIResponse(options: StreamAIResponseOptions) {
  const { req, openai, model, modelConfig, messages, tools, tenantId, finalModelType } = options;
  const encoder = new TextEncoder();

  const readable = new ReadableStream({
    async start(controller) {
      try {
        if (req.signal.aborted) {
          controller.close();
          return;
        }

        // 发送 meta 信息
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "meta" })}\n\n`));

        // 创建流
        const stream = await openai.chat.completions.create({
          model,
          messages,
          max_tokens: modelConfig.maxTokens,
          temperature: modelConfig.temperature,
          tools,
          stream: true,
        }, { signal: req.signal });

        let toolCallId = "";
        let toolCallArgs = "";
        let toolCallName = "";
        let hasToolCall = false;
        let assistantContent = "";

        // 第一阶段：流式输出
        for await (const chunk of stream) {
          if (req.signal.aborted) break;
          const delta = chunk.choices[0]?.delta;

          if (delta?.content) {
            assistantContent += delta.content;
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "delta", content: delta.content })}\n\n`));
          }

          if (delta?.tool_calls && delta.tool_calls.length > 0) {
            hasToolCall = true;
            const tc = delta.tool_calls[0];
            if (tc.id) toolCallId = tc.id;
            if (tc.function?.name) toolCallName = tc.function.name;
            if (tc.function?.arguments) toolCallArgs += tc.function.arguments;
          }
        }

        // 第二阶段：执行工具调用
        if (hasToolCall && toolCallId && toolCallArgs && !req.signal.aborted) {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "tool_call", toolName: "send_im_message", toolCallId })}\n\n`));

          let toolArgs: { platform?: string; content?: string; markdown?: boolean } = {};
          try {
            toolArgs = JSON.parse(toolCallArgs);
          } catch {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "error", error: "工具参数解析失败" })}\n\n`));
            controller.close();
            return;
          }

          // 调用后端发送 IM 消息
          const toolResult = await executeIMTool(tenantId, toolArgs);

          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "tool_result", toolCallId, result: toolResult })}\n\n`));

          // 第三阶段：反馈工具结果给 AI，生成自然语言确认
          const followUpMessages: OpenAI.Chat.ChatCompletionMessageParam[] = [
            ...messages,
            {
              role: "assistant",
              content: assistantContent || null,
              tool_calls: [{ id: toolCallId, type: "function", function: { name: toolCallName || "send_im_message", arguments: toolCallArgs } }],
            },
            { role: "tool", tool_call_id: toolCallId, content: JSON.stringify(toolResult) },
          ];

          const followUp = await openai.chat.completions.create({
            model,
            messages: followUpMessages,
            max_tokens: 500,
            temperature: 0.3,
            stream: true,
          }, { signal: req.signal });

          for await (const chunk of followUp) {
            if (req.signal.aborted) break;
            const delta = chunk.choices[0]?.delta?.content;
            if (delta) {
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "delta", content: delta })}\n\n`));
            }
          }
        }

        if (!req.signal.aborted) {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "done" })}\n\n`));
        }
      } catch (err) {
        const msg = String((err as { message?: string })?.message || err);
        const isAbort = req.signal.aborted || (err as { name?: string })?.name === "AbortError" || msg.toLowerCase().includes("aborted");
        if (!isAbort) {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "error", error: msg })}\n\n`));
        }
      } finally {
        try { controller.close(); } catch { /* ignore */ }
      }
    },
  });

  return new Response(readable, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}

/**
 * 执行 IM 工具调用
 */
async function executeIMTool(
  tenantId: string,
  args: { platform?: string; content?: string; markdown?: boolean }
): Promise<{ success: boolean; message: string }> {
  const backendBase = process.env.BACKEND_INTERNAL_URL || "http://localhost:3001";
  try {
    const res = await fetch(`${backendBase}/internal/send-im`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tenantId,
        platform: args.platform || "",
        content: args.content || "",
        markdown: args.markdown || false,
      }),
      signal: AbortSignal.timeout(30000),
    });

    if (res.ok) {
      const data = await res.json();
      return { success: true, message: data.message || "消息已发送" };
    }
    const errData = await res.json().catch(() => null);
    return { success: false, message: errData?.error || `HTTP ${res.status}` };
  } catch (err) {
    return { success: false, message: String(err) };
  }
}

/**
 * 错误处理
 */
function handleError(err: unknown): NextResponse {
  const errMessage = String((err as { message?: string })?.message || err);
  const errStatus = (err as { status?: number })?.status;
  const lowerErrMessage = errMessage.toLowerCase();

  // MiniMax 余额不足
  if (lowerErrMessage.includes("insufficient balance") || errMessage.includes("1008")) {
    return NextResponse.json(
      { error: "MiniMax 余额不足（错误码 1008）。请在 MiniMax 控制台确认计费账户余额。", analysisEvaluation: getEvaluationSummary() },
      { status: 402 }
    );
  }

  // 认证失败
  if (errStatus === 401) {
    return NextResponse.json(
      { error: `AI 认证失败，请检查 API Key / Base URL / 模型配置。`, analysisEvaluation: getEvaluationSummary() },
      { status: 401 }
    );
  }

  // 频率限制
  if (errStatus === 429) {
    return NextResponse.json(
      { error: "请求频率超限，请稍后重试", analysisEvaluation: getEvaluationSummary() },
      { status: 429 }
    );
  }

  console.error("Chat API error:", err);
  return NextResponse.json(
    { error: "AI 服务异常：" + errMessage, analysisEvaluation: getEvaluationSummary() },
    { status: 500 }
  );
}

// ============================================================================
// 后端 API 辅助函数
// ============================================================================

async function getAnalysisPacketFromBackend(tenantId: string, question: string) {
  const backendBase = process.env.BACKEND_INTERNAL_URL || "http://localhost:3001";
  try {
    const res = await fetch(`${backendBase}/api/tenants/${tenantId}/analysis/query`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Tenant-ID": tenantId },
      body: JSON.stringify({ question }),
      cache: "no-store",
    });
    if (res.ok) {
      const payload = await res.json();
      if (payload?.analysis) return payload.analysis;
    }
  } catch { /* ignore */ }

  return { ...analyzeQuestion(question), evaluation: getEvaluationSummary() };
}

async function getTenantAIConfigFromBackend(
  tenantId: string,
  authHeader?: string | null
): Promise<{ apiKey?: string; baseUrl?: string; modelType?: string; model?: string } | null> {
  const backendBase = process.env.BACKEND_INTERNAL_URL || "http://localhost:3001";
  try {
    const headers: Record<string, string> = { "Content-Type": "application/json", "X-Tenant-ID": tenantId };
    if (authHeader) headers.Authorization = authHeader;
    if (process.env.INTERNAL_API_TOKEN) headers["X-Internal-Token"] = process.env.INTERNAL_API_TOKEN;
    headers["X-Include-Secret"] = "true";

    const res = await fetch(`${backendBase}/api/tenants/${tenantId}/ai-config`, {
      method: "GET",
      headers,
      cache: "no-store",
      signal: AbortSignal.timeout(10000),
    });
    if (res.ok) {
      const payload = await res.json();
      return { apiKey: payload?.apiKey, baseUrl: payload?.baseUrl, modelType: payload?.modelType, model: payload?.model };
    }
  } catch { /* ignore */ }
  return null;
}

async function getTenantDataSourcesContextFromBackend(
  tenantId: string,
  authHeader?: string | null
): Promise<TenantDataSourceContext | null> {
  const backendBase = process.env.BACKEND_INTERNAL_URL || "http://localhost:3001";
  try {
    const headers: Record<string, string> = { "Content-Type": "application/json", "X-Tenant-ID": tenantId };
    if (authHeader) headers.Authorization = authHeader;

    const res = await fetch(`${backendBase}/api/tenants/${tenantId}/data-sources`, {
      method: "GET",
      headers,
      cache: "no-store",
    });

    if (!res.ok) return null;

    const payload = await res.json();
    if (!Array.isArray(payload)) return null;

    const normalized = payload
      .map((item: Record<string, unknown>) => {
        let tables: string[] = [];
        if (Array.isArray(item?.tables)) {
          tables = (item.tables as unknown[]).filter((t): t is string => typeof t === "string");
        } else if (typeof item?.tableInfo === "string" && item.tableInfo) {
          try {
            const parsed = JSON.parse(item.tableInfo as string);
            if (Array.isArray(parsed)) tables = parsed.filter((t: unknown): t is string => typeof t === "string");
          } catch { /* ignore */ }
        }

        const tablesInfoRaw = item?.tablesInfo as TenantDataSourceContext["dataSources"][0]["tablesInfo"] | undefined;
        const tablesInfo: TenantDataSourceContext["dataSources"][0]["tablesInfo"] | undefined = Array.isArray(tablesInfoRaw)
          ? tablesInfoRaw.slice(0, 50)
          : undefined;

        return {
          id: String(item?.id || ""),
          name: String(item?.name || "未命名数据源"),
          type: String(item?.type || "unknown"),
          status: String(item?.status || "unknown"),
          description: typeof item?.description === "string" ? item.description : undefined,
          database: typeof item?.database === "string" ? item.database : undefined,
          host: typeof item?.host === "string" ? item.host : undefined,
          lastSyncAt: typeof item?.lastSyncAt === "string" ? item.lastSyncAt : undefined,
          tables: tables.slice(0, 100),
          tablesInfo,
        };
      })
      .filter((item: { id: string; name: string }) => item.id || item.name);

    return {
      total: normalized.length,
      connected: normalized.filter((item: { status: string }) => item.status === "connected").length,
      dataSources: normalized.slice(0, 20) as TenantDataSourceContext["dataSources"],
    };
  } catch {
    return null;
  }
}

// AutoQuery 数据类型
interface AutoQueryData {
  totalCount?: Record<string, number>;
  distributions?: Array<{ tableName: string; columnName: string; columnType: string; topValues?: Array<{ label: string; value: number }>; rows?: Record<string, unknown>[] }>;
  timeTrends?: Array<{ tableName: string; columnName: string; rows?: Record<string, unknown>[] }>;
  sampleRows?: Array<{ tableName: string; rows?: Record<string, unknown>[] }>;
}

async function fetchAutoQueryData(
  tenantId: string,
  authHeader: string | null | undefined,
  dataSourceContext: TenantDataSourceContext | null,
  latestUserMessage?: string
): Promise<AutoQueryData | null> {
  if (!dataSourceContext || dataSourceContext.connected === 0) return null;

  const backendBase = process.env.BACKEND_INTERNAL_URL || "http://localhost:3001";
  const connectedDataSources = dataSourceContext.dataSources
    .filter((ds) => ds.status === "connected" && ds.tablesInfo && ds.tablesInfo.length > 0)
    .map((ds) => ({ id: ds.id, name: ds.name, type: ds.type, database: ds.database, tablesInfo: ds.tablesInfo || [] }));

  if (connectedDataSources.length === 0) return null;

  try {
    const headers: Record<string, string> = { "Content-Type": "application/json", "X-Tenant-ID": tenantId };
    if (authHeader) headers.Authorization = authHeader;

    const res = await fetch(`${backendBase}/api/tenants/${tenantId}/auto-query`, {
      method: "POST",
      headers,
      body: JSON.stringify({ question: latestUserMessage || "", dataSources: connectedDataSources }),
      signal: AbortSignal.timeout(30000),
    });

    if (res.ok) {
      const result = await res.json() as { success?: boolean; data?: AutoQueryData };
      if (result.success && result.data) return result.data;
    }
  } catch { /* AutoQuery 失败不影响主流程 */ }

  return null;
}
