"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { getCurrentUser } from "@/lib/user-store";
import DatabaseConnectionTab from "./components/DatabaseConnectionTab";
import FileUploadTab from "./components/FileUploadTab";
import MetricsTab from "./components/MetricsTab";

const TABS = [
  { key: "databases" as const, label: "数据库连接", icon: "M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" },
  { key: "files" as const, label: "上传文件", icon: "M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" },
  { key: "metrics" as const, label: "指标管理", icon: "M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" },
];

type TabKey = (typeof TABS)[number]["key"];

function DataSourcePageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialTab = (searchParams.get("tab") === "files" ? "files" : searchParams.get("tab") === "metrics" ? "metrics" : "databases") as TabKey;
  const returnTo = searchParams.get("returnTo");
  const isFromOnboarding = returnTo === "/onboarding";
  const [activeTab, setActiveTab] = useState<TabKey>(initialTab);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const user = getCurrentUser();
    if (!user) {
      router.replace("/auth/login");
      return;
    }
    setReady(true);
  }, [router]);

  if (!ready) {
    return <div className="min-h-[60vh] rounded-3xl border border-zinc-900 bg-zinc-950/40" />;
  }

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-zinc-800 bg-zinc-900/70 p-6">
        <div className="mb-8">
          <div className="inline-flex items-center rounded-full border border-cyan-500/30 bg-cyan-500/10 px-3 py-1 text-xs text-cyan-300">
            数据源管理
          </div>
          <h1 className="mt-4 text-3xl font-semibold tracking-tight text-zinc-100">管理你的数据来源</h1>
          <p className="mt-2 max-w-2xl text-sm text-zinc-400">
            在这里统一管理数据库连接和上传文件，所有数据来源都可供 AI 分析使用。
          </p>
          {isFromOnboarding ? (
            <div className="mt-4 flex flex-wrap items-center gap-3 rounded-2xl border border-cyan-500/20 bg-cyan-500/5 px-4 py-3 text-sm text-cyan-100">
              <span>保存好数据源后，可以直接回到初始化页继续完成基础信息。</span>
              <button
                type="button"
                onClick={() => router.push("/onboarding")}
                className="rounded-xl border border-cyan-500/40 px-3 py-1.5 font-medium text-cyan-200 transition hover:border-cyan-400 hover:bg-cyan-500/10"
              >
                返回初始化
              </button>
            </div>
          ) : null}
        </div>

        <div className="mb-8 flex w-fit items-center gap-1 rounded-xl border border-zinc-800 bg-zinc-900/50 p-1">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-medium transition-all ${
                activeTab === tab.key
                  ? "border border-cyan-500/30 bg-cyan-500/15 text-cyan-300 shadow-sm"
                  : "border border-transparent text-zinc-400 hover:bg-white/5 hover:text-zinc-200"
              }`}
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={tab.icon} />
              </svg>
              {tab.label}
            </button>
          ))}
        </div>

        <div className={activeTab !== "databases" ? "hidden" : ""}>
          <DatabaseConnectionTab />
        </div>
        <div className={activeTab !== "files" ? "hidden" : ""}>
          <FileUploadTab />
        </div>
        <div className={activeTab !== "metrics" ? "hidden" : ""}>
          <MetricsTab />
        </div>
      </section>
    </div>
  );
}

export default function SettingsDataSourcesPage() {
  return (
    <Suspense fallback={<div className="min-h-[60vh] rounded-3xl border border-zinc-900 bg-zinc-950/40" />}>
      <DataSourcePageContent />
    </Suspense>
  );
}
