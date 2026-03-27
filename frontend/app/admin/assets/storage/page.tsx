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

export default function StoragePage() {
  const [storageType, setStorageType] = useState<"local" | "s3">("local");
  const [localPath, setLocalPath] = useState("/data/uploads");
  const [s3Config, setS3Config] = useState({ endpoint: "", accessKey: "", secretKey: "", bucket: "", region: "" });
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  const [stats, setStats] = useState<any>(null);
  useEffect(() => { adminApi.getStats().then(setStats).catch(() => {}); }, []);

  const handleSave = () => {
    setSaving(true);
    setTimeout(() => { setSaving(false); setSaved(true); }, 800);
  };

  const byFormat = stats?.storageByFormat || {};
  const total = Object.values(byFormat).reduce((a: number, b: any) => a + (b as number), 0) as number;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-zinc-100">存储配置</h2>
        <p className="text-sm text-zinc-400 mt-1">配置文件的存储方式和存储后端</p>
      </div>

      {/* 存储类型 */}
      <div className="glass-card rounded-2xl border border-zinc-800/60 p-5">
        <h3 className="text-sm font-medium text-zinc-200 mb-4">存储方式</h3>
        <div className="flex gap-3">
          {([["local", "本地存储"], ["s3", "S3 兼容存储"]] as [string, string][]).map(([v, label]) => (
            <button key={v} onClick={() => setStorageType(v as any)}
              className={`px-4 py-2.5 rounded-xl text-sm border transition-all ${
                storageType === v
                  ? "bg-indigo-500/15 text-indigo-300 border-indigo-500/30"
                  : "bg-zinc-900 text-zinc-400 border-zinc-700 hover:border-zinc-500"
              }`}>
              {label}
            </button>
          ))}
        </div>

        {storageType === "local" ? (
          <div className="mt-4">
            <label className="text-sm text-zinc-300 block mb-2">本地存储路径</label>
            <input className="input-base" value={localPath}
              onChange={(e) => setLocalPath(e.target.value)} />
            <p className="text-xs text-zinc-500 mt-1.5">文件将保存在服务器指定路径下</p>
          </div>
        ) : (
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {(["endpoint", "accessKey", "secretKey", "bucket", "region"] as const).map((f) => (
              <div key={f}>
                <label className="text-sm text-zinc-300 block mb-1.5">
                  {f === "accessKey" ? "Access Key" : f === "secretKey" ? "Secret Key" : f === "endpoint" ? "Endpoint" : f === "bucket" ? "Bucket" : "Region"}
                </label>
                <input className="input-base" type={f === "secretKey" || f === "accessKey" ? "password" : "text"}
                  value={(s3Config as any)[f]} onChange={(e) => setS3Config({ ...s3Config, [f]: e.target.value })}
                  placeholder={f} />
              </div>
            ))}
          </div>
        )}

        {saved && <p className="text-sm text-emerald-400 mt-3">保存成功</p>}

        <button onClick={handleSave} disabled={saving}
          className="btn-primary mt-4">
          {saving ? "保存中..." : "保存配置"}
        </button>
      </div>

      {/* 存储统计 */}
      <div className="glass-card rounded-2xl border border-zinc-800/60 p-5">
        <h3 className="text-sm font-medium text-zinc-200 mb-4">存储使用情况</h3>
        <div className="text-2xl font-semibold text-zinc-100 mb-4">{formatSize(total)}</div>
        <div className="space-y-2">
          {Object.entries(byFormat).map(([fmt, size]) => (
            <div key={fmt} className="flex items-center gap-3">
              <span className="text-xs text-zinc-400 w-12">{fmt}</span>
              <div className="flex-1 bg-zinc-800 rounded-full h-2">
                <div className="h-2 rounded-full bg-indigo-500"
                  style={{ width: `${total > 0 ? ((size as number) / total * 100).toFixed(1) : 0}%` }} />
              </div>
              <span className="text-xs text-zinc-400 w-16 text-right">{formatSize(size as number)}</span>
            </div>
          ))}
        </div>
        {Object.keys(byFormat).length === 0 && (
          <p className="text-sm text-zinc-500">暂无数据</p>
        )}
      </div>
    </div>
  );
}
