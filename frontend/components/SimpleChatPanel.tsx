"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { getCurrentUser } from "@/lib/user-store";
import type { ChatMessage } from "@/lib/types";

interface ChatPanelProps {
  onDataSummaryChange?: (summary: string) => void;
}

export default function SimpleChatPanel({ onDataSummaryChange }: ChatPanelProps) {
  const router = useRouter();
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
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    onDataSummaryChange?.(dataSummary);
  }, [dataSummary, onDataSummaryChange]);

  const sendToAI = async (question: string) => {
    setLoading(true);
    try {
      const user = getCurrentUser();
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

  const handleSend = () => {
    const text = input.trim();
    if (!text || loading) return;
    setInput("");
    sendToAI(text);
  };

  const suggestedQuestions = [
    "上周销售额是多少？环比增长如何？",
    "本月营收趋势分析",
    "哪个产品卖得最好？",
    "预测下个月的销售额",
  ];

  return (
    <div className="flex flex-col h-full">
      {/* 顶部导航 */}
      <header className="flex items-center justify-between px-6 py-3 border-b border-zinc-800/50 bg-zinc-900/30">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <h1 className="text-sm font-medium text-zinc-300">AI 数据分析师</h1>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push("/data-sources")}
            className="px-3 py-1.5 text-xs rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-zinc-200 border border-zinc-700/50 transition-all"
          >
            连接数据源
          </button>
          <button
            onClick={() => router.push("/reports")}
            className="px-3 py-1.5 text-xs rounded-lg bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 border border-indigo-500/20 transition-all"
          >
            我的报表
          </button>
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
