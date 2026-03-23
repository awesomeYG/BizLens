"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { CompanyInfo, CompanyProfile, DataSourceConfig, DataSourceType } from "@/lib/types";
import { completeOnboarding, getCurrentUser, MOCK_DATA } from "@/lib/user-store";

const DATA_SOURCE_OPTIONS: Array<{ value: DataSourceType; label: string }> = [
  { value: "mysql", label: "MySQL" },
  { value: "postgresql", label: "PostgreSQL" },
  { value: "api", label: "API" },
  { value: "csv", label: "CSV / Excel" },
  { value: "mongodb", label: "MongoDB" },
  { value: "other", label: "其他" },
];

const DATABASE_SOURCE_TYPES: DataSourceType[] = [
  "mysql",
  "postgresql",
  "sqlserver",
  "oracle",
  "mongodb",
  "redis",
  "elasticsearch",
  "clickhouse",
  "snowflake",
  "bigquery",
  "hive",
  "spark",
  "kafka",
];

const DEFAULT_PORT_BY_SOURCE_TYPE: Partial<Record<DataSourceType, string>> = {
  mysql: "3306",
  postgresql: "5432",
  sqlserver: "1433",
  oracle: "1521",
  mongodb: "27017",
  redis: "6379",
  elasticsearch: "9200",
  clickhouse: "8123",
  snowflake: "443",
  bigquery: "443",
  hive: "10000",
  spark: "7077",
  kafka: "9092",
};

const HOST_PLACEHOLDER_BY_SOURCE_TYPE: Partial<Record<DataSourceType, string>> = {
  mysql: "mysql.prod.internal",
  postgresql: "postgres.analytics.internal",
  sqlserver: "sqlserver.corp.internal",
  oracle: "oracle.erp.internal",
  mongodb: "mongo.cluster.internal",
  redis: "redis.cache.internal",
  elasticsearch: "es.search.internal",
  clickhouse: "clickhouse.bi.internal",
  snowflake: "account.region.snowflakecomputing.com",
  bigquery: "bigquery.googleapis.com",
  hive: "hive.hadoop.internal",
  spark: "spark-master.internal",
  kafka: "kafka-broker.internal",
};

const DATABASE_PLACEHOLDER_BY_SOURCE_TYPE: Partial<Record<DataSourceType, string>> = {
  mysql: "orders_prod",
  postgresql: "analytics",
  sqlserver: "crm",
  oracle: "ORCL",
  mongodb: "customer_profile",
  redis: "0",
  elasticsearch: "orders-*",
  clickhouse: "warehouse",
  snowflake: "ANALYTICS_WH",
  bigquery: "project.dataset",
  hive: "ods_sales",
  spark: "lakehouse",
  kafka: "orders-topic",
};

