"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const DATA_SOURCES = [
  {
    id: "mysql",
    name: "MySQL",
    description: "最常用的关系型数据库",
    icon: "M",
    color: "#4479A1",
  },
  {
    id: "postgresql",
    name: "PostgreSQL",
    description: "强大的开源关系数据库",
    icon: "P",
    color: "#336791",
  },
  {
    id: "excel",
    name: "Excel / CSV",
    description: "上传电子表格文件",
    icon: "X",
    color: "#217346",
  },
  {
    id: "bigquery",
    name: "BigQuery",
    description: "Google 云数据仓库",
    icon: "B",
    color: "#4285F4",
  },
  {
    id: "snowflake",
    name: "Snowflake",
    description: "云数据平台",
    icon: "S",
    color: "#29B5E8",
  },
];

export default function DataSourcesPage() {
  const router = useRouter();
  const [selected, setSelected] = useState<string | null>(null);
  const [config, setConfig] = useState({
    host: "",
    port: "",
    database: "",
    username: "",
    password: "",
  });
  const [testing, setTesting] = useState(false);
  const [connected, setConnected] = useState(false);

  const handleTest = async () => {
    setTesting(true);
    // 模拟测试连接
    await new Promise((resolve) => setTimeout(resolve, 1500));
    setTesting(false);
    setConnected(true);
  };

  return (
    <div className="min-h-screen bg-zinc-950">
      {/* 顶部导航 */}
      <nav className="flex items-center justify-between px-6 py-4 border-b border-zinc-800/50">
        <button
          onClick={() => router.back()}
          className="flex items-center gap-2 text-zinc-400 hover:text-zinc-200 transition-colors"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
          </svg>
          <span className="text-sm">返回</span>
        </button>
        <h1 className="text-lg font-semibold text-zinc-100">连接数据源</h1>
        <div />
      </nav>

      <main className="max-w-5xl mx-auto p-6">
        {!selected ? (
          /* 选择数据源 */
          <div className="space-y-6">
            <div className="text-center mb-8">
              <h2 className="text-2xl font-semibold text-zinc-100 mb-2">
                选择数据源类型
              </h2>
              <p className="text-zinc-500">
                连接你的数据库或上传文件，立即开始分析
              </p>
            </div>

            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {DATA_SOURCES.map((source) => (
                <button
                  key={source.id}
                  onClick={() => setSelected(source.id)}
                  className="group p-6 rounded-2xl bg-zinc-900/50 border border-zinc-800/50 hover:border-zinc-700 hover:bg-zinc-800/50 transition-all text-left"
                >
                  <div
                    className="w-12 h-12 rounded-xl flex items-center justify-center mb-4 text-lg font-bold"
                    style={{
                      backgroundColor: `${source.color}15`,
                      color: source.color,
                    }}
                  >
                    {source.icon}
                  </div>
                  <h3 className="text-base font-semibold text-zinc-100 mb-1">
                    {source.name}
                  </h3>
                  <p className="text-sm text-zinc-500">{source.description}</p>
                </button>
              ))}
            </div>
          </div>
        ) : (
          /* 配置数据源 */
          <div className="max-w-xl mx-auto">
            <button
              onClick={() => setSelected(null)}
              className="text-sm text-zinc-500 hover:text-zinc-300 mb-4 flex items-center gap-1"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
              </svg>
              返回选择
            </button>

            <div className="rounded-2xl bg-zinc-900/50 border border-zinc-800/50 p-6 space-y-6">
              <div className="flex items-center gap-3 mb-6">
                <div
                  className="w-10 h-10 rounded-lg flex items-center justify-center text-sm font-bold"
                  style={{
                    backgroundColor: `${(DATA_SOURCES.find(s => s.id === selected)?.color || "#666")}15`,
                    color: DATA_SOURCES.find(s => s.id === selected)?.color,
                  }}
                >
                  {DATA_SOURCES.find((s) => s.id === selected)?.icon}
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-zinc-100">
                    {DATA_SOURCES.find((s) => s.id === selected)?.name}
                  </h2>
                  <p className="text-sm text-zinc-500">
                    {connected ? "已连接" : "配置连接信息"}
                  </p>
                </div>
              </div>

              {connected ? (
                <div className="text-center py-8">
                  <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-emerald-500/10 flex items-center justify-center">
                    <svg className="w-8 h-8 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                    </svg>
                  </div>
                  <h3 className="text-lg font-semibold text-zinc-100 mb-2">
                    连接成功！
                  </h3>
                  <p className="text-zinc-500 mb-6">
                    数据源已就绪，现在可以开始分析了
                  </p>
                  <button
                    onClick={() => router.push("/chat")}
                    className="px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-medium transition-all"
                  >
                    开始分析
                  </button>
                </div>
              ) : (
                <>
                  <div className="space-y-4">
                    <div className="grid grid-cols-3 gap-4">
                      <div className="col-span-2">
                        <label className="block text-xs text-zinc-500 mb-1.5 font-medium">
                          主机地址
                        </label>
                        <input
                          value={config.host}
                          onChange={(e) =>
                            setConfig((p) => ({ ...p, host: e.target.value }))
                          }
                          placeholder="localhost"
                          className="input-base"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-zinc-500 mb-1.5 font-medium">
                          端口
                        </label>
                        <input
                          value={config.port}
                          onChange={(e) =>
                            setConfig((p) => ({ ...p, port: e.target.value }))
                          }
                          placeholder="3306"
                          className="input-base"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs text-zinc-500 mb-1.5 font-medium">
                        数据库名
                      </label>
                      <input
                        value={config.database}
                        onChange={(e) =>
                          setConfig((p) => ({ ...p, database: e.target.value }))
                        }
                        placeholder="my_database"
                        className="input-base"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs text-zinc-500 mb-1.5 font-medium">
                          用户名
                        </label>
                        <input
                          value={config.username}
                          onChange={(e) =>
                            setConfig((p) => ({ ...p, username: e.target.value }))
                          }
                          placeholder="root"
                          className="input-base"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-zinc-500 mb-1.5 font-medium">
                          密码
                        </label>
                        <input
                          type="password"
                          value={config.password}
                          onChange={(e) =>
                            setConfig((p) => ({ ...p, password: e.target.value }))
                          }
                          placeholder="••••••••"
                          className="input-base"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="pt-4 flex gap-3">
                    <button
                      onClick={() => setSelected(null)}
                      className="flex-1 px-5 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700/50 transition-all"
                    >
                      取消
                    </button>
                    <button
                      onClick={handleTest}
                      disabled={testing}
                      className="flex-1 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-medium transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      {testing ? "测试中..." : "测试连接"}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
