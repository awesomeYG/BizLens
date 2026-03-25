"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { getCurrentUser } from "@/lib/user-store";
import { request } from "@/lib/auth/api";
import AppHeader from "@/components/AppHeader";
import type { Report, ReportCategory } from "@/lib/types";

const CATEGORIES: { id: string; name: string }[] = [
  { id: "all", name: "全部" },
  { id: "sales", name: "销售" },
  { id: "finance", name: "财务" },
  { id: "operations", name: "运营" },
  { id: "marketing", name: "营销" },
  { id: "custom", name: "自定义" },
];

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  draft: { label: "草稿", color: "bg-zinc-700 text-zinc-300" },
  published: { label: "已发布", color: "bg-emerald-900/60 text-emerald-400" },
  archived: { label: "已归档", color: "bg-amber-900/60 text-amber-400" },
};

const TYPE_MAP: Record<string, string> = {
  daily: "日报",
  weekly: "周报",
  monthly: "月报",
  custom: "自定义",
  realtime: "实时",
};

const GRADIENT_COLORS = [
  "from-indigo-500 to-purple-600",
  "from-emerald-500 to-teal-600",
  "from-amber-500 to-orange-600",
  "from-rose-500 to-pink-600",
  "from-cyan-500 to-blue-600",
  "from-violet-500 to-fuchsia-600",
];

function getGradient(index: number): string {
  return GRADIENT_COLORS[index % GRADIENT_COLORS.length];
}

function formatTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return "刚刚";
  if (diffMin < 60) return `${diffMin} 分钟前`;
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `${diffHour} 小时前`;
  const diffDay = Math.floor(diffHour / 24);
  if (diffDay < 30) return `${diffDay} 天前`;
  return date.toLocaleDateString("zh-CN");
}

