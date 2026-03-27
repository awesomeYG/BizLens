"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";

const ADMIN_NAV = [
  { label: "仪表盘", href: "/admin" },
  { label: "数据资产", href: "/admin/assets/files" },
  { label: "用户管理", href: "/admin/users" },
  { label: "系统配置", href: "/admin/config" },
];

export default function AdminHeaderNav() {
  const pathname = usePathname();
  const isActive = (href: string) => pathname === href || pathname.startsWith(href + "/");

  return (
    <div className="flex items-center gap-2">
      {ADMIN_NAV.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
            isActive(item.href)
              ? "bg-indigo-500/15 text-indigo-200 border border-indigo-500/20"
              : "text-zinc-400 hover:text-zinc-100 hover:bg-white/5 border border-transparent"
          }`}
        >
          {item.label}
        </Link>
      ))}
    </div>
  );
}
