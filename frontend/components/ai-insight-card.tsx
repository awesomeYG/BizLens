"use client";

import { useState } from "react";

interface AIExplanation {
  metric: string;
  currentValue: number;
  baselineValue: number;
  changePercent: number;
  isAnomaly: boolean;
  confidence: number;
  severity: "low" | "medium" | "high" | "critical";
  explanation: string;
  dataSource: string;
  suggestions: string[];
  reasoning?: {
    dataSources: string[];
    analysisSteps: string[];
    confidenceFactors: {
      positive: string[];
      negative: string[];
    };
  };
}

interface AIInsightCardProps {
  insight: AIExplanation;
  onDrillDown?: (metric: string) => void;
  onDismiss?: () => void;
}

export default function AIInsightCard({
  insight,
  onDrillDown,
  onDismiss,
}: AIInsightCardProps) {
  const [showReasoning, setShowReasoning] = useState(false);

  const severityColors = {
    low: "bg-blue-50 border-blue-200 text-blue-800",
    medium: "bg-yellow-50 border-yellow-200 text-yellow-800",
    high: "bg-orange-50 border-orange-200 text-orange-800",
    critical: "bg-red-50 border-red-200 text-red-800",
  };

  const severityLabels = {
    low: "低风险",
    medium: "中风险",
    high: "高风险",
    critical: "严重",
  };

  return (
    <div
      className={`rounded-lg border-2 p-4 ${severityColors[insight.severity]}`}
    >
      {/* 头部 */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className="flex-shrink-0">
            {insight.isAnomaly ? (
              <svg
                className="w-6 h-6"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
            ) : (
              <svg
                className="w-6 h-6"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            )}
          </div>
          <div>
            <h3 className="font-semibold text-lg">{insight.metric}</h3>
            <p className="text-sm opacity-80">{insight.explanation}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="px-2 py-1 text-xs font-medium rounded-full bg-white bg-opacity-60">
            {severityLabels[insight.severity]}
          </span>
          {onDismiss && (
            <button
              onClick={onDismiss}
              className="p-1 hover:bg-black hover:bg-opacity-10 rounded"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* 指标详情 */}
      <div className="grid grid-cols-3 gap-4 mb-3 p-3 bg-white bg-opacity-60 rounded">
        <div>
          <div className="text-xs opacity-70">当前值</div>
          <div className="text-lg font-bold">{insight.currentValue.toFixed(2)}</div>
        </div>
        <div>
          <div className="text-xs opacity-70">基线值</div>
          <div className="text-lg font-bold">{insight.baselineValue.toFixed(2)}</div>
        </div>
        <div>
          <div className="text-xs opacity-70">变化</div>
          <div className={`text-lg font-bold ${insight.changePercent > 0 ? "text-red-600" : "text-green-600"}`}>
            {insight.changePercent > 0 ? "+" : ""}{insight.changePercent.toFixed(1)}%
          </div>
        </div>
      </div>

      {/* 置信度 */}
      <div className="mb-3">
        <div className="flex items-center justify-between text-sm mb-1">
          <span className="opacity-80">AI 置信度</span>
          <span className="font-medium">{(insight.confidence * 100).toFixed(0)}%</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div
            className={`h-2 rounded-full ${
              insight.confidence > 0.8
                ? "bg-green-500"
                : insight.confidence > 0.6
                ? "bg-yellow-500"
                : "bg-red-500"
            }`}
            style={{ width: `${insight.confidence * 100}%` }}
          />
        </div>
      </div>

      {/* 数据来源 */}
      <div className="mb-3 text-sm">
        <span className="opacity-80">📊 {insight.dataSource}</span>
      </div>

      {/* 建议操作 */}
      {insight.suggestions.length > 0 && (
        <div className="mb-3">
          <div className="text-sm font-semibold mb-2">💡 建议操作</div>
          <ul className="space-y-1">
            {insight.suggestions.map((suggestion, i) => (
              <li key={i} className="text-sm flex items-start gap-2">
                <span className="text-green-600 mt-0.5">✓</span>
                <span>{suggestion}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* AI 推理过程（可展开） */}
      <div className="border-t pt-3 mt-3">
        <button
          onClick={() => setShowReasoning(!showReasoning)}
          className="text-sm opacity-80 hover:opacity-100 flex items-center gap-1"
        >
          <svg
            className={`w-4 h-4 transition-transform ${
              showReasoning ? "transform rotate-90" : ""
            }`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
          {showReasoning ? "隐藏" : "查看"}AI 推理过程
        </button>

        {showReasoning && insight.reasoning && (
          <div className="mt-3 space-y-3 text-sm">
            {/* 数据来源 */}
            <div>
              <div className="font-semibold mb-1">📊 数据来源</div>
              <ul className="list-disc list-inside opacity-80 space-y-0.5">
                {insight.reasoning.dataSources.map((source, i) => (
                  <li key={i}>{source}</li>
                ))}
              </ul>
            </div>

            {/* 分析步骤 */}
            <div>
              <div className="font-semibold mb-1">🧠 分析逻辑</div>
              <ol className="list-decimal list-inside opacity-80 space-y-0.5">
                {insight.reasoning.analysisSteps.map((step, i) => (
                  <li key={i}>{step}</li>
                ))}
              </ol>
            </div>

            {/* 置信度因素 */}
            <div>
              <div className="font-semibold mb-1">置信度因素</div>
              {insight.reasoning.confidenceFactors.positive.length > 0 && (
                <div className="mb-2">
                  <div className="text-green-600 text-xs mb-1">✅ 提高置信度:</div>
                  <ul className="list-disc list-inside opacity-80 space-y-0.5">
                    {insight.reasoning.confidenceFactors.positive.map((factor, i) => (
                      <li key={i}>{factor}</li>
                    ))}
                  </ul>
                </div>
              )}
              {insight.reasoning.confidenceFactors.negative.length > 0 && (
                <div>
                  <div className="text-orange-600 text-xs mb-1">⚠️ 降低置信度:</div>
                  <ul className="list-disc list-inside opacity-80 space-y-0.5">
                    {insight.reasoning.confidenceFactors.negative.map((factor, i) => (
                      <li key={i}>{factor}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* 操作按钮 */}
      <div className="flex gap-2 mt-4 pt-3 border-t">
        {onDrillDown && (
          <button
            onClick={() => onDrillDown(insight.metric)}
            className="flex-1 px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            🔍 下钻分析
          </button>
        )}
        <button className="flex-1 px-3 py-1.5 text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200">
          📋 复制洞察
        </button>
      </div>
    </div>
  );
}
