import { NextRequest, NextResponse } from 'next/server'
import {
  analyzeQuestion,
  getEvaluationSummary,
} from '@/lib/ai-analysis'

/**
 * POST /api/agents/query
 * 
 * AI Agent 查询接口
 * 
 * 流程:
 * 1. Query Agent 解析意图
 * 2. Semantic Agent 映射语义
 * 3. Quality Agent 验证 SQL
 * 4. 执行查询
 * 5. Insight Agent 生成洞察
 */
export async function POST(request: NextRequest) {
  const start = Date.now()
  try {
    const body = await request.json()
    const { question, context, tenantId: clientTenantId } = body
    const tenantId = clientTenantId || context?.tenantId || 'demo-tenant'
    
    console.log('收到查询请求:', question)
    
    // ========== Step 1~3: 优先走后端分析引擎 ==========
    const packetWithoutEval = await getAnalysisPacketFromBackend(tenantId, question)
    const sql = packetWithoutEval.sql
    console.log('Analysis Engine - 结果包:', packetWithoutEval)
    
    // ========== Step 4: 执行 SQL ==========
    // 当前返回 mock 数据，后续接入真实执行器
    const data = await executeSQL(sql)
    console.log('执行结果:', data)
    
    // ========== Step 5: 生成洞察 ==========
    const insight = buildInsightText(packetWithoutEval, data)
    console.log('Insight Agent - 生成洞察:', insight)
    
    return NextResponse.json({
      success: true,
      question,
      sql,
      data,
      insight,
      metadata: {
        context,
        packet: packetWithoutEval,
        executionTime: Date.now() - start,
      },
    })
    
  } catch (error) {
    console.error('查询失败:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '查询失败'
      },
      { status: 500 }
    )
  }
}

/**
 * 执行 SQL (Mock)
 */
async function executeSQL(sql: string): Promise<any[]> {
  // 当前返回 mock 数据，后续接入真实数据库执行
  
  // 返回示例数据
  return [
    { category: '电子产品', gmv: 1250000, order_count: 3500 },
    { category: '服装', gmv: 890000, order_count: 5200 },
    { category: '家居', gmv: 720000, order_count: 4100 },
    { category: '美妆', gmv: 540000, order_count: 6800 }
  ]
}

function buildInsightText(packet: any, data: any[]): string {
  const insight = packet.insight

  if (data.length > 0 && 'gmv' in data[0]) {
    const topCategory = data.reduce((max, row) => 
      row.gmv > max.gmv ? row : max, data[0]
    )
    
    return `${insight.conclusion}

证据：
- 已识别指标：${packet.intent.metrics.join('、') || 'gmv'}
- SQL 质量置信度：${packet.quality.confidence}
- 业务亮点：${topCategory.category}品类 GMV 为 ¥${topCategory.gmv.toLocaleString()}

建议：
- ${insight.suggestions.join('\n- ')}`
  }
  
  return `${insight.conclusion}

证据：
- 时间范围：${packet.intent.timeRange}
- SQL 质量置信度：${packet.quality.confidence}

建议：
- ${insight.suggestions.join('\n- ')}`
}

async function getAnalysisPacketFromBackend(tenantId: string, question: string) {
  const backendBase = process.env.BACKEND_INTERNAL_URL || "http://localhost:3001"
  try {
    const res = await fetch(`${backendBase}/api/tenants/${tenantId}/analysis/query`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Tenant-ID": tenantId },
      body: JSON.stringify({ question }),
      cache: "no-store",
    })
    if (!res.ok) {
      throw new Error(`backend analysis failed: ${res.status}`)
    }
    const payload = await res.json()
    if (payload?.analysis) {
      return payload.analysis
    }
  } catch {
    // fallback to local
  }

  return {
    ...analyzeQuestion(question),
    evaluation: getEvaluationSummary(),
  }
}
