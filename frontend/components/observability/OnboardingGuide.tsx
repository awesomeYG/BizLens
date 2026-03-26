"use client";

import Link from "next/link";

interface OnboardingGuideProps {
  hasDataSource: boolean;
  hasMetrics: boolean;
}

export default function OnboardingGuide({ hasDataSource, hasMetrics }: OnboardingGuideProps) {
  const steps = [
    {
      label: "连接数据源",
      description: "连接你的数据库（PostgreSQL / MySQL），让 BizLens 可以查询业务数据",
      done: hasDataSource,
      href: "/data-sources",
    },
    {
      label: "配置核心指标",
      description: "发现并确认业务指标（如 GMV、订单量、转化率），AI 将据此建立监控基线",
      done: hasMetrics,
      href: "/data-sources",
    },
    {
      label: "开始监控",
      description: "BizLens 将每小时自动检测指标异常，每天推送业务健康摘要",
      done: hasDataSource && hasMetrics,
      href: "#",
    },
  ];

  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="max-w-lg w-full text-center">
        {/* 图标 */}
        <div className="w-16 h-16 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-indigo-500/20 to-cyan-500/20 border border-white/[0.06] flex items-center justify-center">
          <svg className="w-8 h-8 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3v11.25A2.25 2.25 0 006 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0118 16.5h-2.25m-7.5 0h7.5m-7.5 0l-1 3m8.5-3l1 3m0 0l.5 1.5m-.5-1.5h-9.5m0 0l-.5 1.5m.75-9l3-1.5L12 12m0 0l3-1.5M12 12l-3-1.5m0 3.75l3 1.5" />
          </svg>
        </div>

        <h2 className="text-xl font-semibold text-white/90 mb-2">开启业务健康监控</h2>
        <p className="text-sm text-white/40 mb-8">
          BizLens 观测中心会持续监控你的核心业务指标，出现异常时主动通知你，并帮你分析原因。
        </p>

        {/* 步骤 */}
        <div className="space-y-3 text-left">
          {steps.map((step, i) => (
            <div
              key={i}
              className={`rounded-xl border p-4 transition-all ${
                step.done
                  ? "border-emerald-500/20 bg-emerald-500/5"
                  : "border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.04]"
              }`}
            >
              <div className="flex items-center gap-3">
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium ${
                  step.done ? "bg-emerald-500/20 text-emerald-400" : "bg-white/[0.06] text-white/40"
                }`}>
                  {step.done ? "ok" : i + 1}
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <h3 className={`text-sm font-medium ${step.done ? "text-emerald-400" : "text-white/70"}`}>
                      {step.label}
                    </h3>
                    {!step.done && step.href !== "#" && (
                      <Link
                        href={step.href}
                        className="text-xs px-2.5 py-1 rounded-lg bg-indigo-500/10 text-indigo-400 hover:bg-indigo-500/20 transition-colors"
                      >
                        去配置
                      </Link>
                    )}
                  </div>
                  <p className="text-xs text-white/40 mt-0.5">{step.description}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
