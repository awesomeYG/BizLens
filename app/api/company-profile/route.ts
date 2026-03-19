import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import type { CompanyInfo, DataSourceConfig } from "@/lib/types";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || "",
});

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      companyInfo?: CompanyInfo;
      dataSources?: DataSourceConfig[];
    };
    const companyInfo = body.companyInfo;
    const dataSources = body.dataSources ?? [];

    if (!companyInfo) {
      return NextResponse.json({ error: "缺少公司信息" }, { status: 400 });
    }

    if (!dataSources.length) {
      return NextResponse.json({ error: "至少配置一个数据源" }, { status: 400 });
    }

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({
        summary: `公司 ${companyInfo.companyName} 属于 ${companyInfo.industry} 行业，当前业务目标是 ${companyInfo.coreGoals}。已接入 ${dataSources.length} 个数据源（如 ${dataSources
          .slice(0, 3)
          .map((s) => s.name)
          .join("、")}），可用于构建统一经营分析视图。`,
        analysisFocuses: [
          "收入增长趋势与异常波动",
          "渠道转化漏斗与客户分层",
          "区域/产品利润结构优化",
        ],
        recommendedMetrics: [
          "营收、毛利率、客单价",
          "获客成本、留存率、复购率",
          "库存周转、履约时效、退款率",
        ],
      });
    }

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content:
            "你是企业 BI 架构顾问。请基于公司信息和数据源生成可执行的公司画像，输出 JSON，字段包含 summary(字符串)、analysisFocuses(字符串数组，3项)、recommendedMetrics(字符串数组，3项)。",
        },
        {
          role: "user",
          content: JSON.stringify({ companyInfo, dataSources }, null, 2),
        },
      ],
      response_format: { type: "json_object" },
      max_tokens: 800,
    });

    const raw = response.choices[0]?.message?.content || "{}";
    const parsed = JSON.parse(raw) as {
      summary?: string;
      analysisFocuses?: string[];
      recommendedMetrics?: string[];
    };

    return NextResponse.json({
      summary: parsed.summary || "已生成公司画像。",
      analysisFocuses: (parsed.analysisFocuses || []).slice(0, 3),
      recommendedMetrics: (parsed.recommendedMetrics || []).slice(0, 3),
    });
  } catch (err) {
    console.error("Company profile API error:", err);
    return NextResponse.json({ error: "公司画像生成失败" }, { status: 500 });
  }
}
