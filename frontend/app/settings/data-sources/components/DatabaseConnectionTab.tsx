"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import type { DataSourceConfig, DataSourceType, DatabaseConnectionConfig } from "@/lib/types";
import { getAccessToken } from "@/lib/auth/api";
import { getCurrentUser, saveOnboardingDraft } from "@/lib/user-store";
import ConfirmDialog from "@/components/ui/ConfirmDialog";

const DATABASE_TYPE_OPTIONS: Array<{ value: DataSourceType; label: string }> = [
  { value: "mysql", label: "MySQL" },
  { value: "postgresql", label: "PostgreSQL" },
  { value: "sqlserver", label: "SQL Server" },
  { value: "oracle", label: "Oracle" },
  { value: "mongodb", label: "MongoDB" },
  { value: "redis", label: "Redis" },
  { value: "elasticsearch", label: "Elasticsearch" },
  { value: "clickhouse", label: "ClickHouse" },
  { value: "snowflake", label: "Snowflake" },
  { value: "bigquery", label: "BigQuery" },
  { value: "hive", label: "Hive" },
  { value: "spark", label: "Spark" },
  { value: "kafka", label: "Kafka" },
  { value: "sqlite", label: "SQLite" },
];

/** 需要 Host/Port/账号 的网络数据库（不含 SQLite） */
const NETWORK_DATABASE_TYPES: DataSourceType[] = DATABASE_TYPE_OPTIONS.filter((o) => o.value !== "sqlite").map((o) => o.value);

const DATABASE_LIST_TYPES = new Set<DataSourceType>(DATABASE_TYPE_OPTIONS.map((o) => o.value));

const DATABASE_TYPE_LABEL = Object.fromEntries(DATABASE_TYPE_OPTIONS.map((o) => [o.value, o.label])) as Record<
  DataSourceType,
  string
>;

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
};

function normalizeDataSourceFromApi(raw: Record<string, unknown>): DataSourceConfig {
  const type = raw.type as DataSourceType;
  const nested = raw.connection as DatabaseConnectionConfig | undefined;
  const id = String(raw.id ?? "");
  const base: DataSourceConfig = {
    id,
    type,
    name: String(raw.name ?? ""),
    description: raw.description ? String(raw.description) : undefined,
    status: raw.status as DataSourceConfig["status"],
    schemaAnalyzed: raw.schemaAnalyzed === true,
  };
  if (nested) {
    base.connection = nested;
  } else if (raw.host != null || raw.database != null || type === "sqlite") {
    base.connection = {
      host: String(raw.host ?? ""),
      port: Number(raw.port ?? 0),
      database: String(raw.database ?? ""),
      username: String(raw.username ?? ""),
      password: String(raw.password ?? ""),
      ssl: Boolean(raw.ssl),
    };
  }
  return base;
}

function isDatabaseListType(t: DataSourceType): boolean {
  return DATABASE_LIST_TYPES.has(t);
}

function connectionSummary(ds: DataSourceConfig): { host: string; database: string } {
  const c = ds.connection;
  return {
    host: c?.host?.trim() ? `${c.host}:${c.port || ""}`.replace(/:$/, "") : "—",
    database: c?.database?.trim() ? c.database : "—",
  };
}

