'use client'

import { useState } from 'react'

/**
 * BizLens v3.0 - Explore 智能探索器
 * 
 * 核心功能:
 * - 自然语言查询
 * - AI Agent 协作
 * - 自动可视化
 */

export default function ExplorePage() {
  const [question, setQuestion] = useState('')
  const [isAsking, setIsAsking] = useState(false)
  const [queryHistory, setQueryHistory] = useState<QueryResult[]>([])
  const [currentResult, setCurrentResult] = useState<QueryResult | null>(null)
  
  interface QueryResult {
    id: string
    question: string
    sql: string
    data: any[]
    insight: string
    timestamp: Date
  }
  
  const handleAsk = async () => {
    if (!question.trim()) return
    
    setIsAsking(true)
    
    try {
      const response = await fetch('/api/agents/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: question,
          context: []
        })
      })
      
      const result = await response.json()
      
      // 添加到历史
      const queryResult: QueryResult = {
        id: `query-${Date.now()}`,
        question: question,
        sql: result.sql,
        data: result.data,
        insight: result.insight,
        timestamp: new Date()
      }
      
      setQueryHistory([queryResult, ...queryHistory])
      setCurrentResult(queryResult)
      setQuestion('')
    } catch (error) {
      console.error('Query failed:', error)
    } finally {
      setIsAsking(false)
    }
  }
  
  const suggestedQuestions = [
    "本月 GMV 是多少？环比增长如何？",
    "哪个品类的销售额最高？",
    "分析客户流失原因",
    "生成月度销售报告"
  ]
  
  return (
    <div className="min-h-screen bg-gray-50">
      {/* 顶部搜索框 */}
      <header className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 py-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">
            🔍 Explore 智能探索
          </h1>
          
          <div className="flex gap-2">
            <input
              type="text"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleAsk()}
              placeholder="用自然语言提问，AI 帮你分析数据..."
              className="flex-1 px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <button
              onClick={handleAsk}
              disabled={isAsking || !question.trim()}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isAsking ? '思考中...' : '提问'}
            </button>
          </div>
          
          {/* 建议问题 */}
          {queryHistory.length === 0 && (
            <div className="mt-6">
              <p className="text-sm text-gray-500 mb-3">💡 试试这些问题：</p>
              <div className="flex flex-wrap gap-2">
                {suggestedQuestions.map((q, i) => (
                  <button
                    key={i}
                    onClick={() => setQuestion(q)}
                    className="px-3 py-1.5 text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </header>
      
      {/* 主要内容区 */}
      <main className="max-w-5xl mx-auto px-4 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* 左侧：查询历史 */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-lg border shadow-sm p-4">
              <h2 className="font-semibold text-gray-900 mb-4">
                查询历史
              </h2>
              {queryHistory.length === 0 ? (
                <p className="text-sm text-gray-500 text-center py-8">
                  暂无查询记录
                </p>
              ) : (
                <div className="space-y-2">
                  {queryHistory.map((query) => (
                    <button
                      key={query.id}
                      onClick={() => setCurrentResult(query)}
                      className={`w-full text-left p-3 rounded hover:bg-gray-50 ${
                        currentResult?.id === query.id ? 'bg-blue-50 border-blue-200' : 'border border-gray-200'
                      }`}
                    >
                      <p className="text-sm text-gray-900 truncate">
                        {query.question}
                      </p>
                      <p className="text-xs text-gray-500 mt-1">
                        {query.timestamp.toLocaleString('zh-CN')}
                      </p>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
          
          {/* 右侧：查询结果 */}
          <div className="lg:col-span-2">
            {currentResult ? (
              <div className="space-y-4">
                {/* 问题 */}
                <div className="bg-white rounded-lg border shadow-sm p-4">
                  <h3 className="text-lg font-semibold text-gray-900">
                    {currentResult.question}
                  </h3>
                </div>
                
                {/* AI 洞察 */}
                {currentResult.insight && (
                  <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                    <div className="flex items-start gap-3">
                      <span className="text-2xl">🤖</span>
                      <div>
                        <h4 className="font-semibold text-purple-900 mb-1">
                          AI 洞察
                        </h4>
                        <p className="text-sm text-purple-800">
                          {currentResult.insight}
                        </p>
                      </div>
                    </div>
                  </div>
                )}
                
                {/* SQL 查询 */}
                {currentResult.sql && (
                  <div className="bg-gray-50 rounded-lg border p-4">
                    <h4 className="text-sm font-semibold text-gray-700 mb-2">
                      生成 SQL
                    </h4>
                    <pre className="text-xs font-mono text-gray-900 overflow-x-auto">
                      {currentResult.sql}
                    </pre>
                  </div>
                )}
                
                {/* 数据表格 */}
                {currentResult.data && currentResult.data.length > 0 && (
                  <div className="bg-white rounded-lg border shadow-sm overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead className="bg-gray-50">
                          <tr>
                            {Object.keys(currentResult.data[0]).map((key) => (
                              <th
                                key={key}
                                className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                              >
                                {key}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                          {currentResult.data.map((row, i) => (
                            <tr key={i}>
                              {Object.values(row).map((value: any, j) => (
                                <td key={j} className="px-4 py-3 text-sm text-gray-900">
                                  {value}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="bg-white rounded-lg border shadow-sm p-12 text-center">
                <div className="text-6xl mb-4">💭</div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  开始你的第一次探索
                </h3>
                <p className="text-gray-500">
                  在上方输入问题，AI 会帮你分析数据
                </p>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}
