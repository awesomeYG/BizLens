"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { completeOnboarding, getCurrentUser, loginUser, logoutUser, quickLoginWithMockData } from "@/lib/user-store";
import type { CompanyInfo, DataSourceConfig, DataSourceType, UserSession } from "@/lib/types";

const DATA_SOURCE_OPTIONS: { type: DataSourceType; label: string; icon: string; category: string }[] = [
  { type: "mysql", label: "MySQL", icon: "M", category: "database" },
  { type: "postgresql", label: "PostgreSQL", icon: "P", category: "database" },
  { type: "sqlserver", label: "SQL Server", icon: "S", category: "database" },
  { type: "oracle", label: "Oracle", icon: "O", category: "database" },
  { type: "mongodb", label: "MongoDB", icon: "M", category: "database" },
  { type: "redis", label: "Redis", icon: "R", category: "cache" },
  { type: "elasticsearch", label: "Elasticsearch", icon: "E", category: "search" },
  { type: "clickhouse", label: "ClickHouse", icon: "C", category: "analytics" },
  { type: "snowflake", label: "Snowflake", icon: "S", category: "analytics" },
  { type: "bigquery", label: "BigQuery", icon: "B", category: "analytics" },
  { type: "hive", label: "Hive", icon: "H", category: "bigdata" },
  { type: "spark", label: "Spark", icon: "S", category: "bigdata" },
  { type: "csv", label: "CSV 文件", icon: "C", category: "file" },
  { type: "excel", label: "Excel 文件", icon: "X", category: "file" },
  { type: "api", label: "业务 API", icon: "A", category: "api" },
  { type: "s3", label: "对象存储", icon: "S", category: "storage" },
  { type: "kafka", label: "Kafka", icon: "K", category: "stream" },
  { type: "other", label: "其他", icon: "?", category: "other" },
];

const CATEGORY_COLORS: Record<string, string> = {
  database: "#6366f1", analytics: "#8b5cf6", bigdata: "#a855f7",
  file: "#22c55e", api: "#f59e0b", cache: "#ef4444",
  search: "#06b6d4", storage: "#3b82f6", stream: "#ec4899", other: "#71717a",
};

const STEPS = [
  { id: 1, title: "企业信息", desc: "基本信息" },
  { id: 2, title: "数据来源", desc: "选择数据源" },
  { id: 3, title: "开始分析", desc: "确认并生成" },
];

