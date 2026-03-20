"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import ChatPanel from "@/components/ChatPanel";
import { getCurrentUser } from "@/lib/user-store";
import type { CompanyProfile } from "@/lib/types";

export default function ChatPage() {
  const router = useRouter();
  const [dataSummary, setDataSummary] = useState("");
  const [companyProfile, setCompanyProfile] = useState<CompanyProfile | undefined>(undefined);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const user = getCurrentUser();
    if (!user?.isOnboarded) {
      router.replace("/");
      return;
    }
    setCompanyProfile(user.companyProfile);
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
        <div className="flex gap-4 items-center">
          <Link
            href="/chat"
            className="text-cyan-400 font-medium border-b-2 border-cyan-400 pb-1"
          >
            AI 对话
          </Link>
          <Link
            href="/alerts"
            className="text-slate-400 hover:text-slate-300"
          >
            智能告警
          </Link>
          <div className="relative group">
            <button className="text-slate-400 hover:text-slate-300 pb-1">
              更多 ▼
            </button>
            <div className="absolute right-0 mt-2 w-40 rounded-lg border border-slate-700 bg-slate-800 shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50">
              <Link
                href="/dashboards"
                className="block px-4 py-2 text-sm text-slate-400 hover:text-slate-200 hover:bg-slate-700 rounded-t-lg"
              >
                数据大屏
              </Link>
              <Link
                href="/alerts/config"
                className="block px-4 py-2 text-sm text-slate-400 hover:text-slate-200 hover:bg-slate-700 border-t border-slate-700"
              >
                告警配置
              </Link>
              <Link
                href="/im/settings"
                className="block px-4 py-2 text-sm text-slate-400 hover:text-slate-200 hover:bg-slate-700 rounded-b-lg"
              >
                IM 设置
              </Link>
            </div>
          </div>
        </div>
      </nav>

      <main className="flex-1 flex min-h-0">
        <div className="flex-1 flex flex-col">
          <ChatPanel
            onDataSummaryChange={setDataSummary}
            companyProfile={companyProfile}
          />
        </div>
        {dataSummary && (
          <aside className="w-80 border-l border-slate-700/50 bg-slate-800/30 p-4 overflow-y-auto">
            <h3 className="text-sm font-medium text-slate-400 mb-2">
              已学习数据
            </h3>
            <pre className="text-xs text-slate-500 whitespace-pre-wrap break-words">
              {dataSummary.slice(0, 500)}
              {dataSummary.length > 500 && "..."}
            </pre>
          </aside>
        )}
      </main>
    </div>
  );
}
