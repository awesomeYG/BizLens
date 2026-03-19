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
5. 支持用户配置钉钉通知事件。当用户表达了类似"当XX条件时通知我"、"帮我设置一个提醒"、"监控XX指标"等意图时，你需要提取通知规则信息。

如果用户上传了数据，请先简要总结数据结构，再回答具体问题。

当识别到用户想创建通知规则时，在回复末尾附加一个 JSON 块，格式如下（用 <!--NOTIFICATION_ACTION--> 标记包裹）：
<!--NOTIFICATION_ACTION-->
{
  "type": "create",
  "rule": {
    "name": "规则名称",
    "condition": "触发条件的自然语言描述",
    "messageTemplate": "钉钉通知消息内容模板",
    "webhookUrl": "",
    "enabled": true
  }
}
<!--/NOTIFICATION_ACTION-->

注意：webhookUrl 留空，由用户在设置页面补充。回复正文中要友好地告知用户规则已创建，并提醒他们去设置页面配置钉钉 Webhook 地址。
当用户想查看已有规则时，type 设为 "list"。当用户想删除规则时，type 设为 "delete"。`;

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
      // 演示模式：检测通知意图
      const lastMsg = messages[messages.length - 1]?.content || "";
      const isNotification = /通知|提醒|监控|告警|钉钉|当.*[时候]|超过|低于|达到/.test(lastMsg);

      if (isNotification) {
        const condition = lastMsg.replace(/^(帮我|请|给我|设置|配置|创建|添加)(一个)?/, "").trim();
        const demoContent =
          `好的，我已为你创建了一条通知规则：\n\n` +
          `- 规则名称：${condition.slice(0, 20)}\n` +
          `- 触发条件：${condition}\n\n` +
          `请前往「设置」页面配置钉钉 Webhook 地址以启用通知推送。`;
        const action = JSON.stringify({
          type: "create",
          rule: {
            name: condition.slice(0, 30) || "自定义通知",
            condition,
            messageTemplate: `[AI BI 通知] ${condition}`,
            webhookUrl: "",
            enabled: true,
          },
        });
        return NextResponse.json({
          content: demoContent + `\n<!--NOTIFICATION_ACTION-->\n${action}\n<!--/NOTIFICATION_ACTION-->`,
        });
      }

      const demoContent = dataSummary
        ? `根据你上传的数据摘要：\n${dataSummary}\n\n建议：1) 配置 API Key 后获得真实分析 2) 你可以告诉我需要监控的指标，我会帮你配置钉钉通知`
        : "请先上传数据文件，然后我可以帮你分析。你也可以告诉我需要监控的指标条件，我会帮你配置钉钉通知提醒。";
      return NextResponse.json({
        content:
          "未配置 OPENAI_API_KEY，当前为演示模式。\n\n" + demoContent,
      });
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
