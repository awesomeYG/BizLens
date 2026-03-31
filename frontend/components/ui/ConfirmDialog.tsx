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
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
      role="presentation"
      onClick={(event) => {
        if (event.target === event.currentTarget && !busy) {
          onClose();
        }
      }}
    >
      <div
        className={`w-full max-w-md overflow-hidden rounded-3xl border border-white/10 bg-zinc-950/95 bg-gradient-to-br ${style.panel} shadow-2xl shadow-black/40`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="border-b border-white/10 px-6 py-5">
          <div className="flex items-start gap-4">
            <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border ${style.iconWrap}`}>
              <ToneIcon tone={tone} />
            </div>
            <div className="min-w-0 flex-1">
              <div className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[11px] ${style.badge}`}>
                <span className={`h-2 w-2 rounded-full ${style.dot}`} />
                操作确认
              </div>
              <h3 id="confirm-dialog-title" className="mt-3 text-xl font-semibold text-white">
                {title}
              </h3>
              <p className="mt-2 text-sm leading-6 text-zinc-400">{description}</p>
            </div>
          </div>
        </div>

        {details ? <div className="space-y-3 px-6 py-5 text-sm text-zinc-300">{details}</div> : null}

        <div className="flex flex-col gap-3 border-t border-white/10 px-6 py-4 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="rounded-xl border border-zinc-700 px-5 py-3 text-sm font-medium text-zinc-200 transition hover:bg-white/5 disabled:opacity-50"
          >
            {cancelText}
          </button>
          <button
            type="button"
            onClick={() => void onConfirm()}
            disabled={busy}
            className={`rounded-xl px-5 py-3 text-sm font-medium transition disabled:opacity-60 ${style.button}`}
          >
            {busy ? "处理中..." : confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
