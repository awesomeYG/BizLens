"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

interface IMSectionNavProps {
  current: "settings" | "notifications" | "rules" | "alerts";
}

const ITEMS: Array<{ key: IMSectionNavProps["current"]; href: string; label: string }> = [
  { key: "settings", href: "/im/settings", label: "IM 配置" },
  { key: "alerts", href: "/alerts", label: "数据告警" },
  { key: "notifications", href: "/im/notifications", label: "通知中心" },
  { key: "rules", href: "/im/rules", label: "通知规则" },
];

export default function IMSectionNav({ current }: Readonly<IMSectionNavProps>) {
  const pathname = usePathname();

  return (
    <nav className="mb-6">
      <div className="inline-flex flex-wrap gap-1 rounded-xl border border-zinc-800/50 bg-zinc-900/70 p-1">
        {ITEMS.map((item) => {
          const active =
            item.key === current ||
            (item.key === "alerts" && (pathname === "/alerts" || pathname.startsWith("/alerts/")));
          return (
            <Link
              key={item.key}
              href={item.href}
              className={`rounded-lg px-4 py-2 text-sm transition-all ${
                active
                  ? "border border-indigo-500/30 bg-indigo-500/15 text-indigo-300"
                  : "text-zinc-400 hover:bg-zinc-800/70 hover:text-zinc-200"
              }`}
            >
              {item.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
