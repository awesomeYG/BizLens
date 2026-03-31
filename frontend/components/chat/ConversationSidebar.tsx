"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import type { ChatConversationSummary } from "@/lib/chat/types";

function formatHistoryDate(value?: string): string {
  if (!value) return "刚刚";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "刚刚";
  const now = new Date();
  const sameDay = now.toDateString() === date.toDateString();
  if (sameDay) {
    return `${date.getHours().toString().padStart(2, "0")}:${date.getMinutes().toString().padStart(2, "0")}`;
  }
  return `${date.getMonth() + 1}/${date.getDate()}`;
}

export interface ConversationSidebarProps {
  conversations: ChatConversationSummary[];
  activeConversationId: string | null;
  historyLoading: boolean;
  sidebarBusyId: string | null;
  pendingDeleteConversationId: string | null;
  editingConversationId: string | null;
  editingTitle: string;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onSelectConversation: (id: string) => void;
  onNewConversation: () => void;
  onStartRename: (item: ChatConversationSummary) => void;
  onRename: (id: string, title: string) => void;
  onCancelRename: () => void;
  onDeleteClick: (id: string) => void;
  onConfirmDelete: () => void;
  onCancelDelete: () => void;
  onTitleChange: (title: string) => void;
}

export function ConversationSidebar({
  conversations,
  activeConversationId,
  historyLoading,
  sidebarBusyId,
  pendingDeleteConversationId,
  editingConversationId,
  editingTitle,
  searchQuery,
  onSearchChange,
  onSelectConversation,
  onNewConversation,
  onStartRename,
  onRename,
  onCancelRename,
  onDeleteClick,
  onConfirmDelete,
  onCancelDelete,
  onTitleChange,
}: ConversationSidebarProps) {
  const [mounted, setMounted] = useState(false);
  const filteredConversations = searchQuery.trim()
    ? conversations.filter((item) =>
        `${item.title} ${item.preview}`.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : conversations;

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <aside className="w-full shrink-0 border-b border-zinc-800/60 bg-zinc-950/80 backdrop-blur-xl lg:w-80 lg:border-b-0 lg:border-r">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-zinc-800/60 px-4 py-4">
        <div>
          <p className="text-sm font-semibold text-zinc-100">历史对话</p>
          <p className="text-xs text-zinc-500">保存你的分析上下文</p>
        </div>
        <button
          onClick={onNewConversation}
          disabled={historyLoading}
          className="inline-flex items-center gap-2 rounded-xl border border-indigo-500/30 bg-indigo-500/10 px-3 py-2 text-xs font-medium text-indigo-200 transition hover:bg-indigo-500/20 disabled:opacity-50"
        >
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          {sidebarBusyId === "new" ? "创建中" : "新对话"}
        </button>
      </div>

      {/* Search */}
      <div className="px-3 py-3">
        <div className="rounded-2xl border border-zinc-800/60 bg-zinc-900/35 px-3 py-3 lg:mb-3">
          <div className="flex items-center gap-2 rounded-xl border border-zinc-800/70 bg-zinc-950/70 px-3 py-2">
            <svg className="h-4 w-4 text-zinc-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-4.35-4.35m1.85-5.15a7 7 0 1 1-14 0 7 7 0 0 1 14 0Z" />
            </svg>
            <input
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="搜索历史对话"
              className="w-full bg-transparent text-sm text-zinc-100 placeholder-zinc-600 outline-none"
            />
          </div>
        </div>
      </div>

      {/* Conversation List */}
      <div className="overflow-x-auto px-3 pb-3 lg:block lg:h-[calc(100vh-88px)] lg:overflow-x-hidden lg:overflow-y-auto">
        <div className="min-w-[240px] lg:min-w-0">
          {historyLoading ? (
            <div className="rounded-2xl border border-zinc-800/60 bg-zinc-900/40 px-4 py-5 text-sm text-zinc-500">正在加载历史对话...</div>
          ) : conversations.length === 0 ? (
            <div className="rounded-2xl border border-zinc-800/60 bg-zinc-900/40 px-4 py-5 text-sm text-zinc-500">还没有历史对话，开始提问吧。</div>
          ) : filteredConversations.length === 0 ? (
            <div className="rounded-2xl border border-zinc-800/60 bg-zinc-900/40 px-4 py-5 text-sm text-zinc-500">没有匹配的历史对话。</div>
          ) : (
            filteredConversations.map((item) => (
              <ConversationItem
                key={item.id}
                item={item}
                active={item.id === activeConversationId}
                isEditing={item.id === editingConversationId}
                editingTitle={editingTitle}
                busy={sidebarBusyId === item.id}
                onSelect={() => onSelectConversation(item.id)}
                onStartRename={() => onStartRename(item)}
                onRename={() => onRename(item.id, editingTitle)}
                onCancelRename={onCancelRename}
                onTitleChange={onTitleChange}
                onDeleteClick={() => onDeleteClick(item.id)}
              />
            ))
          )}
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      <DeleteConfirmationModal
        mounted={mounted}
        conversationTitle={conversations.find((c) => c.id === pendingDeleteConversationId)?.title || "新对话"}
        open={Boolean(pendingDeleteConversationId)}
        busy={sidebarBusyId === pendingDeleteConversationId}
        onCancel={onCancelDelete}
        onConfirm={onConfirmDelete}
      />
    </aside>
  );
}

