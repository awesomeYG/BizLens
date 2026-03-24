"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { getCurrentUser } from "@/lib/user-store";
import { getAccessToken } from "@/lib/auth/api";

const MODEL_OPTIONS = [
  { value: "openai", label: "OpenAI", models: ["gpt-4o-mini", "gpt-4o", "gpt-4-turbo"], color: "emerald", desc: "GPT 系列，综合能力强" },
  { value: "claude", label: "Anthropic Claude", models: ["claude-3-sonnet-20240229", "claude-3-opus-20240229"], color: "amber", desc: "擅长长文本与推理" },
  { value: "qwen", label: "通义千问", models: ["qwen-plus", "qwen-max"], color: "sky", desc: "阿里云，国内直连" },
  { value: "ernie", label: "文心一言", models: ["ernie-bot-4"], color: "blue", desc: "百度，中文理解优秀" },
  { value: "deepseek", label: "DeepSeek", models: ["deepseek-chat", "deepseek-coder"], color: "violet", desc: "高性价比，代码能力强" },
  { value: "minmax", label: "Minimax", models: ["abab6.5-chat", "abab5.5-chat"], color: "orange", desc: "国产多模态大模型" },
];

const COLOR_MAP: Record<string, { dot: string; activeBg: string; activeBorder: string; activeText: string }> = {
  emerald:  { dot: "bg-emerald-400", activeBg: "bg-emerald-500/10", activeBorder: "border-emerald-500/30", activeText: "text-emerald-400" },
  amber:    { dot: "bg-amber-400",   activeBg: "bg-amber-500/10",   activeBorder: "border-amber-500/30",   activeText: "text-amber-400" },
  sky:      { dot: "bg-sky-400",     activeBg: "bg-sky-500/10",     activeBorder: "border-sky-500/30",     activeText: "text-sky-400" },
  blue:     { dot: "bg-blue-400",    activeBg: "bg-blue-500/10",    activeBorder: "border-blue-500/30",    activeText: "text-blue-400" },
  violet:   { dot: "bg-violet-400",  activeBg: "bg-violet-500/10",  activeBorder: "border-violet-500/30",  activeText: "text-violet-400" },
  orange:   { dot: "bg-orange-400",  activeBg: "bg-orange-500/10",  activeBorder: "border-orange-500/30",  activeText: "text-orange-400" },
};

