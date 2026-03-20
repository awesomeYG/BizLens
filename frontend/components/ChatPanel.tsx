"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { saveDashboard } from "@/lib/dashboard-store";
import { DASHBOARD_TEMPLATES } from "@/lib/templates";
import { DEFAULT_DASHBOARD_DATA, mapSampleToDashboard } from "@/lib/data-mapper";
import { getCurrentUser } from "@/lib/user-store";
import type {
  ChatMessage,
  CompanyProfile,
  DashboardData,
  DashboardTemplateId,
} from "@/lib/types";

interface ChatPanelProps {
  onDataSummaryChange?: (summary: string) => void;
  companyProfile?: CompanyProfile;
}

export default function ChatPanel({
  onDataSummaryChange,
  companyProfile,
}: Readonly<ChatPanelProps>) {
  const router = useRouter();
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "welcome",
      role: "assistant",
      content: `你好！我是 AI BI 助手。你可以：\n1. 上传 CSV/Excel 等数据文件，我会学习并分析\n2. 向我提问，我会基于数据给出洞察\n3. 说「生成数据大屏」，我会帮你创建可视化大屏\n4. **创建智能通知**：例如「当今日销售额超过 1000 时，发钉钉通知我」\n\n${
        companyProfile?.summary ? `当前企业画像：${companyProfile.summary}\n\n` : ""
      }请上传数据或直接提问～`,
      timestamp: Date.now(),
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [dataSummary, setDataSummary] = useState("");
  const [draftData, setDraftData] = useState<DashboardData>({ ...DEFAULT_DASHBOARD_DATA });
  const [selectedTemplate, setSelectedTemplate] = useState(
    DASHBOARD_TEMPLATES[0]?.id ?? "sales"
  );
  const [dashboardTitle, setDashboardTitle] = useState("AI 数据大屏");
  const [dataSourceLabel, setDataSourceLabel] = useState<string | null>(null);
  const [uploadedFiles, setUploadedFiles] = useState<{ name: string; summary?: string }[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    onDataSummaryChange?.(dataSummary);
  }, [dataSummary, onDataSummaryChange]);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const formData = new FormData();
    formData.append("file", file);
    try {
      const res = await fetch("/api/parse-data", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "解析失败");
      const summary = data.summary as string;
      const mappedData = mapSampleToDashboard(data.columns, data.sampleData);
      setDraftData(mappedData);
      setDataSourceLabel(file.name);
      setDashboardTitle(`${file.name.replace(/\.[^.]+$/, "")} 数据大屏`);
      setDataSummary((prev) => (prev ? prev + "\n\n" + summary : summary));
      setUploadedFiles((prev) => [
        ...prev,
        { name: file.name, summary: data.summary?.slice(0, 200) },
      ]);
      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: "user",
          content: `已上传文件：${file.name}，请学习并分析`,
          files: [{ name: file.name, summary: data.summary?.slice(0, 150) }],
          timestamp: Date.now(),
        },
      ]);
      setInput("");
      await sendToAI(
        [
          ...messages.map((m) => ({ role: m.role, content: m.content })),
          {
            role: "user",
            content: `用户上传了文件 ${file.name}，数据摘要：\n${summary}\n请简要总结数据结构并说明可以做什么分析，并给出可以生成的数据大屏指标。`,
          },
        ],
        false
      );
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          content: `解析失败：${err instanceof Error ? err.message : "未知错误"}`,
          timestamp: Date.now(),
        },
      ]);
    }
    e.target.value = "";
  };

  const sendToAI = async (
    msgList: { role: string; content: string }[],
    appendUser = true
  ) => {
    setLoading(true);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: msgList,
          dataSummary: dataSummary || undefined,
          dashboardData: draftData,
          companyProfile,
        }),
      });
      const data = await res.json();
      const content = data.content || data.error || "无回复";

      // 检测 AI 回复中的告警配置
      const alertMatch = content.match(/```alert_config\s*\n([\s\S]*?)\n```/);
      if (alertMatch) {
        try {
          const alertConfig = JSON.parse(alertMatch[1]);
          const user = getCurrentUser();
          const tenantId = user?.id || "demo-tenant";
          const alertRes = await fetch(`/api/tenants/${tenantId}/alerts`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(alertConfig),
          });
          if (alertRes.ok) {
            const created = await alertRes.json();
            // 在回复后追加创建成功的提示
            const cleanContent = content.replace(/```alert_config\s*\n[\s\S]*?\n```/, "").trim();
            setMessages((prev) => [
              ...prev,
              ...(appendUser
                ? [{
                    id: crypto.randomUUID(),
                    role: "user" as const,
                    content: input,
                    timestamp: Date.now(),
                  }]
                : []),
              {
                id: crypto.randomUUID(),
                role: "assistant" as const,
                content: cleanContent + `\n\n✅ 告警规则「${created.name}」已自动创建，可在 [智能告警](/alerts) 页面查看和管理。`,
                timestamp: Date.now(),
              },
            ]);
            setInput("");
            return;
          }
        } catch {
          // JSON 解析失败，按普通消息处理
        }
      }

      // 检测 AI 回复中的通知规则配置
      const notificationMatch = content.match(/```notification_rule\s*\n([\s\S]*?)\n```/);
      if (notificationMatch) {
        try {
          const ruleConfig = JSON.parse(notificationMatch[1]);
          const user = getCurrentUser();
          const tenantId = user?.id || "demo-tenant";
          const ruleRes = await fetch(`/api/tenants/${tenantId}/notification-rules`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(ruleConfig),
          });
          if (ruleRes.ok) {
            const created = await ruleRes.json();
            // 在回复后追加创建成功的提示
            const cleanContent = content.replace(/```notification_rule\s*\n[\s\S]*?\n```/, "").trim();
            setMessages((prev) => [
              ...prev,
              ...(appendUser
                ? [{
                    id: crypto.randomUUID(),
                    role: "user" as const,
                    content: input,
                    timestamp: Date.now(),
                  }]
                : []),
              {
                id: crypto.randomUUID(),
                role: "assistant" as const,
                content: cleanContent + `\n\n✅ 智能通知规则「${created.name}」已自动创建！\n\n**配置详情**：\n- 触发条件：${formatCondition(created.conditionType)} ${created.threshold}\n- 时间范围：${formatTimeRange(created.timeRange)}\n- 通知频率：${formatFrequency(created.frequency)}\n\n你可以在对话中继续调整规则，或说"查看通知规则"来管理。`,
                timestamp: Date.now(),
              },
            ]);
            setInput("");
            return;
          }
        } catch (err) {
          // JSON 解析失败，按普通消息处理
          console.error("创建通知规则失败:", err);
        }
      }

      setMessages((prev) => [
        ...prev,
        ...(appendUser
          ? [
              {
                id: crypto.randomUUID(),
                role: "user" as const,
                content: input,
                timestamp: Date.now(),
              },
            ]
          : []),
        {
          id: crypto.randomUUID(),
          role: "assistant" as const,
          content,
          timestamp: Date.now(),
        },
      ]);
      setInput("");
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: "assistant" as const,
          content: `请求失败：${err instanceof Error ? err.message : "网络错误"}`,
          timestamp: Date.now(),
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleSend = () => {
    const text = input.trim();
    if (!text || loading) return;
    const newMessages = [
      ...messages.map((m) => ({ role: m.role, content: m.content })),
      { role: "user", content: text },
    ];
    sendToAI(newMessages);
  };

  const handleGenerateDashboard = () => {
    const template =
      DASHBOARD_TEMPLATES.find((t) => t.id === selectedTemplate) || DASHBOARD_TEMPLATES[0];
    if (!template) return;
    const id = crypto.randomUUID();
    saveDashboard({
      id,
      title: dashboardTitle || template.name,
      templateId: template.id,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      data: draftData,
    });
    router.push(`/dashboards?id=${id}`);
  };

  const handleKpiChange = (
    key: keyof Pick<DashboardData, "totalSales" | "growth" | "customers">,
    value: string
  ) => {
    const num = Number(value);
    setDraftData((prev) => ({
      ...prev,
      [key]: Number.isFinite(num) ? num : prev[key],
    }));
  };

  // 辅助函数：格式化条件类型
  function formatCondition(type?: string): string {
    if (!type) return "";
    const map: Record<string, string> = {
      greater: "大于",
      less: "小于",
      equals: "等于",
      change: "变化率",
      custom: "自定义",
    };
    return map[type] || type;
  }

  // 辅助函数：格式化时间范围
  function formatTimeRange(range?: string): string {
    if (!range) return "";
    const map: Record<string, string> = {
      today: "今日",
      yesterday: "昨日",
      last_7_days: "近 7 天",
      last_30_days: "近 30 天",
      this_month: "本月",
    };
    return map[range] || range;
  }

  // 辅助函数：格式化频率
  function formatFrequency(freq?: string): string {
    if (!freq) return "";
    const map: Record<string, string> = {
      once: "仅一次",
      hourly: "每小时",
      daily: "每天",
      weekly: "每周",
      monthly: "每月",
      realtime: "实时",
    };
    return map[freq] || freq;
  }

  return (
    <div className="flex flex-col h-full">
      {/* 顶部信息栏 */}
      <header className="flex items-center justify-between px-6 py-3 border-b border-zinc-800/80 bg-zinc-900/50">
        <div className="flex items-center gap-3">
          <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse-soft" />
          <h1 className="text-sm font-medium text-zinc-300">AI 分析助手</h1>
        </div>
        <div className="flex items-center gap-3">
          {uploadedFiles.length > 0 && (
            <span className="badge-info">{uploadedFiles.length} 个数据文件</span>
          )}
        </div>
      </header>

      <div className="flex flex-1 min-h-0">
        {/* 消息区域 */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {messages.map((m) => (
            <div key={m.id} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"} animate-fade-in`}>
              <div className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                m.role === "user"
                  ? "bg-indigo-500/15 border border-indigo-500/20 text-zinc-200"
                  : "bg-zinc-800/60 border border-zinc-700/40 text-zinc-300"
              }`}>
                {m.files?.length ? (
                  <div className="mb-2 text-xs text-zinc-500 flex items-center gap-1">
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="m18.375 12.739-7.693 7.693a4.5 4.5 0 0 1-6.364-6.364l10.94-10.94A3 3 0 1 1 19.5 7.372L8.552 18.32m.009-.01-.01.01m5.699-9.941-7.81 7.81a1.5 1.5 0 0 0 2.112 2.13" />
                    </svg>
                    {m.files.map((f) => f.name).join(", ")}
                  </div>
                ) : null}
                <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed">{m.content}</pre>
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex justify-start animate-fade-in">
              <div className="bg-zinc-800/60 border border-zinc-700/40 rounded-2xl px-4 py-3 text-zinc-500 flex items-center gap-2">
                <div className="flex gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-zinc-500 animate-bounce" style={{animationDelay: "0ms"}} />
                  <span className="w-1.5 h-1.5 rounded-full bg-zinc-500 animate-bounce" style={{animationDelay: "150ms"}} />
                  <span className="w-1.5 h-1.5 rounded-full bg-zinc-500 animate-bounce" style={{animationDelay: "300ms"}} />
                </div>
                分析中...
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* 侧边栏 - 大屏草稿（降低存在感） */}
        <aside className="hidden lg:block w-72 border-l border-zinc-800/80 bg-zinc-900/30 p-4 overflow-y-auto space-y-4">
          <div>
            <h3 className="text-xs font-medium text-zinc-500 uppercase tracking-wider mb-2">已学习数据</h3>
            {dataSourceLabel && <div className="text-xs text-zinc-600 mb-2">来源：{dataSourceLabel}</div>}
            <pre className="text-xs text-zinc-600 whitespace-pre-wrap break-words leading-relaxed">
              {dataSummary.slice(0, 500) || "等待上传数据或输入指令"}
              {dataSummary.length > 500 && "..."}
            </pre>
          </div>

          <div className="border-t border-zinc-800/60 pt-3">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xs font-medium text-zinc-500 uppercase tracking-wider">大屏草稿</h3>
              <button onClick={handleGenerateDashboard}
                className="text-xs px-2.5 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-zinc-200 border border-zinc-700/50 transition-all">
                生成
              </button>
            </div>
            <label htmlFor="template-select-side" className="block text-xs text-zinc-500 mb-1">模板</label>
            <select id="template-select-side" value={selectedTemplate}
              onChange={(e) => setSelectedTemplate(e.target.value as DashboardTemplateId)}
              className="w-full bg-zinc-900 border border-zinc-700/50 rounded-lg text-zinc-300 text-xs px-2 py-1.5">
              {DASHBOARD_TEMPLATES.map((t) => (<option key={t.id} value={t.id}>{t.name}</option>))}
            </select>
            <label htmlFor="dashboard-title-side" className="block text-xs text-zinc-500 mt-3 mb-1">标题</label>
            <input id="dashboard-title-side" value={dashboardTitle} onChange={(e) => setDashboardTitle(e.target.value)}
              className="w-full bg-zinc-900 border border-zinc-700/50 rounded-lg text-zinc-300 text-xs px-2 py-1.5" />
            <div className="grid grid-cols-2 gap-2 mt-3">
              <div>
                <div className="text-[11px] text-zinc-500 mb-1">总销售额</div>
                <input type="number" value={draftData.totalSales} onChange={(e) => handleKpiChange("totalSales", e.target.value)}
                  className="w-full bg-zinc-900 border border-zinc-700/50 rounded-lg text-zinc-300 text-xs px-2 py-1.5" />
              </div>
              <div>
                <div className="text-[11px] text-zinc-500 mb-1">同比增长%</div>
                <input type="number" value={draftData.growth} onChange={(e) => handleKpiChange("growth", e.target.value)}
                  className="w-full bg-zinc-900 border border-zinc-700/50 rounded-lg text-zinc-300 text-xs px-2 py-1.5" />
              </div>
              <div>
                <div className="text-[11px] text-zinc-500 mb-1">客户数</div>
                <input type="number" value={draftData.customers} onChange={(e) => handleKpiChange("customers", e.target.value)}
                  className="w-full bg-zinc-900 border border-zinc-700/50 rounded-lg text-zinc-300 text-xs px-2 py-1.5" />
              </div>
              <div className="text-[11px] text-zinc-600 col-span-2">上传数据后自动填充</div>
            </div>
          </div>
        </aside>
      </div>

      {/* 底部输入栏 */}
      <div className="p-4 border-t border-zinc-800/80 bg-zinc-900/50">
        <div className="flex gap-2 items-center max-w-4xl mx-auto">
          <input ref={fileInputRef} type="file" accept=".csv,.txt,.json" className="hidden" onChange={handleUpload} />
          <button onClick={() => fileInputRef.current?.click()}
            className="shrink-0 p-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-zinc-200 border border-zinc-700/50 transition-all"
            title="上传数据">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="m18.375 12.739-7.693 7.693a4.5 4.5 0 0 1-6.364-6.364l10.94-10.94A3 3 0 1 1 19.5 7.372L8.552 18.32m.009-.01-.01.01m5.699-9.941-7.81 7.81a1.5 1.5 0 0 0 2.112 2.13" />
            </svg>
          </button>
          <input value={input} onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSend()}
            placeholder="输入问题，或描述告警规则..."
            className="flex-1 input-base !rounded-xl" />
          <button onClick={handleSend} disabled={loading || !input.trim()}
            className="shrink-0 btn-primary disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 12 3.269 3.125A59.769 59.769 0 0 1 21.485 12 59.768 59.768 0 0 1 3.27 20.875L5.999 12Zm0 0h7.5" />
            </svg>
          </button>
        </div>
        <div className="max-w-4xl mx-auto mt-2 text-xs text-zinc-500">
          提示：可以说 "当今日销售额超过 1000 时，发钉钉通知我" 来创建智能通知规则
        </div>
      </div>
    </div>
  );
}
