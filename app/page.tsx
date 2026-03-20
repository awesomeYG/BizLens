"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { completeOnboarding, getCurrentUser, loginUser, logoutUser } from "@/lib/user-store";
import type { CompanyInfo, DataSourceConfig, DataSourceType, UserSession } from "@/lib/types";

const DATA_SOURCE_OPTIONS: { type: DataSourceType; label: string }[] = [
  { type: "mysql", label: "MySQL" },
  { type: "postgresql", label: "PostgreSQL" },
  { type: "sqlserver", label: "SQL Server" },
  { type: "oracle", label: "Oracle" },
  { type: "mongodb", label: "MongoDB" },
  { type: "redis", label: "Redis" },
  { type: "elasticsearch", label: "Elasticsearch" },
  { type: "clickhouse", label: "ClickHouse" },
  { type: "snowflake", label: "Snowflake" },
  { type: "bigquery", label: "BigQuery" },
  { type: "hive", label: "Hive" },
  { type: "spark", label: "Spark" },
  { type: "csv", label: "CSV 文件" },
  { type: "excel", label: "Excel 文件" },
  { type: "api", label: "业务 API" },
  { type: "s3", label: "对象存储（S3/OSS）" },
  { type: "kafka", label: "Kafka 消息流" },
  { type: "other", label: "其他" },
];

