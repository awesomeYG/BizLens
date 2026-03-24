"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { getCurrentUser, logoutUser } from "@/lib/user-store";
import type { ChatMessage } from "@/lib/types";

interface ChatPanelProps {
  onDataSummaryChange?: (summary: string) => void;
}

/* ---------- 小工具函数 ---------- */
function formatTime(ts: number) {
  const d = new Date(ts);
  return `${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}`;
}

/* ---------- 子组件：AI 头像 ---------- */
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

/* ---------- 子组件：用户头像 ---------- */
function UserAvatar({ name }: { name?: string }) {
  const letter = name?.charAt(0)?.toUpperCase() || "U";
  return (
    <div className="w-7 h-7 shrink-0 rounded-xl bg-gradient-to-br from-zinc-600 to-zinc-700 flex items-center justify-center text-xs font-semibold text-zinc-200 border border-zinc-600/50">
      {letter}
    </div>
  );
}

/* ---------- 子组件：思考中指示器 ---------- */
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
            <span className="text-sm text-zinc-500">正在分析...</span>
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

/* ---------- 子组件：消息气泡 ---------- */
function MessageBubble({ message, userName }: { message: ChatMessage; userName?: string }) {
  const isUser = message.role === "user";

  return (
    <div className={`flex items-end gap-2.5 ${isUser ? "flex-row-reverse" : ""} ${isUser ? "animate-msg-right" : "animate-msg-left"}`}>
      {/* 头像 */}
      {isUser ? <UserAvatar name={userName} /> : <AiAvatar />}

      {/* 消息体 */}
      <div className={`max-w-[75%] group ${isUser ? "items-end" : "items-start"} flex flex-col`}>
        {/* 气泡 */}
        <div
          className={`relative rounded-2xl px-4 py-3 text-sm leading-relaxed transition-shadow ${
            isUser
              ? "rounded-tr-md bg-gradient-to-br from-indigo-600 to-indigo-700 text-white shadow-lg shadow-indigo-500/15"
              : "rounded-tl-md bg-zinc-800/50 border border-zinc-700/30 text-zinc-200 backdrop-blur-sm"
          }`}
        >
          {/* 文件附件 */}
          {message.files?.length ? (
            <div className={`mb-2 flex items-center gap-1.5 text-xs ${isUser ? "text-indigo-200/70" : "text-zinc-500"}`}>
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="m18.375 12.739-7.693 7.693a4.5 4.5 0 0 1-6.364-6.364l10.94-10.94A3 3 0 1 1 19.5 7.372L8.552 18.32m.009-.01-.01.01m5.699-9.941-7.81 7.81a1.5 1.5 0 0 0 2.112 2.13" />
              </svg>
              <span className="font-medium">{message.files.map((f) => f.name).join(", ")}</span>
            </div>
          ) : null}

          {/* 内容 */}
          {isUser ? (
            <p className="whitespace-pre-wrap">{message.content}</p>
          ) : (
            <div className="prose-chat whitespace-pre-wrap font-sans">
              {message.content}
            </div>
          )}
        </div>

        {/* 时间戳 */}
        <span className={`mt-1.5 text-[10px] text-zinc-600 opacity-0 group-hover:opacity-100 transition-opacity select-none ${isUser ? "text-right pr-1" : "pl-1"}`}>
          {formatTime(message.timestamp)}
        </span>
      </div>
    </div>
  );
}