export default function DatabaseConnectionTab() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [testing, setTesting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [analyzingId, setAnalyzingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [dataSources, setDataSources] = useState<DataSourceConfig[]>([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [migrated, setMigrated] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [typeMenuOpen, setTypeMenuOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string; name: string } | null>(null);
  const [analyzeConfirm, setAnalyzeConfirm] = useState<{ id: string; name: string; analyzed: boolean } | null>(null);
  const typeMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!typeMenuOpen) return;
    const onPointerDown = (e: MouseEvent) => {
      if (typeMenuRef.current && !typeMenuRef.current.contains(e.target as Node)) {
        setTypeMenuOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setTypeMenuOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    globalThis.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      globalThis.removeEventListener("keydown", onKey);
    };
  }, [typeMenuOpen]);

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

  const fetchDataSources = useCallback(async () => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    try {
      const tenantId = getTenantId();
      const response = await fetch(`/api/tenants/${tenantId}/data-sources`, {
        headers: getAuthHeaders(),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (response.ok) {
        const data = await response.json();
        const list = Array.isArray(data) ? data : [];
        setDataSources(list.map((row: Record<string, unknown>) => normalizeDataSourceFromApi(row)));
      } else {
        const errorData = await response.json().catch(() => ({})) as { error?: string };
        console.error("获取数据源列表失败:", response.status, errorData.error);
      }
    } catch (err) {
      clearTimeout(timeoutId);
      if (err instanceof Error && err.name === "AbortError") {
        console.error("获取数据源列表超时");
      } else {
        console.error("获取数据源列表失败:", err);
      }
    } finally {
      setLoading(false);
    }
  }, [getTenantId, getAuthHeaders]);

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
      saveOnboardingDraft({ dataSources: [] });
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

  const databaseSources = dataSources.filter((d) => isDatabaseListType(d.type));

  const handleTypeChange = (type: DataSourceType) => {
    setForm((current) => ({
      ...current,
      type,
      port: DEFAULT_PORT_BY_SOURCE_TYPE[type] ?? current.port,
    }));
    setMessage(null);
  };

  const isNetworkDatabaseSource = NETWORK_DATABASE_TYPES.includes(form.type);
  const isSQLiteSource = form.type === "sqlite";

  const buildRequestBody = () => {
    const body: Record<string, unknown> = {
      type: form.type,
      name: form.name.trim(),
      description: form.description.trim(),
    };

    if (isNetworkDatabaseSource) {
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

    return body;
  };

  const validateForm = (): string | null => {
    if (!form.name.trim()) {
      return "请填写数据源名称。";
    }
    if (isNetworkDatabaseSource) {
      if (!form.host.trim() || !form.port || !form.database.trim() || !form.username.trim()) {
        return "请完整填写数据库连接信息。";
      }
      if (!editingId && !form.password) {
        return "请填写数据库密码。";
      }
    }
    if (isSQLiteSource && !form.database.trim()) {
      return "请填写 SQLite 文件路径。";
    }
    return null;
  };

  const openCreateModal = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setMessage(null);
    setModalOpen(true);
  };

  const openEditModal = (source: DataSourceConfig) => {
    const c = source.connection;
    const tenantId = getTenantId();

    setEditingId(source.id);
    // 先用列表数据快速回填，避免弹窗空白；随后再拉详情接口补全字段（尤其是 username / ssl）
    setForm({
      name: source.name,
      type: source.type,
      description: source.description || "",
      host: c?.host || "",
      port: String(c?.port ?? DEFAULT_PORT_BY_SOURCE_TYPE[source.type] ?? ""),
      database: c?.database || "",
      username: c?.username || "",
      password: "",
      ssl: c?.ssl || false,
    });
    setMessage(null);
    setModalOpen(true);

    fetch(`/api/tenants/${tenantId}/data-sources/${source.id}`, { headers: getAuthHeaders() })
      .then(async (res) => {
        if (!res.ok) return null;
        const raw = (await res.json()) as Record<string, unknown>;
        return normalizeDataSourceFromApi(raw);
      })
      .then((fresh) => {
        if (!fresh || fresh.id !== source.id) return;
        const fc = fresh.connection;
        setForm((current) => ({
          ...current,
          name: fresh.name,
          type: fresh.type,
          description: fresh.description || "",
          host: fc?.host || "",
          port: String(fc?.port ?? DEFAULT_PORT_BY_SOURCE_TYPE[fresh.type] ?? ""),
          database: fc?.database || "",
          username: fc?.username || "",
          // 密码始终不回填：留空表示不修改
          password: "",
          ssl: fc?.ssl || false,
        }));
      })
      .catch(() => {
        // 详情拉取失败不阻塞编辑；保留列表回填值
      });
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditingId(null);
    setTypeMenuOpen(false);
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
        body: JSON.stringify({
          dataSource: { ...buildRequestBody(), id: editingId || `test-${Date.now()}`, status: "disconnected" },
        }),
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
      if (editingId) {
        const response = await fetch(`/api/tenants/${tenantId}/data-sources/${editingId}`, {
          method: "PUT",
          headers: getAuthHeaders(),
          body: JSON.stringify(buildRequestBody()),
        });

        if (!response.ok) {
          const err = await response.json().catch(() => ({}));
          setMessage({ type: "error", text: (err as { error?: string }).error || "保存失败" });
          return;
        }

        const raw = (await response.json()) as Record<string, unknown>;
        const updated = normalizeDataSourceFromApi(raw);
        setDataSources((prev) => prev.map((d) => (d.id === editingId ? updated : d)));
        window.dispatchEvent(new CustomEvent("data-sources-updated"));
        setMessage({ type: "success", text: `已更新数据源「${form.name.trim()}」。` });
        closeModal();
      } else {
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

        const raw = (await response.json()) as Record<string, unknown>;
        const created = normalizeDataSourceFromApi(raw);
        setDataSources((prev) => [...prev, created]);
        window.dispatchEvent(new CustomEvent("data-sources-updated"));
        setMessage({ type: "success", text: `已添加数据源「${form.name.trim()}」。` });
        closeModal();
      }
    } catch {
      setMessage({ type: "error", text: "保存失败，请稍后重试" });
    } finally {
      setSubmitting(false);
    }
  };

  const executeDelete = async (id: string, name: string) => {
    setDeletingId(id);
    try {
      const tenantId = getTenantId();
      const response = await fetch(`/api/tenants/${tenantId}/data-sources/${id}`, {
        method: "DELETE",
        headers: getAuthHeaders(),
      });
      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        setMessage({ type: "error", text: (err as { error?: string }).error || "删除失败" });
        return;
      }
      setDataSources((prev) => prev.filter((d) => d.id !== id));
      window.dispatchEvent(new CustomEvent("data-sources-updated"));
      setMessage({ type: "success", text: `已删除「${name}」。` });
    } catch {
      setMessage({ type: "error", text: "删除失败，请稍后重试" });
    } finally {
      setDeletingId(null);
    }
  };

  const handleDelete = (id: string, name: string) => {
    setDeleteConfirm({ id, name });
  };

  const executeAnalyze = async (id: string, name: string) => {
    setAnalyzingId(id);
    setMessage(null);
    try {
      const tenantId = getTenantId();
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 120000);
      const response = await fetch(`/api/tenants/${tenantId}/data-sources/${id}/schema/analyze`, {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify({ mode: "full" }),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        setMessage({ type: "error", text: (err as { error?: string }).error || "AI 分析失败" });
        return;
      }
      const result = (await response.json()) as { success?: boolean; analyzedAt?: string };
      if (result.success) {
        setDataSources((prev) =>
          prev.map((d) => (d.id === id ? { ...d, schemaAnalyzed: true } : d))
        );
        setMessage({ type: "success", text: `AI 分析完成（${result.analyzedAt || ""}）。` });
      } else {
        setMessage({ type: "error", text: "AI 分析未返回预期结果。" });
      }
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        setMessage({ type: "error", text: "AI 分析超时，请稍后重试。" });
      } else {
        setMessage({ type: "error", text: "AI 分析失败，请稍后重试。" });
      }
    } finally {
      setAnalyzingId(null);
    }
  };

  const handleAnalyze = (id: string, name: string, analyzed: boolean) => {
    setAnalyzeConfirm({ id, name, analyzed });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-medium text-zinc-100">数据库连接</h2>
          <p className="mt-1 text-sm text-zinc-500">列表展示全部已保存的数据库类数据源，可在此编辑或删除。</p>
        </div>
        <button
          type="button"
          onClick={openCreateModal}
          className="shrink-0 rounded-xl bg-cyan-500 px-5 py-3 text-sm font-medium text-slate-950 transition hover:bg-cyan-400"
        >
          新增数据库连接
        </button>
      </div>

      {message && !modalOpen ? (
        <p
          className={`rounded-xl border px-4 py-3 text-sm ${
            message.type === "success"
              ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-200"
              : "border-rose-500/30 bg-rose-500/10 text-rose-200"
          }`}
        >
          {message.text}
        </p>
      ) : null}

      <div className="overflow-x-auto rounded-2xl border border-zinc-800 bg-zinc-900/40">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-zinc-700 border-t-cyan-500" />
          </div>
        ) : databaseSources.length === 0 ? (
          <div className="p-10 text-center text-sm text-zinc-400">
            暂无数据库连接。点击「新增数据库连接」添加。
          </div>
        ) : (
          <table className="w-full min-w-[900px] text-left text-sm">
            <thead className="border-b border-zinc-800 bg-zinc-950/80 text-xs uppercase tracking-wide text-zinc-500">
              <tr>
                <th className="px-4 py-3 font-medium">名称</th>
                <th className="px-4 py-3 font-medium">类型</th>
                <th className="px-4 py-3 font-medium">地址</th>
                <th className="px-4 py-3 font-medium">库 / 路径</th>
                <th className="px-4 py-3 font-medium">AI 分析</th>
                <th className="px-4 py-3 text-right font-medium w-48">操作</th>
              </tr>
            </thead>
            <tbody>
              {databaseSources.map((row) => {
                const { host, database } = connectionSummary(row);
                return (
                  <tr key={row.id} className="border-b border-zinc-800/80 last:border-0 hover:bg-zinc-950/40">
                    <td className="px-4 py-3">
                      <div className="font-medium text-zinc-100">{row.name}</div>
                      {row.description ? <div className="mt-0.5 line-clamp-1 text-xs text-zinc-500">{row.description}</div> : null}
                    </td>
                    <td className="px-4 py-3 text-xs uppercase tracking-wide text-cyan-300">{row.type}</td>
                    <td className="px-4 py-3 text-zinc-400">{host}</td>
                    <td className="max-w-[200px] truncate px-4 py-3 text-zinc-400" title={database}>
                      {database}
                    </td>
                    <td className="px-4 py-3">
                      {row.schemaAnalyzed ? (
                        <span className="inline-flex items-center gap-1 rounded-full border border-cyan-500/30 bg-cyan-500/10 px-2 py-0.5 text-xs text-cyan-200">
                          <svg className="h-3 w-3 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                          已分析
                        </span>
                      ) : (
                        <span className="inline-flex rounded-full border border-zinc-600/50 bg-zinc-800/50 px-2 py-0.5 text-xs text-zinc-400">
                          未分析
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 w-52">
                      <div className="flex items-center gap-1.5 justify-end">
                        <button
                          type="button"
                          onClick={() => openEditModal(row)}
                          className="whitespace-nowrap rounded-lg border border-zinc-600 px-2.5 py-1.5 text-xs font-medium text-zinc-200 transition hover:border-zinc-500 hover:bg-white/5"
                        >
                          编辑
                        </button>
                        {row.schemaAnalyzed ? (
                          <button
                            type="button"
                            disabled={analyzingId === row.id}
                            onClick={() => handleAnalyze(row.id, row.name, true)}
                            className="whitespace-nowrap rounded-lg border border-amber-500/35 bg-amber-500/10 px-2.5 py-1.5 text-xs font-medium text-amber-200 transition hover:bg-amber-500/20 disabled:opacity-50"
                          >
                            {analyzingId === row.id ? "分析中…" : "重新分析"}
                          </button>
                        ) : (
                          <button
                            type="button"
                            disabled={analyzingId === row.id}
                            onClick={() => handleAnalyze(row.id, row.name, false)}
                            className="whitespace-nowrap rounded-lg border border-cyan-500/35 bg-cyan-500/10 px-2.5 py-1.5 text-xs font-medium text-cyan-200 transition hover:bg-cyan-500/20 disabled:opacity-50"
                          >
                            {analyzingId === row.id ? "分析中…" : "AI 分析"}
                          </button>
                        )}
                        <button
                          type="button"
                          disabled={deletingId === row.id}
                          onClick={() => handleDelete(row.id, row.name)}
                          className="whitespace-nowrap rounded-lg border border-rose-500/35 bg-rose-500/10 px-2.5 py-1.5 text-xs font-medium text-rose-200 transition hover:bg-rose-500/20 disabled:opacity-50"
                        >
                          {deletingId === row.id ? "删除中…" : "删除"}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {modalOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 p-4"
          role="presentation"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setMessage(null);
              closeModal();
            }
          }}
        >
          <div
            className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-zinc-700 bg-zinc-900 shadow-xl"
            role="dialog"
            aria-modal="true"
            aria-labelledby="db-modal-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="border-b border-zinc-800 px-6 py-4">
              <h3 id="db-modal-title" className="text-lg font-medium text-zinc-100">
                {editingId ? "编辑数据库连接" : "新增数据库连接"}
              </h3>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
              {/* 
                浏览器/密码管理器会对包含 username/password 的表单强行自动填充。
                这里用“诱饵字段 + new-password + 非典型 name”来尽量避免被误填。
              */}
              <div className="hidden">
                <input
                  type="text"
                  name="username"
                  autoComplete="username"
                  tabIndex={-1}
                  aria-hidden="true"
                  value=""
                  readOnly
                />
                <input
                  type="password"
                  name="password"
                  autoComplete="current-password"
                  tabIndex={-1}
                  aria-hidden="true"
                  value=""
                  readOnly
                />
              </div>

              {message && modalOpen ? (
                <p
                  className={`mb-4 rounded-xl border px-4 py-3 text-sm ${
                    message.type === "success"
                      ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-200"
                      : "border-rose-500/30 bg-rose-500/10 text-rose-200"
                  }`}
                >
                  {message.text}
                </p>
              ) : null}

              <div className="grid gap-4 md:grid-cols-2">
                <label className="text-sm text-zinc-300">
                  数据源名称
                  <input
                    value={form.name}
                    onChange={(e) => setForm((current) => ({ ...current, name: e.target.value }))}
                    name="dataSourceName"
                    autoComplete="off"
                    className="mt-2 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-zinc-100 outline-none transition focus:border-cyan-500"
                    placeholder="例如：订单主库"
                  />
                </label>
                <div className="text-sm text-zinc-300">
                  <span id="db-source-type-label" className="block">
                    数据源类型
                  </span>
                  <div className="relative mt-2" ref={typeMenuRef}>
                    <button
                      type="button"
                      id="db-source-type-trigger"
                      aria-haspopup="listbox"
                      aria-expanded={typeMenuOpen}
                      aria-labelledby="db-source-type-label db-source-type-trigger"
                      onClick={() => setTypeMenuOpen((open) => !open)}
                      className={`flex w-full items-center gap-3 rounded-xl border bg-zinc-950 px-3 py-2.5 text-left outline-none transition focus-visible:ring-2 focus-visible:ring-cyan-500/50 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-900 ${
                        typeMenuOpen ? "border-cyan-500/50 shadow-[0_0_0_1px_rgba(34,211,238,0.12)]" : "border-zinc-700 hover:border-zinc-600"
                      }`}
                    >
                      <span className="shrink-0 rounded-lg border border-zinc-700/80 bg-zinc-900/90 px-2 py-1 font-mono text-[11px] font-medium uppercase tracking-wide text-cyan-200/90">
                        {form.type}
                      </span>
                      <span className="min-w-0 flex-1 truncate text-[15px] font-medium text-zinc-100">
                        {DATABASE_TYPE_LABEL[form.type]}
                      </span>
                      <svg
                        className={`h-5 w-5 shrink-0 text-zinc-500 transition-transform duration-200 ${typeMenuOpen ? "rotate-180 text-cyan-400/80" : ""}`}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                        aria-hidden
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                    {typeMenuOpen ? (
                      <div
                        role="listbox"
                        aria-labelledby="db-source-type-label"
                        className="absolute z-20 mt-1 max-h-[min(16.5rem,calc(90vh-12rem))] w-full overflow-auto rounded-xl border border-zinc-700/80 bg-zinc-950 py-1 shadow-2xl shadow-black/60 ring-1 ring-white/[0.06]"
                      >
                        {DATABASE_TYPE_OPTIONS.map((option) => {
                          const selected = form.type === option.value;
                          return (
                            <button
                              key={option.value}
                              type="button"
                              role="option"
                              aria-selected={selected}
                              onClick={() => {
                                handleTypeChange(option.value);
                                setTypeMenuOpen(false);
                              }}
                              className={`flex w-full items-center gap-3 px-3 py-2.5 text-left text-sm transition ${
                                selected
                                  ? "bg-cyan-500/[0.14] text-cyan-100"
                                  : "text-zinc-200 hover:bg-white/[0.06]"
                              }`}
                            >
                              <span
                                className={`shrink-0 rounded-md border px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider ${
                                  selected
                                    ? "border-cyan-500/35 bg-cyan-500/15 text-cyan-200"
                                    : "border-zinc-700 bg-zinc-900 text-zinc-500"
                                }`}
                              >
                                {option.value}
                              </span>
                              <span className="min-w-0 flex-1 truncate font-medium">{option.label}</span>
                              {selected ? (
                                <svg className="h-4 w-4 shrink-0 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                                </svg>
                              ) : (
                                <span className="h-4 w-4 shrink-0" aria-hidden />
                              )}
                            </button>
                          );
                        })}
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>

              <label className="mt-4 block text-sm text-zinc-300">
                数据说明
                <textarea
                  value={form.description}
                  onChange={(e) => setForm((current) => ({ ...current, description: e.target.value }))}
                  rows={3}
                  className="mt-2 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-zinc-100 outline-none transition focus:border-cyan-500"
                  placeholder="例如：包含订单、支付、退款等明细"
                />
              </label>

              {isNetworkDatabaseSource ? (
                <div className="mt-4 grid gap-4 md:grid-cols-2">
                  <label className="text-sm text-zinc-300">
                    Host
                    <input
                      value={form.host}
                      onChange={(e) => setForm((current) => ({ ...current, host: e.target.value }))}
                      name="dbHost"
                      autoComplete="off"
                      className="mt-2 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-zinc-100 outline-none transition focus:border-cyan-500"
                      placeholder={HOST_PLACEHOLDER_BY_SOURCE_TYPE[form.type] || "db.example.internal"}
                    />
                  </label>
                  <label className="text-sm text-zinc-300">
                    Port
                    <input
                      value={form.port}
                      onChange={(e) => setForm((current) => ({ ...current, port: e.target.value }))}
                      name="dbPort"
                      autoComplete="off"
                      className="mt-2 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-zinc-100 outline-none transition focus:border-cyan-500"
                      placeholder="3306"
                    />
                  </label>
                  <label className="text-sm text-zinc-300">
                    Database
                    <input
                      value={form.database}
                      onChange={(e) => setForm((current) => ({ ...current, database: e.target.value }))}
                      name="dbDatabase"
                      autoComplete="off"
                      className="mt-2 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-zinc-100 outline-none transition focus:border-cyan-500"
                      placeholder={DATABASE_PLACEHOLDER_BY_SOURCE_TYPE[form.type] || "orders_prod"}
                    />
                  </label>
                  <label className="text-sm text-zinc-300">
                    Username
                    <input
                      value={form.username}
                      onChange={(e) => setForm((current) => ({ ...current, username: e.target.value }))}
                      name="dbUsername"
                      autoComplete="off"
                      data-lpignore="true"
                      data-1p-ignore="true"
                      className="mt-2 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-zinc-100 outline-none transition focus:border-cyan-500"
                      placeholder="bi_reader"
                    />
                  </label>
                  <label className="text-sm text-zinc-300 md:col-span-2">
                    Password
                    <input
                      type="password"
                      value={form.password}
                      onChange={(e) => setForm((current) => ({ ...current, password: e.target.value }))}
                      name="dbPassword"
                      autoComplete="new-password"
                      data-lpignore="true"
                      data-1p-ignore="true"
                      className="mt-2 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-zinc-100 outline-none transition focus:border-cyan-500"
                      placeholder={editingId ? "留空表示不修改密码" : "输入访问密码"}
                    />
                  </label>
                  <label className="flex items-center gap-3 rounded-xl border border-zinc-800 bg-zinc-950/60 px-4 py-3 text-sm text-zinc-300 md:col-span-2">
                    <input
                      type="checkbox"
                      checked={form.ssl}
                      onChange={(e) => setForm((current) => ({ ...current, ssl: e.target.checked }))}
                      className="h-4 w-4 rounded border-zinc-600 bg-zinc-900"
                    />
                    启用 SSL / TLS
                  </label>
                </div>
              ) : null}

              {isSQLiteSource ? (
                <div className="mt-4 grid gap-4">
                  <label className="text-sm text-zinc-300">
                    SQLite 文件路径（服务器端绝对路径）
                    <input
                      value={form.database}
                      onChange={(e) => setForm((current) => ({ ...current, database: e.target.value }))}
                      className="mt-2 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-zinc-100 outline-none transition focus:border-cyan-500"
                      placeholder="/tmp/demo_ecommerce.db"
                    />
                  </label>
                  <p className="text-xs text-zinc-500">SQLite 读取服务器上的 .db 文件，无需 Host/Port/用户名/密码。</p>
                </div>
              ) : null}
            </div>

            <div className="flex flex-col gap-3 border-t border-zinc-800 px-6 py-4 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => {
                  setMessage(null);
                  closeModal();
                }}
                className="rounded-xl border border-zinc-600 px-5 py-3 text-sm font-medium text-zinc-200 transition hover:bg-white/5"
              >
                取消
              </button>
              <button
                type="button"
                onClick={handleTestConnection}
                disabled={testing || submitting}
                className="rounded-xl border border-cyan-500/40 px-5 py-3 text-sm font-medium text-cyan-200 transition hover:border-cyan-400 hover:bg-cyan-500/10 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {testing ? "测试中…" : "测试连接"}
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={submitting || testing}
                className="rounded-xl bg-cyan-500 px-5 py-3 text-sm font-medium text-slate-950 transition hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {submitting ? "保存中…" : "保存"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <ConfirmDialog
        open={Boolean(deleteConfirm)}
        title={deleteConfirm ? `确认删除“${deleteConfirm.name}”` : "确认删除数据源"}
        description="删除后当前数据源配置将立即移除，且无法撤销。"
        confirmText="确认删除"
        tone="danger"
        busy={deleteConfirm ? deletingId === deleteConfirm.id : false}
        details={
          <div className="rounded-2xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-rose-100">
            请确认当前数据源不再被报表、观测中心或告警规则使用。
          </div>
        }
        onClose={() => setDeleteConfirm(null)}
        onConfirm={async () => {
          const target = deleteConfirm;
          if (!target) return;
          await executeDelete(target.id, target.name);
          setDeleteConfirm(null);
        }}
      />

      <ConfirmDialog
        open={Boolean(analyzeConfirm)}
        title={analyzeConfirm ? (analyzeConfirm.analyzed ? "确认重新分析" : "确认开始分析") : "确认开始分析"}
        description={
          analyzeConfirm
            ? `即将对数据源“${analyzeConfirm.name}”执行 AI Schema 分析，用于识别字段语义、推荐指标和维度。${analyzeConfirm.analyzed ? " 重新分析会基于当前 schema 覆盖已有分析结果。" : ""}`
            : ""
        }
        confirmText={analyzeConfirm?.analyzed ? "确认重新分析" : "确认开始分析"}
        busy={analyzeConfirm ? analyzingId === analyzeConfirm.id : false}
        details={
          <>
            <div className="rounded-2xl border border-white/8 bg-white/5 px-4 py-3">
              <div className="font-medium text-zinc-100">将执行的操作</div>
              <p className="mt-1 text-zinc-400">调用已配置的 AI 模型分析当前数据库 schema，过程可能持续几十秒到两分钟。</p>
            </div>
            <div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-amber-100">
              开始前请确认 AI 配置已填写 API Key，否则本次分析会直接失败。
            </div>
          </>
        }
        onClose={() => setAnalyzeConfirm(null)}
        onConfirm={async () => {
          const target = analyzeConfirm;
          if (!target) return;
          await executeAnalyze(target.id, target.name);
          setAnalyzeConfirm(null);
        }}
      />
    </div>
  );
}
