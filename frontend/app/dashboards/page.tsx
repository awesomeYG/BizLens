"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import TemplateSelectorModal, { DashboardTemplate } from "@/components/dashboard/TemplateSelectorModal";
import { getCurrentUser } from "@/lib/user-store";
import AppHeader from "@/components/AppHeader";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

export default function DashboardsPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [templates, setTemplates] = useState<DashboardTemplate[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const user = getCurrentUser();
    if (!user?.isOnboarded) {
      router.replace("/onboarding");
      return;
    }
    setReady(true);
    loadTemplates();
  }, [router]);

  const loadTemplates = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/tenants/user123/dashboards/templates?includeSystem=true`);
      const data = await res.json();
      setTemplates(data.templates || []);
    } catch (error) {
      console.error("Failed to load templates:", error);
    }
  };

  const handleSelectTemplate = (template: DashboardTemplate) => {
    console.log("Selected template:", template);
    // 下一步：配置数据源（简化版本，直接使用默认数据源）
    createDashboardFromTemplate(template);
  };

  const createDashboardFromTemplate = async (template: DashboardTemplate) => {
    setLoading(true);
    try {
      const res = await fetch(
        `${API_BASE_URL}/api/tenants/user123/dashboards/templates/${template.id}/generate`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            dataSourceId: "default",
            name: `${template.name} - ${new Date().toLocaleDateString("zh-CN")}`,
          }),
        }
      );
      
      if (res.ok) {
        const data = await res.json();
        console.log("Dashboard created:", data.instance);
        // 跳转到详情页面（后续实现）
        router.push(`/dashboards/${data.instance.id}`);
      } else {
        console.error("Failed to create dashboard");
      }
    } catch (error) {
      console.error("Error creating dashboard:", error);
    } finally {
      setLoading(false);
      setShowTemplateModal(false);
    }
  };

  if (!ready) {
    return <div className="min-h-screen bg-slate-900" />;
  }

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-[#0b0b10] via-[#0f1020] to-[#0b0b10] text-white">
      {/* 顶部导航 */}
      <AppHeader
        title="数据大屏"
        breadcrumb={["BizLens", "数据大屏"]}
        actions={
          <button
            onClick={() => setShowTemplateModal(true)}
            disabled={loading}
            className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium transition-all shadow-lg shadow-indigo-500/30 disabled:opacity-60"
          >
            {loading ? "创建中..." : "+ 新建大屏"}
          </button>
        }
      />

      {/* 主体 */}
      <main className="flex-1 px-6 pb-12">
        <div className="max-w-7xl mx-auto space-y-8">
          {/* 顶部英雄区 */}
          <section className="relative overflow-hidden rounded-2xl border border-white/5 bg-gradient-to-br from-indigo-900/40 via-slate-900/60 to-black/80 px-8 py-10 shadow-2xl shadow-indigo-900/30">
            <div className="absolute inset-0 pointer-events-none" aria-hidden>
              <div className="absolute -left-10 -top-10 h-56 w-56 rounded-full bg-indigo-600/20 blur-3xl" />
              <div className="absolute right-0 bottom-0 h-64 w-64 rounded-full bg-cyan-500/15 blur-3xl" />
            </div>
            <div className="relative flex flex-col lg:flex-row lg:items-center lg:justify-between gap-8">
              <div className="space-y-4 max-w-2xl">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-xs text-indigo-100">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse-soft" />
                  实时驱动 · 多场景模板 · ECharts 深色主题
                </div>
                <div>
                  <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-white">数据大屏中心</h1>
                  <p className="mt-3 text-zinc-300 text-base md:text-lg">
                    从预置模板快速生成，或导入数据一键生成专属 BI 大屏。深色质感、分层布局和可视化预览，让你的数据信息更有高级感。
                  </p>
                </div>
                <div className="flex flex-wrap gap-3 text-sm text-zinc-300">
                  <div className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-white/5 border border-white/10">
                    <span className="w-2 h-2 rounded-full bg-emerald-400" /> 智能模板克隆
                  </div>
                  <div className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-white/5 border border-white/10">
                    <span className="w-2 h-2 rounded-full bg-cyan-400" /> 多租户隔离
                  </div>
                  <div className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-white/5 border border-white/10">
                    <span className="w-2 h-2 rounded-full bg-amber-400" /> 实时刷新计划
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3 w-full lg:w-[420px]">
                {[{
                  label: "模板数量",
                  value: templates.length || 5,
                  desc: "系统模板+自定义",
                  color: "from-indigo-500/60 to-violet-500/40",
                }, {
                  label: "预估创建时间",
                  value: "1-2 分钟",
                  desc: "一键生成并预览",
                  color: "from-cyan-500/60 to-blue-500/30",
                }, {
                  label: "可视化组件",
                  value: "图表/卡片/表格",
                  desc: "ECharts 深色主题",
                  color: "from-emerald-500/50 to-teal-500/30",
                }].map((card) => (
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

          {/* 快速开始模板 */}
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-white">快速开始</h2>
                <p className="text-sm text-zinc-400">精选高频模板，点击即可生成实例</p>
              </div>
              <button
                onClick={() => setShowTemplateModal(true)}
                className="btn-secondary border border-white/10"
              >
                查看全部模板
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {templates.slice(0, 3).map((template) => (
                <div
                  key={template.id}
                  onClick={() => handleSelectTemplate(template)}
                  className="group relative overflow-hidden rounded-2xl border border-white/10 bg-white/5 backdrop-blur hover:border-indigo-400/60 hover:shadow-xl hover:shadow-indigo-900/30 transition-all cursor-pointer"
                >
                  <div className="absolute inset-0 bg-gradient-to-br from-white/3 via-transparent to-white/5 opacity-70" aria-hidden />
                  <div className="p-5 space-y-4">
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500/30 to-cyan-500/30 flex items-center justify-center text-xl">
                        <span>{template.icon || "📊"}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="text-base font-semibold text-white line-clamp-1">{template.name}</h3>
                        <p className="text-sm text-zinc-400 line-clamp-2">{template.description}</p>
                      </div>
                    </div>
                    <div className="h-24 rounded-xl bg-gradient-to-br from-indigo-900/40 via-slate-900/70 to-black/80 border border-white/5 relative overflow-hidden">
                      <div className="absolute inset-0 opacity-60" style={{ backgroundImage: "radial-gradient(circle at 30% 30%, rgba(99,102,241,0.3), transparent 40%), radial-gradient(circle at 70% 60%, rgba(14,165,233,0.25), transparent 45%)" }} />
                      <div className="absolute inset-0 grid grid-cols-5 gap-1 p-3 opacity-80">
                        <div className="col-span-3 bg-indigo-500/30 rounded" />
                        <div className="col-span-2 bg-cyan-500/20 rounded" />
                        <div className="col-span-5 grid grid-cols-5 gap-1 mt-1">
                          {[...Array(5)].map((_, i) => (
                            <div key={i} className="h-2 rounded bg-white/10" />
                          ))}
                        </div>
                        <div className="col-span-2 h-12 rounded bg-emerald-500/20" />
                        <div className="col-span-3 h-12 rounded bg-indigo-500/25" />
                      </div>
                    </div>
                    <div className="flex items-center justify-between text-xs text-zinc-400">
                      <span className="inline-flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                        {template.usageCount ?? 0} 次使用
                      </span>
                      {template.category && (
                        <span className="px-2 py-1 rounded-full bg-white/5 border border-white/10 text-[11px] text-indigo-100">
                          {template.category}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-white/30 to-transparent opacity-0 group-hover:opacity-100 transition" />
                </div>
              ))}
            </div>
          </section>

          {/* 我的大屏 */}
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-white">我的大屏</h2>
                <p className="text-sm text-zinc-400">生成后会出现在这里，可继续编辑和发布</p>
              </div>
              <div className="flex gap-3">
                <button className="btn-ghost border border-white/5">导入配置</button>
                <button
                  onClick={() => setShowTemplateModal(true)}
                  className="btn-primary"
                >
                  新建大屏
                </button>
              </div>
            </div>
            <div className="relative overflow-hidden rounded-2xl border border-dashed border-white/10 bg-white/3 px-6 py-10 text-center">
              <div className="absolute inset-0 opacity-40" style={{ backgroundImage: "radial-gradient(circle at 30% 30%, rgba(99,102,241,0.15), transparent 35%), radial-gradient(circle at 70% 60%, rgba(14,165,233,0.15), transparent 40%)" }} />
              <div className="relative space-y-3 max-w-xl mx-auto">
                <div className="mx-auto w-12 h-12 rounded-full bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center text-indigo-100">📺</div>
                <h3 className="text-xl font-semibold text-white">还没有大屏</h3>
                <p className="text-sm text-zinc-400">选择一个模板，几秒钟内生成可视化大屏。支持 KPI 卡片、趋势、渠道分布、区域对比等常用组件。</p>
                <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mt-2">
                  <button
                    onClick={() => setShowTemplateModal(true)}
                    className="btn-primary w-full sm:w-auto"
                  >
                    立即创建
                  </button>
                  <button className="btn-secondary w-full sm:w-auto border border-white/10">查看全部模板</button>
                </div>
              </div>
            </div>
          </section>
        </div>
      </main>

      {/* 模板选择弹窗 */}
      <TemplateSelectorModal
        isOpen={showTemplateModal}
        onClose={() => setShowTemplateModal(false)}
        onSelectTemplate={handleSelectTemplate}
        templates={templates}
      />
    </div>
  );
}
