"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { saveDashboard } from "@/lib/dashboard-store";
import { DASHBOARD_TEMPLATES } from "@/lib/templates";
import { DEFAULT_DASHBOARD_DATA, mapSampleToDashboard } from "@/lib/data-mapper";
import { addNotificationRule } from "@/lib/notification-store";
import { getAIConfig } from "@/lib/ai-config-store";
import type {
  ChatMessage,
  CompanyProfile,
  DashboardData,
  DashboardTemplateId,
  NotificationAction,
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
      content: companyProfile?.summary
        ? `你好，企业画像已就绪。\n\n${companyProfile.summary}\n\n你可以上传数据文件让我分析，或者直接提问。也可以告诉我需要监控的指标，我会帮你配置钉钉通知。`
        : "你好，我是你的 AI 商业分析助手。上传数据文件或直接提问，我会给出洞察和建议。\n\n你也可以用自然语言配置通知，比如「当日销售额超过 1000 时通知我」。",
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

  const parseNotificationAction = (text: string): { cleanContent: string; action?: NotificationAction } => {
    const regex = /<!--NOTIFICATION_ACTION-->\s*([\s\S]*?)\s*<!--\/NOTIFICATION_ACTION-->/;
    const match = text.match(regex);
    if (!match) return { cleanContent: text };
    try {
      const action = JSON.parse(match[1]) as NotificationAction;
      const cleanContent = text.replace(regex, "").trim();
      return { cleanContent, action };
    } catch {
      return { cleanContent: text };
    }
  };

  const sendToAI = async (
    msgList: { role: string; content: string }[],
    appendUser = true
  ) => {
    setLoading(true);
    try {
      const aiConfig = getAIConfig();
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: msgList,
          dataSummary: dataSummary || undefined,
          dashboardData: draftData,
          companyProfile,
          aiConfig: aiConfig.apiKey ? aiConfig : undefined,
        }),
      });
      const ct = res.headers.get("content-type") || "";
      if (!ct.includes("application/json")) throw new Error("服务暂时不可用，请稍后重试");
      const data = await res.json();
      const rawContent = data.content || data.error || "无回复";
      const { cleanContent, action } = parseNotificationAction(rawContent);
      if (action?.type === "create" && action.rule) {
        addNotificationRule(action.rule);
      }
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
          content: cleanContent,
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

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const formData = new FormData();
    formData.append("file", file);
    try {
      const res = await fetch("/api/parse-data", { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "解析失败");
      const summary = data.summary as string;
      const mappedData = mapSampleToDashboard(data.columns, data.sampleData);
      setDraftData(mappedData);
      setDataSourceLabel(file.name);
      setDashboardTitle(`${file.name.replace(/\.[^.]+$/, "")} 数据大屏`);
      setDataSummary((prev) => (prev ? prev + "\n\n" + summary : summary));
      setUploadedFiles((prev) => [...prev, { name: file.name, summary: data.summary?.slice(0, 200) }]);
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
          { role: "user", content: `用户上传了文件 ${file.name}，数据摘要：\n${summary}\n请简要总结数据结构并说明可以做什么分析。` },
        ],
        false
      );
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        { id: crypto.randomUUID(), role: "assistant", content: `解析失败：${err instanceof Error ? err.message : "未知错误"}`, timestamp: Date.now() },
      ]);
    }
    e.target.value = "";
  };

  const handleSend = () => {
    const text = input.trim();
    if (!text || loading) return;
    sendToAI([
      ...messages.map((m) => ({ role: m.role, content: m.content })),
      { role: "user", content: text },
    ]);
  };

  const handleGenerateDashboard = () => {
    const template = DASHBOARD_TEMPLATES.find((t) => t.id === selectedTemplate) || DASHBOARD_TEMPLATES[0];
    if (!template) return;
    const id = crypto.randomUUID();
    saveDashboard({ id, title: dashboardTitle || template.name, templateId: template.id, createdAt: Date.now(), updatedAt: Date.now(), data: draftData });
    router.push(`/dashboards?id=${id}`);
  };

  const handleKpiChange = (key: keyof Pick<DashboardData, "totalSales" | "growth" | "customers">, value: string) => {
    const num = Number(value);
    setDraftData((prev) => ({ ...prev, [key]: Number.isFinite(num) ? num : prev[key] }));
  };

  return (
    <div className="flex flex-col w-full h-full">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
          {messages.map((m) => (
            <div key={m.id} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"} animate-fade-in-up`}>
              <div className={`max-w-[85%] ${m.role === "user" ? "" : "flex gap-3"}`}>
                {m.role === "assistant" && (
                  <div className="shrink-0 w-7 h-7 rounded-lg bg-accent/10 border border-accent/20 flex items-center justify-center mt-0.5">
                    <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                      <path d="M8 1L10 5.5L15 6.5L11.5 10L12.5 15L8 12.5L3.5 15L4.5 10L1 6.5L6 5.5L8 1Z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" className="text-accent"/>
                    </svg>
                  </div>
                )}
                <div
                  className={`rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                    m.role === "user"
                      ? "bg-accent/10 border border-accent/20 text-txt-primary"
                      : "bg-transparent text-txt-secondary"
                  }`}
                >
                  {m.files?.length ? (
                    <div className="flex items-center gap-1.5 mb-2 text-xs text-txt-tertiary">
                      <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
                        <path d="M14 10V12.67A1.33 1.33 0 0112.67 14H3.33A1.33 1.33 0 012 12.67V10M11.33 5.33L8 2M8 2L4.67 5.33M8 2V10" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                      {m.files.map((f) => f.name).join(", ")}
                    </div>
                  ) : null}
                  <pre className="whitespace-pre-wrap font-sans">{m.content}</pre>
                </div>
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex justify-start animate-fade-in-up">
              <div className="flex gap-3">
                <div className="shrink-0 w-7 h-7 rounded-lg bg-accent/10 border border-accent/20 flex items-center justify-center">
                  <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                    <path d="M8 1L10 5.5L15 6.5L11.5 10L12.5 15L8 12.5L3.5 15L4.5 10L1 6.5L6 5.5L8 1Z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" className="text-accent"/>
                  </svg>
                </div>
                <div className="flex items-center gap-1.5 px-4 py-3">
                  <div className="typing-dot" />
                  <div className="typing-dot" />
                  <div className="typing-dot" />
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input area */}
      <div className="shrink-0 border-t border-border-subtle bg-surface/60 backdrop-blur-md">
        <div className="max-w-3xl mx-auto px-4 py-4">
          {uploadedFiles.length > 0 && (
            <div className="flex items-center gap-2 mb-3 flex-wrap">
              {uploadedFiles.map((f, i) => (
                <span key={i} className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-white/[0.03] border border-border-subtle text-[11px] text-txt-tertiary">
                  <svg width="10" height="10" viewBox="0 0 16 16" fill="none">
                    <path d="M9 1H4a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V6L9 1z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round"/>
                  </svg>
                  {f.name}
                </span>
              ))}
            </div>
          )}
          <div className="flex items-end gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.txt,.json"
              className="hidden"
              onChange={handleUpload}
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="shrink-0 w-10 h-10 rounded-xl flex items-center justify-center bg-white/[0.03] border border-border-subtle text-txt-tertiary hover:text-txt-secondary hover:bg-white/[0.06] transition-all"
              title="上传数据"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M14 10V12.67A1.33 1.33 0 0112.67 14H3.33A1.33 1.33 0 012 12.67V10M11.33 5.33L8 2M8 2L4.67 5.33M8 2V10" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
            <div className="flex-1 relative">
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSend()}
                placeholder="输入问题，或描述你想配置的通知事件..."
                className="input-base w-full rounded-xl pl-4 pr-12 py-3 text-sm"
              />
              <button
                onClick={handleSend}
                disabled={loading || !input.trim()}
                className="absolute right-1.5 top-1/2 -translate-y-1/2 w-8 h-8 rounded-lg flex items-center justify-center bg-accent/80 hover:bg-accent disabled:opacity-30 disabled:hover:bg-accent/80 text-white transition-all"
              >
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                  <path d="M14 2L7 9M14 2L9.5 14L7 9M14 2L2 6.5L7 9" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
