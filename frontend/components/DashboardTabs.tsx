"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import DashboardView from "./DashboardView";
import DashboardThumbnail from "./DashboardThumbnail";
import { listDashboards, createDashboardInstance, deleteDashboard, type DashboardInstanceView } from "@/lib/dashboard-store";
import { DEFAULT_DASHBOARD_DATA } from "@/lib/data-mapper";
import { DASHBOARD_TEMPLATES } from "@/lib/templates";

export default function DashboardTabs() {
  const searchParams = useSearchParams();
  const idFromUrl = searchParams.get("id");
  const [dashboards, setDashboards] = useState<DashboardInstanceView[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [showNewModal, setShowNewModal] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const bootstrap = async () => {
      setLoading(true);
      const data = await listDashboards().catch(() => []);
      setDashboards(data);
      if (idFromUrl && data.some((d) => d.id === idFromUrl)) {
        setActiveId(idFromUrl);
      } else {
        setActiveId(data[0]?.id ?? null);
      }
      setLoading(false);
    };
    bootstrap();
  }, [idFromUrl]);

  const active = dashboards.find((d) => d.id === activeId);

  const addDashboard = async (templateId: string) => {
    const template = DASHBOARD_TEMPLATES.find((t) => t.id === templateId);
    if (!template) return;
    setLoading(true);
    const saved = await createDashboardInstance({
      title: template.name,
      templateId: template.id,
      sections: template.sections || [],
    }).catch(() => null);
    const data = await listDashboards().catch(() => []);
    setDashboards(data);
    setActiveId(saved?.id || data[0]?.id || null);
    setShowNewModal(false);
    setLoading(false);
  };

  const removeDashboard = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setLoading(true);
    await deleteDashboard(id).catch(() => undefined);
    const next = await listDashboards().catch(() => []);
    setDashboards(next);
    setActiveId(next[0]?.id ?? null);
    setLoading(false);
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex flex-col border-b border-slate-700/50 bg-slate-800/80">
        <div className="flex items-center gap-1 px-4 py-2 overflow-x-auto">
          {dashboards.map((d) => (
            <div
              key={d.id}
              onClick={() => setActiveId(d.id)}
              className={`group flex items-center gap-2 px-4 py-2 rounded-t-lg cursor-pointer min-w-[140px] max-w-[200px] ${
                activeId === d.id
                  ? "bg-slate-700 text-cyan-400"
                  : "bg-slate-800/50 text-slate-400 hover:bg-slate-700/50"
              }`}
            >
              <span className="truncate text-sm font-medium">{d.title}</span>
              <button
                onClick={(e) => removeDashboard(d.id, e)}
                className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-slate-600 text-slate-400"
              >
                ×
              </button>
            </div>
          ))}
          <button
            onClick={() => setShowNewModal(true)}
            className="px-4 py-2 rounded-t-lg bg-slate-800/50 text-slate-500 hover:bg-slate-700/50 hover:text-cyan-400 text-lg"
          >
            +
          </button>
        </div>
        {dashboards.length > 0 && (
          <div className="flex gap-2 px-4 pb-2 overflow-x-auto">
            {dashboards.map((d) => (
              <DashboardThumbnail
                key={d.id}
                config={{
                  id: d.id,
                  title: d.title,
                  templateId: (d.templateId as any) || "custom",
                  createdAt: d.createdAt,
                  updatedAt: d.updatedAt,
                  data: DEFAULT_DASHBOARD_DATA,
                }}
                active={activeId === d.id}
                onClick={() => setActiveId(d.id)}
              />
            ))}
          </div>
        )}
      </div>

      <div className="flex-1 overflow-auto bg-slate-900 relative">
        {active && (
          <div className="absolute top-4 right-4 z-10 flex gap-2">
            <a
              href={`data:application/json;charset=utf-8,${encodeURIComponent(
                JSON.stringify(active, null, 2)
              )}`}
              download={`${active.title}-${active.id.slice(0, 8)}.json`}
              className="px-3 py-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-300 text-sm"
            >
              导出 JSON
            </a>
          </div>
        )}
        {active ? (
          <DashboardView sections={active.sections} />
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-slate-500">
            <p className="text-lg mb-4">暂无大屏</p>
            <button
              onClick={() => setShowNewModal(true)}
              className="px-6 py-3 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-medium"
            >
              创建第一个大屏
            </button>
          </div>
        )}
      </div>

      {showNewModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-slate-800 rounded-2xl p-6 w-full max-w-lg border border-slate-600">
            <h3 className="text-xl font-semibold text-slate-200 mb-4">
              选择大屏模板
            </h3>
            <div className="grid grid-cols-2 gap-4">
              {DASHBOARD_TEMPLATES.map((t) => (
                <button
                  key={t.id}
                  onClick={() => addDashboard(t.id)}
                  className="p-4 rounded-xl bg-slate-700/50 hover:bg-slate-600/50 border border-slate-600 text-left transition-colors"
                >
                  <div className="font-medium text-slate-200">{t.name}</div>
                  <div className="text-sm text-slate-500 mt-1">
                    {t.description}
                  </div>
                </button>
              ))}
            </div>
            <button
              onClick={() => setShowNewModal(false)}
              className="mt-4 w-full py-2 rounded-lg bg-slate-600 hover:bg-slate-500 text-slate-300"
            >
              取消
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
