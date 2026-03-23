"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { getCurrentUser, logoutUser } from "@/lib/user-store";
import type { ChatMessage } from "@/lib/types";

interface ChatPanelProps {
  onDataSummaryChange?: (summary: string) => void;
}

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

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    onDataSummaryChange?.(dataSummary);
  }, [dataSummary, onDataSummaryChange]);

  const sendToAI = async (question: string) => {
    const user = getCurrentUser();
    if (!user) {
      router.push("/auth/login");
      return;
    }

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
          role: "user",
          content: question,
          timestamp: Date.now(),
        },
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
  };

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
    "请基于已上传数据，生成一个可落地的数据大屏方案（指标+图表）",
  ];

  return (
    <div className="flex flex-col h-full">
      {/* 顶部导航 */}
      <header className="px-6 py-4 border-b border-zinc-800/60 bg-zinc-900/40 backdrop-blur">
        <div className="max-w-6xl mx-auto flex items-center justify-between gap-4">
          <div className="min-w-0 flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500/90 to-purple-600/90 flex items-center justify-center shadow-lg shadow-indigo-500/20">
              <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09Z" />
              </svg>
            </div>
            <div className="min-w-0">
              <h1 className="text-sm font-semibold text-zinc-100 tracking-wide">AI 数据分析师</h1>
              <p className="text-xs text-zinc-500 truncate">
                {currentUser?.name ? `${currentUser.name}，欢迎回来` : "智能洞察与分析建议"}
              </p>
            </div>
          </div>
          <div className="hidden md:flex items-center gap-2">
            <span className="px-2.5 py-1 rounded-md text-xs bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">
              在线
            </span>
            {uploadedFiles.length > 0 && (
              <span className="px-2.5 py-1 rounded-md text-xs bg-zinc-800/70 text-zinc-400 border border-zinc-700/50">
                已上传 {uploadedFiles.length} 个文件
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => router.push("/data-sources")}
              className="px-3 py-1.5 text-xs rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border border-zinc-700/60 transition-all"
            >
              数据源
            </button>
            <button
              onClick={() => router.push("/reports")}
              className="px-3 py-1.5 text-xs rounded-lg bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 transition-all"
            >
              报表
            </button>
            <button
              onClick={() => router.push("/settings/ai")}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg bg-zinc-800/60 hover:bg-zinc-700 text-zinc-300 border border-zinc-700/60 transition-all"
              title="AI 设置"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M10.343 3.94c.09-.542.56-.94 1.11-.94h1.093c.55 0 1.02.398 1.11.94l.149.894c.07.424.384.764.78.93.398.164.855.142 1.205-.108l.737-.527a1.125 1.125 0 0 1 1.45.12l.773.774c.39.389.44 1.002.12 1.45l-.527.737c-.25.35-.272.806-.107 1.204.165.397.505.71.93.78l.893.15c.543.09.94.56.94 1.109v1.094c0 .55-.397 1.02-.94 1.11l-.894.149c-.424.07-.764.383-.929.78-.165.398-.143.854.107 1.204l.527.738c.32.447.269 1.06-.12 1.45l-.774.773a1.125 1.125 0 0 1-1.449.12l-.738-.527c-.35-.25-.806-.272-1.203-.107-.397.165-.71.505-.781.929l-.149.894c-.09.542-.56.94-1.11.94h-1.094c-.55 0-1.019-.398-1.11-.94l-.148-.894c-.071-.424-.384-.764-.781-.93-.398-.164-.854-.142-1.204.108l-.738.527c-.447.32-1.06.269-1.45-.12l-.773-.774a1.125 1.125 0 0 1-.12-1.45l.527-.737c.25-.35.273-.806.108-1.204-.165-.397-.505-.71-.93-.78l-.894-.15c-.542-.09-.94-.56-.94-1.109v-1.094c0-.55.398-1.02.94-1.11l.894-.149c.424-.07.765-.383.93-.78.165-.398.143-.854-.107-1.204l-.527-.738a1.125 1.125 0 0 1 .12-1.45l.773-.773a1.125 1.125 0 0 1 1.45-.12l.737.527c.35.25.807.272 1.204.107.397-.165.71-.505.78-.929l.15-.894Z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
              </svg>
              设置
            </button>
            <button
              onClick={handleLogout}
              className="px-3 py-1.5 text-xs rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/30 transition-all"
            >
              退出登录
            </button>
          </div>
        </div>
      </header>

      {/* 消息区域 */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-4xl mx-auto space-y-6">
          {/* 欢迎消息 */}
          {messages.length === 1 && (
            <div className="text-center py-12">
              <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
                <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 0 0-2.456 2.456ZM16.894 20.567 16.5 21.75l-.394-1.183a2.25 2.25 0 0 0-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 0 0 1.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 0 0 1.423 1.423l1.183.394-1.183.394a2.25 2.25 0 0 0-1.423 1.423Z" />
                </svg>
              </div>
              <h2 className="text-2xl font-semibold text-zinc-100 mb-2">
                今天有什么数据问题？
              </h2>
              <p className="text-zinc-500 mb-8">
                像聊天一样提问，我帮你分析数据
              </p>
              
              {/* 快捷问题 */}
              <div className="grid sm:grid-cols-2 gap-3 max-w-2xl mx-auto">
                {suggestedQuestions.map((q) => (
                  <button
                    key={q}
                    onClick={() => sendToAI(q)}
                    className="p-4 rounded-xl bg-zinc-900/50 border border-zinc-800/50 text-left text-sm text-zinc-400 hover:text-zinc-200 hover:border-zinc-700 transition-all group"
                  >
                    <span className="flex items-center gap-2">
                      <span className="text-indigo-400 group-hover:text-indigo-300">→</span>
                      {q}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* 对话消息 */}
          {messages.map((m) => (
            m.id !== "welcome" && (
              <div
                key={m.id}
                className={`flex ${m.role === "user" ? "justify-end" : "justify-start"} animate-fade-in`}
              >
                <div
                  className={`max-w-[80%] rounded-2xl px-5 py-4 ${
                    m.role === "user"
                      ? "bg-indigo-600 text-white"
                      : "bg-zinc-800/60 border border-zinc-700/40 text-zinc-200"
                  }`}
                >
                  {m.files?.length ? (
                    <div className="mb-2 text-xs text-zinc-500 flex items-center gap-1">
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="m18.375 12.739-7.693 7.693a4.5 4.5 0 0 1-6.364-6.364l10.94-10.94A3 3 0 1 1 19.5 7.372L8.552 18.32m.009-.01-.01.01m5.699-9.941-7.81 7.81a1.5 1.5 0 0 0 2.112 2.13" />
                      </svg>
                      {m.files.map((f) => f.name).join(", ")}
                    </div>
                  ) : null}
                  <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed">
                    {m.content}
                  </pre>
                </div>
              </div>
            )
          ))}

          {/* 加载状态 */}
          {loading && (
            <div className="flex justify-start animate-fade-in">
              <div className="bg-zinc-800/60 border border-zinc-700/40 rounded-2xl px-5 py-4 text-zinc-500 flex items-center gap-3">
                <div className="flex gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-zinc-500 animate-bounce" style={{ animationDelay: "0ms" }} />
                  <span className="w-2 h-2 rounded-full bg-zinc-500 animate-bounce" style={{ animationDelay: "150ms" }} />
                  <span className="w-2 h-2 rounded-full bg-zinc-500 animate-bounce" style={{ animationDelay: "300ms" }} />
                </div>
                正在分析数据...
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* 底部输入栏 */}
      <div className="p-4 border-t border-zinc-800/50 bg-zinc-900/30">
        <div className="max-w-4xl mx-auto flex gap-3">
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,.txt,.json,.xlsx,.xls"
            className="hidden"
            onChange={handleUpload}
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            className="shrink-0 p-3 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-zinc-200 border border-zinc-700/50 transition-all"
            title="上传文件"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="m18.375 12.739-7.693 7.693a4.5 4.5 0 0 1-6.364-6.364l10.94-10.94A3 3 0 1 1 19.5 7.372L8.552 18.32m.009-.01-.01.01m5.699-9.941-7.81 7.81a1.5 1.5 0 0 0 2.112 2.13" />
            </svg>
          </button>
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSend()}
            placeholder="问我任何数据问题..."
            className="flex-1 bg-zinc-900/80 border border-zinc-700/50 rounded-xl px-5 py-3.5 text-zinc-100 placeholder-zinc-500 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500/50"
            autoFocus
          />
          <button
            onClick={handleSend}
            disabled={loading || !input.trim()}
            className="px-6 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-medium transition-all disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none shadow-lg shadow-indigo-500/30"
          >
            发送
          </button>
        </div>
      </div>
    </div>
  );
}
