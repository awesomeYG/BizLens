"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import DashboardTabs from "@/components/DashboardTabs";
import { getCurrentUser } from "@/lib/user-store";

export default function DashboardsPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const user = getCurrentUser();
    if (!user?.isOnboarded) {
      router.replace("/");
      return;
    }
    setReady(true);
  }, [router]);

  if (!ready) {
    return <div className="min-h-screen bg-base" />;
  }

  return (
    <div className="min-h-screen flex flex-col bg-base">
      <nav className="flex items-center justify-between px-5 h-12 border-b border-border-subtle bg-surface/80 backdrop-blur-md shrink-0">
        <Link href="/" className="text-sm font-semibold text-txt-primary tracking-tight hover:text-accent transition-colors">
          BizLens
        </Link>
        <div className="flex items-center gap-1">
          <Link
            href="/chat"
            className="px-3 py-1.5 rounded-lg text-xs text-txt-tertiary hover:text-txt-secondary hover:bg-white/[0.03] transition-all"
          >
            对话
          </Link>
          <Link
            href="/dashboards"
            className="px-3 py-1.5 rounded-lg text-xs font-medium text-accent bg-accent/[0.08]"
          >
            大屏
          </Link>
          <Link
            href="/settings"
            className="px-3 py-1.5 rounded-lg text-xs text-txt-tertiary hover:text-txt-secondary hover:bg-white/[0.03] transition-all"
          >
            设置
          </Link>
        </div>
      </nav>

      <main className="flex-1 flex flex-col min-h-0">
        <Suspense fallback={<div className="flex-1 flex items-center justify-center text-txt-tertiary text-sm">加载中...</div>}>
          <DashboardTabs />
        </Suspense>
      </main>
    </div>
  );
}
