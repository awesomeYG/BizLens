import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || "",
  baseURL: process.env.OPENAI_BASE_URL || undefined, // 支持自定义 API 端点
});

const SYSTEM_PROMPT = `你是 BizLens AI 数据分析专家。你需要：

## 核心能力
1. **数据分析**：理解用户上传的数据，分析结构、趋势、异常
2. **商业洞察**：基于数据提供可执行的业务建议
3. **可视化建议**：推荐合适的图表类型和展示方式
4. **告警配置**：识别用户想要监控的指标，生成结构化告警配置

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
  "threshold": 数值,
  "message": "触发消息"
}
\`\`\`

## 智能推荐
主动识别数据中的：
- 异常值或波动
- 趋势变化
- 相关性洞察
- 优化机会`;

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
      aiConfig: clientAiConfig
    } = body as {
      messages: { role: string; content: string }[];
      dataSummary?: string;
      dataSchema?: any;
      companyProfile?: any;
      conversationContext?: any;
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

    // 优先使用客户端传来的配置
    const apiKey = clientAiConfig?.apiKey || process.env.OPENAI_API_KEY || process.env.AI_API_KEY;
    
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
    }
    
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

    const formattedMessages = messages.map((m) => ({
      role: m.role as "user" | "assistant" | "system",
      content: m.content,
    }));

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
      { error: "AI 服务异常：" + err.message },
      { status: 500 }
    );
  }
}
