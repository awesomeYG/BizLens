"use client";

import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useChat } from "@/hooks/useChat";
import { getCurrentUser } from "@/lib/user-store";
import { createDashboardInstance } from "@/lib/dashboard-store";
import { removeActionBlocks } from "@/lib/chat/response-parser";
import { MessageBubble, ThinkingIndicator } from "@/components/chat/MessageBubble";
import { WelcomeScreen } from "@/components/chat/WelcomeScreen";
import { ConversationSidebar } from "@/components/chat/ConversationSidebar";
import { ChatInput } from "@/components/chat/ChatInput";

export interface ChatPanelProps {
  onDataSummaryChange?: (summary: string) => void;
}

export default function SimpleChatPanel({ onDataSummaryChange }: Readonly<ChatPanelProps>) {
  const router = useRouter();
  const currentUser = useMemo(() => getCurrentUser(), []);
  const tenantId = currentUser?.tenantId || currentUser?.id || "demo-tenant";

  // -------------------------------------------------------------------------
  // 数据摘要
  // -------------------------------------------------------------------------
  const [dataSummary, setDataSummary] = useState("");
  const [uploadedFiles, setUploadedFiles] = useState<{ name: string; summary?: string }[]>([]);
  const [suggestedQuestions, setSuggestedQuestions] = useState<string[]>([]);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  const suggestionsLoadedRef = useRef(false);
  const suggestionsAbortControllerRef = useRef<AbortController | null>(null);

  // -------------------------------------------------------------------------
  // 对话管理
  // -------------------------------------------------------------------------
  const {
    messages,
    setMessages,
    conversations,
    activeConversationId,
    loading,
    historyLoading,
    initialize,
    handleSend,
    stopGeneration,
    loadConversation,
    createConversation,
    renameConversation,
    deleteConversation,
  } = useChat({
    tenantId,
    dataSummary,
    onDataSummaryChange,
  });

  // -------------------------------------------------------------------------
  // Sidebar 状态
  // -------------------------------------------------------------------------
  const [sidebarBusyId, setSidebarBusyId] = useState<string | null>(null);
  const [pendingDeleteConversationId, setPendingDeleteConversationId] = useState<string | null>(null);
  const [editingConversationId, setEditingConversationId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  // -------------------------------------------------------------------------
  // 输入状态
  // -------------------------------------------------------------------------
  const [input, setInput] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const hasScrolledRef = useRef(false);

  // -------------------------------------------------------------------------
  // 自动滚动
  // -------------------------------------------------------------------------
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

  // -------------------------------------------------------------------------
  // 初始化
  // -------------------------------------------------------------------------
  useEffect(() => {
    const bootstrap = async () => {
      if (!currentUser) {
        router.replace("/auth/login");
        return;
      }
      await initialize();
    };
    void bootstrap();
  }, [currentUser, router, initialize]);

  // -------------------------------------------------------------------------
  // 加载推荐问题
  // -------------------------------------------------------------------------
  useEffect(() => {
    if (historyLoading) return;
    if (suggestionsLoadedRef.current) return;

    const user = getCurrentUser();
    const userTenantId = user?.tenantId || user?.id || "demo-tenant";
    const token = localStorage.getItem("access_token");

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
        companyProfile: user?.companyProfile,
        conversations,
      }),
      signal: abortController.signal,
    })
      .then((res) => {
        if (!res.ok) throw new Error("fetch failed");
        return res.json();
      })
      .then((data: { questions?: string[] }) => {
        if (data.questions && data.questions.length > 0) {
          setSuggestedQuestions(data.questions);
          suggestionsLoadedRef.current = true;
          try {
            sessionStorage.setItem("bizlens_suggested_questions", JSON.stringify(data.questions));
          } catch { /* quota exceeded */ }
        }
      })
      .catch((err: Error) => {
        if (err.name === "AbortError") return;
      })
      .finally(() => {
        if (!abortController.signal.aborted) setSuggestionsLoading(false);
      });

    return () => { abortController.abort(); };
  }, [historyLoading, conversations]);

  // -------------------------------------------------------------------------
  // 文件上传
  // -------------------------------------------------------------------------
  const handleUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
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

      await handleSend(`用户上传了文件 ${file.name}，数据摘要：\n${summary}\n请简要总结数据结构，并给出下一步可做的分析方向。`);
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : "未知错误";
      // 上传失败时添加一条错误消息
      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          content: `上传或解析失败：${errMsg}`,
          timestamp: Date.now(),
        },
      ]);
    }

    e.target.value = "";
  }, [handleSend]);

  // -------------------------------------------------------------------------
  // 辅助
  // -------------------------------------------------------------------------

  const showWelcome = messages.filter((item) => item.id !== "welcome").length === 0;
  const latestAssistantMessage = [...messages].reverse().find((m) => m.role === "assistant");
  const showThinkingIndicator = loading && !latestAssistantMessage?.content.trim();

  // -------------------------------------------------------------------------
  // Handlers
  // -------------------------------------------------------------------------
  const handleSendMessage = useCallback(async () => {
    const text = input.trim();
    if (!text || loading) return;
    setInput("");
    await handleSend(text);
  }, [input, loading, handleSend]);

  const handleStopGeneration = useCallback(() => {
    stopGeneration();
  }, [stopGeneration]);

  const handleSelectConversation = useCallback(async (id: string) => {
    setSidebarBusyId(id);
    try {
      await loadConversation(id);
    } finally {
      setSidebarBusyId(null);
    }
  }, [loadConversation]);

  const handleNewConversation = useCallback(async () => {
    setSidebarBusyId("new");
    try {
      await createConversation();
      setSearchQuery("");
    } finally {
      setSidebarBusyId(null);
    }
  }, [createConversation]);

  const handleStartRename = useCallback((item: typeof conversations[0]) => {
    setEditingConversationId(item.id);
    setEditingTitle(item.title || "新对话");
  }, []);

  const handleRenameConversation = useCallback(async (id: string, title: string) => {
    const trimmed = title.trim();
    if (!trimmed) return;
    setSidebarBusyId(id);
    try {
      await renameConversation(id, trimmed);
      setEditingConversationId(null);
      setEditingTitle("");
    } finally {
      setSidebarBusyId(null);
    }
  }, [renameConversation]);

  const handleDeleteConversation = useCallback(async (id: string) => {
    setSidebarBusyId(id);
    try {
      await deleteConversation(id);
      setPendingDeleteConversationId(null);
    } finally {
      setSidebarBusyId(null);
    }
  }, [deleteConversation]);

  const handleFileUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    await handleUpload(e);
  }, [handleUpload]);

  // -------------------------------------------------------------------------
  // 渲染
  // -------------------------------------------------------------------------
  return (
    <div className="flex h-full min-h-0 flex-col lg:flex-row">
      {/* Sidebar */}
      <ConversationSidebar
        conversations={conversations}
        activeConversationId={activeConversationId}
        historyLoading={historyLoading}
        sidebarBusyId={sidebarBusyId}
        pendingDeleteConversationId={pendingDeleteConversationId}
        editingConversationId={editingConversationId}
        editingTitle={editingTitle}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        onSelectConversation={handleSelectConversation}
        onNewConversation={handleNewConversation}
        onStartRename={handleStartRename}
        onRename={handleRenameConversation}
        onCancelRename={() => { setEditingConversationId(null); setEditingTitle(""); }}
        onDeleteClick={setPendingDeleteConversationId}
        onConfirmDelete={() => {
          if (pendingDeleteConversationId) handleDeleteConversation(pendingDeleteConversationId);
        }}
        onCancelDelete={() => setPendingDeleteConversationId(null)}
        onTitleChange={setEditingTitle}
      />

      {/* Main content */}
      <div className="flex min-h-0 flex-1 flex-col">
        <div ref={scrollContainerRef} className="flex-1 min-h-0 overflow-y-auto flex flex-col">
          {/* Header */}
          <div className="border-b border-zinc-800/30 px-6 py-4">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-base font-semibold text-zinc-100">AI 数据分析师</h1>
                <p className="text-xs text-zinc-500">
                  {(currentUser?.name || "智能洞察与分析建议") +
                    (uploadedFiles.length > 0 ? ` | ${uploadedFiles.length} 个数据文件` : "")}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-xs text-zinc-500">在线</span>
              </div>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 min-h-0 pt-6">
            <div className="max-w-3xl mx-auto px-4 py-6 pb-12">
              {showWelcome ? (
                <WelcomeScreen
                  questions={suggestedQuestions}
                  onSelect={(q) => void handleSend(q)}
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

        {/* Input */}
        <ChatInput
          value={input}
          onChange={setInput}
          onSend={handleSendMessage}
          onStop={handleStopGeneration}
          loading={loading}
          disabled={historyLoading}
          uploadedFiles={uploadedFiles}
        />

        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,.txt,.json,.xlsx,.xls"
          className="hidden"
          onChange={handleFileUpload}
        />
      </div>
    </div>
  );
}
