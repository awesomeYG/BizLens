import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

interface ColumnInfo {
  field: string;
  type: string;
  nullable: boolean;
}

interface TableSchema {
  name: string;
  columns: ColumnInfo[];
  recordCount: number;
}

interface TenantDataSource {
  id: string;
  name: string;
  type: string;
  status: string;
  description?: string;
  database?: string;
  host?: string;
  tables: string[];
  tablesInfo?: TableSchema[];
}

interface TenantDataSourceContext {
  total: number;
  connected: number;
  dataSources: TenantDataSource[];
}

interface ConversationSummary {
  id: string;
  title: string;
  preview: string;
  messageCount: number;
}

const SUGGESTION_SYSTEM_PROMPT = `你是 BizLens 的智能数据分析师助手。你的任务是根据以下信息，生成 4~6 个最符合用户实际业务场景的个性化推荐问题。

## 生成规则
1. **基于公司背景**：如果提供了公司画像（行业、业务目标、核心指标），优先围绕公司主营业务提问
2. **基于数据源结构**：如果提供了数据库表结构，优先使用真实表名和字段名提问，让问题更具体可执行
3. **基于历史提问模式**：分析历史对话，找出用户反复关注的主题，这些主题优先出推荐
4. **基于行业通用分析**：适当补充 1~2 个行业通用分析问题（趋势、对比、预测等）
5. **多样性原则**：推荐问题应覆盖不同分析维度（现状描述、趋势分析、对比分析、预测推断等）
6. **具体化优先**：用具体数值或业务术语提问，不要泛泛而问（如"本月销售"而非"业务情况"）
7. **中文提问**：所有问题必须用中文表述，符合中国业务场景

## 输出格式（严格遵循）
你只需输出一行 JSON 数组，不要有任何额外文字说明：
["问题1", "问题2", "问题3", "问题4"]

## 问题风格要求
- 简洁有力，15~40 个字
- 包含具体业务关键词（用上数据表/字段中的真实名称更佳）
- 不带问号后缀（前端渲染时统一加）
- 不重复问题
- 不使用"请问"、"能否"等开头

## 无数据时的降级策略
如果没有任何上下文信息（无公司画像、无数据源、无历史对话），返回以下默认问题：
["上月销售额与环比增长情况", "本月营收趋势分析", "哪个产品/渠道表现最好", "下个月的销售预测", "帮我生成一个数据大屏方案"]`;

function getDefaultBaseURLByModelType(modelType?: string): string | undefined {
  if (modelType === "minmax") return "https://api.minimax.io/v1";
  if (modelType === "deepseek") return "https://api.deepseek.com/v1";
  return undefined;
}

function getModelConfig(modelType?: string) {
  const resolvedModelType = modelType || process.env.AI_MODEL_TYPE || "openai";
  switch (resolvedModelType) {
    case "minmax":
      return { model: process.env.MINIMAX_MODEL || "MiniMax-M2", maxTokens: 300, temperature: 0.8 };
    case "claude":
      return { model: "claude-3-sonnet-20240229", maxTokens: 300, temperature: 0.8 };
    case "qwen":
      return { model: "qwen-plus", maxTokens: 300, temperature: 0.8 };
    case "ernie":
      return { model: "ernie-bot-4", maxTokens: 300, temperature: 0.8 };
    default:
      return { model: process.env.OPENAI_MODEL || "gpt-4o-mini", maxTokens: 300, temperature: 0.8 };
  }
}

async function getTenantAIConfigFromBackend(tenantId: string, authHeader?: string | null) {
  const backendBase = process.env.BACKEND_INTERNAL_URL || "http://localhost:3001";
  try {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "X-Tenant-ID": tenantId,
    };
    if (authHeader) headers.Authorization = authHeader;

    const res = await fetch(`${backendBase}/api/tenants/${tenantId}/ai-config`, {
      method: "GET",
      headers,
      cache: "no-store",
    });
    if (!res.ok) return null;
    const payload = await res.json();
    return {
      apiKey: payload?.apiKey,
      baseUrl: payload?.baseUrl,
      modelType: payload?.modelType,
      model: payload?.model,
    };
  } catch {
    return null;
  }
}

async function getTenantDataSourcesContextFromBackend(
  tenantId: string,
  authHeader?: string | null
): Promise<TenantDataSourceContext | null> {
  const backendBase = process.env.BACKEND_INTERNAL_URL || "http://localhost:3001";
  try {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "X-Tenant-ID": tenantId,
    };
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
      .map((item: any) => {
        let tables: string[] = [];
        if (Array.isArray(item?.tables)) {
          tables = item.tables.filter((t: unknown): t is string => typeof t === "string");
        } else if (typeof item?.tableInfo === "string" && item.tableInfo.trim()) {
          try {
            const parsed = JSON.parse(item.tableInfo);
            if (Array.isArray(parsed)) {
              tables = parsed.filter((t: unknown): t is string => typeof t === "string");
            }
          } catch {
            // ignore
          }
        }
        return {
          id: String(item?.id || ""),
          name: String(item?.name || "未命名数据源"),
          type: String(item?.type || "unknown"),
          status: String(item?.status || "unknown"),
          description: typeof item?.description === "string" ? item.description : undefined,
          database: typeof item?.database === "string" ? item.database : undefined,
          host: typeof item?.host === "string" ? item.host : undefined,
          tables: tables.slice(0, 100),
          tablesInfo: Array.isArray(item?.tablesInfo) ? item.tablesInfo.slice(0, 50) : undefined,
        };
      })
      .filter((item: { id: string }) => item.id);

    return {
      total: normalized.length,
      connected: normalized.filter((item: { status: string }) => item.status === "connected").length,
      dataSources: normalized.slice(0, 20),
    };
  } catch {
    return null;
  }
}

