"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import AppHeader from "@/components/AppHeader";

const SAMPLE_REPORTS = [
  {
    id: "1",
    title: "销售日报",
    description: "每日销售业绩追踪",
    updatedAt: "5 分钟前",
    color: "from-indigo-500 to-purple-600",
  },
  {
    id: "2",
    title: "月度营收分析",
    description: "月度营收趋势和构成",
    updatedAt: "2 小时前",
    color: "from-emerald-500 to-teal-600",
  },
  {
    id: "3",
    title: "客户增长监控",
    description: "新增客户和留存分析",
    updatedAt: "1 天前",
    color: "from-amber-500 to-orange-600",
  },
];

export default function ReportsPage() {
  const router = useRouter();
  const [reports] = useState(SAMPLE_REPORTS);

  return (
    <div className="min-h-screen bg-zinc-950">
      <AppHeader
        title="我的报表"
        backHref="/chat"
        actions={
          <button
            onClick={() => router.push("/chat")}
            className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium transition-all shadow-lg shadow-indigo-500/30"
          >
            新建报表
          </button>
        }
      />

      <main className="max-w-5xl mx-auto p-6">
        <div className="text-center mb-8">
          <h2 className="text-2xl font-semibold text-zinc-100 mb-2">
            所有报表
          </h2>
          <p className="text-zinc-500">
            查看和管理你的数据报表
          </p>
        </div>

        {reports.length === 0 ? (
          <div className="text-center py-16">
            <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center">
              <svg className="w-10 h-10 text-zinc-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3v11.25A2.25 2.25 0 0 0 6 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0 1 18 16.5h-2.25m-7.5 0h7.5m-7.5 0-1 3m8.5-3 1 3m0 0 .5 1.5m-.5-1.5h-9.5m0 0-.5 1.5m.75-9 3-3 2.148 2.148A12.061 12.061 0 0 1 16.5 7.604" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-zinc-100 mb-2">
              还没有报表
            </h3>
            <p className="text-zinc-500 mb-6">
              在对话中让 AI 帮你创建第一个报表
            </p>
            <button
              onClick={() => router.push("/chat")}
              className="px-6 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-medium transition-all shadow-lg shadow-indigo-500/30"
            >
              去创建
            </button>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {reports.map((report) => (
              <div
                key={report.id}
                className="group rounded-2xl bg-zinc-900/50 border border-zinc-800/50 hover:border-zinc-700 overflow-hidden transition-all cursor-pointer"
              >
                {/* 顶部渐变色条 */}
                <div className={`h-2 bg-gradient-to-r ${report.color}`} />
                
                <div className="p-5">
                  <h3 className="text-base font-semibold text-zinc-100 mb-1 group-hover:text-indigo-400 transition-colors">
                    {report.title}
                  </h3>
                  <p className="text-sm text-zinc-500 mb-4">
                    {report.description}
                  </p>
                  
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-zinc-600">
                      更新于 {report.updatedAt}
                    </span>
                    <button className="text-zinc-500 hover:text-zinc-300 transition-colors">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 12a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0ZM12.75 12a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0ZM18.75 12a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0Z" />
                      </svg>
                    </button>
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
