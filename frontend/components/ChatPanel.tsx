"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import { createDashboardInstance } from "@/lib/dashboard-store";
import { DASHBOARD_TEMPLATES } from "@/lib/templates";
import { DEFAULT_DASHBOARD_DATA, mapSampleToDashboard } from "@/lib/data-mapper";
import { getCurrentUser } from "@/lib/user-store";
import DashboardView from "@/components/DashboardView";
import type {
  ChatMessage,
  CompanyProfile,
  DashboardData,
  DashboardSection,
  DashboardTemplateId,
  Report,
} from "@/lib/types";
import { getAccessToken, request } from "@/lib/auth/api";

interface ChatPanelProps {
  onDataSummaryChange?: (summary: string) => void;
  companyProfile?: CompanyProfile;
}

interface AnalysisEvaluation {
  totalQueries: number;
  querySuccessRate: number;
  clarificationRate: number;
  avgResponseMs: number;
  confidenceDistribution: {
    high: number;
    medium: number;
    low: number;
  };
  recentTrend?: Array<{
    timestamp: number;
    success: boolean;
    hadClarification: boolean;
    confidence: "high" | "medium" | "low";
    durationMs: number;
  }>;
}

function buildSparklinePoints(values: number[], width = 240, height = 56): string {
  if (values.length === 0) return "";
  if (values.length === 1) return `0,${height / 2}`;

  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = Math.max(max - min, 1);
  return values
    .map((v, i) => {
      const x = (i / (values.length - 1)) * width;
      const y = height - ((v - min) / range) * height;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
}

function buildRollingRate(values: boolean[], windowSize = 5): number[] {
  if (values.length === 0) return [];
  return values.map((_, idx) => {
    const start = Math.max(0, idx - windowSize + 1);
    const window = values.slice(start, idx + 1);
    const hit = window.filter(Boolean).length;
    return (hit / window.length) * 100;
  });
}

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

/** 从 AI 回复内容中提取 dashboard_config JSON 块 */
function extractDashboardConfig(content: string): { sections: DashboardSection[]; title?: string } | null {
  const regex = /```dashboard_config\s*\n([\s\S]*?)\n```/;
  const match = regex.exec(content);
  if (!match) return null;
  try {
    const config = JSON.parse(match[1]);
    if (config.sections && Array.isArray(config.sections)) {
      return { sections: config.sections, title: config.title };
    }
  } catch {
    // JSON 解析失败
  }
  return null;
}

/** 从内容中移除 dashboard_config 代码块 */
function removeDashboardConfigBlock(content: string): string {
  return content
    .replace(/```dashboard_config\s*\n[\s\S]*?\n```/g, "")
    .replace(/```datasource_config\s*\n[\s\S]*?\n```/g, "")
    .trim();
}

/** 内联大屏预览组件（附带保存入口） */
function InlineDashboardPreview({
  content,
  onSave,
}: {
  content: string;
  onSave?: (payload: { title?: string; sections: DashboardSection[] }) => void;
}) {
  const config = extractDashboardConfig(content);
  if (!config) return null;

  return (
    <div className="mt-3 rounded-xl border border-indigo-500/20 bg-gradient-to-br from-slate-900/80 via-[#0f1020] to-black overflow-hidden">
      <div className="px-4 py-2.5 border-b border-white/5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-indigo-400 animate-pulse" />
          <span className="text-xs font-medium text-zinc-300">
            {config.title || "AI 生成大屏"}
          </span>
          <span className="text-[10px] text-zinc-500">{config.sections.length} 个区块</span>
        </div>
        {onSave ? (
          <button
            onClick={() => onSave({ title: config.title, sections: config.sections })}
            className="text-[11px] text-indigo-100 px-3 py-1 rounded-lg bg-indigo-500/20 border border-indigo-500/30 hover:bg-indigo-500/30"
          >
            保存为大屏
          </button>
        ) : (
          <span className="text-[10px] text-zinc-500 px-2 py-0.5 rounded-full bg-white/5 border border-white/10">
            预览
          </span>
        )}
      </div>
      <div className="p-3">
        <DashboardView sections={config.sections} />
      </div>
    </div>
  );
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
  const [lastDashboardSections, setLastDashboardSections] = useState<DashboardSection[]>([]);
  const [dataSourceLabel, setDataSourceLabel] = useState<string | null>(null);
  const [uploadedFiles, setUploadedFiles] = useState<{ name: string; summary?: string }[]>([]);
  const [analysisEvaluation, setAnalysisEvaluation] = useState<AnalysisEvaluation | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const manualStopRef = useRef(false);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    onDataSummaryChange?.(dataSummary);
  }, [dataSummary, onDataSummaryChange]);

  useEffect(() => {
    fetchAnalysisEvaluation();
  }, []);

  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
    };
  }, []);

  const fetchAnalysisEvaluation = async () => {
    try {
      const user = getCurrentUser();
      const tenantId = user?.id || "demo-tenant";
      const res = await fetch(`/api/tenants/${tenantId}/analysis/evaluation`);
      const data = await res.json();
      if (res.ok && data?.evaluation) {
        setAnalysisEvaluation(data.evaluation as AnalysisEvaluation);
      }
    } catch {
      // 评估指标拉取失败不阻塞主流程
    }
  };

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
    // 将最新的大屏 sections 作为上下文传给后端，便于 AI 增量生成
    const dashboardContext = lastDashboardSections.length > 0 ? { sections: lastDashboardSections } : undefined;
    const assistantMsgId = crypto.randomUUID();

    const createAlertFromResponse = async (rawContent: string) => {
      const alertRegex = /```alert_config\s*\n([\s\S]*?)\n```/;
      const alertMatch = alertRegex.exec(rawContent);
      if (!alertMatch) return false;

      try {
        const alertConfig = JSON.parse(alertMatch[1]);
        const user = getCurrentUser();
        const tenantId = user?.id || "demo-tenant";
        const alertRes = await fetch(`/api/tenants/${tenantId}/alerts`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(alertConfig),
        });
        if (!alertRes.ok) return false;

        const created = await alertRes.json();
        const cleanContent = rawContent.replace(alertRegex, "").trim();
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantMsgId
              ? { ...m, content: cleanContent + `\n\n[check] 告警规则「${created.name}」已自动创建，可在 [智能告警](/alerts) 页面查看和管理。` }
              : m
          )
        );
        return true;
      } catch {
        return false;
      }
    };

    const createNotificationRuleFromResponse = async (rawContent: string) => {
      const notificationRegex = /```notification_rule\s*\n([\s\S]*?)\n```/;
      const notificationMatch = notificationRegex.exec(rawContent);
      if (!notificationMatch) return false;

      try {
        const ruleConfig = JSON.parse(notificationMatch[1]);
        const user = getCurrentUser();
        const tenantId = user?.id || "demo-tenant";
        const ruleRes = await fetch(`/api/tenants/${tenantId}/notification-rules`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(ruleConfig),
        });
        if (!ruleRes.ok) return false;

        const created = await ruleRes.json();
        const cleanContent = rawContent.replace(notificationRegex, "").trim();
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantMsgId
              ? {
                  ...m,
                  content:
                    cleanContent +
                    `\n\n[check] 智能通知规则「${created.name}」已自动创建！\n\n**配置详情**：\n- 触发条件：${formatCondition(created.conditionType)} ${created.threshold}\n- 时间范围：${formatTimeRange(created.timeRange)}\n- 通知频率：${formatFrequency(created.frequency)}\n\n你可以在对话中继续调整规则，或说"查看通知规则"来管理。`,
                }
              : m
          )
        );
        return true;
      } catch (err) {
        console.error("创建通知规则失败:", err);
        return false;
      }
    };

    const createReportFromResponse = async (rawContent: string) => {
      const reportRegex = /```report_config\s*\n([\s\S]*?)\n```/;
      const reportMatch = reportRegex.exec(rawContent);
      if (!reportMatch) return false;

      try {
        const reportConfig = JSON.parse(reportMatch[1]);
        const user = getCurrentUser();
        const tenantId = user?.id || "demo-tenant";

        const created = await request<Report>(
          `/tenants/${tenantId}/reports`,
          {
            method: "POST",
            body: JSON.stringify({
              title: reportConfig.title || "AI 生成报表",
              description: reportConfig.description || "",
              type: reportConfig.type || "custom",
              category: reportConfig.category || "custom",
              aiGenerated: true,
              sections: (reportConfig.sections || []).map((s: any, i: number) => ({
                type: s.type || "kpi",
                title: s.title || "",
                colSpan: s.colSpan || 12,
                rowSpan: s.rowSpan || 1,
                sortOrder: i,
                dataConfig: s.dataConfig || s.data || {},
              })),
            }),
          }
        );

        const cleanContent = rawContent.replace(reportRegex, "").trim();

        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantMsgId
              ? {
                  ...m,
                  content:
                    cleanContent +
                    `\n\n报表「${created.title}」已自动创建！包含 ${created.sections?.length || 0} 个图表区块。\n\n你可以在 [我的报表](/reports/${created.id}) 页面查看和编辑。`,
                }
              : m
          )
        );
        return true;
      } catch (err) {
        console.error("创建报表失败:", err);
        return false;
      }
    };

    const createDataSourceFromResponse = async (rawContent: string) => {
      const dsRegex = /```datasource_config\s*\n([\s\S]*?)\n```/;
      const dsMatch = dsRegex.exec(rawContent);
      if (!dsMatch) return false;

      try {
        const dsConfig = JSON.parse(dsMatch[1]);
        const user = getCurrentUser();
        const tenantId = user?.id || "demo-tenant";
        const token = getAccessToken();
        const headers: Record<string, string> = { "Content-Type": "application/json" };
        if (token) headers["Authorization"] = `Bearer ${token}`;

        const dsRes = await fetch(`/api/tenants/${tenantId}/data-sources`, {
          method: "POST",
          headers,
          body: JSON.stringify(dsConfig),
        });

        const cleanContent = rawContent.replace(dsRegex, "").trim();

        if (!dsRes.ok) {
          const errData = await dsRes.json().catch(() => null);
          const errMsg = errData?.error || `HTTP ${dsRes.status}`;
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantMsgId
                ? { ...m, content: cleanContent + `\n\n**数据源配置失败**：${errMsg}\n\n请检查连接信息是否正确，或前往 [数据源管理](/settings/data-sources) 页面手动配置。` }
                : m
            )
          );
          return false;
        }

        const created = await dsRes.json();
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantMsgId
              ? {
                  ...m,
                  content:
                    cleanContent +
                    `\n\n数据源「${created.name || dsConfig.name}」已自动配置成功！\n\n` +
                    `**连接详情**：\n` +
                    `- 类型：${(dsConfig.type || "").toUpperCase()}\n` +
                    `- 主机：${dsConfig.connection?.host}:${dsConfig.connection?.port}\n` +
                    `- 数据库：${dsConfig.connection?.database}\n` +
                    `- 状态：已连接\n\n` +
                    `你可以前往 [数据源管理](/settings/data-sources) 页面查看详情，或直接开始数据分析。`,
                }
              : m
          )
        );
        return true;
      } catch (err) {
        console.error("创建数据源失败:", err);
        return false;
      }
    };

    setLoading(true);
    const abortController = new AbortController();
    abortControllerRef.current = abortController;
    manualStopRef.current = false;

    // 先追加用户消息和空的 assistant 占位
    setMessages((prev) => [
      ...prev,
      ...(appendUser && input.trim()
        ? [
            {
              id: crypto.randomUUID(),
              role: "user" as const,
              content: input.trim(),
              timestamp: Date.now(),
            },
          ]
        : []),
      {
        id: assistantMsgId,
        role: "assistant" as const,
        content: "",
        timestamp: Date.now(),
      },
    ]);
    setInput("");

    try {
      const token = getAccessToken();
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (token) {
        headers.Authorization = `Bearer ${token}`;
      }
      const res = await fetch("/api/chat", {
        method: "POST",
        headers,
        signal: abortController.signal,
          body: JSON.stringify({
            messages: msgList,
            dataSummary: dataSummary || undefined,
            dashboardData: draftData,
            dashboardContext,
            companyProfile,
          }),
        });


      const contentType = res.headers.get("content-type") || "";

      if (!res.ok) {
        let errText = `请求失败：${res.status}`;
        if (contentType.includes("application/json")) {
          const data = await res.json();
          errText = data.error || data.content || errText;
        }
        throw new Error(errText);
      }

      // 兼容非流式（demo 模式）
      if (contentType.includes("application/json")) {
        const data = await res.json();
        const content = data.content || data.error || "无回复";
        if (data?.analysis?.evaluation) {
          setAnalysisEvaluation(data.analysis.evaluation as AnalysisEvaluation);
        }
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantMsgId ? { ...m, content } : m
          )
        );
        await createAlertFromResponse(content);
        await createNotificationRuleFromResponse(content);
        await createReportFromResponse(content);
        await createDataSourceFromResponse(content);
        return;
      }

      // 流式读取
      const reader = res.body?.getReader();
      if (!reader) throw new Error("无法读取响应流");
      const decoder = new TextDecoder();
      let buffer = "";
      let fullContent = "";

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let idx;
        while ((idx = buffer.indexOf("\n\n")) !== -1) {
          const raw = buffer.slice(0, idx).trim();
          buffer = buffer.slice(idx + 2);
          if (!raw.startsWith("data:")) continue;
          const jsonStr = raw.replace(/^data:\s*/, "");
          if (!jsonStr) continue;
          const evt = JSON.parse(jsonStr) as
            | { type: "delta"; content: string }
            | { type: "meta"; analysis?: any; model?: string }
            | { type: "done" }
            | { type: "error"; error?: string };

          if (evt.type === "delta") {
            fullContent += evt.content || "";
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantMsgId
                  ? { ...m, content: fullContent }
                  : m
              )
            );
          } else if (evt.type === "meta") {
            const meta = evt as { analysis?: { evaluation?: AnalysisEvaluation } };
            if (meta.analysis?.evaluation) {
              setAnalysisEvaluation(meta.analysis.evaluation);
            } else {
              await fetchAnalysisEvaluation();
            }
          } else if (evt.type === "error") {
            throw new Error(evt.error || "流式响应错误");
          }
        }
      }

      // 流式完成后处理告警/通知规则/报表/数据源配置
      if (fullContent) {
        await createAlertFromResponse(fullContent);
        await createNotificationRuleFromResponse(fullContent);
        await createReportFromResponse(fullContent);
        await createDataSourceFromResponse(fullContent);
      }
    } catch (err) {
      const isManualAbort = manualStopRef.current || (err instanceof DOMException && err.name === "AbortError");
      if (isManualAbort) {
        setMessages((prev) =>
          prev.map((m) => {
            if (m.id !== assistantMsgId) return m;
            const content = m.content.trim();
            return {
              ...m,
              content: content ? `${content}\n\n[已手动中断生成]` : "已手动中断本次生成。",
            };
          })
        );
        return;
      }
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantMsgId
            ? {
                ...m,
                content: `请求失败：${err instanceof Error ? err.message : "网络错误"}`,
              }
            : m
        )
      );
    } finally {
      abortControllerRef.current = null;
      manualStopRef.current = false;
      setLoading(false);
    }
  };

  const handleStopGeneration = () => {
    if (!loading || !abortControllerRef.current) return;
    manualStopRef.current = true;
    abortControllerRef.current.abort();
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

  const handleGenerateDashboard = async () => {
    const template =
      DASHBOARD_TEMPLATES.find((t) => t.id === selectedTemplate) || DASHBOARD_TEMPLATES[0];
    if (!template) return;
    try {
      const saved = await createDashboardInstance({
        title: dashboardTitle || template.name,
        templateId: template.id,
        sections: template.sections || [],
      });
      router.push(`/dashboards?id=${saved.id}`);
    } catch (err) {
      console.error("保存大屏失败", err);
    }
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
  const trendItems = analysisEvaluation?.recentTrend || [];
  const successWindow = buildRollingRate(trendItems.map((item) => item.success), 5);
  const clarificationWindow = buildRollingRate(trendItems.map((item) => item.hadClarification), 5);
  const successPolyline = buildSparklinePoints(successWindow);
  const clarificationPolyline = buildSparklinePoints(clarificationWindow);
  const latestAssistantMessage = [...messages].reverse().find((m) => m.role === "assistant");
  const showThinkingIndicator = loading && !latestAssistantMessage?.content.trim();

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
        <div className="flex-1 min-w-0 overflow-y-auto overflow-x-hidden p-6 space-y-4">
          {messages.map((m) => (
            <div key={m.id} className={`flex min-w-0 ${m.role === "user" ? "justify-end" : "justify-start"} animate-fade-in`}>
              <div className={`w-fit min-w-0 max-w-[80%] overflow-hidden rounded-2xl px-4 py-3 ${
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
                {m.role === "user" ? (
                  <pre className="whitespace-pre-wrap break-words font-sans text-sm leading-relaxed">{m.content}</pre>
                ) : (
                  <>
                    <div className="prose-chat prose-invert max-w-full min-w-0 overflow-x-auto text-sm leading-relaxed">
                     <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeHighlight]}>
                         {removeDashboardConfigBlock(m.content)}
                       </ReactMarkdown>
                     </div>
                    <InlineDashboardPreview
                      content={m.content}
                      onSave={async (payload) => {
                        try {
                          const saved = await createDashboardInstance({
                            title: payload.title || dashboardTitle,
                            sections: payload.sections,
                          });
                          setLastDashboardSections(payload.sections);
                          setMessages((prev) =>
                            prev.map((x) =>
                              x.id === m.id
                                ? {
                                    ...x,
                                    content:
                                      removeDashboardConfigBlock(x.content) +
                                      `\n\n[check] 大屏「${saved.title}」已保存，可前往 /dashboards?id=${saved.id} 查看。`,
                                  }
                                : x
                            )
                          );
                        } catch (err) {
                          setMessages((prev) =>
                            prev.map((x) =>
                              x.id === m.id
                                ? {
                                    ...x,
                                    content:
                                      removeDashboardConfigBlock(x.content) +
                                      `\n\n[error] 保存大屏失败：${err instanceof Error ? err.message : "未知错误"}`,
                                  }
                                : x
                            )
                          );
                        }
                      }}
                    />
                   </>
                 )}

              </div>
            </div>
          ))}
          {showThinkingIndicator && (
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
          {analysisEvaluation && (
            <div>
              <h3 className="text-xs font-medium text-zinc-500 uppercase tracking-wider mb-2">分析质量</h3>
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-lg border border-zinc-800/70 p-2 bg-zinc-900/40">
                  <div className="text-[11px] text-zinc-500">查询成功率</div>
                  <div className="text-sm text-zinc-300">{analysisEvaluation.querySuccessRate}%</div>
                </div>
                <div className="rounded-lg border border-zinc-800/70 p-2 bg-zinc-900/40">
                  <div className="text-[11px] text-zinc-500">澄清率</div>
                  <div className="text-sm text-zinc-300">{analysisEvaluation.clarificationRate}%</div>
                </div>
                <div className="rounded-lg border border-zinc-800/70 p-2 bg-zinc-900/40">
                  <div className="text-[11px] text-zinc-500">平均响应</div>
                  <div className="text-sm text-zinc-300">{analysisEvaluation.avgResponseMs}ms</div>
                </div>
                <div className="rounded-lg border border-zinc-800/70 p-2 bg-zinc-900/40">
                  <div className="text-[11px] text-zinc-500">总查询数</div>
                  <div className="text-sm text-zinc-300">{analysisEvaluation.totalQueries}</div>
                </div>
              </div>
              <div className="mt-2 text-[11px] text-zinc-500">
                置信度分布：高 {analysisEvaluation.confidenceDistribution.high} / 中 {analysisEvaluation.confidenceDistribution.medium} / 低 {analysisEvaluation.confidenceDistribution.low}
              </div>
              {trendItems.length > 0 && (
                <div className="mt-3 rounded-lg border border-zinc-800/70 p-2 bg-zinc-900/40">
                  <div className="text-[11px] text-zinc-500 mb-1">最近 {trendItems.length} 次趋势</div>
                  <svg viewBox="0 0 240 56" className="w-full h-14">
                    <polyline
                      points={successPolyline}
                      fill="none"
                      stroke="rgb(16,185,129)"
                      strokeWidth="2"
                      strokeLinecap="round"
                    />
                    <polyline
                      points={clarificationPolyline}
                      fill="none"
                      stroke="rgb(99,102,241)"
                      strokeWidth="2"
                      strokeDasharray="4 3"
                      strokeLinecap="round"
                    />
                  </svg>
                  <div className="mt-1 flex items-center gap-3 text-[10px] text-zinc-500">
                    <span className="inline-flex items-center gap-1">
                      <span className="w-2 h-0.5 bg-emerald-500 inline-block" />成功率(5次窗口)
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <span className="w-2 h-0.5 bg-indigo-500 inline-block" />澄清率(5次窗口)
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}

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
          {loading ? (
            <button onClick={handleStopGeneration}
              className="shrink-0 p-2.5 rounded-xl bg-rose-500/90 hover:bg-rose-500 text-white transition-all duration-200 shadow-lg shadow-rose-500/20"
              title="停止生成">
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                <rect x="6.5" y="6.5" width="11" height="11" rx="2.5" />
              </svg>
            </button>
          ) : (
            <button onClick={handleSend} disabled={!input.trim()}
              className="shrink-0 btn-primary disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 12 3.269 3.125A59.769 59.769 0 0 1 21.485 12 59.768 59.768 0 0 1 3.27 20.875L5.999 12Zm0 0h7.5" />
              </svg>
            </button>
          )}
        </div>
        <div className="max-w-4xl mx-auto mt-2 text-xs text-zinc-500">
          {loading ? "正在生成回答，你可以随时手动中断。" : '提示：可以说 "当今日销售额超过 1000 时，发钉钉通知我" 来创建智能通知规则'}
        </div>
      </div>
    </div>
  );
}
