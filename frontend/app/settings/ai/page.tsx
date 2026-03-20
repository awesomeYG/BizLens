"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { getCurrentUser } from "@/lib/user-store";

const MODEL_OPTIONS = [
  { value: "openai", label: "OpenAI", models: ["gpt-4o-mini", "gpt-4o", "gpt-4-turbo"], icon: "🤖" },
  { value: "claude", label: "Anthropic Claude", models: ["claude-3-sonnet-20240229", "claude-3-opus-20240229"], icon: "🧠" },
  { value: "qwen", label: "通义千问", models: ["qwen-plus", "qwen-max"], icon: "🔮" },
  { value: "ernie", label: "文心一言", models: ["ernie-bot-4"], icon: "📚" },
];

export default function SettingsPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  
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

  useEffect(() => {
    const currentUser = getCurrentUser();
    setUser(currentUser);
    
    // 从 localStorage 加载配置
    const savedConfig = localStorage.getItem("bizlens-ai-config");
    if (savedConfig) {
      try {
        setAiConfig(JSON.parse(savedConfig));
      } catch (e) {
        console.error("加载配置失败", e);
      }
    }
    
    setLoading(false);
  }, []);

  const handleSave = () => {
    localStorage.setItem("bizlens-ai-config", JSON.stringify(aiConfig));
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
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

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-4">
              <button
                onClick={() => router.push("/")}
                className="text-gray-600 hover:text-gray-900"
              >
                ← 返回
              </button>
              <h1 className="text-2xl font-bold text-gray-900">AI 设置</h1>
            </div>
          </div>
        </div>
      </div>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white rounded-lg shadow p-6 space-y-6">
          {/* API Key 配置 */}
          <div>
            <h2 className="text-lg font-semibold text-gray-900 mb-4">AI 服务配置</h2>
            
            <div className="space-y-4">
              {/* 模型服务商选择 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  模型服务商
                </label>
                <div className="grid grid-cols-2 gap-3">
                  {MODEL_OPTIONS.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => handleModelTypeChange(option.value)}
                      className={`p-3 rounded-lg border-2 text-left transition-all ${
                        aiConfig.modelType === option.value
                          ? "border-blue-600 bg-blue-50"
                          : "border-gray-200 hover:border-gray-300"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-xl">{option.icon}</span>
                        <div>
                          <div className="font-medium text-sm">{option.label}</div>
                          <div className="text-xs text-gray-500">
                            {option.models.length} 个模型可选
                          </div>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* API Key */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  API Key *
                </label>
                <input
                  type="password"
                  value={aiConfig.apiKey}
                  onChange={(e) => setAiConfig({ ...aiConfig, apiKey: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder={aiConfig.modelType === "openai" ? "sk-..." : "输入你的 API Key"}
                />
                <p className="mt-1 text-xs text-gray-500">
                  {aiConfig.modelType === "openai" && "在 https://platform.openai.com/api-keys 获取"}
                  {aiConfig.modelType === "claude" && "在 https://console.anthropic.com/settings/keys 获取"}
                  {aiConfig.modelType === "qwen" && "在阿里云百炼平台获取"}
                  {aiConfig.modelType === "ernie" && "在百度智能云千帆平台获取"}
                </p>
              </div>

              {/* 自定义 Base URL */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  API Base URL
                </label>
                <input
                  type="url"
                  value={aiConfig.baseUrl}
                  onChange={(e) => setAiConfig({ ...aiConfig, baseUrl: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="https://api.openai.com/v1"
                />
                <p className="mt-1 text-xs text-gray-500">
                  使用第三方代理服务时填写，留空使用官方地址
                </p>
              </div>

              {/* 模型选择 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  模型
                </label>
                <select
                  value={aiConfig.model}
                  onChange={(e) => setAiConfig({ ...aiConfig, model: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  {MODEL_OPTIONS.find((o) => o.value === aiConfig.modelType)?.models.map((model) => (
                    <option key={model} value={model}>
                      {model}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* 测试连接 */}
          <div className="pt-6 border-t">
            <div className="flex gap-3">
              <button
                onClick={handleTest}
                disabled={testing || !aiConfig.apiKey}
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {testing ? "测试中..." : "测试连接"}
              </button>
              
              <button
                onClick={handleSave}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                保存配置
              </button>
            </div>

            {testResult && (
              <div
                className={`mt-4 p-3 rounded-lg ${
                  testResult.success
                    ? "bg-green-50 text-green-800"
                    : "bg-red-50 text-red-800"
                }`}
              >
                {testResult.message}
              </div>
            )}

            {saved && (
              <div className="mt-4 p-3 bg-green-50 text-green-800 rounded-lg">
                ✓ 配置已保存到本地
              </div>
            )}
          </div>
        </div>

        {/* 使用说明 */}
        <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-6">
          <h3 className="text-sm font-semibold text-blue-900 mb-3">💡 使用说明</h3>
          <ul className="space-y-2 text-sm text-blue-800">
            <li>• 配置将保存在浏览器本地，不会上传到服务器</li>
            <li>• OpenAI 推荐使用 gpt-4o-mini，性价比高</li>
            <li>• 国内用户可使用通义千问或文心一言</li>
            <li>• 配置后可在 AI 对话中使用真实数据分析</li>
          </ul>
        </div>
      </main>
    </div>
  );
}
