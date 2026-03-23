"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import TemplateSelectorModal, { DashboardTemplate } from "@/components/dashboard/TemplateSelectorModal";
import { getCurrentUser } from "@/lib/user-store";

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
    <div className="min-h-screen flex flex-col bg-slate-900">
      {/* Header */}
      <nav className="flex items-center justify-between px-6 py-3 border-b border-slate-700/50 bg-slate-800/80">
        <a href="/" className="text-cyan-400 hover:text-cyan-300 font-medium">
          ← AI BI
        </a>
        <div className="flex gap-4">
          <a
            href="/chat"
            className="text-slate-400 hover:text-slate-300"
          >
            AI 对话
          </a>
          <a
            href="/dashboards"
            className="text-cyan-400 font-medium border-b-2 border-cyan-400 pb-1"
          >
            数据大屏
          </a>
        </div>
      </nav>

      {/* Main Content */}
      <main className="flex-1 p-6">
        <div className="max-w-7xl mx-auto">
          {/* Page Header */}
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-3xl font-bold text-white mb-2">数据大屏</h1>
              <p className="text-slate-400">
                选择模板或自定义创建你的数据大屏
              </p>
            </div>
            <button
              onClick={() => setShowTemplateModal(true)}
              disabled={loading}
              className="px-6 py-3 bg-cyan-500 hover:bg-cyan-600 text-white rounded-lg font-medium transition-all shadow-lg shadow-cyan-500/25 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? "创建中..." : "+ 新建大屏"}
            </button>
          </div>

          {/* Template Quick Select */}
          <div className="mb-8">
            <h2 className="text-xl font-semibold text-white mb-4">快速开始</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {templates.slice(0, 3).map(template => (
                <div
                  key={template.id}
                  onClick={() => handleSelectTemplate(template)}
                  className="bg-slate-800/50 rounded-xl border border-slate-600/50 p-4 cursor-pointer transition-all hover:border-cyan-500/50 hover:bg-slate-700/50"
                >
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 bg-gradient-to-br from-cyan-500/20 to-blue-500/20 rounded-lg flex items-center justify-center flex-shrink-0">
                      <span className="text-xl">{template.icon || "📊"}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-lg font-semibold text-white mb-1">
                        {template.name}
                      </h3>
                      <p className="text-slate-400 text-sm line-clamp-2">
                        {template.description}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Existing Dashboards */}
          <div>
            <h2 className="text-xl font-semibold text-white mb-4">我的大屏</h2>
            <div className="bg-slate-800/30 rounded-xl border border-slate-600/50 p-8 text-center">
              <p className="text-slate-400">暂无大屏，点击上方按钮创建</p>
            </div>
          </div>
        </div>
      </main>

      {/* Template Selector Modal */}
      <TemplateSelectorModal
        isOpen={showTemplateModal}
        onClose={() => setShowTemplateModal(false)}
        onSelectTemplate={handleSelectTemplate}
        templates={templates}
      />
    </div>
  );
}
