/**
 * 对话管理 Hook
 * 封装对话状态管理和持久化逻辑
 */

import { useState, useCallback, useRef, useEffect } from "react";
import { getAccessToken, request } from "@/lib/auth/api";
import { getCurrentUser } from "@/lib/user-store";
import { parseConnectionUriFromText } from "@/lib/chat/response-parser";
import { createDataSourceFromURI, processResponseActions, appendActionResultsToContent } from "@/lib/chat/action-handlers";
import { parseSSEStream } from "@/lib/chat/sse-parser";
import { detectUserIntent } from "@/lib/intent-detection";
import type {
  ChatMessage,
  ChatConversation,
  ChatConversationSummary,
} from "@/lib/chat/types";

// ============================================================================
// 辅助函数
// ============================================================================

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

function buildConversationTitle(messages: ChatMessage[]): string {
  const firstUserMessage = messages.find((item) => item.role === "user" && item.content.trim());
  if (!firstUserMessage) return "新对话";
  const text = firstUserMessage.content.trim();
  return text.length > 24 ? `${text.slice(0, 24)}...` : text;
}

function toPersistedMessages(messages: ChatMessage[]): ChatMessage[] {
  return messages.filter((item) => item.id !== "welcome");
}

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

function summaryFromConversation(conversation: ChatConversation): ChatConversationSummary {
  const persistedMessages = toPersistedMessages(conversation.messages);
  const preview =
    persistedMessages[persistedMessages.length - 1]?.content?.replace(/\s+/g, " ").trim() || "";
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

// ============================================================================
// Hook
// ============================================================================

export interface UseChatReturn {
  messages: ChatMessage[];
  setMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>;
  conversations: ChatConversationSummary[];
  activeConversationId: string | null;
  loading: boolean;
  historyLoading: boolean;
  initialize: () => Promise<void>;
  handleSend: (text: string) => Promise<void>;
  stopGeneration: () => void;
  loadConversation: (conversationId: string) => Promise<void>;
  createConversation: () => Promise<ChatConversation>;
  renameConversation: (conversationId: string, title: string) => Promise<ChatConversationSummary>;
  deleteConversation: (conversationId: string) => Promise<void>;
  flushSave: (conversationId: string, currentMessages: ChatMessage[]) => Promise<void>;
}

export interface UseChatOptions {
  tenantId: string;
  dataSummary?: string;
  onDataSummaryChange?: (summary: string) => void;
}

export function useChat({ tenantId, dataSummary }: UseChatOptions): UseChatReturn {
  // -------------------------------------------------------------------------
  // 状态
  // -------------------------------------------------------------------------
  const [messages, setMessages] = useState<ChatMessage[]>(() => createWelcomeMessages());
  const [conversations, setConversations] = useState<ChatConversationSummary[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(true);

  // -------------------------------------------------------------------------
  // Refs（用于避免闭包陷阱）
  // -------------------------------------------------------------------------
  const abortControllerRef = useRef<AbortController | null>(null);
  const manualStopRef = useRef(false);
  const lastSavedSignatureRef = useRef("[]");
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestMessagesRef = useRef(messages);
  const latestConversationIdRef = useRef(activeConversationId);
  const pendingSaveDuringLoadingRef = useRef(false);

  // 同步 ref
  useEffect(() => { latestMessagesRef.current = messages; }, [messages]);
  useEffect(() => { latestConversationIdRef.current = activeConversationId; }, [activeConversationId]);

  // -------------------------------------------------------------------------
  // 对话列表操作
  // -------------------------------------------------------------------------
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

  const applyConversation = useCallback((conversation: ChatConversation) => {
    const persistedMessages = conversation.messages.length ? conversation.messages : [];
    setActiveConversationId(conversation.id);
    setMessages(persistedMessages.length ? persistedMessages : createWelcomeMessages());
    lastSavedSignatureRef.current = computeMessageSignature(persistedMessages);
  }, []);

  const resetToWelcomeState = useCallback(() => {
    setConversations([]);
    setActiveConversationId(null);
    setMessages(createWelcomeMessages());
    lastSavedSignatureRef.current = "[]";
  }, []);

  const loadConversation = useCallback(async (conversationId: string) => {
    const conversation = await request<ChatConversation>(
      `/tenants/${tenantId}/chat-conversations/${conversationId}`
    );
    applyConversation(conversation);
  }, [applyConversation, tenantId]);

  const createConversation = useCallback(async () => {
    const conversation = await request<ChatConversation>(`/tenants/${tenantId}/chat-conversations`, {
      method: "POST",
      body: JSON.stringify({}),
    });
    applyConversation(conversation);
    upsertConversationSummary(summaryFromConversation(conversation));
    return conversation;
  }, [applyConversation, upsertConversationSummary, tenantId]);

  const renameConversation = useCallback(async (conversationId: string, title: string) => {
    const updated = await request<ChatConversationSummary>(
      `/tenants/${tenantId}/chat-conversations/${conversationId}`,
      { method: "PATCH", body: JSON.stringify({ title }) }
    );
    upsertConversationSummary(updated);
    return updated;
  }, [upsertConversationSummary, tenantId]);

  const deleteConversation = useCallback(async (conversationId: string) => {
    await request(`/tenants/${tenantId}/chat-conversations/${conversationId}`, { method: "DELETE" });
    setConversations((prev) => prev.filter((item) => item.id !== conversationId));

    if (activeConversationId === conversationId) {
      const remaining = conversations.filter((item) => item.id !== conversationId);
      if (remaining.length > 0) {
        await loadConversation(remaining[0].id);
      } else {
        await createConversation();
      }
    }
  }, [activeConversationId, conversations, createConversation, loadConversation, tenantId]);

  // -------------------------------------------------------------------------
  // 保存逻辑
  // -------------------------------------------------------------------------

  /** 立即保存（不走防抖） */
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
        console.error("[Chat] 保存会话失败:", err);
      }
    },
    [tenantId, upsertConversationSummary]
  );

  /** 防抖保存 */
  useEffect(() => {
    if (!activeConversationId || historyLoading) return;

    const persistedMessages = toPersistedMessages(messages);
    const signature = computeMessageSignature(persistedMessages);
    if (signature === lastSavedSignatureRef.current) return;

    if (loading) {
      pendingSaveDuringLoadingRef.current = true;
      return;
    }

    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      flushSave(activeConversationId, messages);
    }, 500);

    return () => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
        saveTimerRef.current = null;
      }
    };
  }, [activeConversationId, historyLoading, loading, messages, flushSave]);

  /** AI 回复结束后立即保存 */
  useEffect(() => {
    if (loading || !pendingSaveDuringLoadingRef.current || !activeConversationId) return;
    pendingSaveDuringLoadingRef.current = false;
    flushSave(activeConversationId, messages);
  }, [loading, activeConversationId, messages, flushSave]);

  // -------------------------------------------------------------------------
  // 初始化
  // -------------------------------------------------------------------------

  const initialize = useCallback(async () => {
    try {
      const items = await request<ChatConversationSummary[]>(
        `/tenants/${tenantId}/chat-conversations`
      );
      setConversations(items);

      if (items.length > 0) {
        await loadConversation(items[0].id);
      } else {
        await createConversation();
      }
    } catch (err) {
      console.error("[Chat] 初始化会话失败:", err);
      resetToWelcomeState();
      setMessages([
        ...createWelcomeMessages(),
        {
          id: crypto.randomUUID(),
          role: "assistant",
          content: `加载历史会话失败：${err instanceof Error ? err.message : "未知错误"}`,
          timestamp: Date.now(),
        },
      ]);
    } finally {
      setHistoryLoading(false);
    }
  }, [tenantId, createConversation, loadConversation, resetToWelcomeState]);

  // -------------------------------------------------------------------------
  // 发送消息
  // -------------------------------------------------------------------------

  const stopGeneration = useCallback(() => {
    if (!loading || !abortControllerRef.current) return;
    manualStopRef.current = true;
    abortControllerRef.current.abort();
  }, [loading]);

  const sendMessage = useCallback(
    async (question: string) => {
      const user = getCurrentUser();
      if (!user) return;

      // 确保有活跃的会话
      let conversationId = activeConversationId;
      if (!conversationId) {
        const conversation = await createConversation();
        conversationId = conversation.id;
      }

      // 预保存用户消息
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
        // 忽略预保存失败
      }

      const userMsgId = crypto.randomUUID();
      const assistantMsgId = crypto.randomUUID();

      // 添加用户消息和占位 AI 消息
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
        if (token) headers.Authorization = `Bearer ${token}`;

        // 检查是否包含数据库连接 URI
        const parsedConn = parseConnectionUriFromText(question);
        if (parsedConn) {
          const result = await createDataSourceFromURI(tenantId, parsedConn);
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantMsgId
                ? { ...m, content: result.message }
                : m
            )
          );
          setLoading(false);
          return;
        }

        // 构建消息历史
        const conversationMessages = [
          ...toPersistedMessages(messages)
            .filter((m) => m.content.trim())
            .map((m) => ({ role: m.role, content: m.content })),
          { role: "user", content: question },
        ];

        // 调用 AI
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

        // 非流式响应（错误响应或其他）
        if (contentType.includes("application/json")) {
          const data = await res.json();
          const content = data.content || data.error || "无回复";
          setMessages((prev) =>
            prev.map((m) => (m.id === assistantMsgId ? { ...m, content } : m))
          );
          const actionResults = await processResponseActions(content, tenantId);
          const updatedContent = appendActionResultsToContent(content, actionResults);
          if (updatedContent !== content) {
            setMessages((prev) =>
              prev.map((m) => (m.id === assistantMsgId ? { ...m, content: updatedContent } : m))
            );
          }
          return;
        }

        // 流式响应
        let fullContent = "";
        await parseSSEStream(
          res,
          {
            onDelta: (content) => {
              fullContent += content;
              setMessages((prev) =>
                prev.map((m) => (m.id === assistantMsgId ? { ...m, content: fullContent } : m))
              );
            },
            onError: (error) => {
              throw new Error(error);
            },
          },
          abortController.signal
        );

        // 处理响应动作
        if (fullContent) {
          const actionResults = await processResponseActions(fullContent, tenantId);
          const updatedContent = appendActionResultsToContent(fullContent, actionResults);
          if (updatedContent !== fullContent) {
            setMessages((prev) =>
              prev.map((m) => (m.id === assistantMsgId ? { ...m, content: updatedContent } : m))
            );
          }
        }
      } catch (err) {
        const isManualAbort =
          manualStopRef.current || (err instanceof DOMException && err.name === "AbortError");

        if (isManualAbort) {
          setMessages((prev) =>
            prev.map((m) => {
              if (m.id !== assistantMsgId) return m;
              const content = m.content.trim();
              return { ...m, content: content ? `${content}\n\n[已手动中断生成]` : "已手动中断本次生成。" };
            })
          );
          return;
        }

        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantMsgId
              ? { ...m, content: `请求失败：${err instanceof Error ? err.message : "网络错误"}` }
              : m
          )
        );
      } finally {
        abortControllerRef.current = null;
        manualStopRef.current = false;
        pendingSaveDuringLoadingRef.current = true;
        setLoading(false);
      }
    },
    [activeConversationId, createConversation, dataSummary, messages, tenantId]
  );

  // -------------------------------------------------------------------------
  // 发送钉钉消息（意图路由）
  // -------------------------------------------------------------------------

  const sendDingtalkMessage = useCallback(
    async (content: string) => {
      const token = getAccessToken();
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (token) headers.Authorization = `Bearer ${token}`;

      const userMsgId = crypto.randomUUID();
      const assistantMsgId = crypto.randomUUID();

      setMessages((prev) => [
        ...prev,
        { id: userMsgId, role: "user", content, timestamp: Date.now() },
        { id: assistantMsgId, role: "assistant", content: "", timestamp: Date.now() },
      ]);

      try {
        const imRes = await fetch(`/api/tenants/${tenantId}/im-configs`, { headers });
        const imConfigs = imRes.ok ? await imRes.json() : [];
        const enabledConfigs = Array.isArray(imConfigs)
          ? imConfigs.filter((c: any) => String(c?.type || "").toLowerCase() === "dingtalk" && c?.enabled)
          : [];
        const dingCfg = enabledConfigs[0];

        if (!dingCfg) {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantMsgId
                ? { ...m, content: `未找到已启用的钉钉配置，无法发送。\n\n请先前往 [IM 配置](/im/settings) 添加并启用钉钉机器人。` }
                : m
            )
          );
          return;
        }

        const sendRes = await fetch(`/api/tenants/${tenantId}/notifications/send`, {
          method: "POST",
          headers,
          body: JSON.stringify({ platformIds: [String(dingCfg.id)], title: "", content, markdown: false }),
        });

        if (!sendRes.ok) {
          const errData = await sendRes.json().catch(() => null);
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantMsgId
                ? { ...m, content: `发送到钉钉失败：${errData?.error || `HTTP ${sendRes.status}`}\n\n请检查 Webhook 与密钥是否正确，或在 [IM 配置](/im/settings) 重新测试。` }
                : m
            )
          );
          return;
        }

        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantMsgId ? { ...m, content: `已将消息发送到钉钉：${content}` } : m
          )
        );
      } catch (err) {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantMsgId
              ? { ...m, content: `发送到钉钉时出现错误：${err instanceof Error ? err.message : "未知错误"}` }
              : m
          )
        );
      }
    },
    [tenantId]
  );

  // -------------------------------------------------------------------------
  // 意图路由入口
  // -------------------------------------------------------------------------

  const handleSend = useCallback(
    async (text: string) => {
      const intentResult = await detectUserIntent(text, tenantId);

      if (intentResult.intent === "send_dingtalk") {
        await sendDingtalkMessage(intentResult.extractedContent || text);
        return;
      }

      await sendMessage(text);
    },
    [sendMessage, sendDingtalkMessage, tenantId]
  );

  return {
    // 状态
    messages,
    setMessages,
    conversations,
    activeConversationId,
    loading,
    historyLoading,
    // 操作
    initialize,
    handleSend,
    stopGeneration,
    loadConversation,
    createConversation,
    renameConversation,
    deleteConversation,
    // 副作用
    flushSave,
  };
}