export default function ReportsPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [tenantId, setTenantId] = useState<string>("");
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  useEffect(() => {
    const user = getCurrentUser();
    if (!user) {
      router.replace("/auth/login");
      return;
    }
    if (!user.isOnboarded) {
      router.replace("/onboarding");
      return;
    }
    setTenantId(user.id?.split("@")[0] || "demo");
    setReady(true);
  }, [router]);

  const fetchReports = useCallback(async () => {
    if (!tenantId) return;
    setLoading(true);
    try {
      const category = selectedCategory === "all" ? "" : selectedCategory;
      const params = new URLSearchParams();
      if (category) params.set("category", category);
      const data = await request<Report[]>(
        `/tenants/${tenantId}/reports${params.toString() ? "?" + params.toString() : ""}`
      );
      setReports(data || []);
    } catch (err) {
      console.error("获取报表列表失败:", err);
      setReports([]);
    } finally {
      setLoading(false);
    }
  }, [tenantId, selectedCategory]);

  useEffect(() => {
    if (ready && tenantId) {
      fetchReports();
    }
  }, [ready, tenantId, fetchReports]);

  const handleDelete = async (reportId: string) => {
    try {
      await request(`/tenants/${tenantId}/reports/${reportId}`, {
        method: "DELETE",
      });
      setReports((prev) => prev.filter((r) => r.id !== reportId));
      setDeleteConfirmId(null);
      setMenuOpenId(null);
    } catch (err) {
      console.error("删除报表失败:", err);
    }
  };

  const handleDuplicate = async (reportId: string) => {
    try {
      const newReport = await request<Report>(
        `/tenants/${tenantId}/reports/${reportId}/duplicate`,
        { method: "POST" }
      );
      setReports((prev) => [newReport, ...prev]);
      setMenuOpenId(null);
    } catch (err) {
      console.error("复制报表失败:", err);
    }
  };

  const handlePublish = async (report: Report) => {
    const newStatus = report.status === "published" ? "draft" : "published";
    try {
      const updated = await request<Report>(
        `/tenants/${tenantId}/reports/${report.id}`,
        {
          method: "PUT",
          body: JSON.stringify({ status: newStatus }),
        }
      );
      setReports((prev) => prev.map((r) => (r.id === report.id ? updated : r)));
      setMenuOpenId(null);
    } catch (err) {
      console.error("更新报表状态失败:", err);
    }
  };

  if (!ready) {
    return <div className="min-h-screen bg-zinc-950" />;
  }

  return (
    <div className="min-h-screen bg-zinc-950">
      <AppHeader
        title="我的报表"
        actions={
          <button
            onClick={() => router.push("/reports/create")}
            className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium transition-all shadow-lg shadow-indigo-500/30"
          >
            + 新建报表
          </button>
        }
      />

      <main className="max-w-6xl mx-auto p-6">
        {/* 分类筛选 */}
        <div className="flex items-center gap-2 mb-6 overflow-x-auto pb-2">
          {CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all ${
                selectedCategory === cat.id
                  ? "bg-indigo-600 text-white shadow-lg shadow-indigo-500/30"
                  : "bg-zinc-900 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200 border border-zinc-800"
              }`}
            >
              {cat.name}
            </button>
          ))}
        </div>

        {/* 加载状态 */}
        {loading ? (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="rounded-2xl bg-zinc-900/50 border border-zinc-800/50 overflow-hidden animate-pulse"
              >
                <div className="h-2 bg-zinc-800" />
                <div className="p-5 space-y-3">
                  <div className="h-5 bg-zinc-800 rounded w-3/4" />
                  <div className="h-4 bg-zinc-800/60 rounded w-full" />
                  <div className="h-3 bg-zinc-800/40 rounded w-1/2" />
                </div>
              </div>
            ))}
          </div>
        ) : reports.length === 0 ? (
          /* 空状态 */
          <div className="text-center py-16">
            <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center">
              <svg
                className="w-10 h-10 text-zinc-600"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={1.5}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M3.75 3v11.25A2.25 2.25 0 0 0 6 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0 1 18 16.5h-2.25m-7.5 0h7.5m-7.5 0-1 3m8.5-3 1 3m0 0 .5 1.5m-.5-1.5h-9.5m0 0-.5 1.5m.75-9 3-3 2.148 2.148A12.061 12.061 0 0 1 16.5 7.604"
                />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-zinc-100 mb-2">
              还没有报表
            </h3>
            <p className="text-zinc-500 mb-6">
              创建你的第一个数据报表，或在 AI 对话中让 AI 帮你生成
            </p>
            <div className="flex items-center justify-center gap-3">
              <button
                onClick={() => router.push("/reports/create")}
                className="px-6 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-medium transition-all shadow-lg shadow-indigo-500/30"
              >
                新建报表
              </button>
              <button
                onClick={() => router.push("/chat")}
                className="px-6 py-3 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-medium transition-all border border-zinc-700"
              >
                AI 生成
              </button>
            </div>
          </div>
        ) : (
          /* 报表列表 */
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {reports.map((report, index) => (
              <div
                key={report.id}
                className="group rounded-2xl bg-zinc-900/50 border border-zinc-800/50 hover:border-zinc-700 overflow-hidden transition-all cursor-pointer relative"
                onClick={() => router.push(`/reports/${report.id}`)}
              >
                {/* 顶部渐变色条 */}
                <div
                  className={`h-2 bg-gradient-to-r ${getGradient(index)}`}
                />

                <div className="p-5">
                  {/* 标题行 */}
                  <div className="flex items-start justify-between mb-1">
                    <h3 className="text-base font-semibold text-zinc-100 group-hover:text-indigo-400 transition-colors line-clamp-1 flex-1">
                      {report.title}
                    </h3>
                    {/* 操作菜单按钮 */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setMenuOpenId(
                          menuOpenId === report.id ? null : report.id
                        );
                      }}
                      className="text-zinc-500 hover:text-zinc-300 transition-colors ml-2 p-1"
                    >
                      <svg
                        className="w-4 h-4"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={2}
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M6.75 12a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0ZM12.75 12a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0ZM18.75 12a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0Z"
                        />
                      </svg>
                    </button>
                  </div>

                  {/* 描述 */}
                  <p className="text-sm text-zinc-500 mb-3 line-clamp-2">
                    {report.description || "暂无描述"}
                  </p>

                  {/* 标签 */}
                  <div className="flex items-center gap-2 mb-3 flex-wrap">
                    {/* 状态标签 */}
                    <span
                      className={`px-2 py-0.5 rounded text-xs font-medium ${
                        STATUS_MAP[report.status]?.color || STATUS_MAP.draft.color
                      }`}
                    >
                      {STATUS_MAP[report.status]?.label || "草稿"}
                    </span>
                    {/* 类型标签 */}
                    <span className="px-2 py-0.5 rounded text-xs font-medium bg-zinc-800 text-zinc-400">
                      {TYPE_MAP[report.type] || report.type}
                    </span>
                    {/* AI 标签 */}
                    {report.aiGenerated && (
                      <span className="px-2 py-0.5 rounded text-xs font-medium bg-purple-900/60 text-purple-400">
                        AI
                      </span>
                    )}
                  </div>

                  {/* 底部信息 */}
                  <div className="flex items-center justify-between text-xs text-zinc-600">
                    <span>
                      {report.sections?.length || 0} 个图表
                    </span>
                    <span>更新于 {formatTime(report.updatedAt)}</span>
                  </div>

                  {/* 下拉菜单 */}
                  {menuOpenId === report.id && (
                    <div
                      className="absolute right-4 top-14 z-20 w-36 rounded-xl bg-zinc-800 border border-zinc-700 shadow-xl py-1 animate-in fade-in slide-in-from-top-2"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button
                        onClick={() => {
                          router.push(`/reports/${report.id}`);
                          setMenuOpenId(null);
                        }}
                        className="w-full text-left px-4 py-2 text-sm text-zinc-300 hover:bg-zinc-700 transition-colors"
                      >
                        查看
                      </button>
                      <button
                        onClick={() => handlePublish(report)}
                        className="w-full text-left px-4 py-2 text-sm text-zinc-300 hover:bg-zinc-700 transition-colors"
                      >
                        {report.status === "published" ? "取消发布" : "发布"}
                      </button>
                      <button
                        onClick={() => handleDuplicate(report.id)}
                        className="w-full text-left px-4 py-2 text-sm text-zinc-300 hover:bg-zinc-700 transition-colors"
                      >
                        复制
                      </button>
                      <hr className="border-zinc-700 my-1" />
                      <button
                        onClick={() => setDeleteConfirmId(report.id)}
                        className="w-full text-left px-4 py-2 text-sm text-red-400 hover:bg-zinc-700 transition-colors"
                      >
                        删除
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* 点击遮罩关闭菜单 */}
      {menuOpenId && (
        <div
          className="fixed inset-0 z-10"
          onClick={() => setMenuOpenId(null)}
        />
      )}

      {/* 删除确认弹窗 */}
      {deleteConfirmId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-zinc-900 border border-zinc-700 rounded-2xl p-6 max-w-sm w-full mx-4 shadow-2xl">
            <h3 className="text-lg font-semibold text-zinc-100 mb-2">
              确认删除
            </h3>
            <p className="text-zinc-400 text-sm mb-6">
              删除后无法恢复，确定要删除这个报表吗？
            </p>
            <div className="flex items-center justify-end gap-3">
              <button
                onClick={() => {
                  setDeleteConfirmId(null);
                  setMenuOpenId(null);
                }}
                className="px-4 py-2 rounded-lg text-sm text-zinc-300 hover:bg-zinc-800 transition-colors"
              >
                取消
              </button>
              <button
                onClick={() => handleDelete(deleteConfirmId)}
                className="px-4 py-2 rounded-lg text-sm bg-red-600 hover:bg-red-500 text-white transition-colors"
              >
                删除
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
