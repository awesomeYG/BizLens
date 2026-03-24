"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { getCurrentUser } from "@/lib/user-store";
import { request } from "@/lib/auth/api";
import AppHeader from "@/components/AppHeader";
import SectionRenderer from "@/components/dashboard/SectionRenderer";
import type { Report, DashboardSection, SectionData } from "@/lib/types";

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

/**
 * 将 ReportSection 转换为 SectionRenderer 需要的 DashboardSection
 */
function toRenderSection(
  sec: Report["sections"] extends (infer S)[] | undefined ? S : never
): DashboardSection {
  return {
    id: sec.id,
    type: sec.type as DashboardSection["type"],
    title: sec.title,
    metrics: sec.metrics,
    dimensions: sec.dimensions,
    chartConfig: sec.chartConfig,
    colSpan: sec.colSpan || 12,
    rowSpan: sec.rowSpan || 1,
    priority: sec.sortOrder,
    timeGrain: sec.timeGrain,
    topN: sec.topN,
    comparison: sec.comparison,
    filterExpr: sec.filterExpr,
    data: sec.dataConfig as SectionData | undefined,
  };
}

export default function ReportDetailPage() {
  const router = useRouter();
  const params = useParams();
  const reportId = params.id as string;

  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tenantId, setTenantId] = useState("");

  useEffect(() => {
    const user = getCurrentUser();
    if (!user?.isOnboarded) {
      router.replace("/onboarding");
      return;
    }
    setTenantId(user.id?.split("@")[0] || "demo");
  }, [router]);

  useEffect(() => {
    if (!tenantId || !reportId) return;

    const fetchReport = async () => {
      setLoading(true);
      try {
        const data = await request<Report>(
          `/tenants/${tenantId}/reports/${reportId}`
        );
        setReport(data);
      } catch (err: any) {
        setError(err?.message || "获取报表失败");
      } finally {
        setLoading(false);
      }
    };

    fetchReport();
  }, [tenantId, reportId]);

  const handlePublish = async () => {
    if (!report) return;
    const newStatus = report.status === "published" ? "draft" : "published";
    try {
      const updated = await request<Report>(
        `/tenants/${tenantId}/reports/${report.id}`,
        {
          method: "PUT",
          body: JSON.stringify({ status: newStatus }),
        }
      );
      setReport(updated);
    } catch (err) {
      console.error("更新状态失败:", err);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950">
        <AppHeader title="加载中..." backHref="/reports" />
        <main className="max-w-6xl mx-auto p-6">
          <div className="space-y-4 animate-pulse">
            <div className="h-8 bg-zinc-800 rounded w-1/3" />
            <div className="h-4 bg-zinc-800/60 rounded w-2/3" />
            <div className="grid grid-cols-12 gap-4 mt-8">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="col-span-4 h-64 bg-zinc-900 rounded-xl border border-zinc-800"
                />
              ))}
            </div>
          </div>
        </main>
      </div>
    );
  }

  if (error || !report) {
    return (
      <div className="min-h-screen bg-zinc-950">
        <AppHeader title="报表不存在" backHref="/reports" />
        <main className="max-w-6xl mx-auto p-6">
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
                  d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z"
                />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-zinc-100 mb-2">
              {error || "报表不存在"}
            </h3>
            <button
              onClick={() => router.push("/reports")}
              className="mt-4 px-6 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-medium transition-all"
            >
              返回报表列表
            </button>
          </div>
        </main>
      </div>
    );
  }

  const sections = report.sections || [];
  const renderSections = sections.map(toRenderSection);

  return (
    <div className="min-h-screen bg-zinc-950">
      <AppHeader
        title={report.title}
        breadcrumb={["BizLens", "报表", report.title]}
        backHref="/reports"
        actions={
          <div className="flex items-center gap-2">
            <button
              onClick={handlePublish}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                report.status === "published"
                  ? "border border-zinc-600 bg-zinc-800 text-zinc-300 hover:bg-zinc-700"
                  : "bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-500/30"
              }`}
            >
              {report.status === "published" ? "取消发布" : "发布"}
            </button>
            <button
              onClick={() => router.push(`/reports/create?edit=${report.id}`)}
              className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium transition-all shadow-lg shadow-indigo-500/30"
            >
              编辑
            </button>
          </div>
        }
      />

      <main className="max-w-[1400px] mx-auto p-6">
        {/* 报表元信息 */}
        <div className="mb-6 flex items-center gap-3 flex-wrap">
          <span
            className={`px-2.5 py-1 rounded-md text-xs font-medium ${
              STATUS_MAP[report.status]?.color || STATUS_MAP.draft.color
            }`}
          >
            {STATUS_MAP[report.status]?.label || "草稿"}
          </span>
          <span className="px-2.5 py-1 rounded-md text-xs font-medium bg-zinc-800 text-zinc-400">
            {TYPE_MAP[report.type] || report.type}
          </span>
          {report.aiGenerated && (
            <span className="px-2.5 py-1 rounded-md text-xs font-medium bg-purple-900/60 text-purple-400">
              AI 生成
            </span>
          )}
          {report.tags?.map((tag) => (
            <span
              key={tag}
              className="px-2.5 py-1 rounded-md text-xs font-medium bg-zinc-800/60 text-zinc-500"
            >
              {tag}
            </span>
          ))}
          {report.description && (
            <span className="text-sm text-zinc-500 ml-2">
              {report.description}
            </span>
          )}
        </div>

        {/* 报表内容区域 */}
        {sections.length === 0 ? (
          <div className="text-center py-20 border border-dashed border-zinc-800 rounded-2xl">
            <svg
              className="w-12 h-12 mx-auto text-zinc-700 mb-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M3.75 6A2.25 2.25 0 0 1 6 3.75h2.25A2.25 2.25 0 0 1 10.5 6v2.25a2.25 2.25 0 0 1-2.25 2.25H6a2.25 2.25 0 0 1-2.25-2.25V6ZM3.75 15.75A2.25 2.25 0 0 1 6 13.5h2.25a2.25 2.25 0 0 1 2.25 2.25V18a2.25 2.25 0 0 1-2.25 2.25H6A2.25 2.25 0 0 1 3.75 18v-2.25ZM13.5 6a2.25 2.25 0 0 1 2.25-2.25H18A2.25 2.25 0 0 1 20.25 6v2.25A2.25 2.25 0 0 1 18 10.5h-2.25a2.25 2.25 0 0 1-2.25-2.25V6ZM13.5 15.75a2.25 2.25 0 0 1 2.25-2.25H18a2.25 2.25 0 0 1 2.25 2.25V18A2.25 2.25 0 0 1 18 20.25h-2.25a2.25 2.25 0 0 1-2.25-2.25v-2.25Z"
              />
            </svg>
            <h3 className="text-zinc-400 font-medium mb-2">
              报表还没有内容
            </h3>
            <p className="text-zinc-600 text-sm mb-4">
              点击编辑按钮添加图表和数据
            </p>
            <button
              onClick={() => router.push(`/reports/create?edit=${report.id}`)}
              className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium transition-all"
            >
              编辑报表
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-12 gap-4">
            {renderSections.map((section) => (
              <div
                key={section.id}
                className={`col-span-${section.colSpan || 12}`}
                style={{
                  gridColumn: `span ${section.colSpan || 12} / span ${section.colSpan || 12}`,
                }}
              >
                <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] overflow-hidden">
                  {section.title && (
                    <div className="px-5 pt-4 pb-2">
                      <h3 className="text-sm font-medium text-zinc-300">
                        {section.title}
                      </h3>
                    </div>
                  )}
                  <div className="px-4 pb-4">
                    <SectionRenderer section={section} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
