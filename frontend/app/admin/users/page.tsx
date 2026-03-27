"use client";

import { useEffect, useState } from "react";
import { adminApi } from "@/lib/admin/api";

function RoleBadge({ role }: { role: string }) {
  const map: Record<string, { cls: string; label: string }> = {
    owner: { cls: "bg-amber-500/15 text-amber-400 border-amber-500/30", label: "所有者" },
    admin: { cls: "bg-indigo-500/15 text-indigo-400 border-indigo-500/30", label: "管理员" },
    member: { cls: "bg-zinc-500/15 text-zinc-400 border-zinc-500/30", label: "成员" },
  };
  const c = map[role] || map.member;
  return <span className={`badge border ${c.cls}`}>{c.label}</span>;
}

interface User { id: string; name: string; email: string; role: string; isLocked: boolean; lastLoginAt?: string; }

export default function UsersPage() {
  const [page, setPage] = useState(1);
  const [keyword, setKeyword] = useState("");
  const [users, setUsers] = useState<User[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPage, setTotalPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<User | null>(null);
  const [resetInfo, setResetInfo] = useState<{ name: string; password: string } | null>(null);

  const load = () => {
    setLoading(true);
    (adminApi.listUsers({ page: String(page), keyword, pageSize: "20" } as any) as Promise<any>)
      .then((r: any) => { setUsers(r.users || []); setTotal(r.total || 0); setTotalPage(r.totalPage || 1); })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [page, keyword]);

  const handleDelete = async (id: string) => { await adminApi.deleteUser(id); setDeleteTarget(null); load(); };
  const handleToggle = async (id: string) => { await adminApi.toggleUserStatus(id); load(); };
  const handleReset = async (id: string, name: string) => {
    const r: any = await adminApi.resetUserPassword(id);
    setResetInfo({ name, password: r.password });
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-zinc-100">用户管理</h2>
          <p className="text-sm text-zinc-400 mt-1">共 {total} 位用户</p>
        </div>
        <button onClick={() => setShowAdd(true)} className="btn-primary">+ 添加用户</button>
      </div>
      <input className="input-base max-w-xs" placeholder="搜索姓名或邮箱..."
        value={keyword} onChange={(e) => { setKeyword(e.target.value); setPage(1); }} />
      <div className="glass-card rounded-2xl border border-zinc-800/60 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-xs text-zinc-500 border-b border-zinc-800/40">
              {["姓名", "邮箱", "角色", "状态", "最近登录", "操作"].map((h) => (
                <th key={h} className="text-left px-4 py-3 font-medium">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800/30">
            {loading ? (
              <tr><td colSpan={6} className="text-center py-10 text-zinc-500">加载中...</td></tr>
            ) : users.length === 0 ? (
              <tr><td colSpan={6} className="text-center py-10 text-zinc-500">暂无数据</td></tr>
            ) : users.map((u) => (
              <tr key={u.id} className="hover:bg-white/2">
                <td className="px-4 py-3 text-zinc-100">{u.name}</td>
                <td className="px-4 py-3 text-zinc-400">{u.email}</td>
                <td className="px-4 py-3"><RoleBadge role={u.role} /></td>
                <td className="px-4 py-3">
                  <span className={`badge ${u.isLocked ? "bg-red-500/15 text-red-400 border-red-500/30" : "bg-emerald-500/15 text-emerald-400 border-emerald-500/30"}`}>
                    {u.isLocked ? "已禁用" : "正常"}
                  </span>
                </td>
                <td className="px-4 py-3 text-zinc-500">{u.lastLoginAt ? u.lastLoginAt.slice(0, 10) : "从未登录"}</td>
                <td className="px-4 py-3">
                  <div className="flex gap-3">
                    <button onClick={() => void handleReset(u.id, u.name)} className="text-xs text-zinc-400 hover:text-indigo-300 transition-colors">重置密码</button>
                    {u.role !== "owner" && (
                      <>
                        <button onClick={() => void handleToggle(u.id)} className="text-xs text-zinc-400 hover:text-amber-300 transition-colors">{u.isLocked ? "启用" : "禁用"}</button>
                        <button onClick={() => setDeleteTarget(u)} className="text-xs text-zinc-400 hover:text-red-300 transition-colors">删除</button>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {totalPage > 1 && (
        <div className="flex items-center justify-center gap-3">
          <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="btn-secondary px-3 py-1.5 text-sm disabled:opacity-30">上一页</button>
          <span className="text-sm text-zinc-500">{page} / {totalPage}</span>
          <button disabled={page >= totalPage} onClick={() => setPage(p => p + 1)} className="btn-secondary px-3 py-1.5 text-sm disabled:opacity-30">下一页</button>
        </div>
      )}

      {showAdd && <AddUserModal onClose={() => setShowAdd(false)} onSuccess={load} />}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="glass-card rounded-2xl p-6 w-full max-w-sm border border-red-500/30">
            <h3 className="text-lg font-semibold text-red-300 mb-2">确认删除</h3>
            <p className="text-sm text-zinc-400 mb-5">确定要删除用户 <span className="text-zinc-200">{deleteTarget.name}</span> 吗？此操作不可撤销。</p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteTarget(null)} className="btn-secondary flex-1">取消</button>
              <button onClick={() => void handleDelete(deleteTarget.id)} className="flex-1 rounded-xl bg-red-600 hover:bg-red-500 text-white py-2.5 font-medium transition-all">确认删除</button>
            </div>
          </div>
        </div>
      )}
      {resetInfo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="glass-card rounded-2xl p-6 w-full max-w-sm border border-amber-500/30">
            <h3 className="text-lg font-semibold text-amber-300 mb-2">密码已重置</h3>
            <p className="text-sm text-zinc-400 mb-2">用户 <span className="text-zinc-200">{resetInfo.name}</span> 的新密码为：</p>
            <div className="bg-zinc-900 rounded-xl p-3 font-mono text-indigo-300 text-center text-lg tracking-wider mb-2">{resetInfo.password}</div>
            <p className="text-xs text-amber-400/70 mb-4">请将该密码告知用户，仅显示一次</p>
            <button onClick={() => setResetInfo(null)} className="btn-primary w-full">我已知晓</button>
          </div>
        </div>
      )}
    </div>
  );
}

function AddUserModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const [form, setForm] = useState({ name: "", email: "", password: "", role: "member" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handle = async () => {
    if (!form.name || !form.email || !form.password) { setError("请填写完整信息"); return; }
    setLoading(true); setError("");
    try { await (adminApi.createUser(form as any) as Promise<any>); onSuccess(); onClose(); }
    catch (e: any) { setError(e.message || "创建失败"); }
    finally { setLoading(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="glass-card rounded-2xl p-6 w-full max-w-md border border-zinc-700">
        <h3 className="text-lg font-semibold text-zinc-100 mb-4">添加用户</h3>
        {error && <div className="mb-3 text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl px-3 py-2">{error}</div>}
        <div className="space-y-3">
          <input className="input-base" placeholder="姓名" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <input className="input-base" type="email" placeholder="邮箱" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          <input className="input-base" type="password" placeholder="初始密码" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
          <div className="flex gap-2">
            {(["admin", "member"] as const).map((r) => (
              <button key={r} onClick={() => setForm({ ...form, role: r })}
                className={`flex-1 py-2 rounded-xl text-sm border transition-all ${form.role === r ? "bg-indigo-500/15 text-indigo-300 border-indigo-500/30" : "bg-zinc-900 text-zinc-400 border-zinc-700"}`}>
                {r === "admin" ? "管理员" : "成员"}
              </button>
            ))}
          </div>
        </div>
        <div className="flex gap-3 mt-5">
          <button onClick={onClose} className="btn-secondary flex-1">取消</button>
          <button onClick={handle} disabled={loading} className="btn-primary flex-1">{loading ? "创建中..." : "创建"}</button>
        </div>
      </div>
    </div>
  );
}
