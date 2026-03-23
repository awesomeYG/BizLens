"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import SimpleChatPanel from "@/components/SimpleChatPanel";
import { getCurrentUser } from "@/lib/user-store";

export default function ChatPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const user = getCurrentUser();
    if (!user) {
      router.replace("/auth/login");
      return;
    }
    setReady(true);
  }, [router]);

  if (!ready) return <div className="min-h-screen bg-zinc-950" />;

  return (
    <div className="h-screen flex flex-col bg-zinc-950 relative overflow-hidden">
      {/* 背景装饰 */}
      <div className="pointer-events-none absolute inset-0">
        {/* 左上光晕 */}
        <div className="absolute -top-32 -left-32 w-96 h-96 bg-indigo-600/[0.04] rounded-full blur-3xl" />
        {/* 右下光晕 */}
        <div className="absolute -bottom-32 -right-32 w-96 h-96 bg-purple-600/[0.03] rounded-full blur-3xl" />
        {/* 微网格 */}
        <div className="absolute inset-0 bg-grid opacity-30" />
      </div>

      {/* 主内容 */}
      <div className="relative z-10 flex flex-col flex-1 min-h-0">
        <SimpleChatPanel />
      </div>
    </div>
  );
}
