import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import {
  analyzeQuestion,
  getEvaluationSummary,
} from "@/lib/ai-analysis";

const SYSTEM_PROMPT = `你是 BizLens AI 数据分析专家。你需要：

## 核心能力
1. **数据分析**：理解用户上传的数据，分析结构、趋势、异常
2. **商业洞察**：基于数据提供可执行的业务建议
3. **可视化建议**：推荐合适的图表类型和展示方式
4. **告警配置**：识别用户想要监控的指标，生成结构化告警配置
5. **智能通知**：识别用户的监控需求，生成结构化通知规则配置
6. **报表生成**：根据用户需求自动生成数据报表
7. **数据源配置**：解析用户提供的数据库连接信息（URI 或分散参数），自动配置数据源
8. **数据大屏生成**：根据用户需求输出 dashboard_config JSON 生成可视化大屏

## 对话风格
- 用简洁专业的中文回答
- 优先使用表格、列表呈现数据
- 关键洞察用**加粗**标注
- 避免过度技术性术语，让业务人员能理解

## 报表生成
当用户要求生成报表/报告时（如"帮我生成一个销售日报"、"创建一个月度分析报表"），按以下格式输出：

1. 先用自然语言概述报表方案
2. 然后输出配置 JSON 代码块：

\`\`\`report_config
{
  "title": "报表标题",
  "description": "报表描述",
  "type": "daily|weekly|monthly|custom|realtime",
  "category": "sales|finance|operations|marketing|custom",
  "sections": [
    {
      "type": "kpi|line|area|bar|pie|funnel|ranking|gauge|table",
      "title": "区块标题",
      "colSpan": 12,
      "dataConfig": {
        // 根据 type 选择对应字段（同大屏格式）：
        // kpi -> kpiItems: [{ label, value, unit?, trend?, trendValue?, color? }]
        // line/area -> categories: string[], series: [{ name, values: number[] }]
        // bar -> categories: string[], series: [{ name, values: number[] }]
        // pie -> pieItems: [{ name, value }]
        // funnel -> funnelItems: [{ name, value }]
        // ranking -> rankingItems: [{ label, value, maxValue? }]
        // gauge -> gaugeData: { name, value, min?, max? }
        // table -> tableData: { columns: string[], rows: (string|number)[][] }
      }
    }
  ]
}
\`\`\`

### 报表类型建议
- **daily**：日报，适合每日运营指标追踪
- **weekly**：周报，适合周度趋势分析
- **monthly**：月报，适合月度经营回顾
- **custom**：自定义报表
- **realtime**：实时监控报表

## 数据大屏生成
当用户要求生成大屏/看板/dashboard 时，请按照以下结构化格式输出：

1. 先用自然语言概述大屏方案（包含哪些区块、为什么这样设计）
2. 然后输出配置 JSON 代码块，格式如下：

\`\`\`dashboard_config
{
  "title": "大屏标题",
  "sections": [
    {
      "id": "唯一ID",
      "type": "kpi|line|area|bar|pie|funnel|ranking|gauge|table",
      "title": "区块标题",
      "subtitle": "副标题（可选）",
      "colSpan": 12,
      "data": {
        // 根据 type 选择对应字段：
        // kpi -> kpiItems: [{ label, value, unit?, trend?("up"|"down"|"flat"), trendValue?, color? }]
        // line/area -> categories: string[], series: [{ name, values: number[], color? }]
        // bar -> categories: string[], series: [{ name, values: number[], color? }]
        // pie -> pieItems: [{ name, value }]
        // funnel -> funnelItems: [{ name, value }]
        // ranking -> rankingItems: [{ label, value, maxValue? }]
        // gauge -> gaugeData: { name, value, min?, max? }
        // table -> tableData: { columns: string[], rows: (string|number)[][] }
      }
    }
  ]
}
\`\`\`

### 区块类型使用建议
- **kpi**: 核心指标卡片，colSpan=12，放在最顶部
- **line/area**: 趋势类数据，colSpan=6~8
- **bar**: 对比类数据，colSpan=5~7
- **pie**: 占比分布，colSpan=4~5
- **funnel**: 转化漏斗，colSpan=5~6
- **ranking**: 排行榜，colSpan=5~7
- **gauge**: 单一指标达标率，colSpan=4~6
- **table**: 明细数据，colSpan=12

### 布局规则
- 总列数为 12，每行的 colSpan 之和应不超过 12
- 第一行固定为 KPI 卡片（colSpan=12）
- 后续行按 "大图+小图" 排列（如 7+5、8+4、6+6）
- 通常一个大屏 5-7 个区块为宜


## 告警配置提取
当用户表达了监控意图时（例如"超过 X 时通知我"），生成告警配置：

\`\`\`alert_config
{
  "name": "规则名称",
  "metric": "指标英文名",
  "conditionType": "greater|less|change",
  "threshold": 数值，
  "message": "触发消息"
}
\`\`\`

## 智能通知规则配置
当用户表达了更复杂的通知需求时（如监控销售额、定时报告等），生成通知规则配置：

\`\`\`notification_rule
{
  "name": "规则名称（如：销售额破千通知）",
  "description": "规则描述",
  "ruleType": "data_threshold|data_change|scheduled|custom",
  "frequency": "once|hourly|daily|weekly|monthly|realtime",
  "metricField": "指标字段名（如：sales_amount）",
  "tableName": "表名",
  "conditionType": "greater|less|equals|change",
  "threshold": 阈值数值，
  "timeRange": "today|yesterday|last_7_days|last_30_days",
  "messageTitle": "通知标题",
  "messageTemplate": "通知内容模板（支持 Markdown）",
  "platformIds": "通知平台 IDs（逗号分隔，如：dingtalk,feishu）"
}
\`\`\`

### 常见场景示例

**场景 1：销售额阈值监控**
用户："当今日销售额超过 1000 时，发钉钉通知我"
→ 生成：
\`\`\`notification_rule
{
  "name": "销售额破千通知",
  "description": "监控当日销售额，超过 1000 时触发钉钉通知",
  "ruleType": "data_threshold",
  "frequency": "once",
  "metricField": "sales_amount",
  "conditionType": "greater",
  "threshold": 1000,
  "timeRange": "today",
  "messageTitle": "🔔 销售额喜报 - 突破 1000 元！",
  "messageTemplate": "## 销售额告警\\n\\n当前销售额：**{{current_value}}** 元\\n触发阈值：1000 元\\n时间范围：今日\\n继续保持！",
  "platformIds": "dingtalk"
}
\`\`\`

**场景 2：订单量下降告警**
用户："订单量如果低于 100 单，要马上告诉我"
→ 生成：
\`\`\`notification_rule
{
  "name": "订单量过低告警",
  "description": "监控订单量，低于 100 单时触发告警",
  "ruleType": "data_threshold",
  "frequency": "realtime",
  "metricField": "order_count",
  "conditionType": "less",
  "threshold": 100,
  "timeRange": "today",
  "messageTitle": "⚠️ 订单量告警",
  "messageTemplate": "## 订单量过低\\n\\n当前订单量：**{{current_value}}** 单\\n预警阈值：100 单\\n请及时关注！",
  "platformIds": "dingtalk"
}
\`\`\`

**场景 3：定时日报**
用户："每天早上 9 点发送昨天的销售日报"
→ 生成：
\`\`\`notification_rule
{
  "name": "销售日报",
  "description": "每日上午 9 点发送昨日销售数据报告",
  "ruleType": "scheduled",
  "frequency": "daily",
  "scheduleTime": "09:00",
  "timeRange": "yesterday",
  "messageTitle": "📊 昨日销售日报",
  "messageTemplate": "## 销售日报\\n\\n统计时间：昨日\\n总销售额：{{total_sales}}\\n订单量：{{order_count}}\\n客户数：{{customer_count}}",
  "platformIds": "dingtalk"
}
\`\`\`

## 配置字段说明

| 字段 | 说明 | 常见值 |
|------|------|------|
| ruleType | 规则类型 | data_threshold(阈值), scheduled(定时), custom(自定义) |
| frequency | 频率 | once(一次), realtime(实时), daily(每天), weekly(每周) |
| conditionType | 条件类型 | greater(大于), less(小于), equals(等于) |
| timeRange | 时间范围 | today(今日), yesterday(昨日), last_7_days(近 7 天) |
| platformIds | 通知平台 | dingtalk(钉钉), feishu(飞书), wecom(企业微信) |

## 数据源配置
当用户提供任意数据库连接意图（例如“把这个库接上”“连到这个数据库”“用这段连接”“帮我配置数据源”），无论是否使用固定措辞，只要包含数据库连接信息（URI 或分散的主机、端口、账号、库名、密码），都应解析并生成数据源配置。

支持的连接信息格式：
- URI 示例：postgres://user:pass@host:port/dbname、postgresql://user:pass@host:port/dbname、mysql://user:pass@host:port/dbname
- 分散参数：用户分别说明主机、端口、用户名、密码、数据库名

datasource_config 输出结构（回复末尾给出代码块）：
- type: postgresql
- name: 数据源名称（根据数据库名或用户意图自动生成）
- description: 数据源描述
- connection.host: 主机地址
- connection.port: 端口号
- connection.database: 数据库名
- connection.username: 用户名
- connection.password: 密码
- connection.ssl: false
- connection.sslmode: disable

### 数据源配置规则
1. 自动意图识别：只要用户给出数据库连接信息或提出连接、配置、接入数据库需求，即生成 datasource_config。
2. 类型判断：
   - postgres:// 或 postgresql:// -> postgresql
   - mysql:// -> mysql
3. 名称生成：用户未指定时，基于数据库名生成（如“mcai 数据库”）。
4. URI 解析格式：scheme://username:password@host:port/database。
5. 参数缺失时先向用户确认（如缺少密码、主机或端口）。
6. 默认 SSL：ssl=false，sslmode=disable；如用户表明需要加密，可设置 ssl=true，并根据描述选择 sslmode（如 require）。
7. 输出顺序：先用自然语言确认解析结果，再在末尾输出 datasource_config 代码块。

### 数据源配置示例
用户：“把这个库接上：postgres://myuser:mypass@192.168.1.100:5432/mydb”
回复应先说明解析结果，再输出 datasource_config 代码块。

## 注意事项
1. 仅当用户明确表达了通知/监控需求时才生成通知/告警配置
2. 数据源配置采用意图识别：出现数据库连接信息或相关意图即可生成，不要求固定措辞
3. 配置代码块放在回复末尾，先给出自然语言解释
4. 如果用户未指定平台，可建议用户选择钉钉/飞书/企业微信
5. 阈值和指标字段尽量从对话上下文中提取
6. 如果信息不完整，先询问用户补充必要字段

## 智能推荐
主动识别数据中的：
- 异常值或波动
- 趋势变化
- 相关性洞察
- 优化机会
- 适合监控的指标`;

