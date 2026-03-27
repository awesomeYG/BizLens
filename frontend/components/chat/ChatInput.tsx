"use client";

import { useRef } from "react";

export interface ChatInputProps {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  onStop: () => void;
  loading: boolean;
  disabled?: boolean;
  onFileUpload?: (file: File) => void;
  uploadedFiles?: { name: string; summary?: string }[];
}

export function ChatInput({
  value,
  onChange,
  onSend,
  onStop,
  loading,
  disabled,
  uploadedFiles = [],
}: ChatInputProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (!loading && value.trim()) {
        onSend();
      }
    }
  };

  return (
    <div className="shrink-0 border-t border-zinc-800/30 bg-zinc-900/40 backdrop-blur-xl">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-2/3 h-px bg-gradient-to-r from-transparent via-indigo-500/15 to-transparent" />

      <div className="max-w-3xl mx-auto px-4 py-4 pb-6">
        {/* 上传文件标签 */}
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

        {/* 输入框和按钮 */}
        <div className="flex items-center gap-2.5">
          {/* 文件上传按钮 */}
          <button
            onClick={() => fileInputRef.current?.click()}
            className="shrink-0 p-2.5 rounded-xl text-zinc-500 hover:text-indigo-400 hover:bg-indigo-500/10 border border-transparent hover:border-indigo-500/20 transition-all"
            title="上传数据文件"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 16.5V9.75m0 0 3 3m-3-3-3 3M6.75 19.5a4.5 4.5 0 0 1-1.41-8.775 5.25 5.25 0 0 1 10.233-2.33 3 3 0 0 1 3.758 3.848A3.752 3.752 0 0 1 18 19.5H6.75Z" />
            </svg>
          </button>

          {/* 输入框 */}
          <div className="flex-1 input-glow rounded-xl bg-zinc-800/50 border border-zinc-700/30 focus-within:border-indigo-500/40 transition-all duration-300">
            <input
              value={value}
              onChange={(e) => onChange(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="描述你的数据分析需求..."
              className="w-full bg-transparent px-4 py-3 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none"
              disabled={disabled}
              autoFocus
            />
          </div>

          {/* 发送 / 停止按钮 */}
          {loading ? (
            <button
              onClick={onStop}
              disabled={disabled}
              className="shrink-0 p-2.5 rounded-xl bg-rose-500/90 hover:bg-rose-500 text-white transition-all duration-200 disabled:opacity-30 disabled:cursor-not-allowed shadow-lg shadow-rose-500/20"
              title="停止生成"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                <rect x="6.5" y="6.5" width="11" height="11" rx="2.5" />
              </svg>
            </button>
          ) : (
            <button
              onClick={onSend}
              disabled={!value.trim() || disabled}
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
  );
}
