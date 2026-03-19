"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { completeOnboarding, getCurrentUser, loginUser, logoutUser } from "@/lib/user-store";
import { getAIConfig } from "@/lib/ai-config-store";
import type { CompanyInfo, DataSourceConfig, DataSourceType, UserSession } from "@/lib/types";

const DATA_SOURCE_OPTIONS: { type: DataSourceType; label: string; desc: string }[] = [
  { type: "mysql", label: "MySQL", desc: "关系型数据库" },
  { type: "postgresql", label: "PostgreSQL", desc: "关系型数据库" },
  { type: "sqlserver", label: "SQL Server", desc: "关系型数据库" },
  { type: "oracle", label: "Oracle", desc: "关系型数据库" },
  { type: "mongodb", label: "MongoDB", desc: "文档数据库" },
  { type: "redis", label: "Redis", desc: "缓存/KV" },
  { type: "elasticsearch", label: "Elasticsearch", desc: "搜索引擎" },
  { type: "clickhouse", label: "ClickHouse", desc: "列式分析" },
  { type: "snowflake", label: "Snowflake", desc: "云数仓" },
  { type: "bigquery", label: "BigQuery", desc: "云数仓" },
  { type: "hive", label: "Hive", desc: "大数据" },
  { type: "spark", label: "Spark", desc: "大数据" },
  { type: "csv", label: "CSV", desc: "文件" },
  { type: "excel", label: "Excel", desc: "文件" },
  { type: "api", label: "API", desc: "业务接口" },
  { type: "s3", label: "S3/OSS", desc: "对象存储" },
  { type: "kafka", label: "Kafka", desc: "消息流" },
  { type: "other", label: "Other", desc: "其他" },
];

