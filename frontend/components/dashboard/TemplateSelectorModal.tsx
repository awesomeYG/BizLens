"use client";

import { useState } from "react";

export interface DashboardTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  icon?: string;
  isSystem?: boolean;
  tags?: string[];
  usageCount?: number;
  sections?: any[];
  layoutConfig?: string;
  colorTone?: string;
}

interface TemplateSelectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectTemplate: (template: DashboardTemplate) => void;
  templates?: DashboardTemplate[];
}

const CATEGORIES = [
  { id: "all", name: "全部", icon: "📊" },
  { id: "promotion", name: "大促监控", icon: "🚀" },
  { id: "operations", name: "日常经营", icon: "📈" },
  { id: "finance", name: "财务分析", icon: "💰" },
  { id: "channel", name: "渠道分析", icon: "📣" },
  { id: "product", name: "商品分析", icon: "📦" },
];

export default function TemplateSelectorModal({
  isOpen,
  onClose,
  onSelectTemplate,
  templates = [],
}: TemplateSelectorModalProps) {
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);

  if (!isOpen) return null;

  const filteredTemplates = selectedCategory === "all"
    ? templates
    : templates.filter(t => t.category === selectedCategory);

  const handleConfirm = () => {
    if (!selectedTemplate) return;
    const template = templates.find(t => t.id === selectedTemplate);
    if (template) {
      onSelectTemplate(template);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xl">
      <div className="w-full max-w-6xl max-h-[82vh] overflow-hidden rounded-3xl border border-white/10 bg-zinc-950/80 shadow-2xl shadow-indigo-900/40 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-white/10">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-[11px] text-indigo-100">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse-soft" />
              模板库 · 支持行业/场景分类
            </div>
            <h2 className="text-2xl font-bold text-white">选择大屏模板</h2>
            <p className="text-sm text-zinc-400">从官方模板或自定义模板中选择，支持一键克隆生成实例</p>
          </div>
          <button
            onClick={onClose}
            className="btn-ghost border border-white/5"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Category Tabs */}
        <div className="flex gap-2 px-6 py-3 border-b border-white/10 overflow-x-auto">
          {CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl whitespace-nowrap border transition-all ${
                selectedCategory === cat.id
                  ? "border-indigo-500/50 bg-indigo-500/15 text-indigo-100 shadow-md shadow-indigo-900/30"
                  : "border-white/5 bg-white/3 text-zinc-300 hover:border-white/10"
              }`}
            >
              <span>{cat.icon}</span>
              <span className="font-medium">{cat.name}</span>
            </button>
          ))}
        </div>

        {/* Template Grid */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {filteredTemplates.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-zinc-400">
              <svg className="w-14 h-14 mb-3 opacity-60" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
              </svg>
              <p>暂无模板</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredTemplates.map((template) => (
                <div
                  key={template.id}
                  onClick={() => setSelectedTemplate(template.id)}
                  className={`group relative overflow-hidden rounded-2xl border p-4 cursor-pointer transition-all backdrop-blur ${
                    selectedTemplate === template.id
                      ? "border-indigo-500 bg-indigo-500/10 shadow-lg shadow-indigo-900/40"
                      : "border-white/5 bg-white/3 hover:border-indigo-400/50 hover:bg-indigo-500/5 hover:shadow-md hover:shadow-indigo-900/30"
                  }`}
                >
                  {/* 选中标记 */}
                  {selectedTemplate === template.id && (
                    <div className="absolute top-3 right-3 flex items-center gap-1 rounded-full bg-emerald-500/20 px-3 py-1 text-[11px] text-emerald-100 border border-emerald-500/30">
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse-soft" />
                      已选
                    </div>
                  )}

                  {/* Icon & 标题 */}
                  <div className="flex items-start gap-3">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500/25 to-cyan-500/25 flex items-center justify-center text-2xl">
                      <span>{template.icon || "📊"}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-lg font-semibold text-white line-clamp-1">{template.name}</h3>
                      <p className="text-sm text-zinc-400 line-clamp-2">{template.description}</p>
                    </div>
                  </div>

                  {/* 预览缩略块 */}
                  <div className="mt-4 h-24 rounded-xl border border-white/5 bg-gradient-to-br from-indigo-900/40 via-slate-900/70 to-black/80 relative overflow-hidden">
                    <div className="absolute inset-0 opacity-60" style={{ backgroundImage: "radial-gradient(circle at 30% 30%, rgba(99,102,241,0.25), transparent 40%), radial-gradient(circle at 70% 60%, rgba(14,165,233,0.2), transparent 45%)" }} />
                    <div className="absolute inset-0 grid grid-cols-5 gap-1 p-3 opacity-85">
                      <div className="col-span-3 bg-indigo-500/35 rounded" />
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

                  {/* Tags & Meta */}
                  <div className="mt-4 flex flex-wrap items-center gap-2 text-[11px] text-zinc-400">
                    {template.tags && template.tags.length > 0 && template.tags.slice(0, 3).map((tag, i) => (
                      <span
                        key={i}
                        className="px-2 py-1 rounded-full bg-white/5 border border-white/10 text-indigo-100"
                      >
                        {tag}
                      </span>
                    ))}
                    <div className="ml-auto inline-flex items-center gap-2">
                      <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-white/5 border border-white/10 text-[11px] text-zinc-200">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                        {template.usageCount || 0} 次使用
                      </span>
                      {template.isSystem && (
                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-indigo-500/20 border border-indigo-400/40 text-[11px] text-indigo-100">
                          官方
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-3 px-6 py-4 border-t border-white/10 bg-zinc-950/70">
          <div className="text-xs text-zinc-500">已选分类：{CATEGORIES.find((c) => c.id === selectedCategory)?.name || "全部"}</div>
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="btn-ghost border border-white/5"
            >
              取消
            </button>
            <button
              onClick={handleConfirm}
              disabled={!selectedTemplate}
              className={`px-6 py-2 rounded-xl font-medium transition-all border ${
                selectedTemplate
                  ? "bg-indigo-600 text-white border-indigo-500 shadow-lg shadow-indigo-900/40 hover:bg-indigo-500"
                  : "bg-white/5 text-zinc-500 border-white/10 cursor-not-allowed"
              }`}
            >
              下一步：配置数据源
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
