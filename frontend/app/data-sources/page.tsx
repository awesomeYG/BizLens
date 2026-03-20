"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { getCurrentUser } from "@/lib/user-store";
import type { DataSourceConfig, DataSourceType, UserSession } from "@/lib/types";

interface DataSourceWithMeta extends DataSourceConfig {
  status?: "connected" | "disconnected" | "error";
  lastSyncAt?: number;
  tables?: string[];
}

export default function DataSourcesPage() {
  const router = useRouter();
  const [user, setUser] = useState<UserSession | null>(null);
  const [dataSources, setDataSources] = useState<DataSourceWithMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedType, setSelectedType] = useState<DataSourceType>("mysql");
  const [testingId, setTestingId] = useState<string | null>(null);

  useEffect(() => {
    const currentUser = getCurrentUser();
    setUser(currentUser);
    if (!currentUser?.isOnboarded) {
      router.push("/");
      return;
    }
    loadDataSources();
  }, [router]);

  const loadDataSources = async () => {
    try {
      const res = await fetch(`/api/tenants/${user?.id}/data-sources`);
      if (res.ok) {
        const data = await res.json();
        setDataSources(data);
      }
    } catch (err) {
      console.error("加载数据源失败:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("确定要删除这个数据源吗？")) return;

    try {
      const res = await fetch(`/api/tenants/${user?.id}/data-sources/${id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        loadDataSources();
      }
    } catch (err) {
      console.error("删除失败:", err);
    }
  };

  const handleTestConnection = async (ds: DataSourceWithMeta) => {
    setTestingId(ds.id);
    try {
      const res = await fetch(
        `/api/tenants/${user?.id}/data-sources/${ds.id}/test`,
        { method: "POST" }
      );
      const result = await res.json();
      alert(result.success ? "连接成功" : "连接失败：" + result.message);
    } catch (err) {
      alert("测试失败：" + err);
    } finally {
      setTestingId(null);
    }
  };

  const dataSourceTypes: { value: DataSourceType; label: string; icon: string }[] = [
    { value: "mysql", label: "MySQL", icon: "🐬" },
    { value: "postgresql", label: "PostgreSQL", icon: "🐘" },
    { value: "csv", label: "CSV 文件", icon: "📄" },
    { value: "excel", label: "Excel", icon: "📊" },
    { value: "api", label: "API", icon: "🔌" },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-4">
              <button
                onClick={() => router.push("/")}
                className="text-gray-600 hover:text-gray-900"
              >
                ← 返回
              </button>
              <h1 className="text-2xl font-bold text-gray-900">数据源管理</h1>
            </div>
            <button
              onClick={() => setShowAddModal(true)}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              + 添加数据源
            </button>
          </div>
        </div>
      </div>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {loading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">加载中...</p>
          </div>
        ) : dataSources.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-lg shadow">
            <p className="text-gray-500 mb-4">暂无数据源</p>
            <button
              onClick={() => setShowAddModal(true)}
              className="text-blue-600 hover:underline"
            >
              添加第一个数据源
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {dataSources.map((ds) => (
              <div
                key={ds.id}
                className="bg-white rounded-lg shadow p-6 hover:shadow-md transition-shadow"
              >
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">
                      {ds.name}
                    </h3>
                    <p className="text-sm text-gray-500">{ds.type}</p>
                  </div>
                  <span
                    className={`px-2 py-1 text-xs rounded-full ${
                      ds.status === "connected"
                        ? "bg-green-100 text-green-800"
                        : ds.status === "error"
                        ? "bg-red-100 text-red-800"
                        : "bg-gray-100 text-gray-800"
                    }`}
                  >
                    {ds.status === "connected" ? "已连接" : ds.status === "error" ? "错误" : "未连接"}
                  </span>
                </div>

                {ds.description && (
                  <p className="text-sm text-gray-600 mb-4">{ds.description}</p>
                )}

                {ds.tables && ds.tables.length > 0 && (
                  <div className="mb-4">
                    <p className="text-xs text-gray-500 mb-1">数据表:</p>
                    <div className="flex flex-wrap gap-1">
                      {ds.tables.slice(0, 5).map((table) => (
                        <span
                          key={table}
                          className="px-2 py-0.5 bg-gray-100 text-gray-700 text-xs rounded"
                        >
                          {table}
                        </span>
                      ))}
                      {ds.tables.length > 5 && (
                        <span className="text-xs text-gray-500">
                          +{ds.tables.length - 5} 更多
                        </span>
                      )}
                    </div>
                  </div>
                )}

                <div className="flex gap-2">
                  <button
                    onClick={() => handleTestConnection(ds)}
                    disabled={testingId === ds.id}
                    className="flex-1 px-3 py-1.5 text-sm bg-blue-50 text-blue-600 rounded hover:bg-blue-100 disabled:opacity-50"
                  >
                    {testingId === ds.id ? "测试中..." : "测试连接"}
                  </button>
                  <button
                    onClick={() => handleDelete(ds.id)}
                    className="px-3 py-1.5 text-sm bg-red-50 text-red-600 rounded hover:bg-red-100"
                  >
                    删除
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {showAddModal && (
        <AddDataSourceModal
          types={dataSourceTypes}
          selectedType={selectedType}
          onTypeChange={setSelectedType}
          onClose={() => setShowAddModal(false)}
          onAdded={() => {
            setShowAddModal(false);
            loadDataSources();
          }}
        />
      )}
    </div>
  );
}

interface AddDataSourceModalProps {
  types: { value: DataSourceType; label: string; icon: string }[];
  selectedType: DataSourceType;
  onTypeChange: (type: DataSourceType) => void;
  onClose: () => void;
  onAdded: () => void;
}

function AddDataSourceModal({
  types,
  selectedType,
  onTypeChange,
  onClose,
  onAdded,
}: AddDataSourceModalProps) {
  const user = getCurrentUser();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [connection, setConnection] = useState({
    host: "",
    port: 3306,
    database: "",
    username: "",
    password: "",
    ssl: false,
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);

    try {
      const payload: any = {
        type: selectedType,
        name,
        description,
      };

      if (selectedType === "mysql" || selectedType === "postgresql") {
        payload.connection = connection;
      }

      const res = await fetch(`/api/tenants/${user?.id}/data-sources`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "创建失败");
      }

      onAdded();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b">
          <h2 className="text-xl font-bold">添加数据源</h2>
        </div>

        <form onSubmit={handleSubmit} className="p-6">
          {/* 类型选择 */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              数据源类型
            </label>
            <div className="grid grid-cols-5 gap-3">
              {types.map((type) => (
                <button
                  key={type.value}
                  type="button"
                  onClick={() => {
                    onTypeChange(type.value);
                    if (type.value === "mysql") {
                      setConnection((c) => ({ ...c, port: 3306 }));
                    } else if (type.value === "postgresql") {
                      setConnection((c) => ({ ...c, port: 5432 }));
                    }
                  }}
                  className={`p-3 rounded-lg border-2 text-center transition-all ${
                    selectedType === type.value
                      ? "border-blue-600 bg-blue-50"
                      : "border-gray-200 hover:border-gray-300"
                  }`}
                >
                  <div className="text-2xl mb-1">{type.icon}</div>
                  <div className="text-xs font-medium">{type.label}</div>
                </button>
              ))}
            </div>
          </div>

          {/* 基本信息 */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              名称 *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="例如：生产数据库"
              required
            />
          </div>

          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              描述
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              rows={2}
              placeholder="可选"
            />
          </div>

          {/* 数据库连接配置 */}
          {(selectedType === "mysql" || selectedType === "postgresql") && (
            <div className="mb-6 p-4 bg-gray-50 rounded-lg">
              <h3 className="text-sm font-medium text-gray-900 mb-4">
                数据库连接信息
              </h3>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-gray-600 mb-1">
                    主机 *
                  </label>
                  <input
                    type="text"
                    value={connection.host}
                    onChange={(e) =>
                      setConnection({ ...connection, host: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                    placeholder="localhost"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs text-gray-600 mb-1">
                    端口 *
                  </label>
                  <input
                    type="number"
                    value={connection.port}
                    onChange={(e) =>
                      setConnection({ ...connection, port: parseInt(e.target.value) || 0 })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                    required
                  />
                </div>

                <div className="col-span-2">
                  <label className="block text-xs text-gray-600 mb-1">
                    数据库名 *
                  </label>
                  <input
                    type="text"
                    value={connection.database}
                    onChange={(e) =>
                      setConnection({ ...connection, database: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs text-gray-600 mb-1">
                    用户名 *
                  </label>
                  <input
                    type="text"
                    value={connection.username}
                    onChange={(e) =>
                      setConnection({ ...connection, username: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs text-gray-600 mb-1">
                    密码 *
                  </label>
                  <input
                    type="password"
                    value={connection.password}
                    onChange={(e) =>
                      setConnection({ ...connection, password: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                    required
                  />
                </div>

                <div className="col-span-2">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={connection.ssl}
                      onChange={(e) =>
                        setConnection({ ...connection, ssl: e.target.checked })
                      }
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-xs text-gray-600">使用 SSL 连接</span>
                  </label>
                </div>
              </div>
            </div>
          )}

          {error && (
            <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-lg text-sm">
              {error}
            </div>
          )}

          <div className="flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
            >
              取消
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {submitting ? "创建中..." : "创建并连接"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
