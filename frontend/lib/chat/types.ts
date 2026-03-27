/**
 * 聊天相关类型定义
 */

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  files?: { name: string; summary?: string }[];
  timestamp: number;
  sqlQuery?: {
    sql: string;
    executed?: boolean;
    error?: string;
    result?: unknown[];
  };
  schemaContext?: string;
}

export interface ChatConversationSummary {
  id: string;
  title: string;
  preview: string;
  messageCount: number;
  createdAt: string;
  updatedAt: string;
  lastMessageAt?: string;
}

export interface ChatConversation {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  lastMessageAt?: string;
  messages: ChatMessage[];
}

/**
 * 流式响应事件类型
 */
export type SSEEvent =
  | { type: "delta"; content: string }
  | { type: "meta"; analysis?: unknown; model?: string; autoQueryData?: unknown }
  | { type: "tool_call"; toolName?: string; toolCallId?: string }
  | { type: "tool_result"; toolCallId?: string; result?: { success?: boolean; message?: string } }
  | { type: "done" }
  | { type: "error"; error?: string };

/**
 * 对话状态
 */
export interface ChatState {
  messages: ChatMessage[];
  conversations: ChatConversationSummary[];
  activeConversationId: string | null;
  loading: boolean;
  historyLoading: boolean;
}

/**
 * AI 意图类型
 */
export type UserIntent =
  | "send_dingtalk"
  | "chat"
  | "dashboard"
  | "notification"
  | "alert"
  | "report"
  | "datasource"
  | "unknown";

/**
 * 意图识别结果
 */
export interface IntentResult {
  intent: UserIntent;
  confidence: number;
  extractedContent?: string;
  reasoning?: string;
}