/* ---------- 子组件：欢迎页 ---------- */
function WelcomeScreen({ questions, onSelect }: { questions: string[]; onSelect: (q: string) => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 animate-scale-in">
      {/* 装饰光球 */}
      <div className="relative mb-8">
        <div className="absolute -inset-8 bg-indigo-500/10 rounded-full blur-2xl animate-float-orb" />
        <div className="relative w-20 h-20 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-2xl shadow-indigo-500/25 card-shimmer-border">
          <svg className="w-10 h-10 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.3}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 0 0-2.456 2.456ZM16.894 20.567 16.5 21.75l-.394-1.183a2.25 2.25 0 0 0-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 0 0 1.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 0 0 1.423 1.423l1.183.394-1.183.394a2.25 2.25 0 0 0-1.423 1.423Z" />
          </svg>
        </div>
      </div>

      {/* 标题 */}
      <h2 className="text-3xl font-bold text-gradient mb-2 tracking-tight">
        有什么数据问题?
      </h2>
      <p className="text-zinc-500 text-sm mb-10 max-w-md text-center leading-relaxed">
        上传数据文件或直接提问，我将为你提供深度分析洞察与可视化建议
      </p>

      {/* 快捷问题 */}
      <div className="grid sm:grid-cols-2 gap-3 max-w-2xl w-full px-4">
        {questions.map((q, i) => (
          <button
            key={q}
            onClick={() => onSelect(q)}
            className="group relative p-4 rounded-xl bg-zinc-900/40 border border-zinc-800/40 text-left text-sm text-zinc-400 hover:text-zinc-100 hover:border-indigo-500/30 hover:bg-zinc-800/40 transition-all duration-300 hover-lift overflow-hidden"
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

/* ========== 主组件 ========== */
export default function SimpleChatPanel({ onDataSummaryChange }: Readonly<ChatPanelProps>) {
  const router = useRouter();
  const currentUser = getCurrentUser();
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "welcome",
      role: "assistant",
      content: "你好！我是你的 AI 数据分析师。问我任何数据问题，我会立即生成可视化分析。",
      timestamp: Date.now(),
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [dataSummary, setDataSummary] = useState("");
  const [uploadedFiles, setUploadedFiles] = useState<{ name: string; summary?: string }[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const hasScrolledRef = useRef(false);

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

  const sendToAI = useCallback(async (question: string) => {
    const user = getCurrentUser();
    if (!user) {
      router.push("/auth/login");
      return;
    }

    setMessages((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        role: "user",
        content: question,
        timestamp: Date.now(),
      },
    ]);

    setLoading(true);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [{ role: "user", content: question }],
          dataSummary: dataSummary || undefined,
          companyProfile: user?.companyProfile,
        }),
      });
      const data = await res.json();
      const content = data.content || data.error || "无回复";

      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          content,
          timestamp: Date.now(),
        },
      ]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          content: `请求失败：${err instanceof Error ? err.message : "网络错误"}`,
          timestamp: Date.now(),
        },
      ]);
    } finally {
      setLoading(false);
    }
  }, [dataSummary, router]);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const formData = new FormData();
    formData.append("file", file);
    try {
      const res = await fetch("/api/parse-data", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "解析失败");

      const summary = data.summary as string;
      setDataSummary((prev) => (prev ? `${prev}\n\n${summary}` : summary));
      setUploadedFiles((prev) => [
        ...prev,
        { name: file.name, summary: data.summary?.slice(0, 200) },
      ]);

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

  const handleSend = () => {
    const text = input.trim();
    if (!text || loading) return;
    setInput("");
    sendToAI(text);
  };

  const handleLogout = () => {
    logoutUser();
    router.replace("/auth/login");
  };

  const suggestedQuestions = [
    "上周销售额是多少？环比增长如何？",
    "本月营收趋势分析",
    "哪个产品卖得最好？",
    "预测下个月的销售额",
    "请基于已上传数据，生成一个可落地的数据大屏方案",
  ];

  const showWelcome = messages.length === 1;

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* ===== 顶部导航 ===== */}
      <header className="relative sticky top-0 z-20 shrink-0 px-5 py-3 border-b border-zinc-800/40 bg-zinc-900/60 backdrop-blur-xl">
        {/* 顶栏底部微光线 */}
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-1/2 h-px bg-gradient-to-r from-transparent via-indigo-500/20 to-transparent" />

        <div className="max-w-6xl mx-auto flex items-center justify-between gap-4">
          {/* 左侧：品牌 */}
          <div className="flex items-center gap-3 min-w-0">
            <AiAvatar size="lg" />
            <div className="min-w-0">
              <h1 className="text-sm font-semibold text-zinc-100 tracking-wide flex items-center gap-2">
                AI 数据分析师
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                </span>
              </h1>
              <p className="text-xs text-zinc-500 truncate">
                {currentUser?.name ? `${currentUser.name}` : "智能洞察与分析建议"}
                {uploadedFiles.length > 0 && (
                  <span className="ml-2 text-indigo-400/70">{uploadedFiles.length} 个数据文件</span>
                )}
              </p>
            </div>
          </div>

          {/* 右侧：操作按钮 */}
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => router.push("/data-sources")}
              className="px-3 py-1.5 text-xs rounded-lg text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/70 transition-all"
            >
              数据源
            </button>
            <button
              onClick={() => router.push("/reports")}
              className="px-3 py-1.5 text-xs rounded-lg text-indigo-400 hover:text-indigo-300 hover:bg-indigo-500/10 transition-all"
            >
              报表
            </button>
            <div className="w-px h-4 bg-zinc-800 mx-1" />
            <button
              onClick={() => router.push("/im/settings")}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg bg-purple-500/10 hover:bg-purple-500/20 text-purple-300 border border-purple-500/30 transition-all"
              title="IM 集成与通知"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 0 1 .865-.501 48.172 48.172 0 0 0 3.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0 0 12 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018Z" />
              </svg>
              集成
            </button>
            <button
              onClick={() => router.push("/settings/ai")}
              className="p-1.5 rounded-lg text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/70 transition-all"
              title="AI 设置"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M10.343 3.94c.09-.542.56-.94 1.11-.94h1.093c.55 0 1.02.398 1.11.94l.149.894c.07.424.384.764.78.93.398.164.855.142 1.205-.108l.737-.527a1.125 1.125 0 0 1 1.45.12l.773.774c.39.389.44 1.002.12 1.45l-.527.737c-.25.35-.272.806-.107 1.204.165.397.505.71.93.78l.893.15c.543.09.94.56.94 1.109v1.094c0 .55-.397 1.02-.94 1.11l-.894.149c-.424.07-.764.383-.929.78-.165.398-.143.854.107 1.204l.527.738c.32.447.269 1.06-.12 1.45l-.774.773a1.125 1.125 0 0 1-1.449.12l-.738-.527c-.35-.25-.806-.272-1.203-.107-.397.165-.71.505-.781.929l-.149.894c-.09.542-.56.94-1.11.94h-1.094c-.55 0-1.019-.398-1.11-.94l-.148-.894c-.071-.424-.384-.764-.781-.93-.398-.164-.854-.142-1.204.108l-.738.527c-.447.32-1.06.269-1.45-.12l-.773-.774a1.125 1.125 0 0 1-.12-1.45l.527-.737c.25-.35.273-.806.108-1.204-.165-.397-.505-.71-.93-.78l-.894-.15c-.542-.09-.94-.56-.94-1.109v-1.094c0-.55.398-1.02.94-1.11l.894-.149c.424-.07.765-.383.93-.78.165-.398.143-.854-.107-1.204l-.527-.738a1.125 1.125 0 0 1 .12-1.45l.773-.773a1.125 1.125 0 0 1 1.45-.12l.737.527c.35.25.807.272 1.204.107.397-.165.71-.505.78-.929l.15-.894Z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
              </svg>
            </button>
            <button
              onClick={handleLogout}
              className="p-1.5 rounded-lg text-zinc-500 hover:text-rose-400 hover:bg-rose-500/10 transition-all"
              title="退出登录"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0 0 13.5 3h-6a2.25 2.25 0 0 0-2.25 2.25v13.5A2.25 2.25 0 0 0 7.5 21h6a2.25 2.25 0 0 0 2.25-2.25V15m3 0 3-3m0 0-3-3m3 3H9" />
              </svg>
            </button>
          </div>
        </div>
      </header>

      {/* ===== 消息区域 ===== */}
      <div ref={scrollContainerRef} className="flex-1 min-h-0 overflow-y-auto pt-6">
        <div className="max-w-3xl mx-auto px-4 py-6 pb-24">
          {/* 欢迎页 */}
          {showWelcome && (
            <WelcomeScreen questions={suggestedQuestions} onSelect={sendToAI} />
          )}

          {/* 对话消息 */}
          <div className={`space-y-5 ${showWelcome ? "hidden" : ""}`}>
            {messages.map((m) =>
              m.id !== "welcome" ? (
                <MessageBubble key={m.id} message={m} userName={currentUser?.name} />
              ) : null
            )}

            {/* 思考中 */}
            {loading && <ThinkingIndicator />}
          </div>

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* ===== 底部输入区 ===== */}
      <div className="relative border-t border-zinc-800/30 bg-zinc-900/40 backdrop-blur-xl">
        {/* 顶部微光线 */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-2/3 h-px bg-gradient-to-r from-transparent via-indigo-500/15 to-transparent" />

          <div className="max-w-3xl mx-auto px-4 py-4 pb-6">

          {/* 已上传文件标签 */}
          {uploadedFiles.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-3">
              {uploadedFiles.map((f) => (
                <span
                  key={f.name}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs bg-indigo-500/10 text-indigo-300 border border-indigo-500/20"
                >
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
                  </svg>
                  {f.name}
                </span>
              ))}
            </div>
          )}

          {/* 输入行 */}
          <div className="flex items-center gap-2.5">
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.txt,.json,.xlsx,.xls"
              className="hidden"
              onChange={handleUpload}
            />

            {/* 上传按钮 */}
            <button
              onClick={() => fileInputRef.current?.click()}
              className="shrink-0 p-2.5 rounded-xl text-zinc-500 hover:text-indigo-400 hover:bg-indigo-500/10 border border-transparent hover:border-indigo-500/20 transition-all"
              title="上传数据文件"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 16.5V9.75m0 0 3 3m-3-3-3 3M6.75 19.5a4.5 4.5 0 0 1-1.41-8.775 5.25 5.25 0 0 1 10.233-2.33 3 3 0 0 1 3.758 3.848A3.752 3.752 0 0 1 18 19.5H6.75Z" />
              </svg>
            </button>

            {/* 输入框容器 */}
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

            {/* 发送按钮 */}
            <button
              onClick={handleSend}
              disabled={loading || !input.trim()}
              className="shrink-0 p-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white transition-all duration-200 disabled:opacity-30 disabled:cursor-not-allowed shadow-lg shadow-indigo-500/20 hover:shadow-indigo-500/30 btn-ripple disabled:shadow-none"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 12 3.269 3.125A59.769 59.769 0 0 1 21.485 12 59.768 59.768 0 0 1 3.27 20.875L5.999 12Zm0 0h7.5" />
              </svg>
            </button>
          </div>

          {/* 底部提示 */}
          <p className="mt-2.5 text-center text-[10px] text-zinc-700 select-none">
            AI 分析结果仅供参考，请结合实际业务场景验证
          </p>
        </div>
      </div>
    </div>
  );
}
