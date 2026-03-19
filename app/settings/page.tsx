"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getCurrentUser } from "@/lib/user-store";
import {
  getNotificationRules,
  deleteNotificationRule,
  toggleNotificationRule,
  addNotificationRule,
} from "@/lib/notification-store";
import type { NotificationRule } from "@/lib/types";

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

  useEffect(() => {
    const user = getCurrentUser();
    if (!user?.isOnboarded) {
      router.replace("/");
      return;
    }
    setRules(getNotificationRules());
    setReady(true);
  }, [router]);

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
    return <div className="min-h-screen bg-slate-900" />;
  }

  return (
    <div className="min-h-screen flex flex-col bg-slate-900">
      <nav className="flex items-center justify-between px-6 py-3 border-b border-slate-700/50 bg-slate-800/80">
        <Link href="/" className="text-cyan-400 hover:text-cyan-300 font-medium">
          &larr; AI BI
        </Link>
        <div className="flex gap-4 items-center">
          <Link href="/chat" className="text-slate-400 hover:text-slate-300">
            AI 对话
          </Link>
          <Link
            href="/settings"
            className="text-cyan-400 font-medium border-b-2 border-cyan-400 pb-1"
          >
            设置
          </Link>
        </div>
      </nav>

      <main className="flex-1 p-6 max-w-4xl mx-auto w-full">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-xl font-semibold text-slate-100">钉钉通知事件</h1>
          <button
            onClick={() => setShowAdd(!showAdd)}
            className="px-4 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-sm"
          >
            {showAdd ? "取消" : "添加规则"}
          </button>
        </div>

        <p className="text-sm text-slate-400 mb-6">
          配置数据监控规则，当条件触发时自动发送钉钉通知。你也可以在 AI 对话中用自然语言描述来创建规则。
        </p>

        {showAdd && (
          <div className="rounded-xl border border-slate-700 bg-slate-800/60 p-5 mb-6 space-y-3">
            <input
              value={form.name}
              onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
              placeholder="规则名称，如：日销售额破千提醒"
              className="w-full rounded-lg bg-slate-700 border border-slate-600 px-3 py-2 text-slate-100 text-sm"
            />
            <input
              value={form.condition}
              onChange={(e) => setForm((p) => ({ ...p, condition: e.target.value }))}
              placeholder="触发条件，如：当日销售额超过1000元"
              className="w-full rounded-lg bg-slate-700 border border-slate-600 px-3 py-2 text-slate-100 text-sm"
            />
            <input
              value={form.messageTemplate}
              onChange={(e) => setForm((p) => ({ ...p, messageTemplate: e.target.value }))}
              placeholder="通知消息模板（可选），如：今日销售额已突破目标！"
              className="w-full rounded-lg bg-slate-700 border border-slate-600 px-3 py-2 text-slate-100 text-sm"
            />
            <input
              value={form.webhookUrl}
              onChange={(e) => setForm((p) => ({ ...p, webhookUrl: e.target.value }))}
              placeholder="钉钉 Webhook URL"
              className="w-full rounded-lg bg-slate-700 border border-slate-600 px-3 py-2 text-slate-100 text-sm"
            />
            <button
              onClick={handleAdd}
              disabled={!form.name.trim() || !form.condition.trim() || !form.webhookUrl.trim()}
              className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-sm"
            >
              保存规则
            </button>
          </div>
        )}

        {rules.length === 0 ? (
          <div className="text-center py-16 text-slate-500">
            <p className="mb-2">暂无通知规则</p>
            <p className="text-sm">
              点击上方「添加规则」或在 AI 对话中说「当日销售额超过1000时通知我」来创建
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {rules.map((rule) => (
              <div
                key={rule.id}
                className={`rounded-xl border p-4 transition-colors ${
                  rule.enabled
                    ? "border-slate-700 bg-slate-800/60"
                    : "border-slate-700/50 bg-slate-800/30 opacity-60"
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="text-sm font-medium text-slate-200 truncate">
                        {rule.name}
                      </h3>
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full ${
                          rule.enabled
                            ? "bg-emerald-500/20 text-emerald-400"
                            : "bg-slate-600/30 text-slate-500"
                        }`}
                      >
                        {rule.enabled ? "启用" : "停用"}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 mb-1">
                      条件：{rule.condition}
                    </p>
                    <p className="text-xs text-slate-500 truncate">
                      消息：{rule.messageTemplate}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => handleToggle(rule.id)}
                      className="text-xs px-3 py-1 rounded-lg border border-slate-600 text-slate-400 hover:text-slate-300 hover:border-slate-500"
                    >
                      {rule.enabled ? "停用" : "启用"}
                    </button>
                    <button
                      onClick={() => handleDelete(rule.id)}
                      className="text-xs px-3 py-1 rounded-lg border border-red-800/50 text-red-400 hover:text-red-300 hover:border-red-700"
                    >
                      删除
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