/* ---- step indicator ---- */
function StepIndicator({ current, total }: { current: number; total: number }) {
  return (
    <div className="flex items-center gap-2">
      {Array.from({ length: total }, (_, i) => (
        <div key={i} className="flex items-center gap-2">
          <div
            className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-medium transition-all duration-300 ${
              i < current
                ? "bg-accent/20 text-accent border border-accent/40"
                : i === current
                ? "bg-accent text-white shadow-lg shadow-accent/25"
                : "bg-white/[0.03] text-txt-tertiary border border-border-subtle"
            }`}
          >
            {i < current ? (
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                <path d="M2.5 6L5 8.5L9.5 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            ) : (
              i + 1
            )}
          </div>
          {i < total - 1 && (
            <div className={`w-8 h-px transition-colors duration-300 ${i < current ? "bg-accent/40" : "bg-border-subtle"}`} />
          )}
        </div>
      ))}
    </div>
  );
}

export default function HomePage() {
  const router = useRouter();
  const [hydrated, setHydrated] = useState(false);
  const [currentUser, setCurrentUser] = useState<UserSession | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(false);
  const [error, setError] = useState("");
  const [onboardStep, setOnboardStep] = useState(0); // 0=company info, 1=data sources

  const [loginForm, setLoginForm] = useState({ name: "张三", email: "zhangsan@example.com" });
  const [companyInfo, setCompanyInfo] = useState<CompanyInfo>({
    companyName: "星辰科技有限公司",
    industry: "电商零售",
    size: "200-500人",
    region: "华东 + 东南亚",
    businessModel: "B2C 跨境电商",
    coreGoals: "提升复购率、降低库存资金占用、优化供应链效率",
  });
  const [selectedSourceTypes, setSelectedSourceTypes] = useState<DataSourceType[]>(["mysql", "excel", "api", "kafka"]);
  const [sourceDetailText, setSourceDetailText] = useState("MySQL 存储交易订单和用户数据，Excel 存储财务报表，API 对接 ERP 系统，Kafka 存储用户行为埋点流数据");

  useEffect(() => {
    const user = getCurrentUser();
    setCurrentUser(user);
    setHydrated(true);
  }, []);

  const sourceConfigs = useMemo<DataSourceConfig[]>(
    () =>
      selectedSourceTypes.map((type) => {
        const option = DATA_SOURCE_OPTIONS.find((i) => i.type === type);
        return {
          id: crypto.randomUUID(),
          type,
          name: option?.label || type,
          description: sourceDetailText || undefined,
        };
      }),
    [selectedSourceTypes, sourceDetailText]
  );

  const handleLogin = (e: React.SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");
    const name = loginForm.name.trim();
    const email = loginForm.email.trim();
    if (!name || !email) {
      setError("请填写姓名和邮箱");
      return;
    }
    const user = loginUser(name, email);
    setCurrentUser(user);
  };

  const toggleSourceType = (type: DataSourceType) => {
    setSelectedSourceTypes((prev) =>
      prev.includes(type) ? prev.filter((item) => item !== type) : [...prev, type]
    );
  };

  const handleNextStep = () => {
    setError("");
    const requiredValues = [
      companyInfo.companyName,
      companyInfo.industry,
      companyInfo.size,
      companyInfo.region,
      companyInfo.businessModel,
      companyInfo.coreGoals,
    ];
    if (requiredValues.some((v) => !v.trim())) {
      setError("请完整填写企业信息");
      return;
    }
    setOnboardStep(1);
  };

  const handleCompleteOnboarding = async () => {
    setError("");
    if (!sourceConfigs.length) {
      setError("请至少选择一个数据源");
      return;
    }

    setLoadingProfile(true);
    try {
      let profileData: { summary: string; analysisFocuses: string[]; recommendedMetrics: string[] };

      try {
        const aiConfig = getAIConfig();
        const res = await fetch("/api/company-profile", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ companyInfo, dataSources: sourceConfigs, aiConfig: aiConfig.apiKey ? aiConfig : undefined }),
        });
        const ct = res.headers.get("content-type") || "";
        if (!res.ok || !ct.includes("application/json")) throw new Error("API 不可用");
        profileData = await res.json();
      } catch {
        // fallback: 本地生成画像
        profileData = {
          summary: `${companyInfo.companyName} 属于${companyInfo.industry}行业，当前业务目标是${companyInfo.coreGoals}。已接入 ${sourceConfigs.length} 个数据源，可用于构建统一经营分析视图。`,
          analysisFocuses: ["收入增长趋势与异常波动", "渠道转化漏斗与客户分层", "区域/产品利润结构优化"],
          recommendedMetrics: ["营收、毛利率、客单价", "获客成本、留存率、复购率", "库存周转、履约时效、退款率"],
        };
      }

      const nextUser = completeOnboarding(companyInfo, sourceConfigs, {
        summary: profileData.summary || "",
        analysisFocuses: profileData.analysisFocuses || [],
        recommendedMetrics: profileData.recommendedMetrics || [],
      });
      setCurrentUser(nextUser);
      router.push("/chat");
    } catch (err) {
      setError(err instanceof Error ? err.message : "画像生成失败");
    } finally {
      setLoadingProfile(false);
    }
  };

  const handleLogout = () => {
    logoutUser();
    setCurrentUser(null);
  };

  if (!hydrated) {
    return <div className="min-h-screen bg-base" />;
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center relative overflow-hidden">
      {/* Background glow */}
      <div className="absolute top-[-40%] left-1/2 -translate-x-1/2 w-[800px] h-[800px] rounded-full bg-accent/[0.03] blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[400px] h-[400px] rounded-full bg-indigo-500/[0.02] blur-[80px] pointer-events-none" />

      <div className="w-full max-w-2xl px-6 relative z-10">
        {/* Brand */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-accent/[0.08] border border-accent/20 mb-6">
            <div className="glow-dot" style={{ background: "var(--accent)", boxShadow: "0 0 8px var(--accent)" }} />
            <span className="text-xs font-medium text-accent tracking-wide">AI-Powered Analytics</span>
          </div>
          <h1 className="text-4xl sm:text-5xl font-bold tracking-tight text-txt-primary mb-3">
            BizLens
          </h1>
          <p className="text-txt-secondary text-base max-w-md mx-auto leading-relaxed">
            智能商业分析平台，对话即洞察
          </p>
        </div>

        {/* Login */}
        {!currentUser && (
          <form
            onSubmit={handleLogin}
            className="glass-card rounded-2xl p-8 space-y-5 animate-fade-in-up"
          >
            <div className="space-y-1">
              <h2 className="text-lg font-semibold text-txt-primary">登录</h2>
              <p className="text-sm text-txt-tertiary">输入信息开始使用</p>
            </div>
            <div className="space-y-3">
              <input
                value={loginForm.name}
                onChange={(e) => setLoginForm((prev) => ({ ...prev, name: e.target.value }))}
                placeholder="姓名"
                className="input-base w-full rounded-xl px-4 py-3 text-sm"
              />
              <input
                value={loginForm.email}
                onChange={(e) => setLoginForm((prev) => ({ ...prev, email: e.target.value }))}
                placeholder="邮箱"
                type="email"
                className="input-base w-full rounded-xl px-4 py-3 text-sm"
              />
            </div>
            {error && <p className="text-red-400 text-sm">{error}</p>}
            <button type="submit" className="btn-primary w-full rounded-xl py-3 text-sm">
              进入平台
            </button>
          </form>
        )}

        {/* Onboarding */}
        {currentUser && !currentUser.isOnboarded && (
          <div className="glass-card rounded-2xl p-8 animate-fade-in-up">
            <div className="flex items-center justify-between mb-8">
              <div className="space-y-1">
                <h2 className="text-lg font-semibold text-txt-primary">初始化配置</h2>
                <p className="text-sm text-txt-tertiary">帮助 AI 理解你的业务</p>
              </div>
              <div className="flex items-center gap-4">
                <StepIndicator current={onboardStep} total={2} />
                <button
                  type="button"
                  onClick={handleLogout}
                  className="text-xs text-txt-tertiary hover:text-txt-secondary transition-colors"
                >
                  退出
                </button>
              </div>
            </div>

            {onboardStep === 0 && (
              <div className="space-y-4 animate-fade-in-up">
                <div className="grid sm:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-txt-secondary">公司名称</label>
                    <input
                      value={companyInfo.companyName}
                      onChange={(e) => setCompanyInfo((prev) => ({ ...prev, companyName: e.target.value }))}
                      className="input-base w-full rounded-xl px-4 py-2.5 text-sm"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-txt-secondary">行业</label>
                    <input
                      value={companyInfo.industry}
                      onChange={(e) => setCompanyInfo((prev) => ({ ...prev, industry: e.target.value }))}
                      className="input-base w-full rounded-xl px-4 py-2.5 text-sm"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-txt-secondary">企业规模</label>
                    <input
                      value={companyInfo.size}
                      onChange={(e) => setCompanyInfo((prev) => ({ ...prev, size: e.target.value }))}
                      className="input-base w-full rounded-xl px-4 py-2.5 text-sm"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-txt-secondary">业务区域</label>
                    <input
                      value={companyInfo.region}
                      onChange={(e) => setCompanyInfo((prev) => ({ ...prev, region: e.target.value }))}
                      className="input-base w-full rounded-xl px-4 py-2.5 text-sm"
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-txt-secondary">业务模式</label>
                  <input
                    value={companyInfo.businessModel}
                    onChange={(e) => setCompanyInfo((prev) => ({ ...prev, businessModel: e.target.value }))}
                    className="input-base w-full rounded-xl px-4 py-2.5 text-sm"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-txt-secondary">核心目标</label>
                  <textarea
                    value={companyInfo.coreGoals}
                    onChange={(e) => setCompanyInfo((prev) => ({ ...prev, coreGoals: e.target.value }))}
                    rows={2}
                    className="input-base w-full rounded-xl px-4 py-2.5 text-sm resize-none"
                  />
                </div>
                {error && <p className="text-red-400 text-sm">{error}</p>}
                <button
                  type="button"
                  onClick={handleNextStep}
                  className="btn-primary w-full rounded-xl py-3 text-sm"
                >
                  下一步
                </button>
              </div>
            )}

            {onboardStep === 1 && (
              <div className="space-y-5 animate-fade-in-up">
                <div>
                  <p className="text-sm text-txt-secondary mb-3">选择数据来源</p>
                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                    {DATA_SOURCE_OPTIONS.map((option) => (
                      <button
                        key={option.type}
                        type="button"
                        onClick={() => toggleSourceType(option.type)}
                        className={`group rounded-xl px-3 py-2.5 text-left transition-all duration-200 ${
                          selectedSourceTypes.includes(option.type)
                            ? "bg-accent/10 border border-accent/30 ring-1 ring-accent/10"
                            : "bg-white/[0.02] border border-border-subtle hover:bg-white/[0.04] hover:border-border-default"
                        }`}
                      >
                        <div className={`text-xs font-medium ${selectedSourceTypes.includes(option.type) ? "text-accent" : "text-txt-primary"}`}>
                          {option.label}
                        </div>
                        <div className="text-[10px] text-txt-tertiary mt-0.5">{option.desc}</div>
                      </button>
                    ))}
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-txt-secondary">补充说明（可选）</label>
                  <textarea
                    value={sourceDetailText}
                    onChange={(e) => setSourceDetailText(e.target.value)}
                    rows={2}
                    placeholder="描述各数据源的用途..."
                    className="input-base w-full rounded-xl px-4 py-2.5 text-sm resize-none"
                  />
                </div>
                {error && <p className="text-red-400 text-sm">{error}</p>}
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setOnboardStep(0)}
                    className="btn-ghost rounded-xl px-6 py-3 text-sm"
                  >
                    上一步
                  </button>
                  <button
                    type="button"
                    onClick={handleCompleteOnboarding}
                    disabled={loadingProfile}
                    className="btn-primary flex-1 rounded-xl py-3 text-sm"
                  >
                    {loadingProfile ? (
                      <span className="flex items-center justify-center gap-2">
                        <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                        AI 正在分析...
                      </span>
                    ) : (
                      "完成配置"
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Welcome back */}
        {currentUser?.isOnboarded && (
          <div className="text-center space-y-8 animate-fade-in-up">
            <div className="space-y-3">
              <p className="text-txt-secondary">
                欢迎回来，<span className="text-txt-primary font-medium">{currentUser.name}</span>
              </p>
              <p className="text-sm text-txt-tertiary">企业画像已就绪</p>
            </div>
            <Link
              href="/chat"
              className="btn-primary inline-flex items-center gap-2 rounded-xl px-8 py-3.5 text-sm"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M2 3.5C2 2.67 2.67 2 3.5 2h9c.83 0 1.5.67 1.5 1.5v7c0 .83-.67 1.5-1.5 1.5H5L2 14.5V3.5z" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              开始对话
            </Link>
            <div>
              <button
                type="button"
                onClick={handleLogout}
                className="text-xs text-txt-tertiary hover:text-txt-secondary transition-colors"
              >
                退出登录
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
