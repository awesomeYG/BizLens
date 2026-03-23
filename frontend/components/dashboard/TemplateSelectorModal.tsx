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
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-slate-800 rounded-2xl border border-slate-600/50 w-full max-w-5xl max-h-[80vh] flex flex-col shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-600/50">
          <div>
            <h2 className="text-2xl font-bold text-white">选择大屏模板</h2>
            <p className="text-slate-400 text-sm mt-1">
              从预置模板中选择，快速生成你的数据大屏
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white transition-colors p-2 hover:bg-slate-700 rounded-lg"
          >
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Category Tabs */}
        <div className="flex gap-2 p-4 border-b border-slate-600/50 overflow-x-auto">
          {CATEGORIES.map(cat => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg whitespace-nowrap transition-all ${
                selectedCategory === cat.id
                  ? "bg-cyan-500/20 text-cyan-400 border border-cyan-500/50"
                  : "bg-slate-700/50 text-slate-400 border border-transparent hover:bg-slate-700"
              }`}
            >
              <span>{cat.icon}</span>
              <span className="font-medium">{cat.name}</span>
            </button>
          ))}
        </div>

        {/* Template Grid */}
        <div className="flex-1 overflow-y-auto p-6">
          {filteredTemplates.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-slate-400">
              <svg className="w-16 h-16 mb-4 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
              </svg>
              <p>暂无模板</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredTemplates.map(template => (
                <div
                  key={template.id}
                  onClick={() => setSelectedTemplate(template.id)}
                  className={`relative bg-slate-700/30 rounded-xl border-2 p-4 cursor-pointer transition-all hover:border-cyan-500/50 hover:bg-slate-700/50 ${
                    selectedTemplate === template.id
                      ? "border-cyan-500 bg-slate-700/50"
                      : "border-slate-600/50"
                  }`}
                >
                  {/* Selected indicator */}
                  {selectedTemplate === template.id && (
                    <div className="absolute top-2 right-2 w-6 h-6 bg-cyan-500 rounded-full flex items-center justify-center">
                      <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                  )}

                  {/* Icon */}
                  <div className="w-12 h-12 bg-gradient-to-br from-cyan-500/20 to-blue-500/20 rounded-lg flex items-center justify-center mb-3">
                    <span className="text-2xl">{template.icon || "📊"}</span>
                  </div>

                  {/* Title */}
                  <h3 className="text-lg font-semibold text-white mb-1">
                    {template.name}
                  </h3>

                  {/* Description */}
                  <p className="text-slate-400 text-sm mb-3 line-clamp-2">
                    {template.description}
                  </p>

                  {/* Tags */}
                  {template.tags && template.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-3">
                      {template.tags.map((tag, i) => (
                        <span
                          key={i}
                          className="px-2 py-0.5 bg-slate-600/50 text-slate-300 text-xs rounded"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Meta */}
                  <div className="flex items-center justify-between text-xs text-slate-500">
                    <span>{template.usageCount || 0} 次使用</span>
                    {template.isSystem && (
                      <span className="px-2 py-0.5 bg-cyan-500/20 text-cyan-400 rounded">
                        官方
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-4 border-t border-slate-600/50 bg-slate-800/50">
          <button
            onClick={onClose}
            className="px-6 py-2 text-slate-300 hover:text-white transition-colors"
          >
            取消
          </button>
          <button
            onClick={handleConfirm}
            disabled={!selectedTemplate}
            className={`px-6 py-2 rounded-lg font-medium transition-all ${
              selectedTemplate
                ? "bg-cyan-500 hover:bg-cyan-600 text-white shadow-lg shadow-cyan-500/25"
                : "bg-slate-600 text-slate-400 cursor-not-allowed"
            }`}
          >
            下一步：配置数据源
          </button>
        </div>
      </div>
    </div>
  );
}
