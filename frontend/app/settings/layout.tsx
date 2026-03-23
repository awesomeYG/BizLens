"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const SETTINGS_NAV = [
  {
    href: "/settings/files",
    label: "文件管理",
    icon: "M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12",
    description: "管理上传的数据文件",
  },
  {
    href: "/settings/ai",
    label: "AI 模型配置",
    icon: "M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z",
    description: "配置 AI 模型服务商",
  },
];

export default function SettingsLayout({
  children,
}: {
  readonly children: React.ReactNode;
}) {
  const pathname = usePathname();
  const currentNav = SETTINGS_NAV.find((item) => item.href === pathname);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50/40">
      <header className="sticky top-0 z-20 border-b border-white/70 bg-white/80 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-sm">
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6l4 2m6-2a10 10 0 11-20 0 10 10 0 0120 0z" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-900">设置中心</p>
              <p className="text-xs text-slate-500">{currentNav?.description ?? "管理系统配置"}</p>
            </div>
          </div>
          <Link
            href="/chat"
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600 transition hover:border-slate-300 hover:text-slate-900"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            返回分析页
          </Link>
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-7xl gap-6 px-4 py-6 sm:px-6 lg:px-8">
        {/* 侧边导航 */}
        <aside className="hidden w-72 self-start rounded-2xl border border-slate-200/80 bg-white/85 p-5 shadow-sm lg:block">
          <div className="mb-4 border-b border-slate-100 pb-4">
            <h2 className="text-lg font-semibold text-slate-900">系统设置</h2>
            <p className="mt-1 text-xs text-slate-500">管理 AI 与数据文件能力</p>
          </div>
          <nav className="space-y-2">
              {SETTINGS_NAV.map((item) => {
                const isActive = pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`flex items-center gap-3 rounded-xl px-4 py-3 transition-all ${
                      isActive
                        ? "border border-blue-200 bg-blue-50 text-blue-700 shadow-sm"
                        : "border border-transparent text-slate-700 hover:bg-slate-50"
                    }`}
                  >
                    <svg
                      className={`h-5 w-5 flex-shrink-0 ${isActive ? "text-blue-600" : "text-slate-400"}`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d={item.icon}
                      />
                    </svg>
                    <div>
                      <div className="font-medium text-sm">{item.label}</div>
                      <div className={`text-xs ${isActive ? "text-blue-600" : "text-slate-500"}`}>
                        {item.description}
                      </div>
                    </div>
                  </Link>
                );
              })}
            </nav>
        </aside>

        {/* 主内容 */}
        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </div>
  );
}
