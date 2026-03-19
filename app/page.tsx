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

  const handleCompleteOnboarding = async (e: React.SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();
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
      setError("请完整填写公司信息");
      return;
    }
    if (!sourceConfigs.length) {
      setError("请至少选择一个数据源");
      return;
    }

    setLoadingProfile(true);
    try {
      const res = await fetch("/api/company-profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyInfo,
          dataSources: sourceConfigs,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "画像生成失败");

      const nextUser = completeOnboarding(companyInfo, sourceConfigs, {
        summary: data.summary || "",
        analysisFocuses: data.analysisFocuses || [],
        recommendedMetrics: data.recommendedMetrics || [],
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
    return <div className="min-h-screen bg-slate-900" />;
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      <div className="w-full max-w-4xl px-6">
        <div className="text-center space-y-3 mb-8">
          <h1 className="text-5xl font-bold bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent">
            AI BI 智能数据分析
          </h1>
          <p className="text-slate-400 text-lg">
            登录后接入公司数据源，让 AI 先理解企业，再进行后续分析
          </p>
        </div>

        {!currentUser && (
          <form
            onSubmit={handleLogin}
            className="mx-auto max-w-xl rounded-2xl border border-slate-700 bg-slate-800/60 p-6 space-y-4"
          >
            <h2 className="text-xl text-slate-100 font-semibold">登录</h2>
            <input
              value={loginForm.name}
              onChange={(e) => setLoginForm((prev) => ({ ...prev, name: e.target.value }))}
              placeholder="姓名"
              className="w-full rounded-lg bg-slate-700 border border-slate-600 px-3 py-2 text-slate-100"
            />
            <input
              value={loginForm.email}
              onChange={(e) => setLoginForm((prev) => ({ ...prev, email: e.target.value }))}
              placeholder="邮箱"
              type="email"
              className="w-full rounded-lg bg-slate-700 border border-slate-600 px-3 py-2 text-slate-100"
            />
            {error ? <p className="text-red-400 text-sm">{error}</p> : null}
            <button
              type="submit"
              className="w-full rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white py-2 font-medium"
            >
              进入平台
            </button>
          </form>
        )}

        {currentUser && !currentUser.isOnboarded && (
          <form
            onSubmit={handleCompleteOnboarding}
            className="rounded-2xl border border-slate-700 bg-slate-800/60 p-6 space-y-5"
          >
            <div className="flex items-center justify-between">
              <h2 className="text-xl text-slate-100 font-semibold">新用户初始化</h2>
              <button
                type="button"
                onClick={handleLogout}
                className="text-sm text-slate-400 hover:text-slate-300"
              >
                退出登录
              </button>
            </div>

            <div className="grid sm:grid-cols-2 gap-3">
              <input
                value={companyInfo.companyName}
                onChange={(e) =>
                  setCompanyInfo((prev) => ({ ...prev, companyName: e.target.value }))
                }
                placeholder="公司名称"
                className="rounded-lg bg-slate-700 border border-slate-600 px-3 py-2 text-slate-100"
              />
              <input
                value={companyInfo.industry}
                onChange={(e) => setCompanyInfo((prev) => ({ ...prev, industry: e.target.value }))}
                placeholder="行业（如电商、制造）"
                className="rounded-lg bg-slate-700 border border-slate-600 px-3 py-2 text-slate-100"
              />
              <input
                value={companyInfo.size}
                onChange={(e) => setCompanyInfo((prev) => ({ ...prev, size: e.target.value }))}
                placeholder="企业规模（如 200-500 人）"
                className="rounded-lg bg-slate-700 border border-slate-600 px-3 py-2 text-slate-100"
              />
              <input
                value={companyInfo.region}
                onChange={(e) => setCompanyInfo((prev) => ({ ...prev, region: e.target.value }))}
                placeholder="业务区域（如华东 + 东南亚）"
                className="rounded-lg bg-slate-700 border border-slate-600 px-3 py-2 text-slate-100"
              />
            </div>

            <input
              value={companyInfo.businessModel}
              onChange={(e) => setCompanyInfo((prev) => ({ ...prev, businessModel: e.target.value }))}
              placeholder="业务模式（如 B2B SaaS、D2C）"
              className="w-full rounded-lg bg-slate-700 border border-slate-600 px-3 py-2 text-slate-100"
            />
            <textarea
              value={companyInfo.coreGoals}
              onChange={(e) => setCompanyInfo((prev) => ({ ...prev, coreGoals: e.target.value }))}
              placeholder="核心目标（如提升复购率、降低库存资金占用）"
              rows={3}
              className="w-full rounded-lg bg-slate-700 border border-slate-600 px-3 py-2 text-slate-100"
            />

            <div>
              <p className="text-slate-300 text-sm mb-2">
                选择数据来源（可多选，支持 SQL/NoSQL/文件/API/流式数据）
              </p>
              <div className="grid sm:grid-cols-3 gap-2">
                {DATA_SOURCE_OPTIONS.map((option) => (
                  <button
                    key={option.type}
                    type="button"
                    onClick={() => toggleSourceType(option.type)}
                    className={`rounded-lg border px-3 py-2 text-sm text-left ${
                      selectedSourceTypes.includes(option.type)
                        ? "border-cyan-500 bg-cyan-500/20 text-cyan-200"
                        : "border-slate-600 bg-slate-700/50 text-slate-300"
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>

            <textarea
              value={sourceDetailText}
              onChange={(e) => setSourceDetailText(e.target.value)}
              placeholder="补充数据说明（例如：MySQL 存交易单、Kafka 存埋点流、S3 存日志）"
              rows={3}
              className="w-full rounded-lg bg-slate-700 border border-slate-600 px-3 py-2 text-slate-100"
            />

            {error ? <p className="text-red-400 text-sm">{error}</p> : null}
            <button
              disabled={loadingProfile}
              type="submit"
              className="w-full rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-70 text-white py-2 font-medium"
            >
              {loadingProfile ? "AI 正在分析公司信息..." : "完成初始化并进入分析"}
            </button>
          </form>
        )}

        {currentUser?.isOnboarded && (
          <div className="mx-auto max-w-2xl text-center space-y-6 rounded-2xl border border-slate-700 bg-slate-800/60 p-6">
            <p className="text-slate-300">
              欢迎回来，{currentUser.name}。企业画像已就绪，可直接开始 AI 分析。
            </p>
            <div className="flex gap-6 justify-center flex-wrap">
              <Link
                href="/chat"
                className="px-8 py-4 rounded-xl bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-500/50 text-cyan-300 font-medium transition-all hover:scale-105"
              >
                AI 对话
              </Link>
            </div>
            <button
              type="button"
              onClick={handleLogout}
              className="text-sm text-slate-400 hover:text-slate-300"
            >
              退出登录
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
