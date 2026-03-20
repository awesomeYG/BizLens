"use client";

import { IMPlatformConfig, IMPlatformMeta } from "@/lib/im";
import IMPlatformIcon from "./IMPlatformIcon";

interface IMPlatformCardProps {
  config: IMPlatformConfig;
  meta: IMPlatformMeta;
  onEdit: (config: IMPlatformConfig) => void;
  onDelete: (id: string) => void;
  onTest: (id: string) => void;
  onToggle?: (id: string, enabled: boolean) => void;
}

export default function IMPlatformCard({
  config,
  meta,
  onEdit,
  onDelete,
  onTest,
  onToggle,
}: IMPlatformCardProps) {
  const statusConfig = {
    connected: { label: "已连接", class: "badge-success" },
    disconnected: { label: "未连接", class: "badge-neutral" },
    error: { label: "异常", class: "badge-error" },
  };

  const status = statusConfig[config.status];

  return (
    <div className="group glass-card rounded-2xl p-5 space-y-4 animate-fade-in hover:border-zinc-700/50 transition-all duration-300">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          {/* Platform Icon */}
          <div
            className="w-12 h-12 rounded-xl flex items-center justify-center shadow-lg"
            style={{ backgroundColor: `${meta.color}15` }}
          >
            <IMPlatformIcon type={meta.type} color={meta.color} size="md" />
          </div>
          {/* Platform Info */}
          <div>
            <h3 className="font-semibold text-zinc-100 text-sm">{config.name}</h3>
            <p className="text-xs text-zinc-500">{meta.label}</p>
          </div>
        </div>
        <span className={status.class}>{status.label}</span>
      </div>

      {/* Webhook URL */}
      <div className="text-xs text-zinc-500 break-all font-mono bg-zinc-900/50 rounded-lg px-3 py-2.5 border border-zinc-800/50">
        {config.webhookUrl}
      </div>

      {/* Config Info */}
      <div className="flex items-center gap-4 text-xs">
        {config.secret && (
          <span className="flex items-center gap-1.5 text-zinc-500">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
            已配置密钥
          </span>
        )}
        <span className={`flex items-center gap-1.5 ${config.enabled ? "text-emerald-400" : "text-zinc-600"}`}>
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          {config.enabled ? "已启用" : "已禁用"}
        </span>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between pt-2 border-t border-zinc-800/50">
        {onToggle ? (
          <button
            onClick={() => onToggle(config.id, !config.enabled)}
            className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
              config.enabled ? "bg-emerald-500/20" : "bg-zinc-700"
            }`}
          >
            <span
              className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                config.enabled ? "translate-x-5" : "translate-x-1"
              }`}
            />
          </button>
        ) : (
          <span className="text-xs text-zinc-600">
            {config.enabled ? "正常运行中" : "已暂停"}
          </span>
        )}
        <div className="flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={() => onTest(config.id)}
            className="px-2.5 py-1.5 rounded-lg text-xs font-medium text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50 transition-colors"
          >
            测试
          </button>
          <button
            onClick={() => onEdit(config)}
            className="px-2.5 py-1.5 rounded-lg text-xs font-medium text-indigo-400 hover:text-indigo-300 hover:bg-indigo-500/10 transition-colors"
          >
            编辑
          </button>
          <button
            onClick={() => onDelete(config.id)}
            className="px-2.5 py-1.5 rounded-lg text-xs font-medium text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-colors"
          >
            删除
          </button>
        </div>
      </div>
    </div>
  );
}
