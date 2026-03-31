import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

// ── 服务端内存缓存 ──────────────────────────────────────────────
// 缓存粒度：tenantId + 上下文指纹（数据源/数据集数量 + 公司画像 hash + 历史对话数量）
// 同一租户在数据未变化时命中缓存，避免重复调 LLM
interface CacheEntry {
  questions: string[];
  source: string;
  createdAt: number;
}

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 分钟
const MAX_CACHE_SIZE = 200; // 最多缓存 200 个 key，防止内存泄漏
const suggestionsCache = new Map<string, CacheEntry>();

/** 简易字符串 hash（用于生成缓存 key 指纹） */
function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  return hash.toString(36);
}

/** 构造缓存 key：tenantId + 上下文特征指纹 */
function buildCacheKey(
  tenantId: string,
  dataSourceCount: number,
  datasetCount: number,
  companyProfile: any,
  conversationCount: number
): string {
  const profileHash = companyProfile ? simpleHash(JSON.stringify(companyProfile)) : "none";
  return `${tenantId}:ds${dataSourceCount}:up${datasetCount}:p${profileHash}:c${conversationCount}`;
}

/** 淘汰过期条目 & 控制总量 */
function evictCache(): void {
  const now = Date.now();
  for (const [key, entry] of suggestionsCache) {
    if (now - entry.createdAt > CACHE_TTL_MS) {
      suggestionsCache.delete(key);
    }
  }
  // 超过上限时删除最旧的条目
  if (suggestionsCache.size > MAX_CACHE_SIZE) {
    const keysToDelete = Array.from(suggestionsCache.keys()).slice(0, suggestionsCache.size - MAX_CACHE_SIZE);
    for (const key of keysToDelete) {
      suggestionsCache.delete(key);
    }
  }
}

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

// 用户上传的数据集上下文
interface UploadedDatasetInfo {
  id: string;
  name: string;
  fileName: string;
  fileFormat: string;
  status: string;
  rowCount: number;
  columnCount: number;
  columns: ColumnInfo[];
}

interface UploadedDatasetsContext {
  total: number;
  datasets: UploadedDatasetInfo[];
}

interface ConversationSummary {
  id: string;
  title: string;
  preview: string;
  messageCount: number;
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

const SUGGESTION_SYSTEM_PROMPT = `你是 BizLens 的智能数据分析师助手。你的任务是根据以下信息，生成 4~6 个最符合用户实际业务场景的个性化推荐问题。

## 生成规则
1. **优先基于用户上传的数据集**：如果提供了用户上传的数据集信息，优先根据数据集的名称、字段来生成推荐问题，不要猜测用户上传的是什么类型的数据
2. **基于已配置数据源**：如果提供了数据库表结构，优先使用真实表名和字段名提问，让问题更具体可执行
3. **基于公司背景**：如果提供了公司画像（行业、业务目标、核心指标），围绕公司主营业务提问
4. **基于历史提问模式**：分析历史对话，找出用户反复关注的主题，这些主题优先出推荐
5. **无数据时的通用问题**：如果没有任何数据上下文，不要猜测用户业务类型，只问通用探索性问题
6. **多样性原则**：推荐问题应覆盖不同分析维度（数据概览、结构分析、探索性提问等）
7. **具体化优先**：用具体数值或业务术语提问，不要泛泛而问
8. **中文提问**：所有问题必须用中文表述，符合中国业务场景

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
如果没有任何上下文信息（无公司画像、无数据源、无上传数据集、无历史对话），返回通用探索性问题：
["请介绍一下这个数据集的基本情况", "有哪些字段可以进行数据分析", "帮我做一个简单的数据概览", "哪些指标需要重点关注", "如何快速开始数据探索"]`;

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
    if (process.env.INTERNAL_API_TOKEN) headers["X-Internal-Token"] = process.env.INTERNAL_API_TOKEN;
    headers["X-Include-Secret"] = "true";

