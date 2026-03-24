"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { getCurrentUser } from "@/lib/user-store";
import AppHeader from "@/components/AppHeader";
import DashboardView from "@/components/DashboardView";
import { DASHBOARD_TEMPLATES, getTemplatesByCategory } from "@/lib/dashboard-templates";
import type { DashboardTemplate } from "@/lib/types";

const CATEGORIES = [
  { id: "all", name: "全部", icon: "📊" },
  { id: "operations", name: "运营分析", icon: "📈" },
  { id: "finance", name: "财务分析", icon: "💰" },
  { id: "channel", name: "渠道/客户", icon: "📣" },
  { id: "product", name: "供应链", icon: "📦" },
  { id: "custom", name: "自定义", icon: "🎨" },
];

export default function DashboardsPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [previewTemplate, setPreviewTemplate] = useState<DashboardTemplate | null>(null);

  useEffect(() => {
    const user = getCurrentUser();
    if (!user?.isOnboarded) {
      router.replace("/onboarding");
      return;
    }
    setReady(true);
  }, [router]);

  const filteredTemplates = getTemplatesByCategory(selectedCategory).filter(
    (t) => t.id !== "custom" || selectedCategory === "custom" || selectedCategory === "all"
  );

  const handleUseTemplate = (template: DashboardTemplate) => {
    // TODO: 后续接入后端创建实例，暂时进入预览
    setPreviewTemplate(template);
  };

  if (!ready) {
    return <div className="min-h-screen bg-[#0b0b10]" />;
  }

  // =============== 模板预览全屏页面 ===============
  if (previewTemplate) {
    return (
      <div className="min-h-screen flex flex-col bg-gradient-to-b from-[#0b0b10] via-[#0f1020] to-[#0b0b10] text-white">
        <AppHeader
          title={previewTemplate.name}
          breadcrumb={["BizLens", "数据大屏", previewTemplate.name]}
          actions={
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPreviewTemplate(null)}
                className="px-3 py-1.5 rounded-lg border border-white/10 bg-white/5 text-zinc-300 text-xs font-medium hover:bg-white/10 transition-all"
              >
                返回模板库
              </button>
              <button className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium transition-all shadow-lg shadow-indigo-500/30">
                保存为我的大屏
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

  // =============== 模板库主页面 ===============
  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-[#0b0b10] via-[#0f1020] to-[#0b0b10] text-white">
      {/* 顶部导航 */}
      <AppHeader
        title="数据大屏"
        breadcrumb={["BizLens", "数据大屏"]}
      />

      <main className="flex-1 px-6 pb-12">
        <div className="max-w-7xl mx-auto space-y-8">
          {/* 英雄区 */}
          <section className="relative overflow-hidden rounded-2xl border border-white/5 bg-gradient-to-br from-indigo-900/40 via-slate-900/60 to-black/80 px-8 py-10 shadow-2xl shadow-indigo-900/30">
            <div className="absolute inset-0 pointer-events-none" aria-hidden>
              <div className="absolute -left-10 -top-10 h-56 w-56 rounded-full bg-indigo-600/20 blur-3xl" />
              <div className="absolute right-0 bottom-0 h-64 w-64 rounded-full bg-cyan-500/15 blur-3xl" />
            </div>
            <div className="relative flex flex-col lg:flex-row lg:items-center lg:justify-between gap-8">
              <div className="space-y-4 max-w-2xl">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-xs text-indigo-100">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  8 大行业模板 -- 配置驱动 -- ECharts 深色主题
                </div>
                <div>
                  <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-white">数据大屏中心</h1>
                  <p className="mt-3 text-zinc-300 text-base md:text-lg">
                    选择预置行业模板一键预览，或通过 AI 对话自动生成专属大屏。支持 KPI、趋势、饼图、漏斗、排行、仪表盘等多种区块。
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3 w-full lg:w-[420px]">
                {[
                  { label: "行业模板", value: DASHBOARD_TEMPLATES.length - 1, desc: "覆盖主流场景", color: "from-indigo-500/60 to-violet-500/40" },
                  { label: "图表类型", value: "10+", desc: "折线/柱状/饼图/漏斗...", color: "from-cyan-500/60 to-blue-500/30" },
                  { label: "区块组件", value: "配置驱动", desc: "JSON 定义零代码", color: "from-emerald-500/50 to-teal-500/30" },
                ].map((card) => (
                  <div key={card.label} className="relative overflow-hidden rounded-2xl border border-white/10 bg-white/5 px-4 py-5 shadow-lg">
                    <div className={`absolute inset-0 bg-gradient-to-br ${card.color} opacity-30`} />
                    <div className="relative space-y-1">
                      <div className="text-xs text-zinc-200/80">{card.label}</div>
                      <div className="text-xl font-semibold text-white">{card.value}</div>
                      <div className="text-[11px] text-zinc-400">{card.desc}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* 分类标签 */}
          <div className="flex gap-2 overflow-x-auto pb-1">
            {CATEGORIES.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl whitespace-nowrap border transition-all ${
                  selectedCategory === cat.id
                    ? "border-indigo-500/50 bg-indigo-500/15 text-indigo-100 shadow-md shadow-indigo-900/30"
                    : "border-white/5 bg-white/[0.03] text-zinc-300 hover:border-white/10 hover:bg-white/5"
                }`}
              >
                <span>{cat.icon}</span>
                <span className="font-medium text-sm">{cat.name}</span>
              </button>
            ))}
          </div>

          {/* 模板网格 */}
          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-white">模板库</h2>
                <p className="text-sm text-zinc-400">点击模板卡片预览完整大屏效果</p>
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
                  {/* 缩略预览 */}
                  <div className="h-40 overflow-hidden bg-gradient-to-br from-slate-900/80 via-[#0f1020] to-black relative">
                    {template.sections && template.sections.length > 0 ? (
                      <div className="pointer-events-none">
                        <DashboardView template={template} compact />
                      </div>
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center text-zinc-600">
                        <span className="text-4xl">{template.icon || "📊"}</span>
                      </div>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                  </div>

                  {/* 信息 */}
                  <div className="p-4 space-y-3">
                    <div className="flex items-start gap-3">
                      <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500/25 to-cyan-500/25 flex items-center justify-center text-lg shrink-0">
                        {template.icon || "📊"}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="text-sm font-semibold text-white line-clamp-1">{template.name}</h3>
                        <p className="text-xs text-zinc-400 line-clamp-2 mt-0.5">{template.description}</p>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5">
                      {template.tags?.slice(0, 3).map((tag) => (
                        <span
                          key={tag}
                          className="px-2 py-0.5 rounded-full bg-white/5 border border-white/10 text-[10px] text-zinc-300"
                        >
                          {tag}
                        </span>
                      ))}
                      <span className="ml-auto text-[10px] text-zinc-500">
                        {template.sections?.length || 0} 个区块
                      </span>
                    </div>
                  </div>

                  {/* hover 底部微光 */}
                  <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-indigo-400/40 to-transparent opacity-0 group-hover:opacity-100 transition" />
                </div>
              ))}
            </div>
          </section>

          {/* 我的大屏 -- 占位 */}
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-white">我的大屏</h2>
                <p className="text-sm text-zinc-400">通过模板生成或 AI 对话创建的大屏会出现在这里</p>
              </div>
            </div>
            <div className="relative overflow-hidden rounded-2xl border border-dashed border-white/10 bg-white/[0.02] px-6 py-10 text-center">
              <div className="absolute inset-0 opacity-40" style={{ backgroundImage: "radial-gradient(circle at 30% 30%, rgba(99,102,241,0.15), transparent 35%), radial-gradient(circle at 70% 60%, rgba(14,165,233,0.15), transparent 40%)" }} />
              <div className="relative space-y-3 max-w-xl mx-auto">
                <div className="mx-auto w-12 h-12 rounded-full bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center text-indigo-100 text-xl">
                  📺
                </div>
                <h3 className="text-xl font-semibold text-white">还没有大屏</h3>
                <p className="text-sm text-zinc-400">
                  点击上方模板卡片预览效果，或前往 AI 对话页面用自然语言生成专属大屏。
                </p>
                <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mt-2">
                  <button
                    onClick={() => router.push("/chat")}
                    className="px-5 py-2 rounded-xl bg-indigo-600 text-white text-sm font-medium shadow-lg shadow-indigo-500/30 hover:bg-indigo-500 transition-all"
                  >
                    用 AI 生成大屏
                  </button>
                </div>
              </div>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
