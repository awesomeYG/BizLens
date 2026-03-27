"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import AppHeader from "@/components/AppHeader";
import { getCurrentUser } from "@/lib/user-store";
import { useEffect, useState } from "react";

const ADMIN_NAV = [
  {
    label: "仪表盘",
    href: "/admin",
    icon: "M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6",
  },
  {
    label: "数据资产",
    href: "/admin/assets/files",
    icon: "M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4",
    children: [
      { label: "文件管理", href: "/admin/assets/files" },
      { label: "数据库", href: "/admin/assets/databases" },
      { label: "存储配置", href: "/admin/assets/storage" },
    ],
  },
  {
    label: "用户管理",
    href: "/admin/users",
    icon: "M17 20h5V4H2v16h5m10 0v-4a3 3 0 00-3-3H9a3 3 0 00-3 3v4m10 0H6",
  },
  {
    label: "系统配置",
    href: "/admin/config",
    icon: "M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z",
  },
];

function AdminSidebar() {
  const pathname = usePathname();

  const isActive = (href: string) => pathname === href || pathname.startsWith(href + "/");

  return (
    <aside className="hidden lg:block w-64 flex-shrink-0">
      <div className="glass-card rounded-2xl p-4">
        <div className="mb-4 pb-4 border-b border-zinc-800/50">
          <h2 className="text-sm font-semibold text-zinc-200">后台管理</h2>
          <p className="mt-1 text-xs text-zinc-500">运营管理、数据资产与配置</p>
        </div>
        <nav className="space-y-1">
          {ADMIN_NAV.map((item) => {
            const active = isActive(item.href);
            return (
              <div key={item.href}>
                <Link
                  href={item.href}
                  className={`flex items-center gap-3 rounded-xl px-3 py-2.5 transition-all border ${
                    active
                      ? "bg-indigo-500/10 text-indigo-300 border-indigo-500/30"
                      : "text-zinc-400 hover:text-zinc-100 hover:bg-white/5 border-transparent"
                  }`}
                >
                  <svg
                    className={`h-4 w-4 flex-shrink-0 ${active ? "text-indigo-300" : "text-zinc-500"}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={item.icon} />
                  </svg>
                  <div className="flex-1">
                    <div className="text-sm font-medium">{item.label}</div>
                    {item.children ? (
                      <div className="mt-2 space-y-1">
                        {item.children.map((child) => {
                          const childActive = isActive(child.href);
                          return (
                            <Link
                              key={child.href}
                              href={child.href}
                              className={`flex items-center gap-2 rounded-lg px-2 py-1.5 text-xs transition-all border ${
                                childActive
                                  ? "bg-indigo-500/10 text-indigo-200 border-indigo-500/30"
                                  : "text-zinc-500 hover:text-zinc-100 hover:bg-white/5 border-transparent"
                              }`}
                            >
                              <span className="inline-block h-1.5 w-1.5 rounded-full bg-indigo-400" />
                              {child.label}
                            </Link>
                          );
                        })}
                      </div>
                    ) : null}
                  </div>
                </Link>
              </div>
            );
          })}
        </nav>
      </div>
    </aside>
  );
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [authorized, setAuthorized] = useState<boolean | null>(null);

  useEffect(() => {
    // 简单检查本地用户角色，前端保护；后端仍会做严格校验
    const user = getCurrentUser();
    if (!user) {
      setAuthorized(false);
      return;
    }
    const userRole = user.role;
    if (userRole === "admin" || userRole === "owner") {
      setAuthorized(true);
    } else {
      setAuthorized(false);
    }
  }, [pathname]);

  if (authorized === false) {
    return (
      <div className="min-h-screen flex items-center justify-center text-zinc-200 bg-zinc-950">
        <div className="text-center space-y-3">
          <h1 className="text-2xl font-semibold">无访问权限</h1>
          <p className="text-sm text-zinc-500">请使用管理员账号登录，或联系管理员开通权限。</p>
          <Link href="/chat" className="text-indigo-400 hover:text-indigo-300 text-sm">
            返回首页
          </Link>
        </div>
      </div>
    );
  }

  if (authorized === null) {
    return <div className="min-h-screen bg-zinc-950" />;
  }

  return (
    <div className="min-h-screen bg-zinc-950 bg-grid">
      <AppHeader breadcrumb={["BizLens", "后台管理"]} showNav={false} />
      <div className="mx-auto flex w-full max-w-7xl gap-6 px-6 py-6">
        <AdminSidebar />
        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </div>
  );
}
