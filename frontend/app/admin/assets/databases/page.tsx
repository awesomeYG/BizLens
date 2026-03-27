"use client";


import { adminApi } from "@/lib/admin/api";
import { useEffect, useState } from "react";

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    connected: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
    disconnected: "bg-zinc-500/15 text-zinc-400 border-zinc-500/30",
    error: "bg-red-500/15 text-red-400 border-red-500/30",
  };
  return <span className={`badge border ${map[status] || map.disconnected}`}>{status}</span>;
}

export default function DatabasesPage() {
  const [page, setPage] = useState(1);
  const [dbType, setDbType] = useState("");
  const [keyword, setKeyword] = useState("");
  const [testing, setTesting] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<Record<string, boolean | null>>({});
  const [rows, setRows] = useState<any[]>([]);
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    adminApi.listDataSources({ page: String(page), type: dbType, keyword, pageSize: "20" } as any)
      .then((r: any) => { setRows(r.dataSources || []); setData(r); })
      .catch(() => setRows([]))
      .finally(() => setLoading(false));
  }, [page, dbType, keyword]);

  const mutate = () => {
    adminApi.listDataSources({ page: String(page), type: dbType, keyword, pageSize: "20" } as any)
      .then((r: any) => { setRows(r.dataSources || []); setData(r); });
  };

  const handleTest = async (id: string) => {
    setTesting(id);
    setTestResult((p) => ({ ...p, [id]: null }));
    try {
      const r: any = await adminApi.testDataSource(id);
      setTestResult((p) => ({ ...p, [id]: r?.success === true }));
    } catch {
      setTestResult((p) => ({ ...p, [id]: false }));
    } finally {
      setTesting(null);
    }
  };

  const handleDelete = async (id: string) => {
    await adminApi.deleteDataSource(id);
    mutate();
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-zinc-100">数据库连接</h2>
      </div>

      <div className="flex gap-3 items-center">
        <input className="input-base max-w-xs" placeholder="搜索名称或主机..."
          value={keyword} onChange={(e) => { setKeyword(e.target.value); setPage(1); }} />
        <select className="input-base w-auto" value={dbType}
          onChange={(e) => { setDbType(e.target.value); setPage(1); }}>
          <option value="">全部类型</option>
          {["mysql", "postgresql", "sqlite", "api"].map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
      </div>

      <div className="glass-card rounded-2xl border border-zinc-800/60 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-xs text-zinc-500 border-b border-zinc-800/40">
              <th className="text-left px-4 py-3 font-medium">名称</th>
              <th className="text-left px-4 py-3 font-medium">类型</th>
              <th className="text-left px-4 py-3 font-medium">主机</th>
              <th className="text-left px-4 py-3 font-medium">数据库</th>
              <th className="text-left px-4 py-3 font-medium">状态</th>
              <th className="text-left px-4 py-3 font-medium">最近同步</th>
              <th className="text-left px-4 py-3 font-medium">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800/30">
            {rows.length === 0 ? (
              <tr><td colSpan={7} className="text-center py-10 text-zinc-500">暂无数据</td></tr>
            ) : rows.map((r) => (
              <tr key={r.id} className="hover:bg-white/2">
                <td className="px-4 py-3 text-zinc-100">{r.name}</td>
                <td className="px-4 py-3"><span className="badge bg-sky-500/15 text-sky-400 border border-sky-500/30">{r.type}</span></td>
                <td className="px-4 py-3 text-zinc-400">{r.host}:{r.port}</td>
                <td className="px-4 py-3 text-zinc-400">{r.database}</td>
                <td className="px-4 py-3"><StatusBadge status={r.status} /></td>
                <td className="px-4 py-3 text-zinc-500">{r.lastSyncAt?.slice(0, 10) || "从未同步"}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <button onClick={() => void handleTest(r.id)}
                      disabled={testing === r.id}
                      className="text-xs flex items-center gap-1 text-zinc-400 hover:text-indigo-300 transition-colors disabled:opacity-40">
                      {testing === r.id ? "测试中..." : testResult[r.id] === true ? "✓ 成功" : testResult[r.id] === false ? "✗ 失败" : "测试连接"}
                    </button>
                    <button onClick={() => handleDelete(r.id)}
                      className="text-xs text-red-400 hover:text-red-300 transition-colors">删除</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {data && data.totalPage > 1 && (
        <div className="flex items-center justify-center gap-3">
          <button disabled={page <= 1} onClick={() => setPage(p => p - 1)}
            className="btn-secondary px-3 py-1.5 text-sm disabled:opacity-30">上一页</button>
          <span className="text-sm text-zinc-500">{page} / {data.totalPage}</span>
          <button disabled={page >= data.totalPage} onClick={() => setPage(p => p + 1)}
            className="btn-secondary px-3 py-1.5 text-sm disabled:opacity-30">下一页</button>
        </div>
      )}
    </div>
  );
}