export default function SettingsPage() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [loadingConfig, setLoadingConfig] = useState(true);
  
  // AI 配置
  const [aiConfig, setAiConfig] = useState({
    apiKey: "",
    baseUrl: "",
    modelType: "openai",
    model: "gpt-4o-mini",
  });
  
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [serverHasApiKey, setServerHasApiKey] = useState(false);
  const [maskedApiKey, setMaskedApiKey] = useState("");
  const [showApiKey, setShowApiKey] = useState(false);
  const [providerOpen, setProviderOpen] = useState(false);
  const [modelOpen, setModelOpen] = useState(false);
  const providerRef = useRef<HTMLDivElement>(null);
  const modelRef = useRef<HTMLDivElement>(null);

  const buildAuthHeaders = (withJsonContentType = true): HeadersInit => {
    const headers: Record<string, string> = {};
    if (withJsonContentType) {
      headers["Content-Type"] = "application/json";
    }
    const token = getAccessToken();
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }
    return headers;
  };

  // 点击外部关闭下拉
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (providerRef.current && !providerRef.current.contains(e.target as Node)) {
        setProviderOpen(false);
      }
      if (modelRef.current && !modelRef.current.contains(e.target as Node)) {
        setModelOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    const loadConfig = async () => {
      const currentUser = getCurrentUser();
      setUser(currentUser);
      const tenantId = currentUser?.id || "demo-tenant";

      try {
        const response = await fetch(`/api/tenants/${tenantId}/ai-config`, {
          method: "GET",
          headers: buildAuthHeaders(),
        });
        const result = await response.json();
        if (!response.ok) {
          throw new Error(result?.error || "加载服务端配置失败");
        }

        setAiConfig((prev) => ({
          ...prev,
          apiKey: "",
          baseUrl: result.baseUrl || "",
          modelType: result.modelType || prev.modelType,
          model: result.model || prev.model,
        }));
        setServerHasApiKey(Boolean(result.hasApiKey));
        setMaskedApiKey(result.maskedApiKey || "");
      } catch (err) {
        setSaveError(err instanceof Error ? err.message : "加载服务端配置失败");
      } finally {
        setLoadingConfig(false);
        setLoading(false);
      }
    };

    void loadConfig();
  }, []);

  const handleSave = async () => {
    const tenantId = user?.id || "demo-tenant";
    setSaveError(null);

    try {
      const response = await fetch(`/api/tenants/${tenantId}/ai-config`, {
        method: "PUT",
        headers: buildAuthHeaders(),
        body: JSON.stringify({
          apiKey: aiConfig.apiKey.trim(),
          baseUrl: aiConfig.baseUrl.trim(),
          modelType: aiConfig.modelType,
          model: aiConfig.model,
        }),
      });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result?.error || "保存失败");
      }

      setServerHasApiKey(Boolean(result.hasApiKey));
      setMaskedApiKey(result.maskedApiKey || "");
      setAiConfig((prev) => ({ ...prev, apiKey: "" }));
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "保存失败");
    }
  };

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    
    try {
      const testAiConfig = {
        apiKey: aiConfig.apiKey.trim(),
        baseUrl: aiConfig.baseUrl.trim(),
        modelType: aiConfig.modelType,
        model: aiConfig.model,
      };

      const response = await fetch("/api/chat", {
        method: "POST",
        headers: buildAuthHeaders(),
        body: JSON.stringify({
          messages: [{ role: "user", content: "Hello, this is a test." }],
          tenantId: user?.id || "demo-tenant",
          aiConfig: testAiConfig,
        }),
      });
      const contentType = response.headers.get("content-type") || "";

      if (!response.ok) {
        let errText = `请求失败：${response.status}`;
        if (contentType.includes("application/json")) {
          const result = await response.json().catch(() => ({}));
          errText = (result as { error?: string; content?: string }).error || (result as { error?: string; content?: string }).content || errText;
        }
        throw new Error(errText);
      }

      if (contentType.includes("application/json")) {
        const result = await response.json();
        setTestResult({
          success: true,
          message: `连接成功！模型：${result.model || "AI"}，使用 tokens: ${result.usage?.total_tokens || "N/A"}`,
        });
        return;
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error("无法读取响应流");
      }
      const decoder = new TextDecoder();
      let buffer = "";
      let fullContent = "";
      let model = "AI";

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
            | { type: "meta"; model?: string }
            | { type: "delta"; content?: string }
            | { type: "error"; error?: string }
            | { type: "done" };

          if (evt.type === "meta" && evt.model) {
            model = evt.model;
          } else if (evt.type === "delta") {
            fullContent += evt.content || "";
          } else if (evt.type === "error") {
            throw new Error(evt.error || "流式响应错误");
          }
        }
      }

      const streamInfo = fullContent ? `，返回长度: ${fullContent.length} 字符` : "";
      setTestResult({
        success: true,
        message: `连接成功！模型：${model}${streamInfo}`,
      });
    } catch (err: any) {
      setTestResult({
        success: false,
        message: `请求失败：${err.message}`,
      });
    } finally {
      setTesting(false);
    }
  };

  const handleModelTypeChange = (type: string) => {
    const option = MODEL_OPTIONS.find((o) => o.value === type);
    setAiConfig({
      ...aiConfig,
      modelType: type,
      model: option?.models[0] || "",
    });
  };

  const currentProvider = MODEL_OPTIONS.find((option) => option.value === aiConfig.modelType);
  const setupProgress = Math.round(
    ([(aiConfig.apiKey || (serverHasApiKey ? "configured" : "")), aiConfig.model].filter((item) => item.trim().length > 0).length / 2) * 100,
  );

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-2 border-zinc-700 border-t-indigo-500"></div>
      </div>
    );
  }

  const getApiKeyLink = () => {
    const links: Record<string, { url: string; label: string }> = {
      openai: { url: "https://platform.openai.com/api-keys", label: "OpenAI 平台" },
      claude: { url: "https://console.anthropic.com/settings/keys", label: "Anthropic 控制台" },
      qwen: { url: "https://bailian.console.aliyun.com/", label: "阿里云百炼平台" },
      ernie: { url: "https://console.bce.baidu.com/qianfan/", label: "百度智能云千帆平台" },
      deepseek: { url: "https://platform.deepseek.com/api_keys", label: "DeepSeek 控制台" },
      minmax: { url: "https://www.minimaxi.com/platform/api-key", label: "Minimax 平台" },
    };
    return links[aiConfig.modelType] || links.openai;
  };

  return (
    <div className="mx-auto max-w-4xl animate-fade-in">
      {/* 统计概览 */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="glass-card rounded-xl p-5 text-center">
          <div className="text-3xl font-bold text-indigo-400 tracking-tight">{setupProgress}%</div>
          <div className="text-xs text-zinc-500 mt-1">配置进度</div>
          <div className="mt-3 h-1.5 rounded-full bg-zinc-800">
            <div className="h-1.5 rounded-full bg-indigo-500 transition-all" style={{ width: `${setupProgress}%` }}></div>
          </div>
        </div>
        <div className="glass-card rounded-xl p-5 text-center">
          <div className="text-3xl font-bold text-emerald-400 tracking-tight">{currentProvider?.label || "-"}</div>
          <div className="text-xs text-zinc-500 mt-1">当前服务商</div>
          <div className="text-xs text-zinc-600 mt-1">可选模型 {currentProvider?.models.length || 0} 个</div>
        </div>
        <div className="glass-card rounded-xl p-5 text-center">
          <div className={`text-3xl font-bold tracking-tight ${(aiConfig.apiKey || serverHasApiKey) ? "text-emerald-400" : "text-amber-400"}`}>
            {aiConfig.apiKey || serverHasApiKey ? "已配置" : "待配置"}
          </div>
          <div className="text-xs text-zinc-500 mt-1">安全状态</div>
          <div className="text-xs text-zinc-600 mt-1">API Key 存储在服务器端</div>
        </div>
      </div>

      <div className="space-y-5">
        {/* 模型服务商选择 */}
        <div className={`glass-card rounded-xl p-5 relative ${providerOpen ? "z-40" : ""}`}>
          <div className="flex items-center gap-3 mb-4">
            <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-indigo-500/15 text-indigo-400">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-zinc-200">选择模型服务商</h3>
              <p className="text-xs text-zinc-500">点击选择 AI 服务商</p>
            </div>
          </div>

          <div className="space-y-3">
            <label className="block text-xs font-medium text-zinc-400 mb-2">
              模型服务商
            </label>
            {/* 自定义服务商选择器 */}
            <div ref={providerRef} className="relative">
              <button
                type="button"
                onClick={() => { setProviderOpen(!providerOpen); setModelOpen(false); }}
                className="w-full flex items-center justify-between rounded-xl bg-zinc-900/80 border border-zinc-700/50 px-4 py-2.5 text-left transition-all hover:border-zinc-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500/50"
              >
                <div className="flex items-center gap-3">
                  <span className={`w-2.5 h-2.5 rounded-full ${COLOR_MAP[currentProvider?.color || "emerald"]?.dot}`}></span>
                  <div>
                    <span className="text-sm text-zinc-100">{currentProvider?.label}</span>
                    <span className="ml-2 text-xs text-zinc-500">{currentProvider?.models.length} 个模型</span>
                  </div>
                </div>
                <svg className={`w-4 h-4 text-zinc-500 transition-transform ${providerOpen ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

                {providerOpen && (
                  <div className="absolute z-50 mt-2 w-full rounded-xl bg-zinc-900 border border-zinc-700/60 shadow-2xl shadow-black/40 overflow-hidden animate-fade-in">
                    <div className="p-1.5 space-y-0.5 max-h-[320px] overflow-y-auto">

                    {MODEL_OPTIONS.map((option) => {
                      const isSelected = aiConfig.modelType === option.value;
                      const colors = COLOR_MAP[option.color];
                      return (
                        <button
                          key={option.value}
                          type="button"
                          onClick={() => { handleModelTypeChange(option.value); setProviderOpen(false); }}
                          className={`w-full flex items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-all ${
                            isSelected
                              ? `${colors.activeBg} ${colors.activeBorder} border`
                              : "border border-transparent hover:bg-white/5"
                          }`}
                        >
                          <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${colors.dot}`}></span>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className={`text-sm font-medium ${isSelected ? colors.activeText : "text-zinc-200"}`}>
                                {option.label}
                              </span>
                              <span className="text-xs text-zinc-600">{option.models.length} 个模型</span>
                            </div>
                            <p className="text-xs text-zinc-500 mt-0.5">{option.desc}</p>
                          </div>
                          {isSelected && (
                            <svg className={`w-4 h-4 flex-shrink-0 ${colors.activeText}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                            </svg>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
            <p className="text-xs text-zinc-600">
              当前可选：{MODEL_OPTIONS.find((o) => o.value === aiConfig.modelType)?.models.join(", ") || "-"}
            </p>
          </div>
        </div>

        {/* API 配置 */}
        <div className={`glass-card rounded-xl p-5 relative ${modelOpen ? "z-40" : ""}`}>
          <div className="flex items-center gap-3 mb-5">
            <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-purple-500/15 text-purple-400">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
              </svg>
            </div>
            <h3 className="text-sm font-semibold text-zinc-200">凭证配置</h3>
          </div>
          
          <div className="space-y-5">
            {/* API Key */}
            <div>
              <label htmlFor="api-key" className="block text-xs font-medium text-zinc-400 mb-2">
                API Key
                <span className="ml-2 text-red-400">*</span>
              </label>
              <div className="relative">
                <input
                  id="api-key"
                  type={showApiKey ? "text" : "password"}
                  value={aiConfig.apiKey}
                  onChange={(e) => setAiConfig({ ...aiConfig, apiKey: e.target.value })}
                  className="input-base pr-20"
                  placeholder={aiConfig.modelType === "openai" ? "sk-..." : "输入你的 API Key"}
                />
                <button
                  type="button"
                  onClick={() => setShowApiKey((prev) => !prev)}
                  className="absolute right-8 top-1/2 -translate-y-1/2 text-xs text-zinc-500 transition hover:text-zinc-300"
                >
                  {showApiKey ? "隐藏" : "显示"}
                </button>
                {aiConfig.apiKey && (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-emerald-500"></div>
                )}
              </div>
              <div className="mt-2 p-3 rounded-lg bg-zinc-900/60 border border-zinc-800/60">
                {serverHasApiKey && !aiConfig.apiKey && (
                  <p className="mb-2 text-xs text-emerald-400">已保存服务端密钥：{maskedApiKey || "********"}</p>
                )}
                <p className="text-xs text-zinc-500">
                  在{" "}
                  <a href={getApiKeyLink().url} target="_blank" rel="noopener noreferrer" className="text-indigo-400 hover:text-indigo-300 underline underline-offset-2">
                    {getApiKeyLink().label}
                  </a>
                  {" "}获取 API Key
                </p>
              </div>
            </div>

            {/* 自定义 Base URL */}
            <div>
              <label htmlFor="api-base-url" className="block text-xs font-medium text-zinc-400 mb-2">
                API Base URL
                <span className="ml-1 text-zinc-600 font-normal">(可选)</span>
              </label>
              <input
                id="api-base-url"
                type="url"
                value={aiConfig.baseUrl}
                onChange={(e) => setAiConfig({ ...aiConfig, baseUrl: e.target.value })}
                className="input-base"
                placeholder="https://api.openai.com/v1 或自定义代理地址"
              />
              <p className="mt-2 text-xs text-zinc-600">
                使用第三方代理服务时填写，留空则使用官方默认地址
              </p>
            </div>

            {/* 模型选择 */}
            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-2">
                选择模型
              </label>
              <div ref={modelRef} className="relative">
                <button
                  type="button"
                  onClick={() => { setModelOpen(!modelOpen); setProviderOpen(false); }}
                  className="w-full flex items-center justify-between rounded-xl bg-zinc-900/80 border border-zinc-700/50 px-4 py-2.5 text-left transition-all hover:border-zinc-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500/50"
                >
                  <span className="text-sm text-zinc-100">{aiConfig.model || "请选择模型"}</span>
                  <svg className={`w-4 h-4 text-zinc-500 transition-transform ${modelOpen ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                {modelOpen && (
                  <div className="absolute z-50 mt-2 w-full rounded-xl bg-zinc-900 border border-zinc-700/60 shadow-2xl shadow-black/40 overflow-hidden animate-fade-in">
                    <div className="p-1.5 space-y-0.5">
                      {MODEL_OPTIONS.find((o) => o.value === aiConfig.modelType)?.models.map((model) => {
                        const isSelected = aiConfig.model === model;
                        return (
                          <button
                            key={model}
                            type="button"
                            onClick={() => { setAiConfig({ ...aiConfig, model }); setModelOpen(false); }}
                            className={`w-full flex items-center justify-between rounded-lg px-3 py-2.5 text-left transition-all ${
                              isSelected
                                ? "bg-indigo-500/10 border border-indigo-500/30"
                                : "border border-transparent hover:bg-white/5"
                            }`}
                          >
                            <span className={`text-sm font-mono ${isSelected ? "text-indigo-400" : "text-zinc-200"}`}>
                              {model}
                            </span>
                            {isSelected && (
                              <svg className="w-4 h-4 text-indigo-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                              </svg>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* 操作按钮 */}
        <div className="glass-card rounded-xl p-5">
          <div className="flex flex-col sm:flex-row gap-3">
            <button
              onClick={handleTest}
              disabled={testing || (!aiConfig.apiKey && !serverHasApiKey)}
              className="btn-secondary inline-flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {testing ? (
                <>
                  <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  测试中...
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                  测试连接
                </>
              )}
            </button>
            
            <button
              onClick={handleSave}
              disabled={loadingConfig || !aiConfig.model || (!aiConfig.apiKey && !serverHasApiKey)}
              className="btn-primary flex-1 inline-flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
              </svg>
              {!aiConfig.apiKey && !serverHasApiKey ? "请先填写 API Key" : "保存配置"}
            </button>
          </div>

          {testResult && (
            <div className={`mt-4 p-4 rounded-xl border ${
              testResult.success
                ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
                : "bg-red-500/10 border-red-500/20 text-red-400"
            }`}>
              <div className="flex items-start gap-3">
                <svg className="w-5 h-5 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                  {testResult.success ? (
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  ) : (
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                  )}
                </svg>
                <div className="flex-1">
                  <p className="font-medium text-sm mb-1">{testResult.success ? '连接成功' : '连接失败'}</p>
                  <p className="text-xs opacity-80">{testResult.message}</p>
                </div>
              </div>
            </div>
          )}

          {saved && (
            <div className="mt-4 p-4 rounded-xl border bg-emerald-500/10 border-emerald-500/20 text-emerald-400">
              <div className="flex items-center gap-2">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                <span className="font-medium text-sm">配置已保存到服务器</span>
              </div>
            </div>
          )}

          {saveError && (
            <div className="mt-4 rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-red-400">
              <p className="text-sm font-medium">{saveError}</p>
            </div>
          )}
        </div>
      </div>

      {/* 底部链接卡片 */}
      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <Link
          href="/settings/files"
          className="glass-card rounded-xl p-5 transition-all hover:border-indigo-500/30 hover-lift"
        >
          <div className="flex items-start gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-500/15 text-indigo-400">
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
            </div>
            <div>
              <p className="font-medium text-sm text-zinc-200">文件管理</p>
              <p className="mt-1 text-xs text-zinc-500">上传和维护 CSV / Excel / JSON 文件，作为 AI 的分析数据源。</p>
            </div>
          </div>
        </Link>
        <div className="glass-card rounded-xl p-5 border-amber-500/20">
          <div className="flex items-start gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-500/15 text-amber-400">
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-medium text-amber-400">安全提示</p>
              <p className="mt-1 text-xs text-zinc-500">API Key 会保存在服务器并按租户隔离，请仅授予最小权限并定期轮换。</p>
            </div>
          </div>
        </div>
      </div>

      {/* 使用说明 */}
      <div className="mt-6 glass-card rounded-xl p-5 border-indigo-500/20">
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-indigo-500/15 flex items-center justify-center">
            <svg className="w-4 h-4 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div className="flex-1">
            <h3 className="text-sm font-semibold text-zinc-200 mb-3">使用说明</h3>
            <ul className="space-y-2 text-xs text-zinc-500">
              <li className="flex items-start gap-2">
                <span className="text-indigo-500 mt-0.5">--</span>
                <span>配置信息会持久化到服务器并按租户隔离，换设备登录后可直接复用</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-indigo-500 mt-0.5">--</span>
                <span>如果不修改 API Key，保存时会沿用服务器中已有密钥，不会清空</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-indigo-500 mt-0.5">--</span>
                <span>OpenAI 推荐使用 <strong className="text-zinc-400">gpt-4o-mini</strong>，国内网络可优先尝试通义千问或文心一言</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-indigo-500 mt-0.5">--</span>
                <span>配置完成后，可在 AI 对话功能中使用真实数据进行智能分析</span>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
