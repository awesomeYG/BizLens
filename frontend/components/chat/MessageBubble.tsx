"use client";

import { parseThinkContent } from "@/lib/chat/response-parser";
import { ThinkingBlock } from "@/components/ThinkingBlock";
import type { ChatMessage, DashboardSection } from "@/lib/types";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import { extractDashboardConfig, removeActionBlocks } from "@/lib/chat/response-parser";

function formatTime(ts: number): string {
  const d = new Date(ts);
  return `${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}`;
}

function AiAvatar({ size = "sm" }: { size?: "sm" | "lg" }) {
  const dim = size === "lg" ? "w-10 h-10" : "w-7 h-7";
  return (
    <div className={`${dim} shrink-0 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/20 animate-breathe`}>
      <svg className={size === "lg" ? "w-5 h-5" : "w-3.5 h-3.5"} viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09Z" />
      </svg>
    </div>
  );
}

function UserAvatar({ name }: { name?: string }) {
  const letter = name?.charAt(0)?.toUpperCase() || "U";
  return (
    <div className="w-7 h-7 shrink-0 rounded-xl bg-gradient-to-br from-zinc-600 to-zinc-700 flex items-center justify-center text-xs font-semibold text-zinc-200 border border-zinc-600/50">
      {letter}
    </div>
  );
}

function InlineDashboardPreview({
  content,
  onSave,
}: {
  content: string;
  onSave?: (payload: { title?: string; sections: DashboardSection[] }) => void;
}) {
  const config = extractDashboardConfig(content);
  if (!config) return null;

  return (
    <div className="mt-3 rounded-xl border border-indigo-500/20 bg-gradient-to-br from-slate-900/80 via-[#0f1020] to-black overflow-hidden">
      <div className="px-4 py-2.5 border-b border-white/5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-indigo-400 animate-pulse" />
          <span className="text-xs font-medium text-zinc-300">{config.title || "AI 生成大屏"}</span>
          <span className="text-[10px] text-zinc-500">{config.sections.length} 个区块</span>
        </div>
        {onSave ? (
          <button
            onClick={() => onSave({ title: config.title, sections: config.sections })}
            className="text-[11px] text-indigo-100 px-3 py-1 rounded-lg bg-indigo-500/20 border border-indigo-500/30 hover:bg-indigo-500/30"
          >
            保存为大屏
          </button>
        ) : (
          <span className="text-[10px] text-zinc-500 px-2 py-0.5 rounded-full bg-white/5 border border-white/10">预览</span>
        )}
      </div>
    </div>
  );
}

export interface MessageBubbleProps {
  message: ChatMessage;
  userName?: string;
  onSaveDashboard?: (payload: { title?: string; sections: DashboardSection[] }) => void;
}

export function MessageBubble({ message, userName, onSaveDashboard }: MessageBubbleProps) {
  const isUser = message.role === "user";

  return (
    <div className={`flex items-end gap-2.5 ${isUser ? "flex-row-reverse" : ""} ${isUser ? "animate-msg-right" : "animate-msg-left"}`}>
      {isUser ? <UserAvatar name={userName} /> : <AiAvatar />}
      <div className={`w-fit min-w-0 max-w-[75%] group ${isUser ? "items-end" : "items-start"} flex flex-col`}>
        <div
          className={`relative min-w-0 overflow-hidden rounded-2xl px-4 py-3 text-sm leading-relaxed transition-shadow ${
            isUser
              ? "rounded-tr-md bg-gradient-to-br from-indigo-600 to-indigo-700 text-white shadow-lg shadow-indigo-500/15"
              : "rounded-tl-md bg-zinc-800/50 border border-zinc-700/30 text-zinc-200 backdrop-blur-sm"
          }`}
        >
          {message.files?.length ? (
            <div className={`mb-2 flex items-center gap-1.5 text-xs ${isUser ? "text-indigo-200/70" : "text-zinc-500"}`}>
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="m18.375 12.739-7.693 7.693a4.5 4.5 0 0 1-6.364-6.364l10.94-10.94A3 3 0 1 1 19.5 7.372L8.552 18.32m.009-.01-.01.01m5.699-9.941-7.81 7.81a1.5 1.5 0 0 0 2.112 2.13" />
              </svg>
              <span className="font-medium">{message.files.map((f) => f.name).join(", ")}</span>
            </div>
          ) : null}

          {isUser ? (
            <p className="whitespace-pre-wrap break-words">{message.content}</p>
          ) : (
            <>
              {(() => {
                const cleaned = removeActionBlocks(message.content);
                const { thinking, content, isThinking } = parseThinkContent(cleaned);
                return (
                  <>
                    <ThinkingBlock thinking={thinking} isThinking={isThinking} />
                    {content && (
                      <div className="prose-chat prose-invert max-w-full min-w-0 overflow-x-auto break-all">
                        <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeHighlight]}>
                          {content}
                        </ReactMarkdown>
                      </div>
                    )}
                  </>
                );
              })()}
            </>
          )}

          {!isUser ? <InlineDashboardPreview content={message.content} onSave={onSaveDashboard} /> : null}
        </div>

        <span className={`mt-1.5 text-[10px] text-zinc-600 opacity-0 group-hover:opacity-100 transition-opacity select-none ${isUser ? "text-right pr-1" : "pl-1"}`}>
          {formatTime(message.timestamp)}
        </span>
      </div>
    </div>
  );
}

export function ThinkingIndicator() {
  return (
    <div className="flex items-start gap-3 animate-msg-left">
      <AiAvatar />
      <div className="max-w-[75%]">
        <div className="rounded-2xl rounded-tl-md px-5 py-4 bg-zinc-800/50 border border-zinc-700/30 backdrop-blur-sm">
          <div className="flex items-center gap-3">
            <div className="flex gap-1">
              <span className="w-2 h-2 rounded-full bg-indigo-400/70 animate-bounce" style={{ animationDelay: "0ms" }} />
              <span className="w-2 h-2 rounded-full bg-purple-400/70 animate-bounce" style={{ animationDelay: "150ms" }} />
              <span className="w-2 h-2 rounded-full bg-indigo-400/70 animate-bounce" style={{ animationDelay: "300ms" }} />
            </div>
            <span className="text-sm text-zinc-500">正在分析中。。。</span>
          </div>
          <div className="mt-3 space-y-2">
            <div className="h-3 rounded-full thinking-skeleton w-3/4" />
            <div className="h-3 rounded-full thinking-skeleton w-1/2" />
          </div>
        </div>
      </div>
    </div>
  );
}
