"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getCurrentUser } from "@/lib/user-store";
import { getAIConfig, saveAIConfig } from "@/lib/ai-config-store";
import {
  getNotificationRules,
  deleteNotificationRule,
  toggleNotificationRule,
  addNotificationRule,
} from "@/lib/notification-store";
import type { AIConfig, NotificationRule } from "@/lib/types";

const SECTIONS = [
  { id: "ai-model", label: "AI 模型" },
  { id: "notifications", label: "通知规则" },
] as const;

export default function SettingsPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [rules, setRules] = useState<NotificationRule[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({
    name: "",
    condition: "",
    messageTemplate: "",
    webhookUrl: "",
  });
  const [aiConfig, setAiConfig] = useState<AIConfig>({ apiKey: "", baseUrl: "https://api.openai.com/v1", model: "gpt-4o-mini" });
  const [aiSaved, setAiSaved] = useState(false);
  const [activeSection, setActiveSection] = useState<string>(SECTIONS[0].id);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const user = getCurrentUser();
    if (!user?.isOnboarded) {
      router.replace("/");
      return;
    }
    setRules(getNotificationRules());
    setAiConfig(getAIConfig());
    setReady(true);
  }, [router]);

  // IntersectionObserver for active section tracking
  useEffect(() => {
    if (!ready) return;
    const container = scrollRef.current;
    if (!container) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActiveSection(entry.target.id);
          }
        }
      },
      { root: container, rootMargin: "-20% 0px -60% 0px", threshold: 0 }
    );

    for (const s of SECTIONS) {
      const el = document.getElementById(s.id);
      if (el) observer.observe(el);
    }

    return () => observer.disconnect();
  }, [ready]);

  const scrollTo = useCallback((id: string) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
      setActiveSection(id);
    }
  }, []);

  const handleAdd = () => {
    if (!form.name.trim() || !form.condition.trim() || !form.webhookUrl.trim()) return;
    const rule = addNotificationRule({
      name: form.name.trim(),
      condition: form.condition.trim(),
      messageTemplate: form.messageTemplate.trim() || `[通知] ${form.name.trim()}`,
      webhookUrl: form.webhookUrl.trim(),
      enabled: true,
    });
    setRules((prev) => [...prev, rule]);
    setForm({ name: "", condition: "", messageTemplate: "", webhookUrl: "" });
    setShowAdd(false);
  };

  const handleDelete = (id: string) => {
    deleteNotificationRule(id);
    setRules((prev) => prev.filter((r) => r.id !== id));
  };

  const handleToggle = (id: string) => {
    const updated = toggleNotificationRule(id);
    if (updated) {
      setRules((prev) => prev.map((r) => (r.id === id ? updated : r)));
    }
  };

  if (!ready) {
    return <div className="min-h-screen bg-base" />;
  }

  return (
    <div className="min-h-screen flex flex-col bg-base">
      {/* Nav */}
      <nav className="flex items-center justify-between px-5 h-12 border-b border-border-subtle bg-surface/80 backdrop-blur-md shrink-0">
        <Link href="/" className="text-sm font-semibold text-txt-primary tracking-tight hover:text-accent transition-colors">
          BizLens
        </Link>
        <div className="flex items-center gap-1">
          <Link href="/chat" className="px-3 py-1.5 rounded-lg text-xs text-txt-tertiary hover:text-txt-secondary hover:bg-white/[0.03] transition-all">
            对话
          </Link>
          <Link href="/dashboards" className="px-3 py-1.5 rounded-lg text-xs text-txt-tertiary hover:text-txt-secondary hover:bg-white/[0.03] transition-all">
            大屏
          </Link>
          <Link href="/settings" className="px-3 py-1.5 rounded-lg text-xs font-medium text-accent bg-accent/[0.08]">
            设置
          </Link>
        </div>
      </nav>

      <div className="flex-1 flex min-h-0">
        {/* Sidebar nav */}
        <aside className="hidden md:flex w-48 shrink-0 flex-col border-r border-border-subtle bg-surface/40 py-8 px-4">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-txt-tertiary mb-4 px-2">设置</p>
          <nav className="space-y-0.5">
            {SECTIONS.map((s) => (
              <button
                key={s.id}
                onClick={() => scrollTo(s.id)}
                className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-all duration-200 relative ${
                  activeSection === s.id
                    ? "text-accent bg-accent/[0.08] font-medium"
                    : "text-txt-tertiary hover:text-txt-secondary hover:bg-white/[0.03]"
                }`}
              >
                {activeSection === s.id && (
                  <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-4 rounded-full bg-accent" />
                )}
                {s.label}
              </button>
            ))}
          </nav>
        </aside>

        {/* Content */}
        <main ref={scrollRef} className="flex-1 overflow-y-auto">
          <div className="max-w-2xl mx-auto px-6 py-10 space-y-16">

            {/* AI API Config */}
            <section id="ai-model" className="scroll-mt-10">
              <div className="mb-6">
                <h2 className="text-lg font-semibold text-txt-primary mb-1">AI 模型配置</h2>
                <p className="text-sm text-txt-tertiary">
                  配置 OpenAI 兼容的 API 接口，支持自定义 Base URL
                </p>
              </div>
              <div className="glass-card rounded-2xl p-6 space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-txt-secondary">API Key</label>
                  <input
                    value={aiConfig.apiKey}
                    onChange={(e) => { setAiConfig((p) => ({ ...p, apiKey: e.target.value })); setAiSaved(false); }}
                    placeholder="sk-..."
                    type="password"
                    className="input-base w-full rounded-xl px-4 py-2.5 text-sm font-mono"
                  />
                </div>
                <div className="grid sm:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-txt-secondary">Base URL</label>
                    <input
                      value={aiConfig.baseUrl}
                      onChange={(e) => { setAiConfig((p) => ({ ...p, baseUrl: e.target.value })); setAiSaved(false); }}
                      placeholder="https://api.openai.com/v1"
                      className="input-base w-full rounded-xl px-4 py-2.5 text-sm font-mono"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-txt-secondary">模型</label>
                    <input
                      value={aiConfig.model}
                      onChange={(e) => { setAiConfig((p) => ({ ...p, model: e.target.value })); setAiSaved(false); }}
                      placeholder="gpt-4o-mini"
                      className="input-base w-full rounded-xl px-4 py-2.5 text-sm font-mono"
                    />
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => { saveAIConfig(aiConfig); setAiSaved(true); }}
                    className="btn-primary rounded-xl px-6 py-2.5 text-sm"
                  >
                    保存配置
                  </button>
                  {aiSaved && (
                    <span className="text-xs text-emerald-400 animate-fade-in-up">已保存</span>
                  )}
                </div>
              </div>
            </section>

            {/* Notification Rules */}
            <section id="notifications" className="scroll-mt-10">
              <div className="flex items-start justify-between mb-6">
                <div>
                  <h2 className="text-lg font-semibold text-txt-primary mb-1">通知规则</h2>
                  <p className="text-sm text-txt-tertiary">
                    配置数据监控条件，触发时自动推送钉钉通知
                  </p>
                </div>
                <button
                  onClick={() => setShowAdd(!showAdd)}
                  className={showAdd ? "btn-ghost rounded-xl px-4 py-2 text-xs" : "btn-primary rounded-xl px-4 py-2 text-xs"}
                >
                  {showAdd ? "取消" : "添加规则"}
                </button>
              </div>

              {/* Add form */}
              {showAdd && (
                <div className="glass-card rounded-2xl p-6 mb-8 space-y-4 animate-fade-in-up">
                  <div className="grid sm:grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-txt-secondary">规则名称</label>
                      <input
                        value={form.name}
                        onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                        placeholder="如：日销售额破千提醒"
                        className="input-base w-full rounded-xl px-4 py-2.5 text-sm"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-txt-secondary">触发条件</label>
                      <input
                        value={form.condition}
                        onChange={(e) => setForm((p) => ({ ...p, condition: e.target.value }))}
                        placeholder="如：当日销售额超过1000元"
                        className="input-base w-full rounded-xl px-4 py-2.5 text-sm"
                      />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-txt-secondary">通知消息（可选）</label>
                    <input
                      value={form.messageTemplate}
                      onChange={(e) => setForm((p) => ({ ...p, messageTemplate: e.target.value }))}
                      placeholder="如：今日销售额已突破目标！"
                      className="input-base w-full rounded-xl px-4 py-2.5 text-sm"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-txt-secondary">钉钉 Webhook URL</label>
                    <input
                      value={form.webhookUrl}
                      onChange={(e) => setForm((p) => ({ ...p, webhookUrl: e.target.value }))}
                      placeholder="https://oapi.dingtalk.com/robot/send?access_token=..."
                      className="input-base w-full rounded-xl px-4 py-2.5 text-sm font-mono"
                    />
                  </div>
                  <button
                    onClick={handleAdd}
                    disabled={!form.name.trim() || !form.condition.trim() || !form.webhookUrl.trim()}
                    className="btn-primary rounded-xl px-6 py-2.5 text-sm"
                  >
                    保存
                  </button>
                </div>
              )}

              {/* Rules list */}
              {rules.length === 0 ? (
                <div className="text-center py-20">
                  <div className="w-12 h-12 rounded-2xl bg-white/[0.03] border border-border-subtle flex items-center justify-center mx-auto mb-4">
                    <svg width="20" height="20" viewBox="0 0 16 16" fill="none">
                      <path d="M8 1.33v2M8 12.67v2M3.29 3.29l1.42 1.42M11.29 11.29l1.42 1.42M1.33 8h2M12.67 8h2M3.29 12.71l1.42-1.42M11.29 4.71l1.42-1.42" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" className="text-txt-tertiary"/>
                    </svg>
                  </div>
                  <p className="text-sm text-txt-tertiary mb-1">暂无通知规则</p>
                  <p className="text-xs text-txt-tertiary/60">
                    点击「添加规则」或在对话中用自然语言创建
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {rules.map((rule) => (
                    <div
                      key={rule.id}
                      className={`glass-card rounded-xl p-4 transition-all duration-200 ${
                        rule.enabled ? "" : "opacity-50"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1.5">
                            <div className={`w-1.5 h-1.5 rounded-full ${rule.enabled ? "bg-emerald-400 shadow-[0_0_6px] shadow-emerald-400/50" : "bg-txt-tertiary"}`} />
                            <h3 className="text-sm font-medium text-txt-primary truncate">
                              {rule.name}
                            </h3>
                          </div>
                          <p className="text-xs text-txt-tertiary mb-0.5 pl-3.5">
                            {rule.condition}
                          </p>
                          {rule.messageTemplate && (
                            <p className="text-xs text-txt-tertiary/60 truncate pl-3.5">
                              {rule.messageTemplate}
                            </p>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            onClick={() => handleToggle(rule.id)}
                            className="btn-ghost rounded-lg px-3 py-1.5 text-[11px]"
                          >
                            {rule.enabled ? "停用" : "启用"}
                          </button>
                          <button
                            onClick={() => handleDelete(rule.id)}
                            className="rounded-lg px-3 py-1.5 text-[11px] border border-red-500/20 text-red-400/80 hover:text-red-400 hover:bg-red-500/[0.06] transition-all"
                          >
                            删除
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
        </main>
      </div>
    </div>
  );
}