"use client";


import { adminApi } from "@/lib/admin/api";
import { useEffect, useState } from "react";

function formatSize(s: number) {
  if (!s || s <= 0) return "0 B";
  const u = ["B", "KB", "MB", "GB"];
  let v = s;
  let i = 0;
  while (v >= 1024 && i < u.length - 1) { v /= 1024; i++; }
  return `${v.toFixed(1)} ${u[i]}`;
}

function FileTable() {
  const [page, setPage] = useState(1);
  const [format, setFormat] = useState("");
  const [keyword, setKeyword] = useState("");
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [rows, setRows] = useState<any[]>([]);
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    adminApi.listDatasets({ page: String(page), format, keyword, pageSize: "20" } as any)
      .then((r: any) => { setRows(r.datasets || []); setData(r); })
      .catch(() => setRows([]))
      .finally(() => setLoading(false));
  }, [page, format, keyword]);

  const mutate = () => {
    adminApi.listDatasets({ page: String(page), format, keyword, pageSize: "20" } as any)
      .then((r: any) => { setRows(r.datasets || []); setData(r); });
  };



  const toggleSel = (id: string) => {
    const n = new Set(sel);
    n.has(id) ? n.delete(id) : n.add(id);
    setSel(n);
  };

  const handleDelete = async (id: string) => {
    await adminApi.deleteDataset(id);
    mutate();
    setSel((s) => { const n = new Set(s); n.delete(id); return n; });
  };

  const handleBatchDelete = async () => {
    for (const id of sel) await adminApi.deleteDataset(id);
    setSel(new Set());
    mutate();
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-3 items-center">
        <input className="input-base max-w-xs" placeholder="搜索文件名..."
          value={keyword} onChange={(e) => { setKeyword(e.target.value); setPage(1); }} />
        <select className="input-base w-auto" value={format}
          onChange={(e) => { setFormat(e.target.value); setPage(1); }}>
          <option value="">全部格式</option>
          {["csv", "excel", "json", "pdf", "word"].map((f) => <option key={f} value={f}>{f.toUpperCase()}</option>)}
        </select>
        {sel.size > 0 && (
          <button onClick={handleBatchDelete}
            className="text-sm text-red-400 hover:text-red-300 border border-red-500/30 rounded-xl px-3 py-2 bg-red-500/5">
            批量删除 ({sel.size})
          </button>
        )}
      </div>

      <div className="glass-card rounded-2xl border border-zinc-800/60 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-xs text-zinc-500 border-b border-zinc-800/40">
              <th className="w-10 px-4 py-3"><input type="checkbox" className="rounded" /></th>
              <th className="text-left px-4 py-3 font-medium">文件名</th>
              <th className="text-left px-4 py-3 font-medium">格式</th>
              <th className="text-left px-4 py-3 font-medium">大小</th>
              <th className="text-left px-4 py-3 font-medium">行数</th>
              <th className="text-left px-4 py-3 font-medium">状态</th>
              <th className="text-left px-4 py-3 font-medium">上传时间</th>
              <th className="text-left px-4 py-3 font-medium">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800/30">
            {rows.length === 0 ? (
              <tr><td colSpan={8} className="text-center py-10 text-zinc-500">暂无数据</td></tr>
            ) : rows.map((r) => (
              <tr key={r.id} className="hover:bg-white/2">
                <td className="px-4 py-3"><input type="checkbox" className="rounded"
                  checked={sel.has(r.id)} onChange={() => toggleSel(r.id)} /></td>
                <td className="px-4 py-3 text-zinc-100">{r.name || r.fileName}</td>
                <td className="px-4 py-3"><span className="badge bg-indigo-500/15 text-indigo-400 border border-indigo-500/30">{r.fileFormat}</span></td>
                <td className="px-4 py-3 text-zinc-400">{formatSize(r.fileSize)}</td>
                <td className="px-4 py-3 text-zinc-400">{r.rowCount}</td>
                <td className="px-4 py-3">
                  <span className={`badge ${r.status === "ready" ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30" : "bg-amber-500/15 text-amber-400 border-amber-500/30"}`}>
                    {r.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-zinc-500">{r.createdAt?.slice(0, 10)}</td>
                <td className="px-4 py-3">
                  <button onClick={() => handleDelete(r.id)} className="text-xs text-red-400 hover:text-red-300 transition-colors">删除</button>
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

export default function FilesPage() {
  const [stats, setStats] = useState<any>(null);
  useEffect(() => { adminApi.getStats().then(setStats).catch(() => {}); }, []);
  const total = stats?.totalDatasets || 0;
  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-zinc-100">文件管理</h2>
          <p className="text-sm text-zinc-400 mt-1">共 {total} 个文件</p>
        </div>
      </div>
      <FileTable />
    </div>
  );
}