function DeleteConfirmationModal({
  mounted,
  conversationTitle,
  open,
  busy,
  onCancel,
  onConfirm,
}: {
  mounted: boolean;
  conversationTitle: string;
  open: boolean;
  busy: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  if (!mounted || !open) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="mx-4 w-full max-w-md rounded-2xl border border-zinc-700/60 bg-zinc-900/95 p-6 shadow-2xl shadow-black/50">
        <div className="mb-4 flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-rose-500/15">
            <svg className="h-5 w-5 text-rose-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h3 className="text-base font-semibold text-zinc-100">确认删除对话</h3>
        </div>
        <p className="mb-6 text-sm text-zinc-400">
          确定要删除「{conversationTitle}」吗？删除后将无法恢复。
        </p>
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 rounded-xl border border-zinc-700 bg-zinc-800/80 px-5 py-2.5 text-sm font-medium text-zinc-200 transition hover:bg-zinc-700/80"
          >
            取消
          </button>
          <button
            onClick={onConfirm}
            disabled={busy}
            className="flex-1 rounded-xl bg-rose-600 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-rose-500 disabled:opacity-60"
          >
            {busy ? "删除中..." : "确认删除"}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

// 单个会话项组件
function ConversationItem({
  item,
  active,
  isEditing,
  editingTitle,
  busy,
  onSelect,
  onStartRename,
  onRename,
  onCancelRename,
  onTitleChange,
  onDeleteClick,
}: {
  item: ChatConversationSummary;
  active: boolean;
  isEditing: boolean;
  editingTitle: string;
  busy: boolean;
  onSelect: () => void;
  onStartRename: () => void;
  onRename: () => void;
  onCancelRename: () => void;
  onTitleChange: (title: string) => void;
  onDeleteClick: () => void;
}) {
  return (
    <div className="min-w-[240px] lg:min-w-0 lg:mb-3">
      <div
        className={`group rounded-2xl border p-3 transition ${
          active
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
                  onChange={(e) => onTitleChange(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") onRename();
                    if (e.key === "Escape") onCancelRename();
                  }}
                  className="w-full rounded-xl border border-indigo-500/30 bg-zinc-950/80 px-3 py-2 text-sm text-zinc-100 outline-none"
                  autoFocus
                />
                <div className="flex items-center gap-2">
                  <button
                    onClick={onRename}
                    disabled={!editingTitle.trim() || busy}
                    className="rounded-lg bg-indigo-500/15 px-2.5 py-1.5 text-xs text-indigo-200 transition hover:bg-indigo-500/25 disabled:opacity-50"
                  >
                    保存
                  </button>
                  <button
                    onClick={onCancelRename}
                    className="rounded-lg bg-zinc-800 px-2.5 py-1.5 text-xs text-zinc-300 transition hover:bg-zinc-700"
                  >
                    取消
                  </button>
                </div>
              </div>
            ) : (
              <button className="w-full text-left" onClick={onSelect}>
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
                onClick={onStartRename}
                disabled={busy}
                className="rounded-lg p-2 text-zinc-500 transition hover:bg-zinc-800 hover:text-indigo-300 disabled:opacity-50"
                title="重命名对话"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487a2.25 2.25 0 1 1 3.182 3.182L7.5 20.212 3 21l.788-4.5L16.862 4.487Z" />
                </svg>
              </button>
              <button
                onClick={onDeleteClick}
                disabled={busy}
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
}
