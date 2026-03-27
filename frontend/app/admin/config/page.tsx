"use client";

import { useState } from "react";

function ConfigSection({ title, desc, children }: { title: string; desc?: string; children: React.ReactNode }) {
  return (
    <div className="glass-card rounded-2xl border border-zinc-800/60 p-5">
      <div className="mb-4">
        <h3 className="text-sm font-medium text-zinc-200">{title}</h3>
        {desc && <p className="text-xs text-zinc-500 mt-1">{desc}</p>}
      </div>
      {children}
    </div>
  );
}

export default function ConfigPage() {
  const [saved, setSaved] = useState<string | null>(null);

  const handleSave = (key: string) => {
    setSaved(key);
    setTimeout(() => setSaved(null), 2000);
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-zinc-100">系统配置</h2>
        <p className="text-sm text-zinc-400 mt-1">配置系统的运行参数</p>
      </div>

      <ConfigSection title="AI 模型配置" desc="设置 AI 模型的默认行为和参数">
        <div className="space-y-3">
          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <label className="text-xs text-zinc-400 block mb-1.5">默认模型</label>
              <select className="input-base">
                <option>gpt-4o-mini</option>
                <option>gpt-4o</option>
                <option>claude-3-sonnet</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-zinc-400 block mb-1.5">温度参数</label>
              <input className="input-base" type="number" step="0.1" min="0" max="2" defaultValue="0.7" />
            </div>
          </div>
        </div>
        <button onClick={() => handleSave("ai")} className="btn-primary mt-4 text-sm">
          {saved === "ai" ? "已保存" : "保存 AI 配置"}
        </button>
      </ConfigSection>

      <ConfigSection title="告警配置" desc="设置告警的默认通知渠道和触发条件">
        <div className="space-y-3">
          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <label className="text-xs text-zinc-400 block mb-1.5">告警冷却时间（分钟）</label>
              <input className="input-base" type="number" defaultValue="5" />
            </div>
            <div>
              <label className="text-xs text-zinc-400 block mb-1.5">默认通知渠道</label>
              <select className="input-base">
                <option value="">未配置</option>
                <option>钉钉</option>
                <option>飞书</option>
                <option>企业微信</option>
                <option>Telegram</option>
              </select>
            </div>
          </div>
        </div>
        <button onClick={() => handleSave("alert")} className="btn-primary mt-4 text-sm">
          {saved === "alert" ? "已保存" : "保存告警配置"}
        </button>
      </ConfigSection>

      <ConfigSection title="数据保留策略" desc="设置数据保留的时间规则">
        <div className="space-y-3">
          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <label className="text-xs text-zinc-400 block mb-1.5">文件保留天数</label>
              <input className="input-base" type="number" defaultValue="90" />
            </div>
            <div>
              <label className="text-xs text-zinc-400 block mb-1.5">告警日志保留天数</label>
              <input className="input-base" type="number" defaultValue="30" />
            </div>
          </div>
        </div>
        <button onClick={() => handleSave("retention")} className="btn-primary mt-4 text-sm">
          {saved === "retention" ? "已保存" : "保存保留策略"}
        </button>
      </ConfigSection>
    </div>
  );
}