export default function HomePage() {
  const router = useRouter();
  const [hydrated, setHydrated] = useState(false);
  const [currentUser, setCurrentUser] = useState<UserSession | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(false);
  const [error, setError] = useState("");

  const [loginForm, setLoginForm] = useState({ name: "", email: "" });
  const [companyInfo, setCompanyInfo] = useState<CompanyInfo>({
    companyName: "", industry: "", size: "", region: "", businessModel: "", coreGoals: "",
  });
  const [selectedSourceTypes, setSelectedSourceTypes] = useState<DataSourceType[]>(["mysql", "excel"]);
  const [sourceDetailText, setSourceDetailText] = useState("");

  useEffect(() => {
    setCurrentUser(getCurrentUser());
    setHydrated(true);
  }, []);

  const sourceConfigs = useMemo<DataSourceConfig[]>(
    () => selectedSourceTypes.map((type) => ({
      id: crypto.randomUUID(), type,
      name: DATA_SOURCE_OPTIONS.find((i) => i.type === type)?.label || type,
      description: sourceDetailText || undefined,
    })),
    [selectedSourceTypes, sourceDetailText]
  );

  const handleLogin = (e: React.SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");
    const name = loginForm.name.trim();
    const email = loginForm.email.trim();
    if (!name || !email) { setError("请填写姓名和邮箱"); return; }
    setCurrentUser(loginUser(name, email));
  };

  const toggleSourceType = (type: DataSourceType) => {
    setSelectedSourceTypes((prev) =>
      prev.includes(type) ? prev.filter((item) => item !== type) : [...prev, type]
    );
  };

  const handleCompleteOnboarding = async (e: React.SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");
    const vals = [companyInfo.companyName, companyInfo.industry, companyInfo.size, companyInfo.region, companyInfo.businessModel, companyInfo.coreGoals];
    if (vals.some((v) => !v.trim())) { setError("请完整填写公司信息"); return; }
    if (!sourceConfigs.length) { setError("请至少选择一个数据源"); return; }
    setLoadingProfile(true);
    try {
      const res = await fetch("/api/company-profile", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyInfo, dataSources: sourceConfigs }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "画像生成失败");
      const nextUser = completeOnboarding(companyInfo, sourceConfigs, {
        summary: data.summary || "", analysisFocuses: data.analysisFocuses || [], recommendedMetrics: data.recommendedMetrics || [],
      });
      setCurrentUser(nextUser);
      router.push("/chat");
    } catch (err) {
      setError(err instanceof Error ? err.message : "画像生成失败");
    } finally {
      setLoadingProfile(false);
    }
  };

  const handleLogout = () => { logoutUser(); setCurrentUser(null); };

  if (!hydrated) return <div className="min-h-screen bg-zinc-950" />;

  return (
    <div className="min-h-screen bg-zinc-950 bg-grid bg-glow-top">
      <div className="flex flex-col items-center justify-center min-h-screen px-6 py-12">
        <div className="w-full max-w-4xl">

          {/* Logo + 标题 */}
          <div className="text-center space-y-4 mb-10">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-sm mb-4">
              <span className="w-2 h-2 rounded-full bg-indigo-400 animate-pulse-soft" />
              AI-Powered Business Intelligence
            </div>
            <h1 className="text-5xl font-bold tracking-tight">
              <span className="bg-gradient-to-r from-white via-zinc-200 to-zinc-400 bg-clip-text text-transparent">
                BizLens
              </span>
            </h1>
            <p className="text-zinc-500 text-lg max-w-md mx-auto">
              接入企业数据源，AI 实时分析商业数据，智能告警驱动决策
            </p>
          </div>

          {/* 登录表单 */}
          {!currentUser && (
            <form onSubmit={handleLogin} className="mx-auto max-w-md glass-card rounded-2xl p-8 space-y-5 animate-fade-in">
              <h2 className="text-xl text-zinc-100 font-semibold">登录</h2>
              <input value={loginForm.name} onChange={(e) => setLoginForm((p) => ({ ...p, name: e.target.value }))}
                placeholder="姓名" className="input-base" />
              <input value={loginForm.email} onChange={(e) => setLoginForm((p) => ({ ...p, email: e.target.value }))}
                placeholder="邮箱" type="email" className="input-base" />
              {error && <p className="text-red-400 text-sm">{error}</p>}
              <button type="submit" className="btn-primary w-full">进入平台</button>
            </form>
          )}

          {/* Onboarding */}
          {currentUser && !currentUser.isOnboarded && (
            <form onSubmit={handleCompleteOnboarding} className="glass-card rounded-2xl p-8 space-y-6 animate-fade-in">
              <div className="flex items-center justify-between">
                <h2 className="text-xl text-zinc-100 font-semibold">初始化企业画像</h2>
                <button type="button" onClick={handleLogout} className="btn-ghost text-sm">退出</button>
              </div>

              <div className="grid sm:grid-cols-2 gap-3">
                <input value={companyInfo.companyName} onChange={(e) => setCompanyInfo((p) => ({ ...p, companyName: e.target.value }))}
                  placeholder="公司名称" className="input-base" />
                <input value={companyInfo.industry} onChange={(e) => setCompanyInfo((p) => ({ ...p, industry: e.target.value }))}
                  placeholder="行业（如电商、制造）" className="input-base" />
                <input value={companyInfo.size} onChange={(e) => setCompanyInfo((p) => ({ ...p, size: e.target.value }))}
                  placeholder="企业规模（如 200-500 人）" className="input-base" />
                <input value={companyInfo.region} onChange={(e) => setCompanyInfo((p) => ({ ...p, region: e.target.value }))}
                  placeholder="业务区域（如华东 + 东南亚）" className="input-base" />
              </div>

              <input value={companyInfo.businessModel} onChange={(e) => setCompanyInfo((p) => ({ ...p, businessModel: e.target.value }))}
                placeholder="业务模式（如 B2B SaaS、D2C）" className="input-base" />
              <textarea value={companyInfo.coreGoals} onChange={(e) => setCompanyInfo((p) => ({ ...p, coreGoals: e.target.value }))}
                placeholder="核心目标（如提升复购率、降低库存资金占用）" rows={3} className="input-base" />

              <div>
                <p className="text-zinc-400 text-sm mb-3">选择数据来源</p>
                <div className="grid sm:grid-cols-3 gap-2">
                  {DATA_SOURCE_OPTIONS.map((option) => (
                    <button key={option.type} type="button" onClick={() => toggleSourceType(option.type)}
                      className={`rounded-lg border px-3 py-2 text-sm text-left transition-all ${
                        selectedSourceTypes.includes(option.type)
                          ? "border-indigo-500/50 bg-indigo-500/10 text-indigo-300"
                          : "border-zinc-700/50 bg-zinc-800/30 text-zinc-400 hover:border-zinc-600"
                      }`}>
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>

              <textarea value={sourceDetailText} onChange={(e) => setSourceDetailText(e.target.value)}
                placeholder="补充数据说明（例如：MySQL 存交易单、Kafka 存埋点流）" rows={3} className="input-base" />

              {error && <p className="text-red-400 text-sm">{error}</p>}
              <button disabled={loadingProfile} type="submit" className="btn-primary w-full disabled:opacity-60">
                {loadingProfile ? "AI 正在分析企业信息..." : "完成初始化"}
              </button>
            </form>
          )}

          {/* 已登录主界面 */}
          {currentUser?.isOnboarded && (
            <div className="animate-fade-in space-y-8">
              <p className="text-center text-zinc-500">
                欢迎回来，<span className="text-zinc-300">{currentUser.name}</span>
              </p>

              {/* 主功能卡片 */}
              <div className="grid sm:grid-cols-2 gap-5">
                <Link href="/chat"
                  className="group glass-card gradient-border rounded-2xl p-6 transition-all hover:scale-[1.02] hover:shadow-xl hover:shadow-indigo-500/5">
                  <div className="w-12 h-12 rounded-xl bg-indigo-500/10 flex items-center justify-center mb-4">
                    <svg className="w-6 h-6 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H8.25m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H12m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 0 1-2.555-.337A5.972 5.972 0 0 1 5.41 20.97a5.969 5.969 0 0 1-.474-.065 4.48 4.48 0 0 0 .978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25Z" />
                    </svg>
                  </div>
                  <h3 className="text-lg font-semibold text-zinc-100 mb-1">AI 对话分析</h3>
                  <p className="text-sm text-zinc-500">上传数据，与 AI 对话获取商业洞察和决策建议</p>
                </Link>

                <Link href="/alerts"
                  className="group glass-card gradient-border rounded-2xl p-6 transition-all hover:scale-[1.02] hover:shadow-xl hover:shadow-amber-500/5">
                  <div className="w-12 h-12 rounded-xl bg-amber-500/10 flex items-center justify-center mb-4">
                    <svg className="w-6 h-6 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 0 0 5.454-1.31A8.967 8.967 0 0 1 18 9.75V9A6 6 0 0 0 6 9v.75a8.967 8.967 0 0 1-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 0 1-5.714 0m5.714 0a3 3 0 1 1-5.714 0" />
                    </svg>
                  </div>
                  <h3 className="text-lg font-semibold text-zinc-100 mb-1">智能告警</h3>
                  <p className="text-sm text-zinc-500">自然语言配置数据监控规则，异常实时推送通知</p>
                </Link>
              </div>

              {/* 次要入口 */}
              <div className="flex gap-3 justify-center flex-wrap">
                <Link href="/dashboards" className="btn-ghost text-sm">数据大屏</Link>
                <Link href="/im/settings" className="btn-ghost text-sm">IM 设置</Link>
                <Link href="/alerts/config" className="btn-ghost text-sm">告警配置</Link>
              </div>

              <div className="text-center">
                <button type="button" onClick={handleLogout} className="text-sm text-zinc-600 hover:text-zinc-400 transition-colors">
                  退出登录
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
