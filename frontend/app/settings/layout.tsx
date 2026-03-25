"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import AppHeader from "@/components/AppHeader";

const SETTINGS_NAV = [
  {
    href: "/settings/profile",
    label: "企业档案",
    icon: "M3.75 19.5h16.5M4.5 16.5a3 3 0 013-3h9a3 3 0 013 3V18H4.5v-1.5ZM12 11.25a3.75 3.75 0 100-7.5 3.75 3.75 0 000 7.5Z",
    description: "维护公司信息与分析偏好",
  },
  {
    href: "/settings/data-sources",
    label: "数据源",
    icon: "M20.25 6.375c0 2.278-3.694 4.125-8.25 4.125S3.75 8.653 3.75 6.375m16.5 0c0-2.278-3.694-4.125-8.25-4.125S3.75 4.097 3.75 6.375m16.5 0v11.25c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125V6.375",
    description: "连接与管理分析用数据源",
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

  return (
    <div className="min-h-screen bg-zinc-950 bg-grid">
      {/* 顶部导航 - 统一 AppHeader */}
      <AppHeader
        breadcrumb={["BizLens", "设置中心"]}
        backHref="/"
      />

      <div className="mx-auto flex w-full max-w-7xl gap-6 px-6 py-6">
        {/* 侧边导航 */}
        <aside className="hidden w-64 self-start lg:block">
          <div className="glass-card rounded-xl p-4">
            <div className="mb-4 pb-4 border-b border-zinc-800/60">
              <h2 className="text-sm font-semibold text-zinc-200">系统设置</h2>
              <p className="mt-1 text-xs text-zinc-500">管理企业档案、AI 与数据能力</p>
            </div>
            <nav className="space-y-1">
              {SETTINGS_NAV.map((item) => {
                const isActive =
                  pathname === item.href ||
                  (item.href === "/settings/data-sources" &&
                    pathname.startsWith("/settings/data-sources"));
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`flex items-center gap-3 rounded-lg px-3 py-2.5 transition-all ${
                      isActive
                        ? "bg-indigo-500/10 text-indigo-400 border border-indigo-500/20"
                        : "text-zinc-400 hover:text-zinc-200 hover:bg-white/5 border border-transparent"
                    }`}
                  >
                    <svg
                      className={`h-4 w-4 flex-shrink-0 ${isActive ? "text-indigo-400" : "text-zinc-500"}`}
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
                      <div className="text-sm font-medium">{item.label}</div>
                      <div className={`text-xs ${isActive ? "text-indigo-400/70" : "text-zinc-600"}`}>
                        {item.description}
                      </div>
                    </div>
                  </Link>
                );
              })}
            </nav>
          </div>
        </aside>

        {/* 主内容 */}
        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </div>
  );
}
