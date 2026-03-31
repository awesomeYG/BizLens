"use client";

import { useEffect, type ReactNode } from "react";

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description: string;
  confirmText?: string;
  cancelText?: string;
  busy?: boolean;
  tone?: "default" | "danger" | "warning";
  details?: ReactNode;
  onConfirm: () => void | Promise<void>;
  onClose: () => void;
}

const TONE_STYLES = {
  default: {
    badge: "border-cyan-500/20 bg-cyan-500/10 text-cyan-100",
    dot: "bg-cyan-400",
    button: "bg-cyan-500 text-slate-950 hover:bg-cyan-400",
    panel: "from-cyan-500/12 via-transparent to-transparent",
    iconWrap: "border-cyan-500/20 bg-cyan-500/10 text-cyan-200",
  },
  danger: {
    badge: "border-rose-500/20 bg-rose-500/10 text-rose-100",
    dot: "bg-rose-400",
    button: "bg-rose-500 text-white hover:bg-rose-400",
    panel: "from-rose-500/12 via-transparent to-transparent",
    iconWrap: "border-rose-500/20 bg-rose-500/10 text-rose-200",
  },
  warning: {
    badge: "border-amber-500/20 bg-amber-500/10 text-amber-100",
    dot: "bg-amber-400",
    button: "bg-amber-500 text-slate-950 hover:bg-amber-400",
    panel: "from-amber-500/12 via-transparent to-transparent",
    iconWrap: "border-amber-500/20 bg-amber-500/10 text-amber-200",
  },
} as const;

function ToneIcon({ tone }: { tone: "default" | "danger" | "warning" }) {
  if (tone === "danger") {
    return (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v4m0 4h.01M10.29 3.86l-7.5 13A1 1 0 003.65 18h16.7a1 1 0 00.86-1.5l-7.5-13a1 1 0 00-1.72 0z" />
      </svg>
    );
  }
  if (tone === "warning") {
    return (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    );
  }
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
    </svg>
  );
}

export default function ConfirmDialog({
  open,
  title,
  description,
  confirmText = "确认",
  cancelText = "取消",
  busy = false,
  tone = "default",
  details,
  onConfirm,
  onClose,
}: ConfirmDialogProps) {
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !busy) {
        onClose();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [busy, onClose, open]);

  if (!open) return null;

  const style = TONE_STYLES[tone];

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-[radial-gradient(circle_at_top,rgba(34,211,238,0.12),transparent_32%),rgba(0,0,0,0.78)] p-4 backdrop-blur-md"
      role="presentation"
      onClick={(event) => {
        if (event.target === event.currentTarget && !busy) {
          onClose();
        }
      }}
    >
      <div
        className={`relative w-full max-w-lg overflow-hidden rounded-[28px] border border-white/12 bg-zinc-950/95 bg-gradient-to-br ${style.panel} shadow-[0_32px_80px_rgba(0,0,0,0.55)]`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.14),transparent_68%)]" />

        <div className="relative border-b border-white/10 px-6 py-5 sm:px-7">
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            aria-label="关闭弹窗"
            className="absolute right-5 top-5 inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/5 text-zinc-400 transition hover:bg-white/10 hover:text-white disabled:opacity-40"
          >
            <svg className="h-4 w-4" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path strokeLinecap="round" d="M5 5l10 10M15 5L5 15" />
            </svg>
          </button>

          <div className="flex items-start gap-4">
            <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border shadow-lg shadow-black/20 ${style.iconWrap}`}>
              <ToneIcon tone={tone} />
            </div>
            <div className="min-w-0 flex-1">
              <div className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[11px] font-medium tracking-[0.18em] uppercase ${style.badge}`}>
                <span className={`h-2 w-2 rounded-full ${style.dot}`} />
                操作确认
              </div>
              <h3 id="confirm-dialog-title" className="mt-3 text-[22px] font-semibold tracking-tight text-white">
                {title}
              </h3>
              <p className="mt-2 max-w-[30rem] text-sm leading-6 text-zinc-400">{description}</p>
            </div>
          </div>
        </div>

        {details ? <div className="relative space-y-3 px-6 py-5 text-sm text-zinc-300 sm:px-7">{details}</div> : null}

        <div className="relative flex flex-col gap-3 border-t border-white/10 bg-white/[0.02] px-6 py-4 sm:flex-row sm:justify-end sm:px-7">
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="rounded-2xl border border-zinc-700/80 bg-zinc-900/70 px-5 py-3 text-sm font-medium text-zinc-200 transition hover:bg-white/5 disabled:opacity-50"
          >
            {cancelText}
          </button>
          <button
            type="button"
            onClick={() => void onConfirm()}
            disabled={busy}
            className={`rounded-2xl px-5 py-3 text-sm font-medium shadow-lg shadow-black/20 transition disabled:opacity-60 ${style.button}`}
          >
            {busy ? "处理中..." : confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
