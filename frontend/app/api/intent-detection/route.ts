/**
 * 意图识别 API 路由
 * 服务端实现，提供统一的意图识别能力
 */

import { NextRequest, NextResponse } from "next/server";
import { detectUserIntent, type IntentResult } from "@/lib/intent-detection";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { text, tenantId } = body as { text: string; tenantId?: string };

    if (!text || typeof text !== "string") {
      return NextResponse.json({ error: "text 参数必填" }, { status: 400 });
    }

    const result = await detectUserIntent(text.trim(), tenantId);

    return NextResponse.json(result, { status: 200 });
  } catch (err) {
    console.error("Intent detection error:", err);
    // 降级为 chat
    return NextResponse.json({
      intent: "chat",
      confidence: 0.5,
      reasoning: "意图识别服务异常，降级为普通聊天",
    } as IntentResult, { status: 200 });
  }
}