    const res = await fetch(`${backendBase}/api/tenants/${tenantId}/ai-config`, {
      method: "GET",
      headers,
      cache: "no-store",
      signal: AbortSignal.timeout(10000),
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
      signal: AbortSignal.timeout(10000),
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

// 获取用户上传的数据集上下文
async function getUploadedDatasetsContextFromBackend(
  tenantId: string,
  authHeader?: string | null
): Promise<UploadedDatasetsContext | null> {
  const backendBase = process.env.BACKEND_INTERNAL_URL || "http://localhost:3001";
  try {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "X-Tenant-ID": tenantId,
    };
    if (authHeader) headers.Authorization = authHeader;

    // 获取用户上传的数据集列表
    const res = await fetch(`${backendBase}/api/datasets?page=1&limit=50`, {
      method: "GET",
      headers,
      cache: "no-store",
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return null;

    const payload = await res.json();
    const datasets = Array.isArray(payload?.data) ? payload.data : [];

    // 解析每个数据集的 schema 信息
    const enrichedDatasets: UploadedDatasetInfo[] = datasets
      .filter((ds: any) => ds.status === "ready" || ds.status === "parsing")
      .map((ds: any) => {
        let columns: ColumnInfo[] = [];
        // 解析 schema JSON 字符串
        if (ds.schema && typeof ds.schema === "string") {
          try {
            const parsed = JSON.parse(ds.schema);
            if (Array.isArray(parsed)) {
              columns = parsed.map((col: any) => ({
                field: String(col?.name || col?.field || ""),
                type: String(col?.type || "unknown"),
                nullable: Boolean(col?.nullable ?? true),
              }));
            }
          } catch {
            // ignore
          }
        } else if (Array.isArray(ds.schema)) {
          columns = ds.schema.map((col: any) => ({
            field: String(col?.name || col?.field || ""),
            type: String(col?.type || "unknown"),
            nullable: Boolean(col?.nullable ?? true),
          }));
        }

        return {
          id: String(ds.id || ""),
          name: String(ds.name || ds.fileName || "未命名数据集"),
          fileName: String(ds.fileName || ""),
          fileFormat: String(ds.fileFormat || ""),
          status: String(ds.status || "unknown"),
          rowCount: Number(ds.rowCount || 0),
          columnCount: Number(ds.columnCount || 0),
          columns: columns.slice(0, 100), // 限制列数
        };
      })
      .filter((ds: UploadedDatasetInfo) => ds.id);

    return {
      total: enrichedDatasets.length,
      datasets: enrichedDatasets,
    };
  } catch {
    return null;
  }
}

// 通用默认问题（不假设任何特定业务类型）
const DEFAULT_QUESTIONS = [
  "请介绍一下这个数据集的基本情况",
  "有哪些字段可以进行数据分析",
  "帮我做一个简单的数据概览",
  "哪些指标需要重点关注",
  "如何快速开始数据探索",
];

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization");
    const tokenTenantId = resolveTenantIdFromAuthHeader(authHeader);
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

    const resolvedTenantId = tokenTenantId || tenantId || "demo-tenant";

    // ── 缓存命中检查（快速路径） ──
    // 先用一个粗粒度 key 尝试命中，避免发起 3 个后端请求 + LLM 调用
    // conversations 数量变化不大时可复用（只看 count 而非内容）
    const conversationCount = Array.isArray(conversations) ? conversations.length : 0;

    // 并行获取 AI 配置、数据源上下文和上传数据集上下文（各自 10 秒超时）
    const [serverConfig, dataSourceContext, uploadedDatasetsContext] = await Promise.all([
      getTenantAIConfigFromBackend(resolvedTenantId, authHeader),
      getTenantDataSourcesContextFromBackend(resolvedTenantId, authHeader),
      getUploadedDatasetsContextFromBackend(resolvedTenantId, authHeader),
    ]);

    // 构造缓存 key 并检查缓存
    const dsCount = dataSourceContext?.total || 0;
    const upCount = uploadedDatasetsContext?.total || 0;
    const cacheKey = buildCacheKey(resolvedTenantId, dsCount, upCount, companyProfile, conversationCount);

    evictCache();
    const cached = suggestionsCache.get(cacheKey);
    if (cached && Date.now() - cached.createdAt < CACHE_TTL_MS) {
      return NextResponse.json({ questions: cached.questions, source: "cache" });
    }

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

    // 用户上传的数据集上下文
    if (uploadedDatasetsContext && uploadedDatasetsContext.total > 0) {
      const datasetsSummary = uploadedDatasetsContext.datasets.map((ds) => ({
        name: ds.name,
        fileName: ds.fileName,
        fileFormat: ds.fileFormat,
        status: ds.status,
        rowCount: ds.rowCount,
        columnCount: ds.columnCount,
        columns: ds.columns.map((c) => ({ field: c.field, type: c.type })),
      }));
      contextPrompt += `\n## 用户上传的数据集\n${JSON.stringify(datasetsSummary, null, 2)}`;
    }

    // 历史对话摘要
    if (conversations && conversations.length > 0) {
      const topConversations = conversations.slice(0, 10).map((c) => ({
        title: c.title,
        preview: c.preview,
      }));
      contextPrompt += `\n## 用户历史提问（按时间倒序）\n${JSON.stringify(topConversations, null, 2)}`;
    }

    // 无任何上下文时返回默认问题
    const hasDataSource = dataSourceContext && dataSourceContext.total > 0;
    const hasUploadedDatasets = uploadedDatasetsContext && uploadedDatasetsContext.total > 0;
    const hasCompanyProfile = !!companyProfile;
    const hasConversations = conversations && conversations.length > 0;

    if (!hasDataSource && !hasUploadedDatasets && !hasCompanyProfile && !hasConversations) {
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
        questions = parsed.filter((q) => q.trim().length > 0).slice(0, 6);
      } else {
        questions = DEFAULT_QUESTIONS;
      }
    } catch {
      questions = DEFAULT_QUESTIONS;
    }

    // 写入缓存
    suggestionsCache.set(cacheKey, { questions, source: "ai", createdAt: Date.now() });

    return NextResponse.json({ questions, source: "ai" });
  } catch (err: any) {
    if (err?.name === "AbortError" || err?.message?.includes("aborted")) {
      return NextResponse.json({ error: "aborted" }, { status: 499 });
    }
    // 出错时降级返回默认问题
    return NextResponse.json({ questions: DEFAULT_QUESTIONS, source: "default" });
  }
}
