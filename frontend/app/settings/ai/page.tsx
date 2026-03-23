"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { getCurrentUser } from "@/lib/user-store";

const MODEL_OPTIONS = [
  { value: "openai", label: "OpenAI", models: ["gpt-4o-mini", "gpt-4o", "gpt-4-turbo"], icon: "🤖" },
  { value: "claude", label: "Anthropic Claude", models: ["claude-3-sonnet-20240229", "claude-3-opus-20240229"], icon: "🧠" },
  { value: "qwen", label: "通义千问", models: ["qwen-plus", "qwen-max"], icon: "🔮" },
  { value: "ernie", label: "文心一言", models: ["ernie-bot-4"], icon: "📚" },
];

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

  useEffect(() => {
    const loadConfig = async () => {
      const currentUser = getCurrentUser();
      setUser(currentUser);
      const tenantId = currentUser?.id || "demo-tenant";

      try {
        const response = await fetch(`/api/tenants/${tenantId}/ai-config`, {
          method: "GET",
          headers: { "Content-Type": "application/json" },
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
        headers: { "Content-Type": "application/json" },
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
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [{ role: "user", content: "Hello, this is a test." }],
          tenantId: user?.id || "demo-tenant",
        }),
      });

      const result = await response.json();
      
      if (response.ok) {
        setTestResult({
          success: true,
          message: `连接成功！模型：${result.model || "AI"}，使用 tokens: ${result.usage?.total_tokens || "N/A"}`,
        });
      } else {
        setTestResult({
          success: false,
          message: `测试失败：${result.error}`,
        });
      }
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
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div>
      <main className="mx-auto max-w-5xl py-2">
        {/* 页面标题 */}
        <div className="mb-8 rounded-3xl border border-slate-200 bg-white/90 p-6 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="inline-flex items-center rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700">
                AI 服务配置
              </div>
              <h2 className="mt-4 text-3xl font-bold text-slate-900">让模型能力稳定可用</h2>
              <p className="mt-2 text-slate-600">配置 AI 服务商、模型和 API 参数，后续在对话分析里会直接使用。</p>
            </div>
            <div className="rounded-2xl border border-indigo-200 bg-indigo-50 p-4 text-sm text-indigo-700">
              <p className="font-semibold">当前用户</p>
              <p className="mt-1 text-indigo-600">{user?.name || user?.email || "本地会话用户"}</p>
            </div>
          </div>
        </div>

        <div className="mb-6 grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl border border-slate-200 bg-white/90 p-4 shadow-sm">
            <p className="text-xs tracking-wide text-slate-500">配置进度</p>
            <p className="mt-2 text-2xl font-semibold text-slate-900">{setupProgress}%</p>
            <div className="mt-2 h-2 rounded-full bg-slate-200">
              <div className="h-2 rounded-full bg-blue-600 transition-all" style={{ width: `${setupProgress}%` }}></div>
            </div>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white/90 p-4 shadow-sm">
            <p className="text-xs tracking-wide text-slate-500">当前服务商</p>
            <p className="mt-2 text-2xl font-semibold text-slate-900">{currentProvider?.label || "-"}</p>
            <p className="mt-1 text-xs text-slate-500">可选模型 {currentProvider?.models.length || 0} 个</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white/90 p-4 shadow-sm">
            <p className="text-xs tracking-wide text-slate-500">安全状态</p>
            <p className="mt-2 text-2xl font-semibold text-slate-900">{aiConfig.apiKey || serverHasApiKey ? "已配置" : "待配置"}</p>
            <p className="mt-1 text-xs text-slate-500">API Key 存储在服务器，仅返回脱敏信息</p>
          </div>
        </div>

        <div className="space-y-6">
          {/* 模型服务商选择 */}
          <div className="rounded-2xl border border-slate-200 bg-white/90 p-6 shadow-sm">
            <div className="flex items-center gap-2 mb-5">
              <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-blue-100 text-blue-600">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-gray-900">选择模型服务商</h3>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {MODEL_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => handleModelTypeChange(option.value)}
                  className={`group relative p-4 rounded-xl border-2 text-left transition-all duration-200 hover:shadow-md ${
                    aiConfig.modelType === option.value
                      ? "border-blue-500 bg-blue-50/50 shadow-sm"
                      : "border-gray-200 hover:border-gray-300 bg-white"
                  }`}
                >
                  {aiConfig.modelType === option.value && (
                    <div className="absolute top-3 right-3 w-5 h-5 rounded-full bg-blue-500 flex items-center justify-center">
                      <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    </div>
                  )}
                  <div className="flex items-start gap-3">
                    <span className="text-3xl flex-shrink-0">{option.icon}</span>
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-gray-900 mb-1">{option.label}</div>
                      <div className="flex items-center gap-2 text-xs text-gray-500">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-gray-100">
                          {option.models.length} 个模型
                        </span>
                      </div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* API 配置 */}
          <div className="rounded-2xl border border-slate-200 bg-white/90 p-6 shadow-sm">
            <div className="flex items-center gap-2 mb-5">
              <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-purple-100 text-purple-600">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-gray-900">凭证配置</h3>
            </div>
            
            <div className="space-y-5">
              {/* API Key */}
              <div>
                <label htmlFor="api-key" className="block text-sm font-medium text-gray-700 mb-2">
                  API Key
                  {" "}
                  <span className="ml-2 text-red-500">*</span>
                </label>
                <div className="relative">
                  <input
                    id="api-key"
                    type={showApiKey ? "text" : "password"}
                    value={aiConfig.apiKey}
                    onChange={(e) => setAiConfig({ ...aiConfig, apiKey: e.target.value })}
                    className="w-full rounded-xl border border-gray-300 py-3 pl-4 pr-20 text-sm transition-all focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
                    placeholder={aiConfig.modelType === "openai" ? "sk-..." : "输入你的 API Key"}
                  />
                  <button
                    type="button"
                    onClick={() => setShowApiKey((prev) => !prev)}
                    className="absolute right-8 top-1/2 -translate-y-1/2 text-xs text-slate-500 transition hover:text-slate-800"
                  >
                    {showApiKey ? "隐藏" : "显示"}
                  </button>
                  {aiConfig.apiKey && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-green-500"></div>
                  )}
                </div>
                <div className="mt-2 p-3 rounded-lg bg-gray-50 border border-gray-100">
                  {serverHasApiKey && !aiConfig.apiKey && (
                    <p className="mb-2 text-xs text-emerald-700">已保存服务端密钥：{maskedApiKey || "********"}</p>
                  )}
                  <p className="text-xs text-gray-600">
                    {aiConfig.modelType === "openai" && (
                      <span>在 <a href="https://platform.openai.com/api-keys" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">OpenAI 平台</a> 获取 API Key</span>
                    )}
                    {aiConfig.modelType === "claude" && (
                      <span>在 <a href="https://console.anthropic.com/settings/keys" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">Anthropic 控制台</a> 获取 API Key</span>
                    )}
                    {aiConfig.modelType === "qwen" && (
                      <span>在 <a href="https://bailian.console.aliyun.com/" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">阿里云百炼平台</a> 获取 API Key</span>
                    )}
                    {aiConfig.modelType === "ernie" && (
                      <span>在 <a href="https://console.bce.baidu.com/qianfan/" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">百度智能云千帆平台</a> 获取 API Key</span>
                    )}
                  </p>
                </div>
              </div>

              {/* 自定义 Base URL */}
              <div>
                <label htmlFor="api-base-url" className="block text-sm font-medium text-gray-700 mb-2">
                  API Base URL
                  {" "}
                  <span className="ml-1 text-gray-400 font-normal">(可选)</span>
                </label>
                <input
                  id="api-base-url"
                  type="url"
                  value={aiConfig.baseUrl}
                  onChange={(e) => setAiConfig({ ...aiConfig, baseUrl: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all text-sm"
                  placeholder="https://api.openai.com/v1"
                />
                <p className="mt-2 text-xs text-gray-500">
                  使用第三方代理服务时填写，留空则使用官方默认地址
                </p>
              </div>

              {/* 模型选择 */}
              <div>
                <label htmlFor="model-select" className="block text-sm font-medium text-gray-700 mb-2">
                  选择模型
                </label>
                <div className="relative">
                  <select
                    id="model-select"
                    value={aiConfig.model}
                    onChange={(e) => setAiConfig({ ...aiConfig, model: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all text-sm appearance-none bg-white cursor-pointer"
                  >
                    {MODEL_OPTIONS.find((o) => o.value === aiConfig.modelType)?.models.map((model) => (
                      <option key={model} value={model}>
                        {model}
                      </option>
                    ))}
                  </select>
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                    <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* 操作按钮 */}
          <div className="rounded-2xl border border-slate-200 bg-white/90 p-6 shadow-sm">
            <div className="flex flex-col sm:flex-row gap-3">
              <button
                onClick={handleTest}
                disabled={testing || (!aiConfig.apiKey && !serverHasApiKey)}
                className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-white border-2 border-gray-300 text-gray-700 font-medium rounded-xl hover:bg-gray-50 hover:border-gray-400 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
              >
                {testing ? (
                  <>
                    <svg className="animate-spin h-5 w-5 text-gray-600" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    测试中...
                  </>
                ) : (
                  <>
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                    测试连接
                  </>
                )}
              </button>
              
              <button
                onClick={handleSave}
                disabled={loadingConfig || !aiConfig.model || (!aiConfig.apiKey && !serverHasApiKey)}
                className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-blue-700 px-6 py-3 font-semibold text-white shadow-sm transition-all duration-200 hover:from-blue-700 hover:to-blue-800 hover:shadow-md disabled:cursor-not-allowed disabled:opacity-50"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
                </svg>
                {!aiConfig.apiKey && !serverHasApiKey ? "请先填写 API Key" : "保存配置"}
              </button>
            </div>

            {testResult && (
              <div
                className={`mt-4 p-4 rounded-xl border-2 ${
                  testResult.success
                    ? "bg-green-50 border-green-200 text-green-800"
                    : "bg-red-50 border-red-200 text-red-800"
                }`}
              >
                <div className="flex items-start gap-3">
                  <svg className={`w-5 h-5 flex-shrink-0 mt-0.5 ${testResult.success ? 'text-green-600' : 'text-red-600'}`} fill="currentColor" viewBox="0 0 20 20">
                    {testResult.success ? (
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    ) : (
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                    )}
                  </svg>
                  <div className="flex-1">
                    <p className="font-medium mb-1">{testResult.success ? '连接成功' : '连接失败'}</p>
                    <p className="text-sm opacity-90">{testResult.message}</p>
                  </div>
                </div>
              </div>
            )}

            {saved && (
              <div className="mt-4 p-4 rounded-xl border-2 bg-green-50 border-green-200 text-green-800">
                <div className="flex items-center gap-2">
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  <span className="font-medium">配置已保存到服务器</span>
                </div>
              </div>
            )}

            {saveError && (
              <div className="mt-4 rounded-xl border-2 border-red-200 bg-red-50 p-4 text-red-800">
                <p className="text-sm font-medium">{saveError}</p>
              </div>
            )}
          </div>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <Link
            href="/settings/files"
            className="rounded-2xl border border-slate-200 bg-white/90 p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-blue-200 hover:shadow"
          >
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-100 text-blue-600">
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
              </div>
              <div>
                <p className="font-semibold text-slate-900">文件管理</p>
                <p className="mt-1 text-sm text-slate-600">上传和维护 CSV / Excel / JSON 文件，作为 AI 的分析数据源。</p>
              </div>
            </div>
          </Link>
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
            <p className="text-sm font-semibold text-amber-900">安全提示</p>
            <p className="mt-1 text-sm text-amber-800">API Key 会保存在服务器并按租户隔离，请仅授予最小权限并定期轮换。</p>
          </div>
        </div>

        {/* 使用说明 */}
        <div className="mt-6 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-2xl p-6">
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center">
              <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div className="flex-1">
              <h3 className="text-sm font-semibold text-blue-900 mb-3">使用说明</h3>
              <ul className="space-y-2 text-sm text-blue-800">
                <li className="flex items-start gap-2">
                  <span className="text-blue-500 mt-0.5">•</span>
                  <span>配置信息会持久化到服务器并按租户隔离，换设备登录后可直接复用</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-blue-500 mt-0.5">•</span>
                  <span>如果不修改 API Key，保存时会沿用服务器中已有密钥，不会清空</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-blue-500 mt-0.5">•</span>
                  <span>OpenAI 推荐使用 <strong>gpt-4o-mini</strong>，国内网络可优先尝试通义千问或文心一言</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-blue-500 mt-0.5">•</span>
                  <span>配置完成后，可在 AI 对话功能中使用真实数据进行智能分析</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
