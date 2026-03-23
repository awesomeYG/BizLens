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

## 对话风格
- 用简洁专业的中文回答
- 优先使用表格、列表呈现数据
- 关键洞察用**加粗**标注
- 避免过度技术性术语，让业务人员能理解

## 数据大屏生成
当用户要求生成大屏时，请：
1. 理解用户想要展示的核心指标
2. 推荐 3-5 个相关图表
3. 说明每个图表的类型和用途
4. 用 JSON 格式输出大屏配置（如果用户明确要求）

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

## 注意事项
1. 仅当用户明确表达了通知/监控需求时才生成配置
2. 配置代码块放在回复末尾，先给出自然语言解释
3. 如果用户未指定平台，可建议用户选择钉钉/飞书/企业微信
4. 阈值和指标字段尽量从对话上下文中提取
5. 如果信息不完整，先询问用户补充必要字段

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
  try {
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

    const serverConfig = await getTenantAIConfigFromBackend(tenantId);

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
    
    // 如果客户端指定了模型，使用客户端的
    let finalModel = modelConfig.model;
    if (clientAiConfig?.model) {
      finalModel = clientAiConfig.model;
    } else if (serverConfig?.model) {
      finalModel = serverConfig.model;
    }

    const finalBaseURL = clientAiConfig?.baseUrl || serverConfig?.baseUrl || process.env.OPENAI_BASE_URL || undefined;
    
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

    // 调用 AI API
    const response = await openai.chat.completions.create({
      model: finalModel,
      messages: [
        { role: "system", content: systemContent },
        ...formattedMessages,
      ],
      max_tokens: modelConfig.maxTokens,
      temperature: modelConfig.temperature,
    });

    const content = response.choices[0]?.message?.content || "抱歉，未能生成回复。";
    return NextResponse.json({ 
      content,
      usage: response.usage,
      model: finalModel,
      analysis: {
        ...analysisPacket,
      },
    });
  } catch (err: any) {
    console.error("Chat API error:", err);
    
    // 错误分类处理
    if (err.status === 401) {
      return NextResponse.json(
        { error: "AI API Key 无效，请检查配置" },
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

async function getTenantAIConfigFromBackend(tenantId: string): Promise<{
  apiKey?: string;
  baseUrl?: string;
  model?: string;
} | null> {
  const backendBase = process.env.BACKEND_INTERNAL_URL || "http://localhost:3001";
  try {
    const res = await fetch(`${backendBase}/api/tenants/${tenantId}/ai-config`, {
      method: "GET",
      headers: { "Content-Type": "application/json", "X-Tenant-ID": tenantId },
      cache: "no-store",
    });
    if (!res.ok) {
      return null;
    }
    const payload = await res.json();
    return {
      apiKey: payload?.apiKey,
      baseUrl: payload?.baseUrl,
      model: payload?.model,
    };
  } catch {
    return null;
  }
}
