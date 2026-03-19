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
    return <div className="min-h-screen bg-slate-900" />;
  }

  return (
    <div className="min-h-screen flex flex-col bg-slate-900">
      <nav className="flex items-center justify-between px-6 py-3 border-b border-slate-700/50 bg-slate-800/80">
        <Link href="/" className="text-cyan-400 hover:text-cyan-300 font-medium">
          ← AI BI
        </Link>
        <div className="flex gap-4">
          <Link
            href="/chat"
            className="text-slate-400 hover:text-slate-300"
          >
            AI 对话
          </Link>
          <Link
            href="/dashboards"
            className="text-cyan-400 font-medium border-b-2 border-cyan-400 pb-1"
          >
            数据大屏
          </Link>
        </div>
      </nav>

      <main className="flex-1 flex flex-col min-h-0">
        <Suspense fallback={<div className="flex-1 flex items-center justify-center text-slate-500">加载中...</div>}>
          <DashboardTabs />
        </Suspense>
      </main>
    </div>
  );
}
