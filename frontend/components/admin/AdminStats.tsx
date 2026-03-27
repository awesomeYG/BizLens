"use client";

import { useEffect, useState } from "react";
import { adminApi } from "@/lib/admin/api";

function formatSize(s: number) {
  if (!s || s <= 0) return "0 B";
  const u = ["B", "KB", "MB", "GB", "TB"];
  let v = s;
  let i = 0;
  while (v >= 1024 && i < u.length - 1) { v /= 1024; i++; }
  return `${v.toFixed(1)} ${u[i]}`;
}

export default function AdminStats() {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  useEffect(() => {
    adminApi.getStats()
      .then(setStats)
      .catch((e: any) => setErr(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="min-h-[40vh] rounded-3xl border border-zinc-800 bg-zinc-950/40" />;
  if (err) return <div className="rounded-2xl border border-red-500/20 bg-red-500/5 p-4 text-sm text-red-300">加载失败：{err}</div>;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[
          { title: "用户数", value: stats?.totalUsers ?? 0 },
          { title: "文件数", value: stats?.totalDatasets ?? 0 },
          { title: "数据源数", value: stats?.totalDataSources ?? 0 },
          { title: "存储总量", value: formatSize(stats?.totalStorageSize) },
        ].map((c) => (
          <div key={c.title} className="glass-card rounded-2xl p-5 border border-zinc-800/60">
            <div className="text-sm text-zinc-400">{c.title}</div>
            <div className="mt-2 text-3xl font-semibold text-zinc-50">{c.value}</div>
          </div>
        ))}
      </div>
      <div className="glass-card rounded-2xl p-5 border border-zinc-800/60">
        <div className="text-sm text-zinc-400 mb-1">最近上传文件</div>
        <div className="text-lg font-semibold text-zinc-100 mb-4">最近 5 条</div>
        {stats?.recentDatasets?.length ? (
          <div className="divide-y divide-zinc-800/40">
            {stats.recentDatasets.map((d: any) => (
              <div key={d.id} className="py-3 flex items-center justify-between text-sm">
                <span className="text-zinc-100 truncate">{d.name || d.fileName}</span>
                <span className="text-xs text-zinc-500 ml-4 shrink-0">{d.fileFormat} · {formatSize(d.fileSize)}</span>
              </div>
            ))}
          </div>
        ) : <div className="text-sm text-zinc-500">暂无数据</div>}
      </div>
    </div>
  );
}
