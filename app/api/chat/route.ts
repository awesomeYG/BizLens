import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import type { CompanyProfile, DashboardData } from "@/lib/types";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || "",
});

const SYSTEM_PROMPT = `你是一个专业的商业智能(BI)数据分析助手。用户可以上传公司的数据文件(CSV/Excel等)，你需要：
1. 理解并分析用户上传的数据
2. 根据用户问题给出数据洞察和建议
3. 当用户要求生成数据大屏时，你可以建议合适的图表类型、指标和布局
4. 用简洁专业的中文回答，必要时用表格或列表呈现
5. 当用户想要配置数据告警/通知时，你需要理解用户的自然语言描述，提取出告警规则并生成结构化配置

如果用户上传了数据，请先简要总结数据结构，再回答具体问题。

## 告警配置能力

当用户表达了类似以下意图时，你需要生成告警配置：
- "当日销售额超过1000时通知我"
- "库存低于50件时发钉钉告警"
- "利润率下降超过10%时提醒"

请在回复中包含一个 JSON 代码块，格式如下：
\`\`\`alert_config
{
  "name": "告警规则名称",
  "description": "规则描述",
  "metric": "监控指标英文标识，如 daily_sales",
  "conditionType": "greater|less|equals|change|custom",
  "threshold": 数值阈值,
  "message": "告警触发时的通知消息内容，支持 Markdown",
  "enabled": true
}
\`\`\`

conditionType 说明：
- greater: 大于阈值时触发
- less: 小于阈值时触发
- equals: 等于阈值时触发
- change: 变化幅度超过阈值时触发（百分比）
- custom: 自定义复杂条件

在 JSON 之外，用自然语言向用户确认你理解的告警规则，并说明用户可以在"智能告警"页面管理这些规则。`;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { messages, dataSummary, dashboardData, companyProfile } = body as {
      messages: { role: string; content: string }[];
      dataSummary?: string;
      dashboardData?: DashboardData;
      companyProfile?: CompanyProfile;
    };

    if (!messages?.length) {
      return NextResponse.json(
        { error: "消息不能为空" },
        { status: 400 }
      );
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      const demoContent = dataSummary
        ? `根据你上传的数据摘要：\n${dataSummary}\n\n建议：1) 配置 API Key 后获得真实分析 2) 可尝试「生成销售数据大屏」等指令`
        : "请先上传数据文件，然后我可以帮你分析并生成大屏。";
      return NextResponse.json(
        {
          content:
            "未配置 OPENAI_API_KEY。请在 .env.local 中设置。当前为演示模式，我会模拟分析结果。\n\n" +
            demoContent,
        },
        { status: 200 }
      );
    }

    const formatted = messages.map((m) => ({
      role: m.role as "user" | "assistant" | "system",
      content: m.content,
    }));

    const structuredDataText = dashboardData
      ? `\n\n用户当前的大屏数据草稿（JSON）：\n${JSON.stringify(
          dashboardData,
          null,
          2
        )}`
      : "";

    const systemContent =
      SYSTEM_PROMPT +
      (companyProfile
        ? `\n\n用户企业画像（后续分析请优先结合）：\n${JSON.stringify(companyProfile, null, 2)}`
        : "") +
      (dataSummary ? `\n\n用户已上传的数据摘要：\n${dataSummary}` : "") +
      structuredDataText;

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemContent },
        ...formatted,
      ],
      max_tokens: 2000,
    });

    const content =
      response.choices[0]?.message?.content || "抱歉，未能生成回复。";
    return NextResponse.json({ content });
  } catch (err) {
    console.error("Chat API error:", err);
    return NextResponse.json(
      { error: "对话服务异常，请稍后重试" },
      { status: 500 }
    );
  }
}
