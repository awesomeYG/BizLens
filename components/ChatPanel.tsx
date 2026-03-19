"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { saveDashboard } from "@/lib/dashboard-store";
import { DASHBOARD_TEMPLATES } from "@/lib/templates";
import { DEFAULT_DASHBOARD_DATA, mapSampleToDashboard } from "@/lib/data-mapper";
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
      content: `你好！我是 AI BI 助手。你可以：\n1. 上传 CSV/Excel 等数据文件，我会学习并分析\n2. 向我提问，我会基于数据给出洞察\n3. 说「生成数据大屏」，我会帮你创建可视化大屏\n\n${
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

  return (
    <div className="flex flex-col h-full">
      <header className="flex items-center justify-between px-6 py-4 border-b border-slate-700/50 bg-slate-800/50">
        <h1 className="text-xl font-semibold text-cyan-400">AI 对话</h1>
        <div className="flex items-center gap-4">
          {uploadedFiles.length > 0 && (
            <span className="text-sm text-slate-400">
              已上传 {uploadedFiles.length} 个文件
            </span>
          )}
          <Link
            href="/dashboards"
            className="text-sm text-cyan-400 hover:text-cyan-300"
          >
            查看大屏 →
          </Link>
        </div>
      </header>

      <div className="flex flex-1 min-h-0">
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {messages.map((m) => (
            <div
              key={m.id}
              className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[85%] rounded-2xl px-4 py-3 ${
                  m.role === "user"
                    ? "bg-cyan-500/20 text-cyan-100"
                    : "bg-slate-700/50 text-slate-200"
                }`}
              >
                {m.files?.length ? (
                  <div className="mb-2 text-xs text-slate-400">
                    📎 {m.files.map((f) => f.name).join(", ")}
                  </div>
                ) : null}
                <pre className="whitespace-pre-wrap font-sans text-sm">
                  {m.content}
                </pre>
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex justify-start">
              <div className="bg-slate-700/50 rounded-2xl px-4 py-3 text-slate-400">
                思考中...
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        <aside className="hidden lg:block w-80 border-l border-slate-700/50 bg-slate-800/30 p-4 overflow-y-auto space-y-4">
          <div>
            <h3 className="text-sm font-medium text-slate-300 mb-2">已学习数据</h3>
            {dataSourceLabel ? (
              <div className="text-xs text-slate-400 mb-2">来源：{dataSourceLabel}</div>
            ) : null}
            <pre className="text-xs text-slate-500 whitespace-pre-wrap break-words">
              {dataSummary.slice(0, 500) || "等待上传数据或输入指令"}
              {dataSummary.length > 500 && "..."}
            </pre>
          </div>

          <div className="border-t border-slate-700/60 pt-3">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium text-slate-300">大屏草稿</h3>
              <button
                onClick={handleGenerateDashboard}
                className="text-xs px-2 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white"
              >
                生成
              </button>
            </div>
            <label htmlFor="template-select-side" className="block text-xs text-slate-400 mb-1">
              模板
            </label>
            <select
              id="template-select-side"
              value={selectedTemplate}
              onChange={(e) => setSelectedTemplate(e.target.value as DashboardTemplateId)}
              className="w-full bg-slate-700 border border-slate-600 rounded-lg text-slate-200 text-xs px-2 py-1"
            >
              {DASHBOARD_TEMPLATES.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
            <label htmlFor="dashboard-title-side" className="block text-xs text-slate-400 mt-3 mb-1">
              标题
            </label>
            <input
              id="dashboard-title-side"
              value={dashboardTitle}
              onChange={(e) => setDashboardTitle(e.target.value)}
              className="w-full bg-slate-700 border border-slate-600 rounded-lg text-slate-200 text-xs px-2 py-1"
            />
            <div className="grid grid-cols-2 gap-2 mt-3">
              <div>
                <div className="text-[11px] text-slate-400 mb-1">总销售额</div>
                <input
                  type="number"
                  value={draftData.totalSales}
                  onChange={(e) => handleKpiChange("totalSales", e.target.value)}
                  className="w-full bg-slate-700 border border-slate-600 rounded-lg text-slate-200 text-xs px-2 py-1"
                />
              </div>
              <div>
                <div className="text-[11px] text-slate-400 mb-1">同比增长%</div>
                <input
                  type="number"
                  value={draftData.growth}
                  onChange={(e) => handleKpiChange("growth", e.target.value)}
                  className="w-full bg-slate-700 border border-slate-600 rounded-lg text-slate-200 text-xs px-2 py-1"
                />
              </div>
              <div>
                <div className="text-[11px] text-slate-400 mb-1">客户数</div>
                <input
                  type="number"
                  value={draftData.customers}
                  onChange={(e) => handleKpiChange("customers", e.target.value)}
                  className="w-full bg-slate-700 border border-slate-600 rounded-lg text-slate-200 text-xs px-2 py-1"
                />
              </div>
              <div className="text-[11px] text-slate-500 col-span-2">
                上传数据后会自动填充，可手动微调。
              </div>
            </div>
          </div>
        </aside>
      </div>

      <div className="p-4 border-t border-slate-700/50 bg-slate-800/30">
        <div className="flex flex-wrap gap-2 items-center">
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,.txt,.json"
            className="hidden"
            onChange={handleUpload}
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            className="px-4 py-2 rounded-lg bg-slate-600 hover:bg-slate-500 text-slate-300 text-sm"
          >
            📎 上传数据
          </button>
          <select
            value={selectedTemplate}
            onChange={(e) => setSelectedTemplate(e.target.value as DashboardTemplateId)}
            className="px-3 py-2 rounded-lg bg-slate-700 border border-slate-600 text-slate-200 text-sm"
          >
            {DASHBOARD_TEMPLATES.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
          <input
            value={dashboardTitle}
            onChange={(e) => setDashboardTitle(e.target.value)}
            className="w-40 sm:w-56 px-3 py-2 rounded-lg bg-slate-700 border border-slate-600 text-slate-200 text-sm"
            placeholder="大屏标题"
          />
          <button
            onClick={handleGenerateDashboard}
            className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm"
          >
            📊 生成大屏
          </button>
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSend()}
            placeholder="输入问题或说「生成数据大屏」..."
            className="flex-1 min-w-[180px] px-4 py-2 rounded-lg bg-slate-700 border border-slate-600 text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
          />
          <button
            onClick={handleSend}
            disabled={loading || !input.trim()}
            className="px-6 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium"
          >
            发送
          </button>
        </div>
      </div>
    </div>
  );
}