export default function OnboardingPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [testing, setTesting] = useState(false);
  const [error, setError] = useState("");
  const [testResult, setTestResult] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [companyInfo, setCompanyInfo] = useState<CompanyInfo>({
    companyName: "",
    industry: "",
    size: "",
    region: "",
    businessModel: "",
    coreGoals: "",
  });
  const [dataSource, setDataSource] = useState({
    name: "",
    type: "mysql" as DataSourceType,
    description: "",
    host: "",
    port: "3306",
    database: "",
    username: "",
    password: "",
    ssl: false,
    apiUrl: "",
    apiMethod: "GET" as "GET" | "POST",
    authType: "none" as "none" | "bearer" | "basic" | "apikey",
    authToken: "",
    headers: "",
    fileName: "",
    fileSize: "",
  });
  const [analysisFocuses, setAnalysisFocuses] = useState([
    "收入增长趋势",
    "客户留存与复购",
    "利润结构优化",
  ]);
  const [recommendedMetrics, setRecommendedMetrics] = useState([
    "营收",
    "毛利率",
    "复购率",
  ]);

  useEffect(() => {
    const user = getCurrentUser();
    if (!user) {
      router.replace("/auth/login");
      return;
    }

    if (user.isOnboarded) {
      router.replace("/dashboards");
      return;
    }

    setReady(true);
  }, [router]);

  const updateFocus = (index: number, value: string) => {
    setAnalysisFocuses((current) => current.map((item, idx) => (idx === index ? value : item)));
  };

  const updateMetric = (index: number, value: string) => {
    setRecommendedMetrics((current) => current.map((item, idx) => (idx === index ? value : item)));
  };

  const handleDataSourceTypeChange = (type: DataSourceType) => {
    setDataSource((current) => ({
      ...current,
      type,
      port: DEFAULT_PORT_BY_SOURCE_TYPE[type] ?? current.port,
    }));
    setTestResult(null);
  };

  const isDatabaseSource = DATABASE_SOURCE_TYPES.includes(dataSource.type);
  const isApiSource = dataSource.type === "api";
  const isFileSource = dataSource.type === "csv" || dataSource.type === "excel";

  const buildNormalizedDataSource = (): DataSourceConfig => {
    const normalizedDataSource: DataSourceConfig = {
      id: `manual-${Date.now()}`,
      name: dataSource.name.trim(),
      type: dataSource.type,
      description: dataSource.description.trim(),
      status: "connected",
      lastSyncAt: Date.now(),
    };

    if (isDatabaseSource) {
      normalizedDataSource.connection = {
        host: dataSource.host.trim(),
        port: Number(dataSource.port),
        database: dataSource.database.trim(),
        username: dataSource.username.trim(),
        password: dataSource.password,
        ssl: dataSource.ssl,
      };
    }

    if (isApiSource) {
      const headers = Object.fromEntries(
        dataSource.headers
          .split("\n")
          .map((line) => line.trim())
          .filter(Boolean)
          .map((line) => {
            const [key, ...rest] = line.split(":");
            return [key.trim(), rest.join(":").trim()];
          })
          .filter(([key]) => key)
      );

      normalizedDataSource.apiConfig = {
        url: dataSource.apiUrl.trim(),
        method: dataSource.apiMethod,
        authType: dataSource.authType,
        authToken: dataSource.authToken.trim() || undefined,
        headers: Object.keys(headers).length ? headers : undefined,
      };
    }

    if (isFileSource) {
      normalizedDataSource.fileConfig = {
        fileName: dataSource.fileName.trim(),
        fileSize: Number(dataSource.fileSize) || 0,
        uploadedAt: Date.now(),
      };
    }

    return normalizedDataSource;
  };

  const validateDataSource = (normalizedDataSource: DataSourceConfig): string | null => {
    if (!normalizedDataSource.name) {
      return "请至少填写一个数据源名称。";
    }

    if (isDatabaseSource) {
      const connection = normalizedDataSource.connection;
      if (!connection || !connection.host || !connection.port || !connection.database || !connection.username || !connection.password) {
        return "请完整填写数据库连接信息。";
      }
    }

    if (isApiSource && !normalizedDataSource.apiConfig?.url) {
      return "请填写 API 地址。";
    }

    if (isFileSource && !normalizedDataSource.fileConfig?.fileName) {
      return "请填写文件名。";
    }

    return null;
  };

  const handleTestConnection = async () => {
    const normalizedDataSource = buildNormalizedDataSource();
    const validationError = validateDataSource(normalizedDataSource);

    if (validationError) {
      setTestResult({ type: "error", message: validationError });
      return;
    }

    setTesting(true);
    setTestResult(null);

    try {
      const response = await fetch("/api/data-source/test", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ dataSource: normalizedDataSource }),
      });
      const payload = (await response.json()) as { ok?: boolean; message?: string; error?: string };

      if (!response.ok) {
        setTestResult({ type: "error", message: payload.error || "测试连接失败" });
        return;
      }

      setTestResult({ type: "success", message: payload.message || "测试连接成功" });
    } catch {
      setTestResult({ type: "error", message: "测试连接失败，请稍后重试" });
    } finally {
      setTesting(false);
    }
  };

  const handleComplete = async () => {
    const normalizedCompanyInfo: CompanyInfo = {
      companyName: companyInfo.companyName.trim(),
      industry: companyInfo.industry.trim(),
      size: companyInfo.size.trim(),
      region: companyInfo.region.trim(),
      businessModel: companyInfo.businessModel.trim(),
      coreGoals: companyInfo.coreGoals.trim(),
    };

    const normalizedDataSource = buildNormalizedDataSource();

    if (Object.values(normalizedCompanyInfo).some((value) => !value)) {
      setError("请完整填写公司信息。");
      return;
    }

    const dataSourceError = validateDataSource(normalizedDataSource);
    if (dataSourceError) {
      setError(dataSourceError);
      return;
    }

    setError("");
    setSubmitting(true);

    let companyProfile: CompanyProfile = {
      summary: `${normalizedCompanyInfo.companyName} 正在建设以 ${normalizedCompanyInfo.coreGoals} 为核心目标的数据分析体系。`,
      analysisFocuses: analysisFocuses.map((item) => item.trim()).filter(Boolean).slice(0, 3),
      recommendedMetrics: recommendedMetrics.map((item) => item.trim()).filter(Boolean).slice(0, 3),
    };

    try {
      const response = await fetch("/api/company-profile", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          companyInfo: normalizedCompanyInfo,
          dataSources: [normalizedDataSource],
        }),
      });

      if (response.ok) {
        const profile = (await response.json()) as CompanyProfile;
        companyProfile = {
          summary: profile.summary,
          analysisFocuses: profile.analysisFocuses?.length
            ? profile.analysisFocuses.slice(0, 3)
            : companyProfile.analysisFocuses,
          recommendedMetrics: profile.recommendedMetrics?.length
            ? profile.recommendedMetrics.slice(0, 3)
            : companyProfile.recommendedMetrics,
        };
      }
    } catch {
      // ignore profile generation failure and fallback to form values
    }

    completeOnboarding(normalizedCompanyInfo, [normalizedDataSource], companyProfile);
    router.replace("/dashboard");
  };

  if (!ready) {
    return <div className="min-h-screen bg-zinc-950" />;
  }

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100 px-6 py-12">
      <div className="mx-auto max-w-4xl">
        <div className="mb-10">
          <div className="inline-flex items-center rounded-full border border-cyan-500/30 bg-cyan-500/10 px-3 py-1 text-xs text-cyan-300">
            首次使用引导
          </div>
          <h1 className="mt-4 text-4xl font-semibold tracking-tight">先完成初始化，再进入数据大屏</h1>
          <p className="mt-3 max-w-2xl text-zinc-400">
            你当前还没有完成系统初始化。完成后，数据大屏、告警和报表页面就会按同一套业务上下文工作。
          </p>
        </div>

        <div className="grid gap-8 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="space-y-6">
            <section className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-6">
              <h2 className="text-lg font-medium">1. 公司信息</h2>
              <div className="mt-5 grid gap-4 md:grid-cols-2">
                <label className="text-sm text-zinc-300">
                  公司名称
                  <input value={companyInfo.companyName} onChange={(e) => setCompanyInfo((current) => ({ ...current, companyName: e.target.value }))} className="mt-2 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-zinc-100 outline-none transition focus:border-cyan-500" />
                </label>
                <label className="text-sm text-zinc-300">
                  所属行业
                  <input value={companyInfo.industry} onChange={(e) => setCompanyInfo((current) => ({ ...current, industry: e.target.value }))} className="mt-2 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-zinc-100 outline-none transition focus:border-cyan-500" />
                </label>
                <label className="text-sm text-zinc-300">
                  公司规模
                  <input value={companyInfo.size} onChange={(e) => setCompanyInfo((current) => ({ ...current, size: e.target.value }))} className="mt-2 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-zinc-100 outline-none transition focus:border-cyan-500" />
                </label>
                <label className="text-sm text-zinc-300">
                  区域市场
                  <input value={companyInfo.region} onChange={(e) => setCompanyInfo((current) => ({ ...current, region: e.target.value }))} className="mt-2 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-zinc-100 outline-none transition focus:border-cyan-500" />
                </label>
              </div>
              <div className="mt-4 grid gap-4">
                <label className="text-sm text-zinc-300">
                  商业模式
                  <input value={companyInfo.businessModel} onChange={(e) => setCompanyInfo((current) => ({ ...current, businessModel: e.target.value }))} className="mt-2 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-zinc-100 outline-none transition focus:border-cyan-500" />
                </label>
                <label className="text-sm text-zinc-300">
                  核心目标
                  <textarea value={companyInfo.coreGoals} onChange={(e) => setCompanyInfo((current) => ({ ...current, coreGoals: e.target.value }))} rows={3} className="mt-2 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-zinc-100 outline-none transition focus:border-cyan-500" />
                </label>
              </div>
            </section>

            <section className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-6">
              <h2 className="text-lg font-medium">2. 数据源</h2>
              <div className="mt-5 grid gap-4 md:grid-cols-2">
                <label className="text-sm text-zinc-300">
                  数据源名称
                  <input value={dataSource.name} onChange={(e) => setDataSource((current) => ({ ...current, name: e.target.value }))} className="mt-2 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-zinc-100 outline-none transition focus:border-cyan-500" placeholder="例如：订单主库" />
                </label>
                <label className="text-sm text-zinc-300">
                  数据源类型
                  <select value={dataSource.type} onChange={(e) => handleDataSourceTypeChange(e.target.value as DataSourceType)} className="mt-2 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-zinc-100 outline-none transition focus:border-cyan-500">
                    {DATA_SOURCE_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                </label>
              </div>
              <label className="mt-4 block text-sm text-zinc-300">
                数据说明
                <textarea value={dataSource.description} onChange={(e) => setDataSource((current) => ({ ...current, description: e.target.value }))} rows={3} className="mt-2 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-zinc-100 outline-none transition focus:border-cyan-500" placeholder="例如：包含订单、支付、退款、用户标签等经营明细" />
              </label>

              {isDatabaseSource ? (
                <div className="mt-4 grid gap-4 md:grid-cols-2">
                  <label className="text-sm text-zinc-300">
                    Host
                    <input value={dataSource.host} onChange={(e) => setDataSource((current) => ({ ...current, host: e.target.value }))} className="mt-2 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-zinc-100 outline-none transition focus:border-cyan-500" placeholder={HOST_PLACEHOLDER_BY_SOURCE_TYPE[dataSource.type] || "db.example.internal"} />
                  </label>
                  <label className="text-sm text-zinc-300">
                    Port
                    <input value={dataSource.port} onChange={(e) => setDataSource((current) => ({ ...current, port: e.target.value }))} className="mt-2 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-zinc-100 outline-none transition focus:border-cyan-500" placeholder="3306" />
                  </label>
                  <label className="text-sm text-zinc-300">
                    Database
                    <input value={dataSource.database} onChange={(e) => setDataSource((current) => ({ ...current, database: e.target.value }))} className="mt-2 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-zinc-100 outline-none transition focus:border-cyan-500" placeholder={DATABASE_PLACEHOLDER_BY_SOURCE_TYPE[dataSource.type] || "orders_prod"} />
                  </label>
                  <label className="text-sm text-zinc-300">
                    Username
                    <input value={dataSource.username} onChange={(e) => setDataSource((current) => ({ ...current, username: e.target.value }))} className="mt-2 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-zinc-100 outline-none transition focus:border-cyan-500" placeholder="bi_reader" />
                  </label>
                  <label className="text-sm text-zinc-300 md:col-span-2">
                    Password
                    <input type="password" value={dataSource.password} onChange={(e) => setDataSource((current) => ({ ...current, password: e.target.value }))} className="mt-2 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-zinc-100 outline-none transition focus:border-cyan-500" placeholder="输入访问密码" />
                  </label>
                  <label className="md:col-span-2 flex items-center gap-3 rounded-xl border border-zinc-800 bg-zinc-950/60 px-4 py-3 text-sm text-zinc-300">
                    <input type="checkbox" checked={dataSource.ssl} onChange={(e) => setDataSource((current) => ({ ...current, ssl: e.target.checked }))} className="h-4 w-4 rounded border-zinc-600 bg-zinc-900" />
                    启用 SSL / TLS
                  </label>
                </div>
              ) : null}

              {isApiSource ? (
                <div className="mt-4 grid gap-4 md:grid-cols-2">
                  <label className="text-sm text-zinc-300 md:col-span-2">
                    API URL
                    <input value={dataSource.apiUrl} onChange={(e) => setDataSource((current) => ({ ...current, apiUrl: e.target.value }))} className="mt-2 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-zinc-100 outline-none transition focus:border-cyan-500" placeholder="https://api.example.com/v1/reports" />
                  </label>
                  <label className="text-sm text-zinc-300">
                    Method
                    <select value={dataSource.apiMethod} onChange={(e) => setDataSource((current) => ({ ...current, apiMethod: e.target.value as "GET" | "POST" }))} className="mt-2 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-zinc-100 outline-none transition focus:border-cyan-500">
                      <option value="GET">GET</option>
                      <option value="POST">POST</option>
                    </select>
                  </label>
                  <label className="text-sm text-zinc-300">
                    认证方式
                    <select value={dataSource.authType} onChange={(e) => setDataSource((current) => ({ ...current, authType: e.target.value as "none" | "bearer" | "basic" | "apikey" }))} className="mt-2 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-zinc-100 outline-none transition focus:border-cyan-500">
                      <option value="none">无</option>
                      <option value="bearer">Bearer Token</option>
                      <option value="basic">Basic</option>
                      <option value="apikey">API Key</option>
                    </select>
                  </label>
                  <label className="text-sm text-zinc-300 md:col-span-2">
                    Token / 密钥
                    <input type="password" value={dataSource.authToken} onChange={(e) => setDataSource((current) => ({ ...current, authToken: e.target.value }))} className="mt-2 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-zinc-100 outline-none transition focus:border-cyan-500" placeholder="如有鉴权可填" />
                  </label>
                  <label className="text-sm text-zinc-300 md:col-span-2">
                    Headers
                    <textarea value={dataSource.headers} onChange={(e) => setDataSource((current) => ({ ...current, headers: e.target.value }))} rows={3} className="mt-2 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-zinc-100 outline-none transition focus:border-cyan-500" placeholder={"Authorization: Bearer xxx\nX-Tenant-Id: demo"} />
                  </label>
                </div>
              ) : null}

              {isFileSource ? (
                <div className="mt-4 grid gap-4 md:grid-cols-2">
                  <label className="text-sm text-zinc-300">
                    文件名
                    <input value={dataSource.fileName} onChange={(e) => setDataSource((current) => ({ ...current, fileName: e.target.value }))} className="mt-2 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-zinc-100 outline-none transition focus:border-cyan-500" placeholder="sales-report-2026.csv" />
                  </label>
                  <label className="text-sm text-zinc-300">
                    文件大小（字节）
                    <input value={dataSource.fileSize} onChange={(e) => setDataSource((current) => ({ ...current, fileSize: e.target.value }))} className="mt-2 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-zinc-100 outline-none transition focus:border-cyan-500" placeholder="204800" />
                  </label>
                </div>
              ) : null}
            </section>

            <section className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-6">
              <h2 className="text-lg font-medium">3. 分析偏好</h2>
              <div className="mt-5 grid gap-6 md:grid-cols-2">
                <div>
                  <p className="text-sm text-zinc-400">重点分析方向</p>
                  <div className="mt-3 space-y-3">
                    {analysisFocuses.map((item, index) => (
                      <input key={`focus-${index}`} value={item} onChange={(e) => updateFocus(index, e.target.value)} className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-zinc-100 outline-none transition focus:border-cyan-500" />
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-sm text-zinc-400">推荐指标</p>
                  <div className="mt-3 space-y-3">
                    {recommendedMetrics.map((item, index) => (
                      <input key={`metric-${index}`} value={item} onChange={(e) => updateMetric(index, e.target.value)} className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-zinc-100 outline-none transition focus:border-cyan-500" />
                    ))}
                  </div>
                </div>
              </div>
            </section>
          </div>

          <aside className="space-y-6">
            <section className="rounded-2xl border border-cyan-500/20 bg-gradient-to-br from-cyan-500/10 to-sky-500/5 p-6">
              <h2 className="text-xl font-medium">完成初始化</h2>
              <p className="mt-3 text-sm text-zinc-300">
                提交后我会根据公司信息和数据源生成一份初始画像，并把当前账号标记为已完成 onboarding。
              </p>
              {error ? <p className="mt-4 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">{error}</p> : null}
              {testResult ? <p className={`mt-4 rounded-xl border px-4 py-3 text-sm ${testResult.type === "success" ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-200" : "border-amber-500/30 bg-amber-500/10 text-amber-200"}`}>{testResult.message}</p> : null}
              <div className="mt-6 flex flex-col gap-3">
                <button
                  onClick={handleTestConnection}
                  disabled={testing || submitting}
                  className="rounded-xl border border-cyan-500/40 px-5 py-3 font-medium text-cyan-200 transition hover:border-cyan-400 hover:bg-cyan-500/10 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {testing ? "测试中..." : "测试连接"}
                </button>
                <button
                  onClick={handleComplete}
                  disabled={submitting}
                  className="rounded-xl bg-cyan-500 px-5 py-3 font-medium text-slate-950 transition hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {submitting ? "初始化中..." : "完成初始化并进入大屏"}
                </button>
                <button
                  onClick={() => {
                    completeOnboarding(MOCK_DATA.companyInfo, MOCK_DATA.dataSources, MOCK_DATA.companyProfile);
                    router.replace("/dashboard");
                  }}
                  className="rounded-xl border border-zinc-700 px-5 py-3 font-medium text-zinc-200 transition hover:border-zinc-500 hover:bg-zinc-800"
                >
                  使用演示数据快速体验
                </button>
              </div>
            </section>

            <section className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-6 text-sm text-zinc-400">
              <h2 className="text-lg font-medium text-zinc-100">填写建议</h2>
              <ul className="mt-4 space-y-3">
                <li>公司信息尽量写业务语言，便于后续 AI 生成更贴近场景的分析建议。</li>
                <li>数据源先填一个最核心的业务库即可，后面可以继续扩展。</li>
                <li>分析偏好会直接影响默认大屏和告警的方向。</li>
              </ul>
            </section>
          </aside>
        </div>
      </div>
    </main>
  );
}
