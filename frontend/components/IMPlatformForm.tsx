"use client";

import { IM_PLATFORMS_LIST, type IMPlatformType, type IMConfigCreateRequest } from "@/lib/im";
import { useEffect, useRef, useState } from "react";

interface IMPlatformFormProps {
  editingId: string | null;
  formData: IMConfigCreateRequest;
  error: string;
  onSubmit: (e: React.FormEvent) => void;
  onFormDataChange: (data: IMConfigCreateRequest) => void;
  onClose: () => void;
}

export default function IMPlatformForm({
  editingId,
  formData,
  error,
  onSubmit,
  onFormDataChange,
  onClose,
}: IMPlatformFormProps) {
  const selectedPlatform = IM_PLATFORMS_LIST.find((p) => p.type === formData.type);
  const [typeMenuOpen, setTypeMenuOpen] = useState(false);
  const typeMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (typeMenuRef.current && !typeMenuRef.current.contains(event.target as Node)) {
        setTypeMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-start sm:items-center justify-center px-4 py-8 sm:px-6 z-50 animate-fade-in overflow-y-auto">
      <div className="w-full max-w-lg glass-card rounded-2xl p-6 space-y-5 border-zinc-700/50 shadow-2xl max-h-[calc(100vh-4rem)] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-zinc-100">
              {editingId ? "编辑平台配置" : "添加新平台"}
            </h2>
            <p className="text-xs text-zinc-500 mt-0.5">
              {editingId ? "修改现有平台配置" : "配置您的即时通讯平台"}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Platform Selection (only for new) */}
        {!editingId && (
          <div className="space-y-2">
            <label className="block text-xs text-zinc-500">选择平台类型</label>
            <div className="relative" ref={typeMenuRef}>
              <button
                type="button"
                aria-haspopup="listbox"
                aria-expanded={typeMenuOpen}
                onClick={() => setTypeMenuOpen((open) => !open)}
                className={`flex w-full items-center gap-3 rounded-xl border px-4 py-3 text-left text-sm transition focus-visible:ring-2 focus-visible:ring-indigo-500/40 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-900 ${typeMenuOpen
                  ? "border-indigo-500/60 bg-zinc-900/70 shadow-[0_0_0_1px_rgba(99,102,241,0.25)]"
                  : "border-zinc-800 bg-zinc-900/60 hover:border-zinc-700"
                  }`}
              >
                <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-zinc-800 bg-zinc-950">
                  {selectedPlatform ? (
                    <span className="text-sm font-bold" style={{ color: selectedPlatform.color }}>
                      {selectedPlatform.label.charAt(0)}
                    </span>
                  ) : (
                    <span className="text-xs text-zinc-500">IM</span>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[15px] font-medium text-zinc-100">
                    {selectedPlatform ? selectedPlatform.label : "请选择要接入的平台"}
                  </div>
                  <div className="truncate text-xs text-zinc-500">
                    {selectedPlatform ? selectedPlatform.description : "钉钉 / 飞书 / 企业微信 / Slack / Telegram / Discord"}
                  </div>
                </div>
                <svg
                  className={`h-4 w-4 shrink-0 text-zinc-500 transition-transform duration-200 ${typeMenuOpen ? "rotate-180 text-indigo-400" : ""}`}
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>

              {typeMenuOpen ? (
                <div
                  role="listbox"
                  className="absolute z-20 mt-2 max-h-[18rem] w-full overflow-auto rounded-xl border border-zinc-800/80 bg-zinc-950/95 py-1 shadow-2xl shadow-black/60 ring-1 ring-white/[0.05]"
                >
                  {IM_PLATFORMS_LIST.map((platform) => {
                    const selected = platform.type === formData.type;
                    return (
                      <button
                        key={platform.type}
                        type="button"
                        role="option"
                        aria-selected={selected}
                        onClick={() => {
                          onFormDataChange({ ...formData, type: platform.type as IMPlatformType });
                          setTypeMenuOpen(false);
                        }}
                        className={`flex w-full items-center gap-3 px-3 py-2.5 text-left text-sm transition ${selected
                          ? "bg-indigo-500/10 text-indigo-100"
                          : "text-zinc-100 hover:bg-white/5"
                          }`}
                      >
                        <span
                          className="flex h-9 w-9 items-center justify-center rounded-lg border border-zinc-800"
                          style={{ backgroundColor: `${platform.color}15` }}
                        >
                          <span className="text-sm font-bold" style={{ color: platform.color }}>
                            {platform.label.charAt(0)}
                          </span>
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="truncate font-medium">{platform.label}</div>
                          <div className="truncate text-xs text-zinc-500">{platform.description}</div>
                        </div>
                        {selected ? (
                          <svg className="h-4 w-4 shrink-0 text-indigo-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                        ) : (
                          <span className="h-4 w-4" aria-hidden />
                        )}
                      </button>
                    );
                  })}
                </div>
              ) : null}
            </div>
            <div className="flex flex-wrap gap-2 text-[11px] text-zinc-500">
              {IM_PLATFORMS_LIST.map((platform) => (
                <span
                  key={platform.type}
                  className="inline-flex items-center gap-1 rounded-full border border-zinc-800/80 bg-zinc-900/50 px-2.5 py-1"
                >
                  <span
                    className="h-2.5 w-2.5 rounded-full"
                    style={{ backgroundColor: platform.color }}
                  />
                  <span className="text-[11px] text-zinc-300">{platform.label}</span>
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Selected Platform Info */}
        {selectedPlatform && editingId && (
          <div className="flex items-center gap-3 p-3 rounded-xl bg-zinc-900/50 border border-zinc-800/50">
            <div
              className="w-10 h-10 rounded-lg flex items-center justify-center"
              style={{ backgroundColor: `${selectedPlatform.color}15` }}
            >
              <span className="text-base font-bold" style={{ color: selectedPlatform.color }}>
                {selectedPlatform.label.charAt(0)}
              </span>
            </div>
            <div>
              <div className="text-sm font-medium text-zinc-200">{selectedPlatform.label}</div>
              <div className="text-xs text-zinc-500">{selectedPlatform.description}</div>
            </div>
          </div>
        )}
        {/* Form */}
        <form onSubmit={onSubmit} className="space-y-4" autoComplete="off">
          <div>
            <label className="block text-xs text-zinc-500 mb-1.5">配置名称</label>
            <input
              value={formData.name}
              onChange={(e) => onFormDataChange({ ...formData, name: e.target.value })}
              placeholder="如：研发群告警机器人"
              className="input-base"
              autoFocus
            />
          </div>

          <div>
            <label className="block text-xs text-zinc-500 mb-1.5">Webhook 地址</label>
            <input
              value={formData.webhookUrl}
              onChange={(e) => onFormDataChange({ ...formData, webhookUrl: e.target.value })}
              placeholder="https://oapi.dingtalk.com/robot/send?access_token=..."
              type="url"
              className="input-base"
              autoComplete="off"
              spellCheck={false}
            />
          </div>

          {formData.type === "dingtalk" || formData.type === "feishu" ? (
            <div>
              <label className="block text-xs text-zinc-500 mb-1.5">
                {formData.type === "dingtalk" ? "AppKey:AppSecret" : "签名密钥"}
                <span className="text-zinc-600 ml-1">(可选，推荐配置)</span>
              </label>
              <input
                value={formData.secret}
                onChange={(e) => onFormDataChange({ ...formData, secret: e.target.value })}
                placeholder={formData.type === "dingtalk" ? "格式：dingxxxxxxxxx:xxxxxxxxx" : "SEC..."}
                type="text"
                className="input-base"
                autoComplete="off"
                spellCheck={false}
                style={{ WebkitTextSecurity: "disc" } as any}
              />
              <p className="text-[10px] text-zinc-600 mt-1">
                {formData.type === "dingtalk"
                  ? "钉钉企业内部应用的 AppKey 和 AppSecret，用冒号分隔，用于 Stream 模式接收消息"
                  : "部分平台需要签名密钥以增强安全性"}
              </p>
            </div>
          ) : null}

          {formData.type === "dingtalk" ? (
            <div>
              <label className="block text-xs text-zinc-500 mb-1.5">
                自定义关键词
                <span className="text-zinc-600 ml-1">(若机器人启用了关键词安全设置则必填)</span>
              </label>
              <input
                value={formData.keyword ?? ""}
                onChange={(e) => onFormDataChange({ ...formData, keyword: e.target.value })}
                placeholder="与钉钉群内机器人设置一致"
                type="text"
                className="input-base"
              />
              <p className="text-[10px] text-zinc-600 mt-1">
                平台会在发送内容前自动附带该词，避免「关键词不匹配」错误
              </p>
            </div>
          ) : null}

          {formData.type === "dingtalk" ? (
            <div className="p-3 rounded-xl bg-indigo-500/5 border border-indigo-500/20">
              <div className="flex items-start gap-2">
                <svg className="w-4 h-4 text-indigo-400 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div>
                  <p className="text-xs text-indigo-300 font-medium">双向对话支持</p>
                  <p className="text-[10px] text-zinc-400 mt-1 leading-relaxed">
                    配置 AppKey:AppSecret 后，服务启动时会自动建立 Stream 长连接，
                    用户在钉钉群 @机器人 即可与 AI 对话，无需公网回调地址。
                  </p>
                </div>
              </div>
            </div>
          ) : null}

          <div className="flex items-center gap-3 p-3 rounded-xl bg-zinc-900/30 border border-zinc-800/50">
            <input
              id="enabled"
              type="checkbox"
              checked={formData.enabled}
              onChange={(e) => onFormDataChange({ ...formData, enabled: e.target.checked })}
              className="w-4 h-4 rounded bg-zinc-800 border-zinc-600 text-indigo-500 focus:ring-indigo-500/20"
            />
            <div>
              <label htmlFor="enabled" className="text-sm text-zinc-300 cursor-pointer">
                立即启用此平台
              </label>
              <p className="text-xs text-zinc-500">禁用后将不会发送任何通知</p>
            </div>
          </div>

          {error && (
            <div className="flex items-center gap-2 p-3 rounded-xl bg-red-500/10 border border-red-500/30">
              <svg className="w-4 h-4 text-red-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="text-sm text-red-400">{error}</span>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="btn-secondary flex-1"
            >
              取消
            </button>
            <button
              type="submit"
              className="btn-primary flex-1"
            >
              {editingId ? "保存更改" : "添加平台"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
