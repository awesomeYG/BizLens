"use client";

import { IM_PLATFORMS_LIST, type IMPlatformType, type IMConfigCreateRequest } from "@/lib/im";

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

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
      <div className="w-full max-w-lg glass-card rounded-2xl p-6 space-y-5 border-zinc-700/50 shadow-2xl">
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
          <div>
            <label className="block text-xs text-zinc-500 mb-2">选择平台类型</label>
            <div className="grid grid-cols-2 gap-2">
              {IM_PLATFORMS_LIST.map((platform) => (
                <button
                  key={platform.type}
                  type="button"
                  onClick={() => onFormDataChange({ ...formData, type: platform.type as IMPlatformType })}
                  className={`p-3 rounded-xl border transition-all text-left ${
                    formData.type === platform.type
                      ? "border-indigo-500/50 bg-indigo-500/10"
                      : "border-zinc-800 bg-zinc-900/30 hover:border-zinc-700"
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <div
                      className="w-8 h-8 rounded-lg flex items-center justify-center"
                      style={{ backgroundColor: `${platform.color}15` }}
                    >
                      <span className="text-sm font-bold" style={{ color: platform.color }}>
                        {platform.label.charAt(0)}
                      </span>
                    </div>
                    <div>
                      <div className="text-xs font-medium text-zinc-200">{platform.label}</div>
                      <div className="text-[10px] text-zinc-500 truncate">{platform.description}</div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Selected Platform Info */}
        {selectedPlatform && (
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
        <form onSubmit={onSubmit} className="space-y-4">
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
            />
          </div>

          {formData.type === "dingtalk" || formData.type === "feishu" ? (
            <div>
              <label className="block text-xs text-zinc-500 mb-1.5">
                签名密钥
                <span className="text-zinc-600 ml-1">(可选，推荐配置)</span>
              </label>
              <input
                value={formData.secret}
                onChange={(e) => onFormDataChange({ ...formData, secret: e.target.value })}
                placeholder="SEC..."
                type="password"
                className="input-base"
              />
              <p className="text-[10px] text-zinc-600 mt-1">
                部分平台需要签名密钥以增强安全性
              </p>
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
