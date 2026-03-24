"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import type { DataSourceConfig, DataSourceType } from "@/lib/types";
import { getAccessToken } from "@/lib/auth/api";
import { getCurrentUser, saveOnboardingDraft } from "@/lib/user-store";

const DATA_SOURCE_OPTIONS: Array<{ value: DataSourceType; label: string }> = [
  { value: "mysql", label: "MySQL" },
  { value: "postgresql", label: "PostgreSQL" },
  { value: "sqlite", label: "SQLite" },
  { value: "api", label: "API" },
  { value: "csv", label: "CSV / Excel" },
  { value: "mongodb", label: "MongoDB" },
  { value: "snowflake", label: "Snowflake" },
  { value: "bigquery", label: "BigQuery" },
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

const EMPTY_FORM = {
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
};

export default function DatabaseConnectionTab() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [testing, setTesting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [dataSources, setDataSources] = useState<DataSourceConfig[]>([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [migrated, setMigrated] = useState(false);

  const getTenantId = useCallback(() => {
    const user = getCurrentUser();
    return user?.tenantId || user?.id || "demo-tenant";
  }, []);

  const getAuthHeaders = useCallback((): Record<string, string> => {
    const token = getAccessToken();
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }
    return headers;
  }, []);

  // 从后端加载数据源列表
  const fetchDataSources = useCallback(async () => {
    try {
      const tenantId = getTenantId();
      const response = await fetch(`/api/tenants/${tenantId}/data-sources`, {
        headers: getAuthHeaders(),
      });
      if (response.ok) {
        const data = await response.json();
        setDataSources(Array.isArray(data) ? data : []);
      }
    } catch (err) {
      console.error("获取数据源列表失败:", err);
    } finally {
      setLoading(false);
    }
  }, [getTenantId, getAuthHeaders]);

  // localStorage 数据迁移
  const migrateLocalStorageData = useCallback(async () => {
    if (migrated) return;
    setMigrated(true);

    const user = getCurrentUser();
    const localDataSources = user?.dataSources;
    if (!localDataSources || localDataSources.length === 0) return;

    const tenantId = getTenantId();
    let migratedCount = 0;

    for (const ds of localDataSources) {
      try {
        const body: Record<string, unknown> = {
          type: ds.type,
          name: ds.name,
          description: ds.description || "",
        };

        if (ds.connection) {
          body.connection = ds.connection;
        }
        if (ds.apiConfig) {
          body.apiConfig = {
            url: ds.apiConfig.url,
            method: ds.apiConfig.method,
            headers: ds.apiConfig.headers,
            authType: ds.apiConfig.authType,
            authToken: ds.apiConfig.authToken,
          };
        }
        if (ds.fileConfig) {
          body.fileConfig = ds.fileConfig;
        }

        const response = await fetch(`/api/tenants/${tenantId}/data-sources`, {
          method: "POST",
          headers: getAuthHeaders(),
          body: JSON.stringify(body),
        });

        if (response.ok) {
          migratedCount++;
        }
      } catch {
        // 单条迁移失败不影响其他
      }
    }

    if (migratedCount > 0) {
      // 清除 localStorage 中的旧数据
      saveOnboardingDraft({ dataSources: [] });
      // 重新加载
      await fetchDataSources();
      setMessage({
        type: "success",
        text: `已将 ${migratedCount} 个本地数据源迁移到服务器。`,
      });
    }
  }, [migrated, getTenantId, getAuthHeaders, fetchDataSources]);

  useEffect(() => {
    const user = getCurrentUser();
    if (!user) {
      router.replace("/auth/login");
      return;
    }
    fetchDataSources().then(() => {
      migrateLocalStorageData();
    });
  }, [router, fetchDataSources, migrateLocalStorageData]);

  const handleTypeChange = (type: DataSourceType) => {
    setForm((current) => ({
      ...current,
      type,
      port: DEFAULT_PORT_BY_SOURCE_TYPE[type] ?? current.port,
    }));
    setMessage(null);
  };

  const isDatabaseSource = DATABASE_SOURCE_TYPES.includes(form.type);
  const isSQLiteSource = form.type === "sqlite";
  const isApiSource = form.type === "api";
  const isFileSource = form.type === "csv" || form.type === "excel";

  const buildRequestBody = () => {
    const body: Record<string, unknown> = {
      type: form.type,
      name: form.name.trim(),
      description: form.description.trim(),
    };

    if (isDatabaseSource) {
      body.connection = {
        host: form.host.trim(),
        port: Number(form.port),
        database: form.database.trim(),
        username: form.username.trim(),
        password: form.password,
        ssl: form.ssl,
      };
    }

    if (isSQLiteSource) {
      body.connection = {
        host: "",
        port: 0,
        database: form.database.trim(),
        username: "",
        password: "",
        ssl: false,
      };
    }

    if (isApiSource) {
      const headers = Object.fromEntries(
        form.headers
          .split("\n")
          .map((line) => line.trim())
          .filter(Boolean)
          .map((line) => {
            const [key, ...rest] = line.split(":");
            return [key.trim(), rest.join(":").trim()];
          })
          .filter(([key]) => key)
      );

      body.apiConfig = {
        url: form.apiUrl.trim(),
        method: form.apiMethod,
        authType: form.authType,
        authToken: form.authToken.trim() || undefined,
        headers: Object.keys(headers).length ? headers : undefined,
      };
    }

    if (isFileSource) {
      body.fileConfig = {
        fileName: form.fileName.trim(),
        fileSize: Number(form.fileSize) || 0,
        uploadedAt: Date.now(),
      };
    }

    return body;
  };

  const validateForm = (): string | null => {
    if (!form.name.trim()) {
      return "请至少填写一个数据源名称。";
    }
    if (isDatabaseSource) {
      if (!form.host.trim() || !form.port || !form.database.trim() || !form.username.trim() || !form.password) {
        return "请完整填写数据库连接信息。";
      }
    }
    if (isSQLiteSource && !form.database.trim()) {
      return "请填写 SQLite 文件路径。";
    }
    if (isApiSource && !form.apiUrl.trim()) {
      return "请填写 API 地址。";
    }
    if (isFileSource && !form.fileName.trim()) {
      return "请填写文件名。";
    }
    return null;
  };

  const handleTestConnection = async () => {
    const validationError = validateForm();
    if (validationError) {
      setMessage({ type: "error", text: validationError });
      return;
    }

    setTesting(true);
    setMessage(null);

    try {
      const response = await fetch("/api/data-source/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dataSource: { ...buildRequestBody(), id: `test-${Date.now()}`, status: "disconnected" } }),
      });
      const payload = (await response.json()) as { ok?: boolean; message?: string; error?: string };

      if (!response.ok) {
        setMessage({ type: "error", text: payload.error || "测试连接失败" });
        return;
      }
      setMessage({ type: "success", text: payload.message || "测试连接成功" });
    } catch {
      setMessage({ type: "error", text: "测试连接失败，请稍后重试" });
    } finally {
      setTesting(false);
    }
  };

  const handleSave = async () => {
    const validationError = validateForm();
    if (validationError) {
      setMessage({ type: "error", text: validationError });
      return;
    }

    setSubmitting(true);
    setMessage(null);

    try {
      const tenantId = getTenantId();
      const response = await fetch(`/api/tenants/${tenantId}/data-sources`, {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify(buildRequestBody()),
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        setMessage({ type: "error", text: (err as { error?: string }).error || "保存失败" });
        return;
      }

      const created = await response.json();
      setDataSources((prev) => [...prev, created]);
      setForm(EMPTY_FORM);
      setMessage({ type: "success", text: `已保存数据源"${form.name.trim()}"。你可以继续添加下一个数据源。` });
    } catch {
      setMessage({ type: "error", text: "保存失败，请稍后重试" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr]">
      <section className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-6">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-medium">已保存数据源</h2>
          <span className="rounded-full border border-cyan-500/20 bg-cyan-500/10 px-3 py-1 text-xs text-cyan-200">
            {dataSources.length} 个
          </span>
        </div>

        <div className="mt-5 space-y-3">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-2 border-zinc-700 border-t-cyan-500"></div>
            </div>
          ) : dataSources.length ? (
            dataSources.map((source) => (
              <div key={source.id} className="rounded-xl border border-zinc-800 bg-zinc-950/70 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-medium text-zinc-100">{source.name}</div>
                    <div className="mt-1 text-xs uppercase tracking-wide text-cyan-300">{source.type}</div>
                  </div>
                  <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-1 text-xs text-emerald-200">
                    {source.status || "connected"}
                  </span>
                </div>
                {source.description ? <p className="mt-3 text-sm text-zinc-400">{source.description}</p> : null}
              </div>
            ))
          ) : (
            <div className="rounded-xl border border-dashed border-zinc-700 bg-zinc-950/50 p-4 text-sm text-zinc-400">
              还没有数据源。先在右侧表单里保存第一个数据源。
            </div>
          )}
        </div>
      </section>

      <section className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-6">
        <h2 className="text-lg font-medium">新增数据源</h2>
        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <label className="text-sm text-zinc-300">
            数据源名称
            <input value={form.name} onChange={(e) => setForm((current) => ({ ...current, name: e.target.value }))} className="mt-2 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-zinc-100 outline-none transition focus:border-cyan-500" placeholder="例如：订单主库" />
          </label>
          <label className="text-sm text-zinc-300">
            数据源类型
            <select value={form.type} onChange={(e) => handleTypeChange(e.target.value as DataSourceType)} className="mt-2 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-zinc-100 outline-none transition focus:border-cyan-500">
              {DATA_SOURCE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </label>
        </div>

        <label className="mt-4 block text-sm text-zinc-300">
          数据说明
          <textarea value={form.description} onChange={(e) => setForm((current) => ({ ...current, description: e.target.value }))} rows={3} className="mt-2 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-zinc-100 outline-none transition focus:border-cyan-500" placeholder="例如：包含订单、支付、退款、用户标签等经营明细" />
        </label>

        {isDatabaseSource ? (
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <label className="text-sm text-zinc-300">
              Host
              <input value={form.host} onChange={(e) => setForm((current) => ({ ...current, host: e.target.value }))} className="mt-2 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-zinc-100 outline-none transition focus:border-cyan-500" placeholder={HOST_PLACEHOLDER_BY_SOURCE_TYPE[form.type] || "db.example.internal"} />
            </label>
            <label className="text-sm text-zinc-300">
              Port
              <input value={form.port} onChange={(e) => setForm((current) => ({ ...current, port: e.target.value }))} className="mt-2 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-zinc-100 outline-none transition focus:border-cyan-500" placeholder="3306" />
            </label>
            <label className="text-sm text-zinc-300">
              Database
              <input value={form.database} onChange={(e) => setForm((current) => ({ ...current, database: e.target.value }))} className="mt-2 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-zinc-100 outline-none transition focus:border-cyan-500" placeholder={DATABASE_PLACEHOLDER_BY_SOURCE_TYPE[form.type] || "orders_prod"} />
            </label>
            <label className="text-sm text-zinc-300">
              Username
              <input value={form.username} onChange={(e) => setForm((current) => ({ ...current, username: e.target.value }))} className="mt-2 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-zinc-100 outline-none transition focus:border-cyan-500" placeholder="bi_reader" />
            </label>
            <label className="text-sm text-zinc-300 md:col-span-2">
              Password
              <input type="password" value={form.password} onChange={(e) => setForm((current) => ({ ...current, password: e.target.value }))} className="mt-2 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-zinc-100 outline-none transition focus:border-cyan-500" placeholder="输入访问密码" />
            </label>
            <label className="md:col-span-2 flex items-center gap-3 rounded-xl border border-zinc-800 bg-zinc-950/60 px-4 py-3 text-sm text-zinc-300">
              <input type="checkbox" checked={form.ssl} onChange={(e) => setForm((current) => ({ ...current, ssl: e.target.checked }))} className="h-4 w-4 rounded border-zinc-600 bg-zinc-900" />
              启用 SSL / TLS
            </label>
          </div>
        ) : null}

        {isSQLiteSource ? (
          <div className="mt-4 grid gap-4">
            <label className="text-sm text-zinc-300">
              SQLite 文件路径（服务器端绝对路径）
              <input value={form.database} onChange={(e) => setForm((current) => ({ ...current, database: e.target.value }))} className="mt-2 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-zinc-100 outline-none transition focus:border-cyan-500" placeholder="/tmp/demo_ecommerce.db" />
            </label>
            <p className="text-xs text-zinc-500">SQLite 数据源直接读取服务器上的 .db 文件，无需 Host/Port/用户名/密码。</p>
          </div>
        ) : null}

        {isApiSource ? (
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <label className="text-sm text-zinc-300 md:col-span-2">
              API URL
              <input value={form.apiUrl} onChange={(e) => setForm((current) => ({ ...current, apiUrl: e.target.value }))} className="mt-2 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-zinc-100 outline-none transition focus:border-cyan-500" placeholder="https://api.example.com/v1/reports" />
            </label>
            <label className="text-sm text-zinc-300">
              Method
              <select value={form.apiMethod} onChange={(e) => setForm((current) => ({ ...current, apiMethod: e.target.value as "GET" | "POST" }))} className="mt-2 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-zinc-100 outline-none transition focus:border-cyan-500">
                <option value="GET">GET</option>
                <option value="POST">POST</option>
              </select>
            </label>
            <label className="text-sm text-zinc-300">
              认证方式
              <select value={form.authType} onChange={(e) => setForm((current) => ({ ...current, authType: e.target.value as "none" | "bearer" | "basic" | "apikey" }))} className="mt-2 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-zinc-100 outline-none transition focus:border-cyan-500">
                <option value="none">无</option>
                <option value="bearer">Bearer Token</option>
                <option value="basic">Basic</option>
                <option value="apikey">API Key</option>
              </select>
            </label>
            <label className="text-sm text-zinc-300 md:col-span-2">
              Token / 密钥
              <input type="password" value={form.authToken} onChange={(e) => setForm((current) => ({ ...current, authToken: e.target.value }))} className="mt-2 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-zinc-100 outline-none transition focus:border-cyan-500" placeholder="如有鉴权可填" />
            </label>
            <label className="text-sm text-zinc-300 md:col-span-2">
              Headers
              <textarea value={form.headers} onChange={(e) => setForm((current) => ({ ...current, headers: e.target.value }))} rows={3} className="mt-2 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-zinc-100 outline-none transition focus:border-cyan-500" placeholder={"Authorization: Bearer xxx\nX-Tenant-Id: demo"} />
            </label>
          </div>
        ) : null}

        {isFileSource ? (
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <label className="text-sm text-zinc-300">
              文件名
              <input value={form.fileName} onChange={(e) => setForm((current) => ({ ...current, fileName: e.target.value }))} className="mt-2 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-zinc-100 outline-none transition focus:border-cyan-500" placeholder="sales-report-2026.csv" />
            </label>
            <label className="text-sm text-zinc-300">
              文件大小（字节）
              <input value={form.fileSize} onChange={(e) => setForm((current) => ({ ...current, fileSize: e.target.value }))} className="mt-2 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-zinc-100 outline-none transition focus:border-cyan-500" placeholder="204800" />
            </label>
          </div>
        ) : null}

        {message ? <p className={`mt-4 rounded-xl border px-4 py-3 text-sm ${message.type === "success" ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-200" : "border-rose-500/30 bg-rose-500/10 text-rose-200"}`}>{message.text}</p> : null}

        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <button
            onClick={handleTestConnection}
            disabled={testing || submitting}
            className="rounded-xl border border-cyan-500/40 px-5 py-3 font-medium text-cyan-200 transition hover:border-cyan-400 hover:bg-cyan-500/10 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {testing ? "测试中..." : "测试连接"}
          </button>
          <button
            onClick={handleSave}
            disabled={submitting || testing}
            className="rounded-xl bg-cyan-500 px-5 py-3 font-medium text-slate-950 transition hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? "保存中..." : "保存并继续添加"}
          </button>
        </div>
      </section>
    </div>
  );
}
