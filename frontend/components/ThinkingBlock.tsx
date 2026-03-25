"use client";

import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";

/**
 * 从消息内容中解析 <think>...</think> 标签。
 * 返回 { thinking, content }：
 *   - thinking: think 标签内的思考内容（可能为空字符串）
 *   - content: 去除 think 标签后的正文内容
 *
 * 支持场景：
 *   1. 完整的 <think>...</think> 标签
 *   2. 只有开头 <think> 但没有闭合（流式中间态，视为正在思考）
 *   3. 没有 think 标签
 */
export function parseThinkContent(raw: string): {
  thinking: string;
  content: string;
  isThinking: boolean;
} {
  // 匹配完整的 <think>...</think>
  const fullMatch = raw.match(/<think>([\s\S]*?)<\/think>/);
  if (fullMatch) {
    const thinking = fullMatch[1].trim();
    const content = raw.replace(/<think>[\s\S]*?<\/think>/, "").trim();
    return { thinking, content, isThinking: false };
  }

  // 匹配未闭合的 <think>... （流式传输中）
  const partialMatch = raw.match(/<think>([\s\S]*)$/);
  if (partialMatch) {
    const thinking = partialMatch[1].trim();
    return { thinking, content: "", isThinking: true };
  }

  // 无 think 标签
  return { thinking: "", content: raw, isThinking: false };
}

/**
 * 从内容中完全移除 <think>...</think> 标签及其内容，
 * 用于钉钉等不需要展示思考过程的场景。
 */
export function stripThinkTags(content: string): string {
  return content.replace(/<think>[\s\S]*?<\/think>/g, "").trim();
}

/**
 * 思考过程折叠展示组件。
 * 当 AI 返回包含 <think> 标签的内容时，以可折叠区域展示思考过程。
 */
export function ThinkingBlock({
  thinking,
  isThinking,
}: {
  thinking: string;
  isThinking: boolean;
}) {
  const [expanded, setExpanded] = useState(false);

  if (!thinking && !isThinking) return null;

  return (
    <div className="thinking-block mb-3">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-400 transition-colors select-none"
      >
        {isThinking ? (
          <span className="thinking-spinner inline-block w-3 h-3 border border-zinc-500 border-t-transparent rounded-full animate-spin" />
        ) : (
          <svg
            className={`w-3 h-3 transition-transform ${expanded ? "rotate-90" : ""}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
          </svg>
        )}
        <span>{isThinking ? "思考中..." : "查看思考过程"}</span>
      </button>

      {(expanded || isThinking) && thinking && (
        <div className="thinking-content mt-2 pl-3 border-l-2 border-zinc-700/50 text-xs text-zinc-500 leading-relaxed">
          <div className="prose-chat prose-invert max-w-full min-w-0 overflow-x-auto text-xs opacity-70">
            <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeHighlight]}>
              {thinking}
            </ReactMarkdown>
          </div>
        </div>
      )}
    </div>
  );
}
