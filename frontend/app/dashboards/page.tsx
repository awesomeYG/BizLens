"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { getCurrentUser } from "@/lib/user-store";
import AppHeader from "@/components/AppHeader";
import DashboardView from "@/components/DashboardView";
import ObservabilityCenter from "@/components/observability/ObservabilityCenter";
import { DASHBOARD_TEMPLATES, getTemplatesByCategory } from "@/lib/dashboard-templates";
import { listDashboards, type DashboardInstanceView } from "@/lib/dashboard-store";
import type { DashboardTemplate } from "@/lib/types";

const CATEGORIES = [
  { id: "all", name: "全部" },
  { id: "operations", name: "运营分析" },
  { id: "finance", name: "财务分析" },
  { id: "channel", name: "渠道/客户" },
  { id: "product", name: "供应链" },
  { id: "custom", name: "自定义" },
];

export default function DashboardsPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#0b0b10]" />}>
      <DashboardsContent />
    </Suspense>
  );
}

function DashboardsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [ready, setReady] = useState(false);

  // Tab 状态: "observability" | "boards"
  const tabFromUrl = searchParams.get("tab");
  const idFromUrl = searchParams.get("id");
  const [activeTab, setActiveTab] = useState<"observability" | "boards">(
    tabFromUrl === "boards" || idFromUrl ? "boards" : "observability"
  );

  // 看板相关状态
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [previewTemplate, setPreviewTemplate] = useState<DashboardTemplate | null>(null);
  const [myDashboards, setMyDashboards] = useState<DashboardInstanceView[]>([]);
  const [activeMyDashboard, setActiveMyDashboard] = useState<DashboardInstanceView | null>(null);

  useEffect(() => {
    const user = getCurrentUser();
    if (!user) {
      router.replace("/auth/login");
      return;
    }
    setReady(true);
  }, [router]);

  useEffect(() => {
    if (!ready || activeTab !== "boards") return;
    const loadDashboards = async () => {
      const list = await listDashboards().catch(() => []);
      setMyDashboards(list);
      if (list.length === 0) {
        setActiveMyDashboard(null);
        return;
      }
      const matched = idFromUrl ? list.find((d) => d.id === idFromUrl) : undefined;
      setActiveMyDashboard(matched || list[0]);
    };
    void loadDashboards();
  }, [ready, activeTab, idFromUrl]);

  const filteredTemplates = getTemplatesByCategory(selectedCategory).filter(
    (t) => t.id !== "custom" || selectedCategory === "custom" || selectedCategory === "all"
  );

  const handleUseTemplate = (template: DashboardTemplate) => {
    setPreviewTemplate(template);
  };

  const switchTab = (tab: "observability" | "boards") => {
    setActiveTab(tab);
    if (tab === "observability") {
      router.replace("/dashboards");
    } else {
      router.replace("/dashboards?tab=boards");
    }
  };

  if (!ready) {
    return <div className="min-h-screen bg-[#0b0b10]" />;
  }

  // 模板预览全屏
  if (previewTemplate) {
    return (
      <div className="min-h-screen flex flex-col bg-gradient-to-b from-[#0b0b10] via-[#0f1020] to-[#0b0b10] text-white">
        <AppHeader
          title={previewTemplate.name}
          breadcrumb={["BizLens", "观测中心", "看板", previewTemplate.name]}
          actions={
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPreviewTemplate(null)}
                className="px-3 py-1.5 rounded-lg border border-white/10 bg-white/5 text-zinc-300 text-xs font-medium hover:bg-white/10 transition-all"
              >
                返回
              </button>
              <button className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium transition-all shadow-lg shadow-indigo-500/30">
                保存为看板
              </button>
            </div>
          }
        />
        <main className="flex-1 px-4 pb-8">
          <div className="max-w-[1400px] mx-auto">
            <DashboardView template={previewTemplate} />
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-[#0b0b10] via-[#0f1020] to-[#0b0b10] text-white">
      <AppHeader
        title="观测中心"
        breadcrumb={["BizLens", "观测中心"]}
      />

      <main className="flex-1 px-6 pb-12">
        <div className="max-w-7xl mx-auto space-y-6">
          {/* Tab 切换 */}
          <div className="flex items-center gap-1 p-1 rounded-xl bg-white/[0.03] border border-white/[0.06] w-fit">
            <button
              onClick={() => switchTab("observability")}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                activeTab === "observability"
                  ? "bg-indigo-500/20 text-indigo-300 shadow-sm"
                  : "text-white/40 hover:text-white/60 hover:bg-white/[0.04]"
              }`}
            >
              观测中心
            </button>
            <button
              onClick={() => switchTab("boards")}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                activeTab === "boards"
                  ? "bg-indigo-500/20 text-indigo-300 shadow-sm"
                  : "text-white/40 hover:text-white/60 hover:bg-white/[0.04]"
              }`}
            >
              我的看板
            </button>
          </div>

          {/* 观测中心 Tab */}
          {activeTab === "observability" && <ObservabilityCenter />}

          {/* 我的看板 Tab */}
          {activeTab === "boards" && (
            <div className="space-y-8">
              {/* 分类标签 */}
              <div className="flex gap-2 overflow-x-auto pb-1">
                {CATEGORIES.map((cat) => (
                  <button
                    key={cat.id}
                    onClick={() => setSelectedCategory(cat.id)}
                    className={`px-4 py-2 rounded-xl whitespace-nowrap border transition-all text-sm font-medium ${
                      selectedCategory === cat.id
                        ? "border-indigo-500/50 bg-indigo-500/15 text-indigo-100"
                        : "border-white/5 bg-white/[0.03] text-zinc-300 hover:border-white/10 hover:bg-white/5"
                    }`}
                  >
                    {cat.name}
                  </button>
                ))}
              </div>

              {/* 模板网格 */}
              <section className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-lg font-semibold text-white">看板模板</h2>
                    <p className="text-sm text-zinc-400">选择模板快速创建看板</p>
                  </div>
                  <span className="text-xs text-zinc-500">{filteredTemplates.length} 个模板</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {filteredTemplates.map((template) => (
                    <div
                      key={template.id}
                      onClick={() => handleUseTemplate(template)}
                      className="group relative overflow-hidden rounded-2xl border border-white/[0.06] bg-white/[0.02] backdrop-blur hover:border-indigo-400/50 hover:shadow-xl hover:shadow-indigo-900/20 transition-all cursor-pointer"
                    >
                      <div className="h-40 overflow-hidden bg-gradient-to-br from-slate-900/80 via-[#0f1020] to-black relative">
                        {template.sections && template.sections.length > 0 ? (
                          <div className="pointer-events-none">
                            <DashboardView template={template} compact />
                          </div>
                        ) : (
                          <div className="absolute inset-0 flex items-center justify-center text-zinc-600">
                            <span className="text-4xl">{template.icon || "D"}</span>
                          </div>
                        )}
                        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                      </div>
                      <div className="p-4 space-y-3">
                        <div className="flex items-start gap-3">
                          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500/25 to-cyan-500/25 flex items-center justify-center text-lg shrink-0">
                            {template.icon || "D"}
                          </div>
                          <div className="flex-1 min-w-0">
                            <h3 className="text-sm font-semibold text-white line-clamp-1">{template.name}</h3>
                            <p className="text-xs text-zinc-400 line-clamp-2 mt-0.5">{template.description}</p>
                          </div>
                        </div>
                        <div className="flex flex-wrap items-center gap-1.5">
                          {template.tags?.slice(0, 3).map((tag) => (
                            <span key={tag} className="px-2 py-0.5 rounded-full bg-white/5 border border-white/10 text-[10px] text-zinc-300">
                              {tag}
                            </span>
                          ))}
                          <span className="ml-auto text-[10px] text-zinc-500">{template.sections?.length || 0} 个区块</span>
                        </div>
                      </div>
                      <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-indigo-400/40 to-transparent opacity-0 group-hover:opacity-100 transition" />
                    </div>
                  ))}
                </div>
              </section>

              {/* 我的看板 */}
              <section className="space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-lg font-semibold text-white">已创建的看板</h2>
                    <p className="text-sm text-zinc-400">通过模板或 AI 对话创建的看板</p>
                  </div>
                </div>

                {activeMyDashboard ? (
                  <div className="space-y-3">
                    <div className="flex flex-wrap items-center gap-2">
                      {myDashboards.map((dashboard) => {
                        const active = dashboard.id === activeMyDashboard.id;
                        return (
                          <button
                            key={dashboard.id}
                            onClick={() => {
                              setActiveMyDashboard(dashboard);
                              router.replace(`/dashboards?tab=boards&id=${dashboard.id}`);
                            }}
                            className={`px-3 py-1.5 rounded-lg border text-xs transition-all ${
                              active
                                ? "border-indigo-500/50 bg-indigo-500/20 text-indigo-100"
                                : "border-white/10 bg-white/5 text-zinc-300 hover:bg-white/10"
                            }`}
                          >
                            {dashboard.title}
                          </button>
                        );
                      })}
                    </div>
                    <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-white/[0.02] p-4">
                      <DashboardView sections={activeMyDashboard.sections} />
                    </div>
                  </div>
                ) : (
                  <div className="relative overflow-hidden rounded-2xl border border-dashed border-white/10 bg-white/[0.02] px-6 py-10 text-center">
                    <div className="relative space-y-3 max-w-xl mx-auto">
                      <h3 className="text-lg font-semibold text-white">还没有看板</h3>
                      <p className="text-sm text-zinc-400">
                        点击上方模板卡片创建，或在 AI 对话中用自然语言生成。
                      </p>
                      <button
                        onClick={() => router.push("/chat")}
                        className="px-5 py-2 rounded-xl bg-indigo-600 text-white text-sm font-medium shadow-lg shadow-indigo-500/30 hover:bg-indigo-500 transition-all"
                      >
                        用 AI 生成看板
                      </button>
                    </div>
                  </div>
                )}
              </section>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
