'use client'

import { useState, useEffect } from 'react'

/**
 * BizLens v3.0 - Notebook 编辑器页面
 * 
 * 核心功能:
 * - 响应式单元格执行
 * - SQL/Python/AI 混合编程
 * - 依赖图可视化
 */

export default function NotebookPage() {
  const [notebookId, setNotebookId] = useState<string | null>(null)
  const [cells, setCells] = useState<Cell[]>([])
  const [isExecuting, setIsExecuting] = useState(false)
  
  interface Cell {
    id: string
    type: 'sql' | 'python' | 'markdown' | 'ai'
    code: string
    output: any
    deps: string[]
    status?: 'idle' | 'running' | 'success' | 'error'
  }
  
  // 加载 Notebook
  useEffect(() => {
    loadNotebook()
  }, [])
  
  const loadNotebook = async () => {
    // TODO: 从 API 加载 Notebook
    // 临时使用示例数据
    setNotebookId('demo-notebook')
    setCells([
      {
        id: 'cell-1',
        type: 'sql',
        code: "SELECT * FROM orders WHERE created_at >= '2026-01-01'",
        output: null,
        deps: [],
        status: 'idle'
      },
      {
        id: 'cell-2',
        type: 'python',
        code: "active_orders = orders[orders.status == 'active']",
        output: null,
        deps: ['cell-1'],
        status: 'idle'
      }
    ])
  }
  
  const addCell = (type: Cell['type']) => {
    const newCell: Cell = {
      id: `cell-${Date.now()}`,
      type,
      code: '',
      output: null,
      deps: [],
      status: 'idle'
    }
    setCells([...cells, newCell])
  }
  
  const updateCellCode = (cellId: string, code: string) => {
    setCells(cells.map(cell =>
      cell.id === cellId ? { ...cell, code } : cell
    ))
  }
  
  const runCell = async (cellId: string) => {
    const cell = cells.find(c => c.id === cellId)
    if (!cell) return
    
    // 更新状态为运行中
    setCells(cells.map(c =>
      c.id === cellId ? { ...c, status: 'running' as const } : c
    ))
    
    try {
      // TODO: 调用后端 API 执行单元格
      const response = await fetch('/api/notebooks/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          notebookId,
          cellId: cell.id,
          code: cell.code,
          type: cell.type
        })
      })
      
      const result = await response.json()
      
      // 更新单元格输出
      setCells(cells.map(c =>
        c.id === cellId 
          ? { ...c, output: result.output, status: 'success' as const }
          : c
      ))
    } catch (error) {
      setCells(cells.map(c =>
        c.id === cellId 
          ? { ...c, output: error, status: 'error' as const }
          : c
      ))
    }
  }
  
  const runAll = async () => {
    setIsExecuting(true)
    
    // 按依赖顺序执行所有单元格
    for (const cell of cells) {
      await runCell(cell.id)
    }
    
    setIsExecuting(false)
  }
  
  const deleteCell = (cellId: string) => {
    setCells(cells.filter(c => c.id !== cellId))
  }
  
  return (
    <div className="min-h-screen bg-gray-50">
      {/* 顶部工具栏 */}
      <header className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h1 className="text-xl font-bold text-gray-900">
              📓 Notebook
            </h1>
            <span className="text-sm text-gray-500">
              {notebookId || '未命名 Notebook'}
            </span>
          </div>
          
          <div className="flex items-center gap-2">
            <button
              onClick={() => addCell('sql')}
              className="px-3 py-1.5 text-sm bg-orange-100 text-orange-700 rounded hover:bg-orange-200"
            >
              + SQL
            </button>
            <button
              onClick={() => addCell('python')}
              className="px-3 py-1.5 text-sm bg-green-100 text-green-700 rounded hover:bg-green-200"
            >
              + Python
            </button>
            <button
              onClick={() => addCell('markdown')}
              className="px-3 py-1.5 text-sm bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
            >
              + Markdown
            </button>
            <button
              onClick={() => addCell('ai')}
              className="px-3 py-1.5 text-sm bg-purple-100 text-purple-700 rounded hover:bg-purple-200"
            >
              + AI
            </button>
            
            <div className="w-px h-6 bg-gray-300 mx-2" />
            
            <button
              onClick={runAll}
              disabled={isExecuting}
              className="px-4 py-1.5 text-sm bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
            >
              ▶ 运行全部
            </button>
          </div>
        </div>
      </header>
      
      {/* Notebook 内容区 */}
      <main className="max-w-7xl mx-auto px-4 py-6">
        {cells.length === 0 ? (
          <EmptyState onAddCell={addCell} />
        ) : (
          <div className="space-y-4">
            {cells.map((cell, index) => (
              <CellComponent
                key={cell.id}
                cell={cell}
                index={index}
                onUpdateCode={(code) => updateCellCode(cell.id, code)}
                onRun={() => runCell(cell.id)}
                onDelete={() => deleteCell(cell.id)}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  )
}

// 空状态组件
function EmptyState({ onAddCell }: { onAddCell: (type: any) => void }) {
  return (
    <div className="text-center py-20">
      <div className="text-6xl mb-4">📝</div>
      <h2 className="text-xl font-semibold text-gray-900 mb-2">
        开始你的分析
      </h2>
      <p className="text-gray-500 mb-6">
        添加第一个单元格，开始数据分析之旅
      </p>
      <div className="flex justify-center gap-3">
        <button
          onClick={() => onAddCell('sql')}
          className="px-4 py-2 bg-orange-500 text-white rounded hover:bg-orange-600"
        >
          SQL 单元格
        </button>
        <button
          onClick={() => onAddCell('python')}
          className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600"
        >
          Python 单元格
        </button>
      </div>
    </div>
  )
}

// 单元格组件
function CellComponent({ 
  cell, 
  index,
  onUpdateCode,
  onRun,
  onDelete
}: {
  cell: Cell
  index: number
  onUpdateCode: (code: string) => void
  onRun: () => void
  onDelete: () => void
}) {
  const [isExpanded, setIsExpanded] = useState(true)
  
  const getTypeColor = (type: string) => {
    switch (type) {
      case 'sql': return 'bg-orange-500'
      case 'python': return 'bg-green-500'
      case 'markdown': return 'bg-blue-500'
      case 'ai': return 'bg-purple-500'
      default: return 'bg-gray-500'
    }
  }
  
  return (
    <div className="bg-white rounded-lg border shadow-sm overflow-hidden">
      {/* 单元格头部 */}
      <div className="bg-gray-50 px-4 py-2 flex items-center justify-between border-b">
        <div className="flex items-center gap-2">
          <span className={`px-2 py-0.5 text-xs font-semibold text-white rounded ${getTypeColor(cell.type)}`}>
            {cell.type.toUpperCase()}
          </span>
          <span className="text-sm text-gray-500">
            Cell {index + 1}
          </span>
          {cell.deps.length > 0 && (
            <span className="text-xs text-gray-400">
              依赖：{cell.deps.join(', ')}
            </span>
          )}
        </div>
        
        <div className="flex items-center gap-2">
          <button
            onClick={onRun}
            disabled={cell.status === 'running'}
            className="p-1.5 text-green-600 hover:bg-green-50 rounded disabled:opacity-50"
            title="运行单元格"
          >
            {cell.status === 'running' ? '⏳' : '▶'}
          </button>
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-1.5 text-gray-600 hover:bg-gray-100 rounded"
          >
            {isExpanded ? '▲' : '▼'}
          </button>
          <button
            onClick={onDelete}
            className="p-1.5 text-red-600 hover:bg-red-50 rounded"
          >
            🗑
          </button>
        </div>
      </div>
      
      {isExpanded && (
        <>
          {/* 代码编辑器 */}
          <div className="p-4">
            <textarea
              value={cell.code}
              onChange={(e) => onUpdateCode(e.target.value)}
              className="w-full font-mono text-sm border rounded p-3 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              rows={Math.max(3, cell.code.split('\n').length)}
              placeholder={
                cell.type === 'sql' ? '输入 SQL 查询...' :
                cell.type === 'python' ? '输入 Python 代码...' :
                cell.type === 'markdown' ? '输入 Markdown 内容...' :
                '输入 AI 分析指令...'
              }
            />
          </div>
          
          {/* 输出区域 */}
          {cell.output && (
            <div className={`px-4 pb-4 ${
              cell.status === 'error' ? 'bg-red-50' : 
              cell.status === 'success' ? 'bg-green-50' : 'bg-gray-50'
            }`}>
              <div className="font-mono text-sm whitespace-pre-wrap">
                {typeof cell.output === 'string' ? cell.output : JSON.stringify(cell.output, null, 2)}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
