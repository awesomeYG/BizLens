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
    if (!user?.isOnboarded) { router.replace("/"); return; }
    setCompanyProfile(user.companyProfile);
    setReady(true);
  }, [router]);

  if (!ready) return <div className="min-h-screen bg-zinc-950" />;

  return (
    <div className="min-h-screen flex flex-col bg-zinc-950">
      {/* 导航栏 */}
      <nav className="flex items-center justify-between px-6 py-3 border-b border-zinc-800/80 bg-zinc-950/90 backdrop-blur-md sticky top-0 z-40">
        <Link href="/" className="flex items-center gap-2 text-zinc-400 hover:text-zinc-200 transition-colors">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
          </svg>
          <span className="font-medium text-sm bg-gradient-to-r from-white to-zinc-400 bg-clip-text text-transparent">BizLens</span>
        </Link>
        <div className="flex gap-1 items-center">
          <Link href="/chat" className="px-3 py-1.5 rounded-lg text-sm font-medium bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
            AI 对话
          </Link>
          <Link href="/alerts" className="btn-ghost text-sm">智能告警</Link>
          <div className="relative group">
            <button className="btn-ghost text-sm flex items-center gap-1">
              更多
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
              </svg>
            </button>
            <div className="absolute right-0 mt-1 w-40 rounded-xl border border-zinc-800 bg-zinc-900/95 backdrop-blur-md shadow-2xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50 overflow-hidden">
              <Link href="/dashboards" className="block px-4 py-2.5 text-sm text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/80 transition-colors">
                数据大屏
              </Link>
              <Link href="/alerts/config" className="block px-4 py-2.5 text-sm text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/80 transition-colors border-t border-zinc-800/50">
                告警配置
              </Link>
              <Link href="/im/settings" className="block px-4 py-2.5 text-sm text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/80 transition-colors border-t border-zinc-800/50">
                IM 设置
              </Link>
            </div>
          </div>
        </div>
      </nav>

      <main className="flex-1 flex min-h-0">
        <div className="flex-1 flex flex-col">
          <ChatPanel onDataSummaryChange={setDataSummary} companyProfile={companyProfile} />
        </div>
        {dataSummary && (
          <aside className="w-80 border-l border-zinc-800/80 bg-zinc-900/30 p-5 overflow-y-auto">
            <h3 className="text-xs font-medium text-zinc-500 uppercase tracking-wider mb-3">
              已学习数据
            </h3>
            <pre className="text-xs text-zinc-600 whitespace-pre-wrap break-words leading-relaxed">
              {dataSummary.slice(0, 500)}
              {dataSummary.length > 500 && "..."}
            </pre>
          </aside>
        )}
      </main>
    </div>
  );
}
