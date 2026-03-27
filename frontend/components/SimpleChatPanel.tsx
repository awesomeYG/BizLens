"use client";

import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import { getCurrentUser } from "@/lib/user-store";
import { request, getAccessToken } from "@/lib/auth/api";
import { createDashboardInstance } from "@/lib/dashboard-store";
import { detectUserIntent } from "@/lib/intent-detection";
import type { ChatConversation, ChatConversationSummary, ChatMessage, DashboardSection } from "@/lib/types";
import AppHeader from "@/components/AppHeader";
import { parseThinkContent, ThinkingBlock } from "@/components/ThinkingBlock";

interface ChatPanelProps {
  onDataSummaryChange?: (summary: string) => void;
}

interface ParsedConnection {
  type: "postgresql" | "mysql";
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
  ssl?: boolean;
}

function formatTime(ts: number) {
  const d = new Date(ts);
  return `${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}`;
}

function parseConnectionUriFromText(text: string): ParsedConnection | null {
  const uriRegex = /\b(postgres(?:ql)?|mysql):\/\/[^\s"'<>]+/i;
  const match = uriRegex.exec(text);
  if (!match) return null;

  let normalized = match[0];
  if (/^postgres:\/\//i.test(normalized)) {
    normalized = normalized.replace(/^postgres:\/\//i, "postgresql://");
  }

  try {
    const url = new URL(normalized);
    const scheme = url.protocol.replace(":", "").toLowerCase();
    if (scheme !== "postgresql" && scheme !== "mysql") {
      return null;
    }
    if (!url.hostname || !url.pathname || !url.username) {
      return null;
    }

    const database = decodeURIComponent(url.pathname.replace(/^\/+/, ""));
    if (!database) return null;

    const defaultPort = scheme === "postgresql" ? 5432 : 3306;
    const parsedPort = Number(url.port || defaultPort);
    if (!Number.isFinite(parsedPort) || parsedPort <= 0) {
      return null;
    }

    return {
      type: scheme,
      host: url.hostname,
      port: parsedPort,
      database,
      username: decodeURIComponent(url.username),
      password: decodeURIComponent(url.password),
      ssl:
        scheme === "postgresql"
          ? ["1", "true", "require", "verify-ca", "verify-full"].includes(
            (url.searchParams.get("sslmode") || url.searchParams.get("ssl") || "").toLowerCase()
          )
          : undefined,
    };
  } catch {
    return null;
  }
}

function formatHistoryDate(value?: string) {
  if (!value) return "刚刚";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "刚刚";
  const now = new Date();
  const sameDay = now.toDateString() === date.toDateString();
  if (sameDay) return formatTime(date.getTime());
  return `${date.getMonth() + 1}/${date.getDate()}`;
}

function buildConversationTitle(messages: ChatMessage[]) {
  const firstUserMessage = messages.find((item) => item.role === "user" && item.content.trim());
  if (!firstUserMessage) return "新对话";
  const text = firstUserMessage.content.trim();
  return text.length > 24 ? `${text.slice(0, 24)}...` : text;
}

function createWelcomeMessages(): ChatMessage[] {
  return [
    {
      id: "welcome",
      role: "assistant",
      content: "你好！我是你的 AI 数据分析师。问我任何数据问题，我会立即生成可视化分析。",
      timestamp: Date.now(),
    },
  ];
}

function isNotFoundError(err: unknown) {
  if (!(err instanceof Error)) return false;
  const message = err.message.toLowerCase();
  return message === "not found" || message.includes("404") || message.includes("会话不存在");
}

function toPersistedMessages(messages: ChatMessage[]) {
  return messages.filter((item) => item.id !== "welcome");
}

/**
 * 归一化签名：只提取后端 DTO 关心的字段，避免前端独有字段（sqlQuery、schemaContext 等）
 * 导致签名永远不同而引发无限重复保存或比对失效。
 */
function computeMessageSignature(messages: ChatMessage[]): string {
  return JSON.stringify(
    messages.map((m) => ({
      id: m.id,
      role: m.role,
      content: m.content,
      files: m.files,
      timestamp: m.timestamp,
    }))
  );
}

function extractDashboardConfig(content: string): { sections: DashboardSection[]; title?: string } | null {
  const regex = /```dashboard_config\s*\n([\s\S]*?)\n```/;
  const match = regex.exec(content);
  if (!match) return null;
  try {
    const config = JSON.parse(match[1]);
    if (config.sections && Array.isArray(config.sections)) {
      return { sections: config.sections, title: config.title };
    }
  } catch {
    // ignore parse error
  }
  return null;
}

function removeActionBlocks(content: string): string {
  return content
    .replace(/```dashboard_config\s*\n[\s\S]*?\n```/g, "")
    .replace(/```datasource_config\s*\n[\s\S]*?\n```/g, "")
    .replace(/```alert_config\s*\n[\s\S]*?\n```/g, "")
    .replace(/```notification_rule\s*\n[\s\S]*?\n```/g, "")
    .replace(/```report_config\s*\n[\s\S]*?\n```/g, "")
    .replace(/```rca_request\s*\n[\s\S]*?\n```/g, "")
    .trim();
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

function summaryFromConversation(conversation: ChatConversation): ChatConversationSummary {
  const persistedMessages = toPersistedMessages(conversation.messages);
  const preview = persistedMessages[persistedMessages.length - 1]?.content?.replace(/\s+/g, " ").trim() || "";
  return {
    id: conversation.id,
    title: conversation.title,
    preview: preview.length > 40 ? `${preview.slice(0, 40)}...` : preview,
    messageCount: persistedMessages.length,
    createdAt: conversation.createdAt,
    updatedAt: conversation.updatedAt,
    lastMessageAt: conversation.lastMessageAt,
  };
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

function ThinkingIndicator() {
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

function MessageBubble({
  message,
  userName,
  onSaveDashboard,
}: {
  message: ChatMessage;
  userName?: string;
  onSaveDashboard?: (payload: { title?: string; sections: DashboardSection[] }) => void;
}) {
  const isUser = message.role === "user";

  return (
    <div className={`flex items-end gap-2.5 ${isUser ? "flex-row-reverse" : ""} ${isUser ? "animate-msg-right" : "animate-msg-left"}`}>
      {isUser ? <UserAvatar name={userName} /> : <AiAvatar />}
      <div className={`w-fit min-w-0 max-w-[75%] group ${isUser ? "items-end" : "items-start"} flex flex-col`}>
        <div
          className={`relative min-w-0 overflow-hidden rounded-2xl px-4 py-3 text-sm leading-relaxed transition-shadow ${isUser
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

function WelcomeScreen({ questions, onSelect, loading }: { questions: string[]; onSelect: (q: string) => void; loading?: boolean }) {
  // 兜底默认问题（AI 未返回时展示）
  const defaultQuestions = [
    "上月销售额与环比增长情况",
    "本月营收趋势分析",
    "哪个产品/渠道表现最好",
    "下个月的销售预测",
  ];
  // 渐进式策略：有问题就展示，loading 时也不显示骨架屏
  // 优先用 AI 推荐 > 用 sessionStorage 缓存的推荐 > 用默认问题
  const displayQuestions = questions.length > 0 ? questions : defaultQuestions;

  return (
    <div className="flex flex-col items-center justify-center py-16 animate-scale-in">
      <div className="relative mb-8">
        <div className="absolute -inset-8 bg-indigo-500/10 rounded-full blur-2xl animate-float-orb" />
        <div className="relative w-20 h-20 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-2xl shadow-indigo-500/25 card-shimmer-border">
          <svg className="w-10 h-10 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.3}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 0 0-2.456 2.456ZM16.894 20.567 16.5 21.75l-.394-1.183a2.25 2.25 0 0 0-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 0 0 1.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 0 0 1.423 1.423l1.183.394-1.183.394a2.25 2.25 0 0 0-1.423 1.423Z" />
          </svg>
        </div>
      </div>

      <h2 className="text-3xl font-bold text-gradient mb-2 tracking-tight">有什么数据问题?</h2>
      <p className="text-zinc-500 text-sm mb-10 max-w-md text-center leading-relaxed">
        上传数据文件或直接提问，我将为你提供深度分析洞察与可视化建议
      </p>

      <div className="grid sm:grid-cols-2 gap-3 max-w-2xl w-full px-4">
        {displayQuestions.map((q, i) => (
          <button
            key={`suggestion-${i}`}
            onClick={() => onSelect(q)}
            className={`group relative p-4 rounded-xl bg-zinc-900/40 border border-zinc-800/40 text-left text-sm text-zinc-400 hover:text-zinc-100 hover:border-indigo-500/30 hover:bg-zinc-800/40 transition-all duration-300 hover-lift overflow-hidden${loading ? " opacity-70" : ""}`}
            style={{ animationDelay: `${i * 80}ms` }}
          >
            <div className="absolute inset-0 card-inner-glow opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
            <span className="relative flex items-start gap-2.5">
              <span className="mt-0.5 w-5 h-5 shrink-0 rounded-md bg-indigo-500/10 flex items-center justify-center text-indigo-400 group-hover:bg-indigo-500/20 group-hover:text-indigo-300 transition-colors">
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
                </svg>
              </span>
              <span className="leading-relaxed">{q}</span>
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

export default function SimpleChatPanel({ onDataSummaryChange }: Readonly<ChatPanelProps>) {
  const router = useRouter();
  const currentUser = useMemo(() => getCurrentUser(), []);
  const tenantId = currentUser?.tenantId || currentUser?.id || "demo-tenant";
  const [messages, setMessages] = useState<ChatMessage[]>(() => createWelcomeMessages());
  const [conversations, setConversations] = useState<ChatConversationSummary[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [editingConversationId, setEditingConversationId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState("");
  const [loading, setLoading] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [sidebarBusyId, setSidebarBusyId] = useState<string | null>(null);
  const [pendingDeleteConversationId, setPendingDeleteConversationId] = useState<string | null>(null);
  const [dataSummary, setDataSummary] = useState("");
  const [uploadedFiles, setUploadedFiles] = useState<{ name: string; summary?: string }[]>([]);
  const [suggestedQuestions, setSuggestedQuestions] = useState<string[]>(() => {
    // 优先从 sessionStorage 恢复缓存的推荐问题（避免页面刷新后重新等待 LLM）
    if (typeof window !== "undefined") {
      try {
        const cached = sessionStorage.getItem("bizlens_suggested_questions");
        if (cached) {
          const parsed = JSON.parse(cached);
          if (Array.isArray(parsed) && parsed.length > 0) return parsed;
        }
      } catch { /* ignore */ }
    }
    return [];
  });
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  const suggestionsAbortControllerRef = useRef<AbortController | null>(null);
  /** 标记是否已经成功获取过 AI 推荐问题（防止重复请求） */
  const suggestionsLoadedRef = useRef(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const hasScrolledRef = useRef(false);
  const lastSavedSignatureRef = useRef("[]");
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const manualStopRef = useRef(false);
  /** 标记在 loading 期间有消息变更需要保存 */
  const pendingSaveDuringLoadingRef = useRef(false);
  /** 跟踪最新 messages / activeConversationId，供卸载 cleanup 使用 */
  const latestMessagesRef = useRef(messages);
  const latestConversationIdRef = useRef(activeConversationId);

  // 同步 ref 到最新值，确保卸载 cleanup 能拿到最新状态
  useEffect(() => {
    latestMessagesRef.current = messages;
  }, [messages]);
  useEffect(() => {
    latestConversationIdRef.current = activeConversationId;
  }, [activeConversationId]);

  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const needsScroll = container.scrollHeight - container.clientHeight > 8;
    if (!needsScroll) {
      hasScrolledRef.current = true;
      return;
    }

    container.scrollTo({ top: container.scrollHeight, behavior: hasScrolledRef.current ? "smooth" : "auto" });
    hasScrolledRef.current = true;
  }, [messages, loading]);

  useEffect(() => {
    onDataSummaryChange?.(dataSummary);
  }, [dataSummary, onDataSummaryChange]);

  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
    };
  }, []);

  /**
   * 组件卸载或页面刷新时，同步保存未持久化的消息到后端。
   *
   * 覆盖两种场景：
   * 1. SPA 路由切换 -- useEffect cleanup 触发
   * 2. 页面硬刷新/关闭 -- window beforeunload 事件触发
   *
   * 使用 navigator.sendBeacon (POST) 保证即使页面正在卸载也能可靠发送；
   * 后端 chat-conversations/{id} 同时接受 PUT 和 POST。
   * 若 sendBeacon 不可用则退回到同步 XMLHttpRequest。
   */
  const syncSaveBeforeUnload = useCallback(() => {
    const conversationId = latestConversationIdRef.current;
    const currentMessages = latestMessagesRef.current;
    if (!conversationId) return;

    // 清除尚未执行的防抖定时器
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }

    const persistedMessages = toPersistedMessages(currentMessages);
    const signature = computeMessageSignature(persistedMessages);
    // 签名无变化说明已保存过，无需重复保存
    if (signature === lastSavedSignatureRef.current) return;

    const token = getAccessToken();
    const apiBase = process.env.NEXT_PUBLIC_API_URL || "/api";
    const url = `${apiBase}/tenants/${tenantId}/chat-conversations/${conversationId}`;
    const payload = JSON.stringify({
      title: buildConversationTitle(persistedMessages),
      messages: persistedMessages,
    });

    // 优先使用 sendBeacon（浏览器保证在页面卸载时完成发送）
    // sendBeacon 只支持 POST，不支持自定义 header，因此 token 通过 URL query 传递
    if (typeof navigator !== "undefined" && navigator.sendBeacon) {
      const beaconUrl = token ? `${url}?_token=${encodeURIComponent(token)}` : url;
      const blob = new Blob([payload], { type: "application/json" });
      const sent = navigator.sendBeacon(beaconUrl, blob);
      if (sent) return;
      // sendBeacon 返回 false 时退回到 XHR
    }

    // fallback：同步 XMLHttpRequest（阻塞式，确保请求在页面卸载前完成）
    try {
      const xhr = new XMLHttpRequest();
      xhr.open("PUT", url, false);
      xhr.setRequestHeader("Content-Type", "application/json");
      if (token) xhr.setRequestHeader("Authorization", `Bearer ${token}`);
      xhr.send(payload);
    } catch {
      // 静默处理
    }
  }, [tenantId]);

  // 注册 beforeunload 事件（处理页面刷新 / 关闭标签页）
  useEffect(() => {
    const handleBeforeUnload = () => {
      syncSaveBeforeUnload();
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      // SPA 路由切换时 useEffect cleanup 触发，也保存一次
      syncSaveBeforeUnload();
    };
  }, [syncSaveBeforeUnload]);

  // 加载个性化推荐问题
  // 策略：等 conversations 加载完成后（historyLoading=false）再发起一次请求
  // 如果已成功获取过 AI 推荐，不再重复请求
  useEffect(() => {
    // 等待历史对话加载完成后再请求（避免无效的双重触发）
    if (historyLoading) return;
    // 已成功获取过 AI 推荐，跳过
    if (suggestionsLoadedRef.current) return;

    const currentUser = getCurrentUser();
    const userTenantId = currentUser?.tenantId || currentUser?.id || "demo-tenant";
    const token = getAccessToken();

    // 取消之前的请求，防止竞态条件
    suggestionsAbortControllerRef.current?.abort();
    const abortController = new AbortController();
    suggestionsAbortControllerRef.current = abortController;

    setSuggestionsLoading(true);
    fetch("/api/chat/suggested-questions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({
        tenantId: userTenantId,
        companyProfile: currentUser?.companyProfile,
        conversations: conversations,
      }),
      signal: abortController.signal,
    })
      .then((res) => {
        if (!res.ok) throw new Error("fetch failed");
        return res.json();
      })
      .then((data: { questions?: string[]; source?: string }) => {
        if (data.questions && data.questions.length > 0) {
          setSuggestedQuestions(data.questions);
          suggestionsLoadedRef.current = true;
          // 写入 sessionStorage 以便页面刷新后快速恢复
          try {
            sessionStorage.setItem("bizlens_suggested_questions", JSON.stringify(data.questions));
          } catch { /* quota exceeded 等异常忽略 */ }
        }
      })
      .catch((err) => {
        if (err.name === "AbortError") {
          return;
        }
        console.warn("获取推荐问题失败:", err);
      })
      .finally(() => {
        if (!abortController.signal.aborted) {
          setSuggestionsLoading(false);
        }
      });

    return () => {
      abortController.abort();
    };
  }, [historyLoading, conversations]);

  const applyConversation = useCallback((conversation: ChatConversation) => {
    const persistedMessages = conversation.messages.length ? conversation.messages : [];
    setEditingConversationId(null);
    setEditingTitle("");
    setActiveConversationId(conversation.id);
    setMessages(persistedMessages.length ? persistedMessages : createWelcomeMessages());
    setUploadedFiles(
      persistedMessages.flatMap((item) => item.files?.map((file) => ({ name: file.name, summary: file.summary })) || [])
    );
    lastSavedSignatureRef.current = computeMessageSignature(persistedMessages);
  }, []);

  const resetToWelcomeState = useCallback(() => {
    setConversations([]);
    setActiveConversationId(null);
    setMessages(createWelcomeMessages());
    setUploadedFiles([]);
    setDataSummary("");
    lastSavedSignatureRef.current = "[]";
  }, []);

  const upsertConversationSummary = useCallback((summary: ChatConversationSummary) => {
    setConversations((prev) => {
      const next = [summary, ...prev.filter((item) => item.id !== summary.id)];
      return next.sort((a, b) => {
        const aTime = new Date(a.lastMessageAt || a.updatedAt).getTime();
        const bTime = new Date(b.lastMessageAt || b.updatedAt).getTime();
        return bTime - aTime;
      });
    });
  }, []);

  /**
   * 立即保存当前会话消息到后端，不走防抖。
   * 用于 sendToAI 结束时确保消息可靠持久化。
   */
  const flushSave = useCallback(
    async (conversationId: string, currentMessages: ChatMessage[]) => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
        saveTimerRef.current = null;
      }
      const persistedMessages = toPersistedMessages(currentMessages);
      const signature = computeMessageSignature(persistedMessages);
      if (signature === lastSavedSignatureRef.current) return;
      try {
        const saved = await request<ChatConversation>(
          `/tenants/${tenantId}/chat-conversations/${conversationId}`,
          {
            method: "PUT",
            body: JSON.stringify({
              title: buildConversationTitle(persistedMessages),
              messages: persistedMessages,
            }),
          }
        );
        lastSavedSignatureRef.current = computeMessageSignature(saved.messages);
        upsertConversationSummary(summaryFromConversation(saved));
      } catch (err) {
        console.error("保存会话失败:", err);
      }
    },
    [tenantId, upsertConversationSummary]
  );

  const filteredConversations = useMemo(() => {
    const keyword = searchQuery.trim().toLowerCase();
    if (!keyword) return conversations;
    return conversations.filter((item) => {
      const haystack = `${item.title} ${item.preview}`.toLowerCase();
      return haystack.includes(keyword);
    });
  }, [conversations, searchQuery]);

  const loadConversation = useCallback(async (conversationId: string) => {
    setSidebarBusyId(conversationId);
    try {
      const conversation = await request<ChatConversation>(`/tenants/${tenantId}/chat-conversations/${conversationId}`);
      applyConversation(conversation);
    } finally {
      setSidebarBusyId(null);
    }
  }, [applyConversation, tenantId]);

  const createConversation = useCallback(async () => {
    const conversation = await request<ChatConversation>(`/tenants/${tenantId}/chat-conversations`, {
      method: "POST",
      body: JSON.stringify({}),
    });
    setSearchQuery("");
    applyConversation(conversation);
    upsertConversationSummary(summaryFromConversation(conversation));
    setDataSummary("");
    setInput("");
    return conversation;
  }, [applyConversation, tenantId, upsertConversationSummary]);

  useEffect(() => {
    let disposed = false;

    const bootstrap = async () => {
      if (!currentUser) {
        router.replace("/auth/login");
        return;
      }

      try {
        const items = await request<ChatConversationSummary[]>(`/tenants/${tenantId}/chat-conversations`);
        if (disposed) return;
        setConversations(items);

        if (items.length > 0) {
          await loadConversation(items[0].id);
        } else {
          await createConversation();
        }
      } finally {
        if (!disposed) {
          setHistoryLoading(false);
        }
      }
    };

    bootstrap().catch((err) => {
      console.error("初始化会话失败:", err);
      if (!disposed) {
        if (isNotFoundError(err)) {
          resetToWelcomeState();
          setHistoryLoading(false);
          return;
        }

        setHistoryLoading(false);
        setMessages([
          ...createWelcomeMessages(),
          {
            id: crypto.randomUUID(),
            role: "assistant",
            content: `加载历史会话失败：${err instanceof Error ? err.message : "未知错误"}`,
            timestamp: Date.now(),
          },
        ]);
      }
    });

    return () => {
      disposed = true;
    };
  }, [createConversation, currentUser, loadConversation, resetToWelcomeState, router, tenantId]);

  useEffect(() => {
    if (!activeConversationId || historyLoading) return;

    const persistedMessages = toPersistedMessages(messages);
    const signature = computeMessageSignature(persistedMessages);
    if (signature === lastSavedSignatureRef.current) return;

    // 在 AI 回复期间（loading === true）不立即保存，但标记需要保存
    if (loading) {
      pendingSaveDuringLoadingRef.current = true;
      return;
    }

    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
    }

    saveTimerRef.current = setTimeout(async () => {
      try {
        const saved = await request<ChatConversation>(`/tenants/${tenantId}/chat-conversations/${activeConversationId}`, {
          method: "PUT",
          body: JSON.stringify({
            title: buildConversationTitle(persistedMessages),
            messages: persistedMessages,
          }),
        });
        lastSavedSignatureRef.current = computeMessageSignature(saved.messages);
        upsertConversationSummary(summaryFromConversation(saved));
      } catch (err) {
        console.error("保存会话失败:", err);
      }
    }, 500);

    return () => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
        saveTimerRef.current = null;
      }
    };
  }, [activeConversationId, historyLoading, loading, messages, tenantId, upsertConversationSummary]);

  const sendToAI = useCallback(async (question: string) => {
    const user = getCurrentUser();
    if (!user) {
      router.push("/auth/login");
      return;
    }

    let conversationId = activeConversationId;
    if (!conversationId) {
      const conversation = await createConversation();
      conversationId = conversation.id;
    }

    // 先立即把用户消息和当前对话持久化到后端
    // 再触发 AI 处理，这样即使页面关闭用户消息也不会丢失
    try {
      const allMsgsNow = [
        ...toPersistedMessages(messages),
        { id: crypto.randomUUID(), role: "user", content: question, timestamp: Date.now() } as ChatMessage,
      ];
      await request(`/tenants/${tenantId}/chat-conversations/${conversationId}`, {
        method: "PUT",
        body: JSON.stringify({
          title: buildConversationTitle(allMsgsNow),
          messages: allMsgsNow,
        }),
      });
    } catch {
      // 持久化失败不影响 AI 处理
    }

    const userMsgId = crypto.randomUUID();
    const assistantMsgId = crypto.randomUUID();

    const createDataSourceFromResponse = async (rawContent: string) => {
      const dsRegex = /```datasource_config\s*\n([\s\S]*?)\n```/;
      const dsMatch = dsRegex.exec(rawContent);
      if (!dsMatch) return false;

      try {
        const dsConfig = JSON.parse(dsMatch[1]);
        const token = getAccessToken();
        const headers: Record<string, string> = { "Content-Type": "application/json" };
        if (token) headers.Authorization = `Bearer ${token}`;

        const dsRes = await fetch(`/api/tenants/${tenantId}/data-sources`, {
          method: "POST",
          headers,
          body: JSON.stringify(dsConfig),
        });

        const cleanContent = rawContent.replace(dsRegex, "").trim();

        if (!dsRes.ok) {
          const errData = await dsRes.json().catch(() => null);
          const errMsg = errData?.error || `HTTP ${dsRes.status}`;
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantMsgId
                ? { ...m, content: `${cleanContent}\n\n**数据源配置失败**：${errMsg}\n\n请检查连接信息是否正确，或前往 [数据源管理](/settings/data-sources) 页面手动配置。` }
                : m
            )
          );
          return false;
        }

        const created = await dsRes.json();
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantMsgId
              ? {
                ...m,
                content:
                  `${cleanContent}\n\n数据源「${created.name || dsConfig.name}」已自动配置成功！\n\n` +
                  `**连接详情**：\n` +
                  `- 类型：${(dsConfig.type || "").toUpperCase()}\n` +
                  `- 主机：${dsConfig.connection?.host}:${dsConfig.connection?.port}\n` +
                  `- 数据库：${dsConfig.connection?.database}\n` +
                  `- 状态：已连接\n\n` +
                  `你可以前往 [数据源管理](/settings/data-sources) 页面查看详情，或直接开始数据分析。`,
              }
              : m
          )
        );
        return true;
      } catch (err) {
        console.error("创建数据源失败:", err);
        return false;
      }
    };

    const createAlertFromResponse = async (rawContent: string) => {
      const alertRegex = /```alert_config\s*\n([\s\S]*?)\n```/;
      const alertMatch = alertRegex.exec(rawContent);
      if (!alertMatch) return false;

      try {
        const alertConfig = JSON.parse(alertMatch[1]);
        const token = getAccessToken();
        const headers: Record<string, string> = { "Content-Type": "application/json" };
        if (token) headers.Authorization = `Bearer ${token}`;

        const alertRes = await fetch(`/api/tenants/${tenantId}/alerts`, {
          method: "POST",
          headers,
          body: JSON.stringify(alertConfig),
        });

        const cleanContent = rawContent.replace(alertRegex, "").trim();
        if (!alertRes.ok) {
          const errData = await alertRes.json().catch(() => null);
          const errMsg = errData?.error || `HTTP ${alertRes.status}`;
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantMsgId
                ? {
                  ...m,
                  content:
                    `${cleanContent}\n\n` +
                    `已识别到告警意图，但自动创建告警规则失败：${errMsg}\n\n` +
                    `你可以前往 [告警配置](/alerts/config) 页面手动检查。`,
                }
                : m
            )
          );
          return false;
        }

        const created = await alertRes.json();
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantMsgId
              ? {
                ...m,
                content:
                  `${cleanContent}\n\n` +
                  `告警规则「${created.name || alertConfig.name}」已自动创建。\n\n` +
                  `可前往 [告警配置](/alerts/config) 页面查看和调整。`,
              }
              : m
          )
        );
        return true;
      } catch (err) {
        console.error("创建告警规则失败:", err);
        return false;
      }
    };

    const createNotificationRuleFromResponse = async (rawContent: string) => {
      const notificationRegex = /```notification_rule\s*\n([\s\S]*?)\n```/;
      const notificationMatch = notificationRegex.exec(rawContent);
      if (!notificationMatch) return false;

      try {
        const ruleConfig = JSON.parse(notificationMatch[1]) as Record<string, unknown>;
        const token = getAccessToken();
        const headers: Record<string, string> = { "Content-Type": "application/json" };
        if (token) headers.Authorization = `Bearer ${token}`;

        const imRes = await fetch(`/api/tenants/${tenantId}/im-configs`, { headers });
        const imConfigs = imRes.ok ? await imRes.json() : [];
        const enabledConfigs = Array.isArray(imConfigs) ? imConfigs.filter((c) => c?.enabled) : [];

        const rawPlatformValue = ruleConfig.platformIds;
        const rawPlatformIds = Array.isArray(rawPlatformValue)
          ? rawPlatformValue.map(String).join(",").trim()
          : typeof rawPlatformValue === "string"
            ? rawPlatformValue.trim()
            : "";
        const requestedTokens = rawPlatformIds
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean);

        const resolvedIds = new Set<string>();
        const unresolvedTokens: string[] = [];

        for (const tokenItem of requestedTokens) {
          const tokenLower = tokenItem.toLowerCase();
          const matched = enabledConfigs.filter((cfg: any) => {
            const id = String(cfg?.id || "");
            const type = String(cfg?.type || "").toLowerCase();
            const name = String(cfg?.name || "").toLowerCase();
            return id === tokenItem || type === tokenLower || name.includes(tokenLower);
          });
          if (matched.length > 0) {
            matched.forEach((cfg: any) => resolvedIds.add(String(cfg.id)));
          } else {
            unresolvedTokens.push(tokenItem);
          }
        }

        if (requestedTokens.length === 0) {
          // platformIds 未指定时，不自动选择任何平台
          // 由用户在 IM 配置页面手动关联，或在创建规则后编辑
        }

        ruleConfig.platformIds = Array.from(resolvedIds).join(",");

        const ruleRes = await fetch(`/api/tenants/${tenantId}/notification-rules`, {
          method: "POST",
          headers,
          body: JSON.stringify(ruleConfig),
        });

        const cleanContent = rawContent.replace(notificationRegex, "").trim();
        if (!ruleRes.ok) {
          const errData = await ruleRes.json().catch(() => null);
          const errMsg = errData?.error || `HTTP ${ruleRes.status}`;
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantMsgId
                ? {
                  ...m,
                  content:
                    `${cleanContent}\n\n` +
                    `已识别到通知规则，但自动创建失败：${errMsg}\n\n` +
                    `请前往 [IM 配置](/im/settings) 检查钉钉机器人，并在 [通知规则](/im/rules) 页面手动创建。`,
                }
                : m
            )
          );
          return false;
        }

        const created = await ruleRes.json();
        const unresolvedText =
          unresolvedTokens.length > 0
            ? `\n- 未匹配平台：${unresolvedTokens.join(", ")}（请在 IM 配置页检查）`
            : "";
        const pairStatus = resolvedIds.size > 0 ? "已自动完成平台配对" : "未匹配到可用平台配置";

        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantMsgId
              ? {
                ...m,
                content:
                  `${cleanContent}\n\n` +
                  `通知规则「${created.name || ruleConfig.name || "未命名规则"}」已自动创建，${pairStatus}。\n\n` +
                  `**核对入口**：\n` +
                  `- [查看通知规则](/im/rules?ruleId=${created.id})\n` +
                  `- [检查 IM 配置](/im/settings)` +
                  unresolvedText,
              }
              : m
          )
        );
        return true;
      } catch (err) {
        console.error("创建通知规则失败:", err);
        return false;
      }
    };

    const createDashboardFromResponse = async (rawContent: string) => {
      const config = extractDashboardConfig(rawContent);
      if (!config) return false;
      try {
        const saved = await createDashboardInstance({
          title: config.title || "AI 生成大屏",
          sections: config.sections,
        });
        const cleanContent = removeActionBlocks(rawContent);
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantMsgId
              ? {
                ...m,
                content: `${cleanContent}\n\n[check] 大屏「${saved.title}」已自动创建，可前往 /dashboards?id=${saved.id} 查看。`,
              }
              : m
          )
        );
        return true;
      } catch (err) {
        console.error("创建大屏失败:", err);
        return false;
      }
    };

    setMessages((prev) => [
      ...prev,
      { id: userMsgId, role: "user", content: question, timestamp: Date.now() },
      { id: assistantMsgId, role: "assistant", content: "", timestamp: Date.now() },
    ]);

    setLoading(true);
    const abortController = new AbortController();
    abortControllerRef.current = abortController;
    manualStopRef.current = false;
    try {
      const token = getAccessToken();
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (token) {
        headers.Authorization = `Bearer ${token}`;
      }

      const parsedConn = parseConnectionUriFromText(question);
      if (parsedConn) {
        const dsPayload = {
          type: parsedConn.type,
          name: `${parsedConn.database} 数据库`,
          description: `通过聊天自动配置（${parsedConn.host}:${parsedConn.port}/${parsedConn.database}）`,
          connection: {
            host: parsedConn.host,
            port: parsedConn.port,
            database: parsedConn.database,
            username: parsedConn.username,
            password: parsedConn.password,
            ssl: parsedConn.ssl ?? false,
          },
        };

        const dsRes = await fetch(`/api/tenants/${tenantId}/data-sources`, {
          method: "POST",
          headers,
          body: JSON.stringify(dsPayload),
        });

        if (!dsRes.ok) {
          const errData = await dsRes.json().catch(() => null);
          const errMsg = errData?.error || `HTTP ${dsRes.status}`;
          const diagnosis = errData?.connectionDiagnosis as
            | {
              dnsMessage?: string;
              tcpMessage?: string;
              tlsMessage?: string;
              authMessage?: string;
              recommendedSSL?: string;
              diagnosisSummary?: string;
            }
            | undefined;
          const diagnosisText = diagnosis
            ? `\n\n**连接诊断**：\n` +
            `- DNS：${diagnosis.dnsMessage || "未返回"}\n` +
            `- TCP：${diagnosis.tcpMessage || "未返回"}\n` +
            `- TLS：${diagnosis.tlsMessage || "未返回"}\n` +
            `- 鉴权：${diagnosis.authMessage || "未返回"}\n` +
            `- 建议 SSL：${diagnosis.recommendedSSL || "未返回"}\n` +
            `- 结论：${diagnosis.diagnosisSummary || "未返回"}`
            : "";
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantMsgId
                ? {
                  ...m,
                  content:
                    `已识别到数据库连接串，但自动配置失败：${errMsg}\n\n` +
                    diagnosisText +
                    `\n\n` +
                    `请确认连接串可访问，或前往 [数据源管理](/settings/data-sources) 页面查看。`,
                }
                : m
            )
          );
          return;
        }

        const created = await dsRes.json().catch(() => null);
        const finalName = created?.name || dsPayload.name;
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantMsgId
              ? {
                ...m,
                content:
                  `已为你自动配置数据源「${finalName}」。\n\n` +
                  `- 类型：${parsedConn.type.toUpperCase()}\n` +
                  `- 主机：${parsedConn.host}:${parsedConn.port}\n` +
                  `- 数据库：${parsedConn.database}\n` +
                  `- 用户名：${parsedConn.username}\n\n` +
                  `现在可以直接继续提问分析，例如“帮我看下最近7天的销售趋势”。`,
              }
              : m
          )
        );
        return;
      }

      const conversationMessages = [
        ...toPersistedMessages(messages)
          .filter((m) => m.content.trim())
          .map((m) => ({ role: m.role, content: m.content })),
        { role: "user", content: question },
      ];

      const res = await fetch("/api/chat", {
        method: "POST",
        headers,
        signal: abortController.signal,
        body: JSON.stringify({
          messages: conversationMessages,
          dataSummary: dataSummary || undefined,
          companyProfile: user.companyProfile,
          tenantId,
          conversationId,
        }),
      });

      const contentType = res.headers.get("content-type") || "";
      if (!res.ok) {
        let errText = `请求失败：${res.status}`;
        if (contentType.includes("application/json")) {
          const data = await res.json();
          errText = data.error || data.content || errText;
        }
        throw new Error(errText);
      }

      if (contentType.includes("application/json")) {
        const data = await res.json();
        const content = data.content || data.error || "无回复";
        setMessages((prev) => prev.map((m) => (m.id === assistantMsgId ? { ...m, content } : m)));
        await createAlertFromResponse(content);
        await createNotificationRuleFromResponse(content);
        await createDataSourceFromResponse(content);
        await createDashboardFromResponse(content);
        return;
      }

      const reader = res.body?.getReader();
      if (!reader) throw new Error("无法读取响应流");

      const decoder = new TextDecoder();
      let buffer = "";
      let fullContent = "";

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        let idx;
        while ((idx = buffer.indexOf("\n\n")) !== -1) {
          const raw = buffer.slice(0, idx).trim();
          buffer = buffer.slice(idx + 2);
          if (!raw.startsWith("data:")) continue;
          const jsonStr = raw.replace(/^data:\s*/, "");
          if (!jsonStr) continue;

          const evt = JSON.parse(jsonStr) as
            | { type: "delta"; content: string }
            | { type: "meta"; analysis?: any; model?: string }
            | { type: "tool_call"; toolName?: string; toolCallId?: string }
            | { type: "tool_result"; toolCallId?: string; result?: { success?: boolean; message?: string } }
            | { type: "done" }
            | { type: "error"; error?: string };

          if (evt.type === "delta") {
            fullContent += evt.content || "";
            setMessages((prev) => prev.map((m) => (m.id === assistantMsgId ? { ...m, content: fullContent } : m)));
          } else if (evt.type === "tool_call") {
            setMessages((prev) => prev.map((m) => (m.id === assistantMsgId ? { ...m, content: fullContent + "\n\n> 正在发送消息到钉钉..." } : m)));
          } else if (evt.type === "error") {
            throw new Error(evt.error || "流式响应错误");
          }
        }
      }

      if (fullContent) {
        await createAlertFromResponse(fullContent);
        await createNotificationRuleFromResponse(fullContent);
        await createDataSourceFromResponse(fullContent);
        await createDashboardFromResponse(fullContent);
      }
    } catch (err) {
      const isManualAbort = manualStopRef.current || (err instanceof DOMException && err.name === "AbortError");
      if (isManualAbort) {
        setMessages((prev) =>
          prev.map((m) => {
            if (m.id !== assistantMsgId) return m;
            const content = m.content.trim();
            return {
              ...m,
              content: content ? `${content}\n\n[已手动中断生成]` : "已手动中断本次生成。",
            };
          })
        );
        return;
      }
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantMsgId ? { ...m, content: `请求失败：${err instanceof Error ? err.message : "网络错误"}` } : m
        )
      );
    } finally {
      abortControllerRef.current = null;
      manualStopRef.current = false;
      pendingSaveDuringLoadingRef.current = true;
      setLoading(false);
    }
  }, [activeConversationId, createConversation, dataSummary, messages, router, tenantId]);

  /**
   * 当 loading 从 true 变为 false 且有 pending 保存时，立即保存。
   * 不走防抖，确保 AI 回复结束后消息一定被持久化。
   */
  useEffect(() => {
    if (loading || !pendingSaveDuringLoadingRef.current || !activeConversationId) return;
    pendingSaveDuringLoadingRef.current = false;
    flushSave(activeConversationId, messages);
  }, [loading, activeConversationId, messages, flushSave]);

  const handleStopGeneration = useCallback(() => {
    if (!loading || !abortControllerRef.current) return;
    manualStopRef.current = true;
    abortControllerRef.current.abort();
  }, [loading]);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch("/api/parse-data", { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "解析失败");

      const summary = data.summary as string;
      setDataSummary((prev) => (prev ? `${prev}\n\n${summary}` : summary));
      setUploadedFiles((prev) => [...prev, { name: file.name, summary: data.summary?.slice(0, 200) }]);
      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: "user",
          content: `已上传文件：${file.name}，请学习并分析`,
          files: [{ name: file.name, summary: data.summary?.slice(0, 150) }],
          timestamp: Date.now(),
        },
      ]);

      await sendToAI(`用户上传了文件 ${file.name}，数据摘要：\n${summary}\n请简要总结数据结构，并给出下一步可做的分析方向。`);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          content: `上传或解析失败：${err instanceof Error ? err.message : "未知错误"}`,
          timestamp: Date.now(),
        },
      ]);
    }

    e.target.value = "";
  };

  const handleSend = async () => {
    const text = input.trim();
    if (!text || loading) return;
    setInput("");

    // 使用 AI 意图识别判断用户想要做什么
    const intentResult = await detectUserIntent(text, tenantId);

    // 如果是发送钉钉消息
    if (intentResult.intent === "send_dingtalk") {
      const directMsg = intentResult.extractedContent || text;
      const userMsgId = crypto.randomUUID();
      const assistantMsgId = crypto.randomUUID();
      setMessages((prev) => [
        ...prev,
        { id: userMsgId, role: "user", content: text, timestamp: Date.now() },
        { id: assistantMsgId, role: "assistant", content: "", timestamp: Date.now() },
      ]);

      const token = getAccessToken();
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (token) headers.Authorization = `Bearer ${token}`;

      try {
        const imRes = await fetch(`/api/tenants/${tenantId}/im-configs`, { headers });
        const imConfigs = imRes.ok ? await imRes.json() : [];
        const enabledConfigs = Array.isArray(imConfigs) ? imConfigs.filter((c) => c?.enabled) : [];
        const dingCfg = enabledConfigs.find((c: any) => String(c?.type || "").toLowerCase() === "dingtalk");

        if (!dingCfg) {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantMsgId
                ? {
                  ...m,
                  content:
                    `未找到已启用的钉钉配置，无法发送。\n\n` +
                    `请先前往 [IM 配置](/im/settings) 添加并启用钉钉机器人。`,
                }
                : m
            )
          );
          return;
        }

        const sendRes = await fetch(`/api/tenants/${tenantId}/notifications/send`, {
          method: "POST",
          headers,
          body: JSON.stringify({
            platformIds: [String(dingCfg.id)],
            title: "",
            content: directMsg,
            markdown: false,
          }),
        });

        if (!sendRes.ok) {
          const errData = await sendRes.json().catch(() => null);
          const errMsg = errData?.error || `HTTP ${sendRes.status}`;
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantMsgId
                ? {
                  ...m,
                  content:
                    `发送到钉钉失败：${errMsg}\n\n` +
                    `请检查 Webhook 与密钥是否正确，或在 [IM 配置](/im/settings) 重新测试。`,
                }
                : m
            )
          );
          return;
        }

        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantMsgId
              ? {
                ...m,
                content: `已将消息发送到钉钉：${directMsg}`,
              }
              : m
          )
        );
      } catch (err) {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantMsgId
              ? {
                ...m,
                content: `发送到钉钉时出现错误：${err instanceof Error ? err.message : "未知错误"}`,
              }
              : m
          )
        );
      }
      return;
    }

    // 其他意图交给 AI 处理
    void sendToAI(text);
  };

  const handleNewConversation = async () => {
    setSidebarBusyId("new");
    try {
      await createConversation();
    } finally {
      setSidebarBusyId(null);
    }
  };

  const handleDeleteConversation = async (conversationId: string) => {
    setSidebarBusyId(conversationId);
    try {
      await request(`/tenants/${tenantId}/chat-conversations/${conversationId}`, { method: "DELETE" });
      const remaining = conversations.filter((item) => item.id !== conversationId);
      setConversations(remaining);

      if (activeConversationId === conversationId) {
        if (remaining.length > 0) {
          await loadConversation(remaining[0].id);
        } else {
          await createConversation();
        }
      }
    } finally {
      setSidebarBusyId(null);
      setPendingDeleteConversationId(null);
    }
  };

  const handleStartRename = (conversation: ChatConversationSummary) => {
    setEditingConversationId(conversation.id);
    setEditingTitle(conversation.title || "新对话");
  };

  const handleRenameConversation = async (conversationId: string) => {
    const title = editingTitle.trim();
    if (!title) return;
    setSidebarBusyId(conversationId);
    try {
      const updated = await request<ChatConversationSummary>(`/tenants/${tenantId}/chat-conversations/${conversationId}`, {
        method: "PATCH",
        body: JSON.stringify({ title }),
      });
      upsertConversationSummary(updated);
      setEditingConversationId(null);
      setEditingTitle("");
    } finally {
      setSidebarBusyId(null);
    }
  };

  const handleCancelRename = () => {
    setEditingConversationId(null);
    setEditingTitle("");
  };

  const latestAssistantMessage = [...messages].reverse().find((m) => m.role === "assistant");
  const showThinkingIndicator = loading && !latestAssistantMessage?.content.trim();
  const showWelcome = toPersistedMessages(messages).length === 0;

  return (
    <div className="flex h-full min-h-0 flex-col lg:flex-row">
      <aside className="w-full shrink-0 border-b border-zinc-800/60 bg-zinc-950/80 backdrop-blur-xl lg:w-80 lg:border-b-0 lg:border-r">
        <div className="flex items-center justify-between border-b border-zinc-800/60 px-4 py-4">
          <div>
            <p className="text-sm font-semibold text-zinc-100">历史对话</p>
            <p className="text-xs text-zinc-500">保存你的分析上下文</p>
          </div>
          <button
            onClick={() => void handleNewConversation()}
            disabled={loading || historyLoading}
            className="inline-flex items-center gap-2 rounded-xl border border-indigo-500/30 bg-indigo-500/10 px-3 py-2 text-xs font-medium text-indigo-200 transition hover:bg-indigo-500/20 disabled:opacity-50"
          >
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            {sidebarBusyId === "new" ? "创建中" : "新对话"}
          </button>
        </div>

        <div className="flex gap-3 overflow-x-auto px-3 py-3 lg:block lg:h-[calc(100vh-88px)] lg:overflow-x-hidden lg:overflow-y-auto">
          <div className="min-w-[240px] lg:mb-3 lg:min-w-0">
            <div className="rounded-2xl border border-zinc-800/60 bg-zinc-900/35 px-3 py-3">
              <div className="flex items-center gap-2 rounded-xl border border-zinc-800/70 bg-zinc-950/70 px-3 py-2">
                <svg className="h-4 w-4 text-zinc-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-4.35-4.35m1.85-5.15a7 7 0 1 1-14 0 7 7 0 0 1 14 0Z" />
                </svg>
                <input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="搜索历史对话"
                  className="w-full bg-transparent text-sm text-zinc-100 placeholder-zinc-600 outline-none"
                />
              </div>
            </div>
          </div>

          {historyLoading ? (
            <div className="rounded-2xl border border-zinc-800/60 bg-zinc-900/40 px-4 py-5 text-sm text-zinc-500">正在加载历史对话...</div>
          ) : null}

          {!historyLoading && conversations.length === 0 ? (
            <div className="rounded-2xl border border-zinc-800/60 bg-zinc-900/40 px-4 py-5 text-sm text-zinc-500">还没有历史对话，开始提问吧。</div>
          ) : null}

          {!historyLoading && conversations.length > 0 && filteredConversations.length === 0 ? (
            <div className="rounded-2xl border border-zinc-800/60 bg-zinc-900/40 px-4 py-5 text-sm text-zinc-500">没有匹配的历史对话。</div>
          ) : null}

          {filteredConversations.map((item) => {
            const active = item.id === activeConversationId;
            const isEditing = item.id === editingConversationId;
            return (
              <div key={item.id} className="min-w-[240px] lg:min-w-0 lg:mb-3">
                <div
                  className={`group rounded-2xl border p-3 transition ${active
                      ? "border-indigo-500/40 bg-indigo-500/10 shadow-lg shadow-indigo-500/10"
                      : "border-zinc-800/60 bg-zinc-900/35 hover:border-zinc-700/80 hover:bg-zinc-900/60"
                    }`}
                >
                  <div className="flex items-start gap-2">
                    <div className="min-w-0 flex-1">
                      {isEditing ? (
                        <div className="space-y-2">
                          <input
                            value={editingTitle}
                            onChange={(e) => setEditingTitle(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") void handleRenameConversation(item.id);
                              if (e.key === "Escape") handleCancelRename();
                            }}
                            className="w-full rounded-xl border border-indigo-500/30 bg-zinc-950/80 px-3 py-2 text-sm text-zinc-100 outline-none"
                            autoFocus
                          />
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => void handleRenameConversation(item.id)}
                              disabled={!editingTitle.trim() || sidebarBusyId === item.id}
                              className="rounded-lg bg-indigo-500/15 px-2.5 py-1.5 text-xs text-indigo-200 transition hover:bg-indigo-500/25 disabled:opacity-50"
                            >
                              保存
                            </button>
                            <button
                              onClick={handleCancelRename}
                              className="rounded-lg bg-zinc-800 px-2.5 py-1.5 text-xs text-zinc-300 transition hover:bg-zinc-700"
                            >
                              取消
                            </button>
                          </div>
                        </div>
                      ) : (
                        <button className="w-full text-left" onClick={() => void loadConversation(item.id)}>
                          <div className="flex items-center justify-between gap-2">
                            <p className="truncate text-sm font-medium text-zinc-100">{item.title || "新对话"}</p>
                            <span className="shrink-0 text-[10px] uppercase tracking-[0.18em] text-zinc-500">
                              {formatHistoryDate(item.lastMessageAt || item.updatedAt)}
                            </span>
                          </div>
                          <p className="mt-1 line-clamp-2 text-xs leading-5 text-zinc-500">{item.preview || "等待第一条消息"}</p>
                        </button>
                      )}
                    </div>
                    {!isEditing ? (
                      <div className="shrink-0 flex items-center gap-1 self-start">
                        <button
                          onClick={() => handleStartRename(item)}
                          disabled={sidebarBusyId === item.id}
                          className="rounded-lg p-2 text-zinc-500 transition hover:bg-zinc-800 hover:text-indigo-300 disabled:opacity-50"
                          title="重命名对话"
                        >
                          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487a2.25 2.25 0 1 1 3.182 3.182L7.5 20.212 3 21l.788-4.5L16.862 4.487Z" />
                          </svg>
                        </button>
                        <button
                          onClick={() => setPendingDeleteConversationId(item.id)}
                          disabled={sidebarBusyId === item.id}
                          className="rounded-lg p-2 text-zinc-500 transition hover:bg-zinc-800 hover:text-rose-300 disabled:opacity-50"
                          title="删除对话"
                        >
                          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 7.5h12m-10.5 0v10.125A1.875 1.875 0 0 0 9.375 19.5h5.25A1.875 1.875 0 0 0 16.5 17.625V7.5m-6 3v5.25m3-5.25v5.25M9.75 7.5V5.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V7.5" />
                          </svg>
                        </button>
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </aside>

      <div className="flex min-h-0 flex-1 flex-col">
        <div ref={scrollContainerRef} className="flex-1 min-h-0 overflow-y-auto flex flex-col">
          <AppHeader
            title="AI 数据分析师"
            subtitle={
              (currentUser?.name ? currentUser.name : "智能洞察与分析建议") +
              (uploadedFiles.length > 0 ? ` | ${uploadedFiles.length} 个数据文件` : "")
            }
            showOnlineStatus
          />

          <div className="flex-1 min-h-0 pt-6">
            <div className="max-w-3xl mx-auto px-4 py-6 pb-12">
              {showWelcome ? (
                <WelcomeScreen
                  questions={suggestedQuestions}
                  onSelect={(q) => void sendToAI(q)}
                  loading={suggestionsLoading}
                />
              ) : null}

              <div className={`space-y-5 ${showWelcome ? "hidden" : ""}`}>
                {messages.map((m) => {
                  if (m.id === "welcome") return null;
                  if (m.role === "assistant" && !m.content.trim()) return null;
                  return (
                    <MessageBubble
                      key={m.id}
                      message={m}
                      userName={currentUser?.name}
                      onSaveDashboard={async (payload) => {
                        try {
                          const saved = await createDashboardInstance({
                            title: payload.title || "AI 生成大屏",
                            sections: payload.sections,
                          });
                          setMessages((prev) =>
                            prev.map((x) =>
                              x.id === m.id
                                ? {
                                  ...x,
                                  content:
                                    removeActionBlocks(x.content) +
                                    `\n\n[check] 大屏「${saved.title}」已保存，可前往 /dashboards?id=${saved.id} 查看。`,
                                }
                                : x
                            )
                          );
                        } catch (err) {
                          setMessages((prev) =>
                            prev.map((x) =>
                              x.id === m.id
                                ? {
                                  ...x,
                                  content:
                                    removeActionBlocks(x.content) +
                                    `\n\n[error] 保存大屏失败：${err instanceof Error ? err.message : "未知错误"}`,
                                }
                                : x
                            )
                          );
                        }
                      }}
                    />
                  );
                })}
                {showThinkingIndicator ? <ThinkingIndicator /> : null}
              </div>

              <div ref={messagesEndRef} />
            </div>
          </div>
        </div>

        <div className="shrink-0 border-t border-zinc-800/30 bg-zinc-900/40 backdrop-blur-xl">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-2/3 h-px bg-gradient-to-r from-transparent via-indigo-500/15 to-transparent" />

          <div className="max-w-3xl mx-auto px-4 py-4 pb-6">
            {uploadedFiles.length > 0 ? (
              <div className="flex flex-wrap gap-2 mb-3">
                {uploadedFiles.map((f) => (
                  <span
                    key={`${f.name}-${f.summary || ""}`}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs bg-indigo-500/10 text-indigo-300 border border-indigo-500/20"
                  >
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
                    </svg>
                    {f.name}
                  </span>
                ))}
              </div>
            ) : null}

            <div className="flex items-center gap-2.5">
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.txt,.json,.xlsx,.xls"
                className="hidden"
                onChange={handleUpload}
              />

              <button
                onClick={() => fileInputRef.current?.click()}
                className="shrink-0 p-2.5 rounded-xl text-zinc-500 hover:text-indigo-400 hover:bg-indigo-500/10 border border-transparent hover:border-indigo-500/20 transition-all"
                title="上传数据文件"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 16.5V9.75m0 0 3 3m-3-3-3 3M6.75 19.5a4.5 4.5 0 0 1-1.41-8.775 5.25 5.25 0 0 1 10.233-2.33 3 3 0 0 1 3.758 3.848A3.752 3.752 0 0 1 18 19.5H6.75Z" />
                </svg>
              </button>

              <div className="flex-1 input-glow rounded-xl bg-zinc-800/50 border border-zinc-700/30 focus-within:border-indigo-500/40 transition-all duration-300">
                <input
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSend()}
                  placeholder="描述你的数据分析需求..."
                  className="w-full bg-transparent px-4 py-3 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none"
                  autoFocus
                />
              </div>

              {loading ? (
                <button
                  onClick={handleStopGeneration}
                  disabled={historyLoading}
                  className="shrink-0 p-2.5 rounded-xl bg-rose-500/90 hover:bg-rose-500 text-white transition-all duration-200 disabled:opacity-30 disabled:cursor-not-allowed shadow-lg shadow-rose-500/20"
                  title="停止生成"
                >
                  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                    <rect x="6.5" y="6.5" width="11" height="11" rx="2.5" />
                  </svg>
                </button>
              ) : (
                <button
                  onClick={handleSend}
                  disabled={!input.trim() || historyLoading}
                  className="shrink-0 p-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white transition-all duration-200 disabled:opacity-30 disabled:cursor-not-allowed shadow-lg shadow-indigo-500/20 hover:shadow-indigo-500/30 btn-ripple disabled:shadow-none"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 12 3.269 3.125A59.769 59.769 0 0 1 21.485 12 59.768 59.768 0 0 1 3.27 20.875L5.999 12Zm0 0h7.5" />
                  </svg>
                </button>
              )}
            </div>
            {loading ? <p className="mt-2 text-xs text-zinc-500">正在生成回答，你可以随时手动中断。</p> : null}

            <p className="mt-2.5 text-center text-[10px] text-zinc-700 select-none">AI 分析结果仅供参考，请结合实际业务场景验证</p>
          </div>
        </div>
      </div>

      {pendingDeleteConversationId ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
          <div className="mx-4 w-full max-w-md rounded-2xl border border-zinc-700/60 bg-zinc-900/95 p-6 shadow-2xl shadow-black/50">
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-rose-500/15">
                <svg className="h-5 w-5 text-rose-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                  />
                </svg>
              </div>
              <h3 className="text-base font-semibold text-zinc-100">确认删除对话</h3>
            </div>
            <p className="mb-6 text-sm text-zinc-400">
              {`确定要删除“${conversations.find((item) => item.id === pendingDeleteConversationId)?.title || "新对话"}”吗？删除后将无法恢复。`}
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setPendingDeleteConversationId(null)}
                className="flex-1 rounded-xl border border-zinc-700 bg-zinc-800/80 px-5 py-2.5 text-sm font-medium text-zinc-200 transition hover:bg-zinc-700/80"
              >
                取消
              </button>
              <button
                onClick={() => void handleDeleteConversation(pendingDeleteConversationId)}
                disabled={sidebarBusyId === pendingDeleteConversationId}
                className="flex-1 rounded-xl bg-rose-600 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-rose-500 disabled:opacity-60"
              >
                {sidebarBusyId === pendingDeleteConversationId ? "删除中..." : "确认删除"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