export default function HomePage() {
  const router = useRouter();
  const [hydrated, setHydrated] = useState(false);
  const [currentUser, setCurrentUser] = useState<UserSession | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(false);
  const [error, setError] = useState("");
  const [step, setStep] = useState(1);

  const [loginForm, setLoginForm] = useState({ name: "", email: "" });
  const [companyInfo, setCompanyInfo] = useState<CompanyInfo>({
    companyName: "", industry: "", size: "", region: "", businessModel: "", coreGoals: "",
  });
  const [selectedSourceTypes, setSelectedSourceTypes] = useState<DataSourceType[]>(["mysql", "excel"]);
  const [sourceDetailText, setSourceDetailText] = useState("");

  useEffect(() => { setCurrentUser(getCurrentUser()); setHydrated(true); }, []);

  const sourceConfigs = useMemo<DataSourceConfig[]>(
    () => selectedSourceTypes.map((type) => ({
      id: crypto.randomUUID(), type,
      name: DATA_SOURCE_OPTIONS.find((i) => i.type === type)?.label || type,
      description: sourceDetailText || undefined,
    })),
    [selectedSourceTypes, sourceDetailText]
  );

  const handleLogin = (e: React.SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault(); setError("");
    const name = loginForm.name.trim(); const email = loginForm.email.trim();
    if (!name || !email) { setError("请填写姓名和邮箱"); return; }
    setCurrentUser(loginUser(name, email));
  };

  const toggleSourceType = (type: DataSourceType) => {
    setSelectedSourceTypes((prev) => prev.includes(type) ? prev.filter((item) => item !== type) : [...prev, type]);
  };

  const handleNextStep = () => {
    setError("");
    if (step === 1) {
      const vals = [companyInfo.companyName, companyInfo.industry, companyInfo.size, companyInfo.region, companyInfo.businessModel, companyInfo.coreGoals];
      if (vals.some((v) => !v.trim())) { setError("请完整填写所有字段"); return; }
    }
    if (step === 2 && selectedSourceTypes.length === 0) { setError("请至少选择一个数据源"); return; }
    setStep((s) => Math.min(s + 1, 3));
  };

  const handleSubmitOnboarding = async () => {
    setError(""); setLoadingProfile(true);
    try {
      const res = await fetch("/api/company-profile", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyInfo, dataSources: sourceConfigs }),
      });
      
      // 检查响应状态
      if (!res.ok) {
        const text = await res.text();
        console.error("API 响应错误:", res.status, text);
        // 尝试解析 JSON 错误
        try {
          const errorData = JSON.parse(text);
          throw new Error(errorData.error || "画像生成失败");
        } catch {
          throw new Error(`服务器错误 (${res.status})`);
        }
      }
      
      const data = await res.json();
      const nextUser = completeOnboarding(companyInfo, sourceConfigs, {
        summary: data.summary || "", analysisFocuses: data.analysisFocuses || [], recommendedMetrics: data.recommendedMetrics || [],
      });
      setCurrentUser(nextUser);
      router.push("/chat");
    } catch (err) {
      console.error("Onboarding 错误:", err);
      setError(err instanceof Error ? err.message : "画像生成失败，请稍后重试");
    }
    finally { setLoadingProfile(false); }
  };

  const handleLogout = () => { logoutUser(); setCurrentUser(null); setStep(1); };
  if (!hydrated) return <div className="min-h-screen bg-zinc-950" />;

  return (
    <div className="min-h-screen bg-zinc-950 bg-grid bg-glow-top">
      <div className="flex flex-col items-center justify-center min-h-screen px-6 py-12">
        <div className="w-full max-w-4xl">

          {/* Logo */}
          <div className="text-center space-y-4 mb-10">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-sm mb-4">
              <span className="w-2 h-2 rounded-full bg-indigo-400 animate-pulse-soft" />
              AI-Powered Business Intelligence
            </div>
            <h1 className="text-5xl font-bold tracking-tight">
              <span className="bg-gradient-to-r from-white via-zinc-200 to-zinc-400 bg-clip-text text-transparent">BizLens</span>
            </h1>
            {!currentUser && <p className="text-zinc-500 text-lg max-w-md mx-auto">接入企业数据源，AI 实时分析商业数据，智能告警驱动决策</p>}
          </div>

          {/* 登录 */}
          {!currentUser && (
            <div className="space-y-4">
              <form onSubmit={handleLogin} className="mx-auto max-w-md glass-card rounded-2xl p-8 space-y-5 animate-fade-in">
                <h2 className="text-xl text-zinc-100 font-semibold">登录</h2>
                <input value={loginForm.name} onChange={(e) => setLoginForm((p) => ({ ...p, name: e.target.value }))} placeholder="姓名" className="input-base" />
                <input value={loginForm.email} onChange={(e) => setLoginForm((p) => ({ ...p, email: e.target.value }))} placeholder="邮箱" type="email" className="input-base" />
                {error && <p className="text-red-400 text-sm">{error}</p>}
                <button type="submit" className="btn-primary w-full">进入平台</button>
              </form>
              
              <div className="text-center">
                <button
                  type="button"
                  onClick={() => {
                    quickLoginWithMockData();
                    setCurrentUser(getCurrentUser());
                  }}
                  className="text-sm text-zinc-400 hover:text-zinc-300 transition-colors underline"
                >
                  🚀 快速测试（使用 Mock 数据）
                </button>
                <p className="text-xs text-zinc-600 mt-1">
                  自动填充电商公司数据，跳过初始化流程
                </p>
              </div>
            </div>
          )}

          {/* Onboarding 向导 */}
          {currentUser && !currentUser.isOnboarded && (
            <div className="animate-fade-in">
              {/* 步骤指示器 */}
              <div className="flex items-center justify-center gap-0 mb-8">
                {STEPS.map((s, i) => (
                  <div key={s.id} className="flex items-center">
                    <button onClick={() => s.id < step && setStep(s.id)}
                      className={`flex items-center gap-3 px-4 py-2 rounded-xl transition-all ${
                        step === s.id ? "bg-indigo-500/15 border border-indigo-500/30" :
                        step > s.id ? "bg-emerald-500/10 border border-emerald-500/20 cursor-pointer hover:bg-emerald-500/15" :
                        "bg-zinc-800/30 border border-zinc-800/50"
                      }`}>
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold transition-all ${
                        step === s.id ? "bg-indigo-500 text-white shadow-lg shadow-indigo-500/30" :
                        step > s.id ? "bg-emerald-500/20 text-emerald-400" :
                        "bg-zinc-800 text-zinc-500"
                      }`}>
                        {step > s.id ? (
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                          </svg>
                        ) : s.id}
                      </div>
                      <div className="text-left hidden sm:block">
                        <div className={`text-sm font-medium ${step === s.id ? "text-indigo-300" : step > s.id ? "text-emerald-400" : "text-zinc-500"}`}>{s.title}</div>
                        <div className="text-xs text-zinc-600">{s.desc}</div>
                      </div>
                    </button>
                    {i < STEPS.length - 1 && (
                      <div className={`w-8 h-px mx-1 ${step > s.id ? "bg-emerald-500/30" : "bg-zinc-800"}`} />
                    )}
                  </div>
                ))}
              </div>

              {/* Step 1: 企业信息 */}
              {step === 1 && (
                <div className="glass-card gradient-border rounded-2xl p-8 space-y-6 animate-slide-up max-w-2xl mx-auto">
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-xl text-zinc-100 font-semibold">企业基本信息</h2>
                      <p className="text-sm text-zinc-500 mt-1">AI 将基于这些信息生成专属企业画像</p>
                    </div>
                    <button type="button" onClick={handleLogout} className="btn-ghost text-sm">退出</button>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs text-zinc-500 mb-1.5 font-medium">公司名称</label>
                      <input value={companyInfo.companyName} onChange={(e) => setCompanyInfo((p) => ({ ...p, companyName: e.target.value }))}
                        placeholder="如：杭州某某科技有限公司" className="input-base" />
                    </div>
                    <div className="grid sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs text-zinc-500 mb-1.5 font-medium">所属行业</label>
                        <input value={companyInfo.industry} onChange={(e) => setCompanyInfo((p) => ({ ...p, industry: e.target.value }))}
                          placeholder="如：电商、制造、金融" className="input-base" />
                      </div>
                      <div>
                        <label className="block text-xs text-zinc-500 mb-1.5 font-medium">企业规模</label>
                        <input value={companyInfo.size} onChange={(e) => setCompanyInfo((p) => ({ ...p, size: e.target.value }))}
                          placeholder="如：200-500 人" className="input-base" />
                      </div>
                    </div>
                    <div className="grid sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs text-zinc-500 mb-1.5 font-medium">业务区域</label>
                        <input value={companyInfo.region} onChange={(e) => setCompanyInfo((p) => ({ ...p, region: e.target.value }))}
                          placeholder="如：华东 + 东南亚" className="input-base" />
                      </div>
                      <div>
                        <label className="block text-xs text-zinc-500 mb-1.5 font-medium">业务模式</label>
                        <input value={companyInfo.businessModel} onChange={(e) => setCompanyInfo((p) => ({ ...p, businessModel: e.target.value }))}
                          placeholder="如：B2B SaaS、D2C" className="input-base" />
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs text-zinc-500 mb-1.5 font-medium">核心业务目标</label>
                      <textarea value={companyInfo.coreGoals} onChange={(e) => setCompanyInfo((p) => ({ ...p, coreGoals: e.target.value }))}
                        placeholder="描述你最关注的业务指标和目标，如：提升复购率、降低获客成本、优化库存周转..." rows={3} className="input-base" />
                    </div>
                  </div>

                  {error && <p className="text-red-400 text-sm">{error}</p>}
                  <button type="button" onClick={handleNextStep} className="btn-primary w-full">
                    下一步：选择数据来源
                    <svg className="w-4 h-4 inline ml-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
                    </svg>
                  </button>
                </div>
              )}

              {/* Step 2: 数据源选择 */}
              {step === 2 && (
                <div className="glass-card gradient-border rounded-2xl p-8 space-y-6 animate-slide-up">
                  <div>
                    <h2 className="text-xl text-zinc-100 font-semibold">选择数据来源</h2>
                    <p className="text-sm text-zinc-500 mt-1">选择你的企业正在使用的数据源，AI 将据此定制分析策略</p>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                    {DATA_SOURCE_OPTIONS.map((option) => {
                      const selected = selectedSourceTypes.includes(option.type);
                      const color = CATEGORY_COLORS[option.category] || "#71717a";
                      return (
                        <button key={option.type} type="button" onClick={() => toggleSourceType(option.type)}
                          className={`group relative rounded-xl border p-4 text-left transition-all ${
                            selected
                              ? "border-indigo-500/40 bg-indigo-500/8 shadow-lg shadow-indigo-500/5"
                              : "border-zinc-800/60 bg-zinc-900/30 hover:border-zinc-700 hover:bg-zinc-800/40"
                          }`}>
                          {selected && (
                            <div className="absolute top-2 right-2">
                              <svg className="w-4 h-4 text-indigo-400" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm3.857-9.809a.75.75 0 0 0-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 1 0-1.06 1.061l2.5 2.5a.75.75 0 0 0 1.137-.089l4-5.5Z" clipRule="evenodd" />
                              </svg>
                            </div>
                          )}
                          <div className="w-9 h-9 rounded-lg flex items-center justify-center mb-3 text-sm font-bold transition-all"
                            style={{ backgroundColor: `${color}15`, color }}>
                            {option.icon}
                          </div>
                          <div className={`text-sm font-medium ${selected ? "text-zinc-100" : "text-zinc-400"}`}>{option.label}</div>
                        </button>
                      );
                    })}
                  </div>

                  <div>
                    <label className="block text-xs text-zinc-500 mb-1.5 font-medium">补充说明（可选）</label>
                    <textarea value={sourceDetailText} onChange={(e) => setSourceDetailText(e.target.value)}
                      placeholder="描述各数据源的用途，如：MySQL 存交易订单、Kafka 存用户行为埋点流..." rows={3} className="input-base" />
                  </div>

                  {selectedSourceTypes.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {selectedSourceTypes.map((type) => {
                        const opt = DATA_SOURCE_OPTIONS.find((o) => o.type === type);
                        const color = CATEGORY_COLORS[opt?.category || "other"];
                        return (
                          <span key={type} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs border transition-all"
                            style={{ borderColor: `${color}30`, backgroundColor: `${color}08`, color }}>
                            {opt?.label}
                            <button type="button" onClick={() => toggleSourceType(type)} className="hover:opacity-70">x</button>
                          </span>
                        );
                      })}
                    </div>
                  )}

                  {error && <p className="text-red-400 text-sm">{error}</p>}
                  <div className="flex gap-3">
                    <button type="button" onClick={() => setStep(1)} className="btn-secondary flex-1">上一步</button>
                    <button type="button" onClick={handleNextStep} className="btn-primary flex-1">
                      下一步：确认信息
                      <svg className="w-4 h-4 inline ml-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
                      </svg>
                    </button>
                  </div>
                </div>
              )}

              {/* Step 3: 确认 */}
              {step === 3 && (
                <div className="glass-card gradient-border rounded-2xl p-8 space-y-6 animate-slide-up max-w-2xl mx-auto">
                  <div>
                    <h2 className="text-xl text-zinc-100 font-semibold">确认并生成企业画像</h2>
                    <p className="text-sm text-zinc-500 mt-1">AI 将基于以下信息为你生成专属的商业分析画像</p>
                  </div>

                  <div className="space-y-4">
                    <div className="rounded-xl bg-zinc-900/60 border border-zinc-800/50 p-5 space-y-3">
                      <h3 className="text-xs font-medium text-zinc-500 uppercase tracking-wider">企业信息</h3>
                      <div className="grid sm:grid-cols-2 gap-x-8 gap-y-2">
                        {[
                          ["公司", companyInfo.companyName],
                          ["行业", companyInfo.industry],
                          ["规模", companyInfo.size],
                          ["区域", companyInfo.region],
                          ["模式", companyInfo.businessModel],
                        ].map(([label, value]) => (
                          <div key={label} className="flex items-baseline gap-2">
                            <span className="text-xs text-zinc-600 shrink-0 w-8">{label}</span>
                            <span className="text-sm text-zinc-300">{value}</span>
                          </div>
                        ))}
                      </div>
                      <div>
                        <span className="text-xs text-zinc-600">目标</span>
                        <p className="text-sm text-zinc-300 mt-0.5">{companyInfo.coreGoals}</p>
                      </div>
                    </div>

                    <div className="rounded-xl bg-zinc-900/60 border border-zinc-800/50 p-5">
                      <h3 className="text-xs font-medium text-zinc-500 uppercase tracking-wider mb-3">数据来源</h3>
                      <div className="flex flex-wrap gap-2">
                        {selectedSourceTypes.map((type) => {
                          const opt = DATA_SOURCE_OPTIONS.find((o) => o.type === type);
                          const color = CATEGORY_COLORS[opt?.category || "other"];
                          return (
                            <span key={type} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs border"
                              style={{ borderColor: `${color}30`, backgroundColor: `${color}08`, color }}>
                              <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: color }} />
                              {opt?.label}
                            </span>
                          );
                        })}
                      </div>
                      {sourceDetailText && <p className="text-xs text-zinc-500 mt-3">{sourceDetailText}</p>}
                    </div>
                  </div>

                  {error && <p className="text-red-400 text-sm">{error}</p>}

                  {loadingProfile && (
                    <div className="rounded-xl bg-indigo-500/5 border border-indigo-500/20 p-5 text-center space-y-3">
                      <div className="flex justify-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-indigo-400 animate-bounce" style={{animationDelay: "0ms"}} />
                        <span className="w-2 h-2 rounded-full bg-indigo-400 animate-bounce" style={{animationDelay: "150ms"}} />
                        <span className="w-2 h-2 rounded-full bg-indigo-400 animate-bounce" style={{animationDelay: "300ms"}} />
                      </div>
                      <p className="text-sm text-indigo-300">AI 正在分析企业信息，生成专属画像...</p>
                      <p className="text-xs text-zinc-600">这可能需要几秒钟</p>
                    </div>
                  )}

                  <div className="flex gap-3">
                    <button type="button" onClick={() => setStep(2)} disabled={loadingProfile} className="btn-secondary flex-1 disabled:opacity-40">上一步</button>
                    <button type="button" onClick={handleSubmitOnboarding} disabled={loadingProfile}
                      className="btn-primary flex-1 disabled:opacity-60 disabled:cursor-not-allowed">
                      {loadingProfile ? "生成中..." : "生成企业画像，开始分析"}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* 已登录主界面 */}
          {currentUser?.isOnboarded && (
            <div className="animate-fade-in space-y-8">
              <p className="text-center text-zinc-500">欢迎回来，<span className="text-zinc-300">{currentUser.name}</span></p>
              <div className="grid sm:grid-cols-2 gap-5">
                <Link href="/chat" className="group glass-card gradient-border rounded-2xl p-6 transition-all hover:scale-[1.02] hover:shadow-xl hover:shadow-indigo-500/5">
                  <div className="w-12 h-12 rounded-xl bg-indigo-500/10 flex items-center justify-center mb-4">
                    <svg className="w-6 h-6 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H8.25m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H12m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 0 1-2.555-.337A5.972 5.972 0 0 1 5.41 20.97a5.969 5.969 0 0 1-.474-.065 4.48 4.48 0 0 0 .978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25Z" />
                    </svg>
                  </div>
                  <h3 className="text-lg font-semibold text-zinc-100 mb-1">AI 对话分析</h3>
                  <p className="text-sm text-zinc-500">上传数据，与 AI 对话获取商业洞察和决策建议</p>
                </Link>
                <Link href="/data-sources" className="group glass-card gradient-border rounded-2xl p-6 transition-all hover:scale-[1.02] hover:shadow-xl hover:shadow-emerald-500/5">
                  <div className="w-12 h-12 rounded-xl bg-emerald-500/10 flex items-center justify-center mb-4">
                    <svg className="w-6 h-6 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 6.375c0 2.278-3.694 4.125-8.25 4.125S3.75 8.653 3.75 6.375m16.5 0c0-2.278-3.694-4.125-8.25-4.125S3.75 4.097 3.75 6.375m16.5 0v11.25c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125V6.375m16.5 0v3.75m-16.5-3.75v3.75m16.5 0v3.75C20.25 16.153 16.556 18 12 18m-8.25-3.75c0-2.278 3.694-4.125 8.25-4.125s8.25 1.847 8.25 4.125" />
                    </svg>
                  </div>
                  <h3 className="text-lg font-semibold text-zinc-100 mb-1">数据源管理</h3>
                  <p className="text-sm text-zinc-500">连接数据库、上传文件，管理所有数据来源</p>
                </Link>
                <Link href="/alerts" className="group glass-card gradient-border rounded-2xl p-6 transition-all hover:scale-[1.02] hover:shadow-xl hover:shadow-amber-500/5">
                  <div className="w-12 h-12 rounded-xl bg-amber-500/10 flex items-center justify-center mb-4">
                    <svg className="w-6 h-6 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 0 0 5.454-1.31A8.967 8.967 0 0 1 18 9.75V9A6 6 0 0 0 6 9v.75a8.967 8.967 0 0 1-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 0 1-5.714 0m5.714 0a3 3 0 1 1-5.714 0" />
                    </svg>
                  </div>
                  <h3 className="text-lg font-semibold text-zinc-100 mb-1">智能告警</h3>
                  <p className="text-sm text-zinc-500">自然语言配置数据监控规则，异常实时推送通知</p>
                </Link>
              </div>
              <div className="flex gap-3 justify-center flex-wrap">
                <Link href="/dashboards" className="btn-ghost text-sm">数据大屏</Link>
                <Link href="/im/settings" className="btn-ghost text-sm">IM 设置</Link>
                <Link href="/alerts/config" className="btn-ghost text-sm">告警配置</Link>
              </div>
              <div className="text-center">
                <button type="button" onClick={handleLogout} className="text-sm text-zinc-600 hover:text-zinc-400 transition-colors">退出登录</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