const DEFAULT_QUESTIONS = [
  "上月销售额与环比增长情况",
  "本月营收趋势分析",
  "哪个产品/渠道表现最好",
  "下个月的销售预测",
  "帮我生成一个数据大屏方案",
];

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization");
    const body = await req.json();
    const {
      tenantId,
      companyProfile,
      conversations,
      aiConfig: clientAiConfig,
    } = body as {
      tenantId?: string;
      companyProfile?: any;
      conversations?: ConversationSummary[];
      aiConfig?: {
        apiKey?: string;
        baseUrl?: string;
        modelType?: string;
        model?: string;
      };
    };

    const resolvedTenantId = tenantId || "demo-tenant";

    // 并行获取 AI 配置和数据源上下文
    const [serverConfig, dataSourceContext] = await Promise.all([
      getTenantAIConfigFromBackend(resolvedTenantId, authHeader),
      getTenantDataSourcesContextFromBackend(resolvedTenantId, authHeader),
    ]);

    const apiKey =
      clientAiConfig?.apiKey ||
      serverConfig?.apiKey ||
      process.env.OPENAI_API_KEY ||
      process.env.AI_API_KEY;

    // 无 API Key 时返回默认问题
    if (!apiKey) {
      return NextResponse.json({ questions: DEFAULT_QUESTIONS, source: "default" });
    }

    const modelType =
      clientAiConfig?.modelType || serverConfig?.modelType || process.env.AI_MODEL_TYPE || "openai";
    const modelConfig = getModelConfig(modelType);

    let finalModel = modelConfig.model;
    if (clientAiConfig?.model) finalModel = clientAiConfig.model;
    else if (serverConfig?.model) finalModel = serverConfig.model;

    const finalBaseURL =
      clientAiConfig?.baseUrl ||
      serverConfig?.baseUrl ||
      process.env.OPENAI_BASE_URL ||
      getDefaultBaseURLByModelType(modelType);

    // 构建上下文提示
    let contextPrompt = "";

    // 公司画像
    if (companyProfile) {
      const profile = typeof companyProfile === "string" ? companyProfile : JSON.stringify(companyProfile, null, 2);
      contextPrompt += `\n## 公司画像\n${profile}`;
    }

    // 数据源上下文
    if (dataSourceContext && dataSourceContext.total > 0) {
      const enriched = dataSourceContext.dataSources.map((ds) => ({
        name: ds.name,
        type: ds.type,
        status: ds.status,
        database: ds.database,
        tables:
          ds.tablesInfo && ds.tablesInfo.length > 0
            ? ds.tablesInfo.map((t) => ({
                name: t.name,
                recordCount: t.recordCount,
                columns: t.columns.map((c) => ({ field: c.field, type: c.type })),
              }))
            : ds.tables.map((name) => ({ name, recordCount: 0, columns: [] })),
      }));
      contextPrompt += `\n## 已配置数据源\n${JSON.stringify(enriched, null, 2)}`;
    }

    // 历史对话摘要
    if (conversations && conversations.length > 0) {
      const topConversations = conversations.slice(0, 10).map((c) => ({
        title: c.title,
        preview: c.preview,
      }));
      contextPrompt += `\n## 用户历史提问（按时间倒序）\n${JSON.stringify(topConversations, null, 2)}`;
    }

    if (!contextPrompt) {
      return NextResponse.json({ questions: DEFAULT_QUESTIONS, source: "default" });
    }

    const openai = new OpenAI({ apiKey, baseURL: finalBaseURL });

    const response = await openai.chat.completions.create(
      {
        model: finalModel,
        messages: [
          { role: "system", content: SUGGESTION_SYSTEM_PROMPT + (contextPrompt || "") },
          {
            role: "user",
            content: "请根据以上上下文信息，生成 4~6 个最符合该用户业务场景的个性化推荐问题。只需输出一行 JSON 数组，不要有任何额外说明。",
          },
        ],
        max_tokens: modelConfig.maxTokens,
        temperature: modelConfig.temperature,
      },
      { signal: req.signal }
    );

    const rawContent = response.choices[0]?.message?.content?.trim() || "";

    // 尝试解析 JSON 数组
    let questions: string[];
    try {
      // 去掉可能存在的 markdown 代码块包裹
      const cleaned = rawContent.replace(/^```(?:json)?\s*/, "").replace(/\s*```$/, "").trim();
      const parsed = JSON.parse(cleaned);
      if (Array.isArray(parsed) && parsed.every((item) => typeof item === "string")) {
        questions = parsed.slice(0, 6);
      } else {
        questions = DEFAULT_QUESTIONS;
      }
    } catch {
      questions = DEFAULT_QUESTIONS;
    }

    return NextResponse.json({ questions, source: "ai" });
  } catch (err: any) {
    if (err?.name === "AbortError" || err?.message?.includes("aborted")) {
      return NextResponse.json({ error: "aborted" }, { status: 499 });
    }
    // 出错时降级返回默认问题
    return NextResponse.json({ questions: DEFAULT_QUESTIONS, source: "default" });
  }
}