interface AIModelConfig {
  model: string;
  maxTokens: number;
  temperature: number;
}

function getDefaultBaseURLByModelType(modelType?: string): string | undefined {
  if (modelType === "deepseek") {
    return "https://api.deepseek.com/v1";
  }
  return undefined;
}

function getModelConfig(): AIModelConfig {
  const modelType = process.env.AI_MODEL_TYPE || "openai";
  
  switch (modelType) {
    case "claude":
      return {
        model: "claude-3-sonnet-20240229",
        maxTokens: 2000,
        temperature: 0.7,
      };
    case "qwen": // 通义千问
      return {
        model: "qwen-plus",
        maxTokens: 2000,
        temperature: 0.7,
      };
    case "ernie": // 文心一言
      return {
        model: "ernie-bot-4",
        maxTokens: 2000,
        temperature: 0.7,
      };
    default: // OpenAI
      return {
        model: process.env.OPENAI_MODEL || "gpt-4o-mini",
        maxTokens: 2000,
        temperature: 0.7,
      };
  }
}

export async function POST(req: NextRequest) {
  let finalModelType = process.env.AI_MODEL_TYPE || "openai";
  try {
    const authHeader = req.headers.get("authorization");
    const body = await req.json();
    const { 
      messages, 
      dataSummary, 
      dataSchema,
      companyProfile,
      conversationContext,
      tenantId: clientTenantId,
      aiConfig: clientAiConfig
    } = body as {
      messages: { role: string; content: string }[];
      dataSummary?: string;
      dataSchema?: any;
      companyProfile?: any;
      conversationContext?: any;
      tenantId?: string;
      aiConfig?: {
        apiKey?: string;
        baseUrl?: string;
        modelType?: string;
        model?: string;
      };
    };

    if (!messages?.length) {
      return NextResponse.json(
        { error: "消息不能为空" },
        { status: 400 }
      );
    }
    const latestUserMessage = [...messages].reverse().find((m) => m.role === "user")?.content || "";
    const tenantId =
      clientTenantId ||
      conversationContext?.tenantId ||
      companyProfile?.tenantId ||
      "demo-tenant";
    const analysisPacket = await getAnalysisPacketFromBackend(tenantId, latestUserMessage);

    const serverConfig = await getTenantAIConfigFromBackend(tenantId, authHeader);

    // 优先使用客户端传来的配置，其次服务端租户配置，最后环境变量
    const apiKey =
      clientAiConfig?.apiKey ||
      serverConfig?.apiKey ||
      process.env.OPENAI_API_KEY ||
      process.env.AI_API_KEY;
    
    // 演示模式
    if (!apiKey) {
      const demoContent = dataSummary
        ? `根据你上传的数据：\n${dataSummary}\n\n**建议：**
1. 配置 API Key 启用真实 AI 分析
2. 尝试提问"帮我分析销售趋势"
3. 说"生成数据大屏"创建可视化`
        : "请先上传数据文件，然后我可以帮你分析。";
      
      return NextResponse.json(
        {
          content: "⚠️ 演示模式：未配置 AI API Key\n\n" + demoContent,
          demoMode: true,
        },
        { status: 200 }
      );
    }

    const modelConfig = getModelConfig();
    finalModelType =
      clientAiConfig?.modelType || serverConfig?.modelType || process.env.AI_MODEL_TYPE || "openai";
    
    // 如果客户端指定了模型，使用客户端的
    let finalModel = modelConfig.model;
    if (clientAiConfig?.model) {
      finalModel = clientAiConfig.model;
    } else if (serverConfig?.model) {
      finalModel = serverConfig.model;
    }

    const finalBaseURL =
      clientAiConfig?.baseUrl ||
      serverConfig?.baseUrl ||
      process.env.OPENAI_BASE_URL ||
      getDefaultBaseURLByModelType(finalModelType) ||
      undefined;
    
    // 构建增强版系统提示
    let systemContent = SYSTEM_PROMPT;
    
    if (companyProfile) {
      systemContent += `\n\n## 企业画像\n${JSON.stringify(companyProfile, null, 2)}`;
    }
    
    if (dataSchema) {
      systemContent += `\n\n## 数据结构\n${JSON.stringify(dataSchema, null, 2)}`;
    }
    
    if (dataSummary) {
      systemContent += `\n\n## 数据摘要\n${dataSummary}`;
    }

    if (conversationContext) {
      systemContent += `\n\n## 对话上下文\n${JSON.stringify(conversationContext, null, 2)}`;
    }
    systemContent += `\n\n## AI分析引擎上下文（用于提高回答稳定性）\n${JSON.stringify(analysisPacket, null, 2)}`;

    const formattedMessages = messages.map((m) => ({
      role: m.role as "user" | "assistant" | "system",
      content: m.content,
    }));

    const openai = new OpenAI({
      apiKey,
      baseURL: finalBaseURL,
    });

    // 调用 AI API（流式输出）
    const stream = await openai.chat.completions.create({
      model: finalModel,
      messages: [
        { role: "system", content: systemContent },
        ...formattedMessages,
      ],
      max_tokens: modelConfig.maxTokens,
      temperature: modelConfig.temperature,
      stream: true,
    });

    // 构造 SSE 响应流
    const encoder = new TextEncoder();
    const readable = new ReadableStream({
      async start(controller) {
        try {
          // 先发送 analysis 元数据
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ type: "meta", analysis: analysisPacket, model: finalModel })}\n\n`)
          );
          for await (const chunk of stream) {
            const delta = chunk.choices[0]?.delta?.content;
            if (delta) {
              controller.enqueue(
                encoder.encode(`data: ${JSON.stringify({ type: "delta", content: delta })}\n\n`)
              );
            }
          }
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "done" })}\n\n`));
        } catch (err) {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ type: "error", error: String(err) })}\n\n`)
          );
        } finally {
          controller.close();
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
  } catch (err: any) {
    console.error("Chat API error:", err);
    
    // 错误分类处理
    if (err.status === 401) {
      const providerHint =
        finalModelType === "deepseek"
          ? "（可能是 DeepSeek Base URL 未配置或配置错误，建议使用 https://api.deepseek.com/v1）"
          : "";
      return NextResponse.json(
        { error: `AI 认证失败，请检查 API Key / Base URL / 模型配置${providerHint}` },
        { status: 401 }
      );
    }
    
    if (err.status === 429) {
      return NextResponse.json(
        { error: "请求频率超限，请稍后重试" },
        { status: 429 }
      );
    }
    
    return NextResponse.json(
      {
        error: "AI 服务异常：" + err.message,
        analysisEvaluation: getEvaluationSummary(),
      },
      { status: 500 }
    );
  }
}

async function getAnalysisPacketFromBackend(tenantId: string, question: string) {
  const backendBase = process.env.BACKEND_INTERNAL_URL || "http://localhost:3001";
  try {
    const res = await fetch(`${backendBase}/api/tenants/${tenantId}/analysis/query`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Tenant-ID": tenantId },
      body: JSON.stringify({ question }),
      cache: "no-store",
    });
    if (!res.ok) {
      throw new Error(`backend analysis failed: ${res.status}`);
    }
    const payload = await res.json();
    if (payload?.analysis) {
      return payload.analysis;
    }
  } catch {
    // ignore and fallback
  }

  return {
    ...analyzeQuestion(question),
    evaluation: getEvaluationSummary(),
  };
}

async function getTenantAIConfigFromBackend(tenantId: string, authHeader?: string | null): Promise<{
  apiKey?: string;
  baseUrl?: string;
  modelType?: string;
  model?: string;
} | null> {
  const backendBase = process.env.BACKEND_INTERNAL_URL || "http://localhost:3001";
  try {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "X-Tenant-ID": tenantId,
    };
    if (authHeader) {
      headers.Authorization = authHeader;
    }
    const res = await fetch(`${backendBase}/api/tenants/${tenantId}/ai-config`, {
      method: "GET",
      headers,
      cache: "no-store",
    });
    if (!res.ok) {
      return null;
    }
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
