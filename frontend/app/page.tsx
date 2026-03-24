"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getCurrentUser, loginUser } from "@/lib/user-store";
import AppHeader from "@/components/AppHeader";

export default function HomePage() {
  const router = useRouter();
  const [hydrated, setHydrated] = useState(false);
  const [question, setQuestion] = useState("");

  useEffect(() => {
    const user = getCurrentUser();
    if (user) {
      router.push(user.isOnboarded ? "/chat" : "/onboarding");
      return;
    }
    setHydrated(true);
  }, [router]);

  const handleQuickStart = async () => {
    try {
      // 快速登录，使用测试账号
      await loginUser("test@example.com", "password123");
      localStorage.setItem("mock_user", "true");
      router.push("/chat");
    } catch {
      // 登录失败时跳转到登录页
      router.push("/auth/login");
    }
  };

  if (!hydrated) {
    return <div className="min-h-screen bg-zinc-950" />;
  }

  return (
    <div className="min-h-screen bg-zinc-950 bg-grid bg-glow-top flex flex-col">
      {/* 顶部导航 */}
      <AppHeader
        title="BizLens"
        subtitle="AI 驱动的商业智能"
        showNav={false}
        showLogout={false}
        actions={
          <>
            <button
              onClick={() => router.push("/auth/login")}
              className="px-3 py-1.5 text-xs text-zinc-400 hover:text-zinc-200 transition-colors"
            >
              登录
            </button>
            <button
              onClick={() => router.push("/auth/register")}
              className="px-3 py-1.5 text-xs bg-indigo-600 text-white rounded-lg hover:bg-indigo-500 transition-colors"
            >
              注册
            </button>
          </>
        }
      />

      {/* 主要内容 - 居中对话框 */}
      <main className="flex-1 flex flex-col items-center justify-center px-4 pb-20">
        <div className="w-full max-w-3xl text-center space-y-8 animate-fade-in">
          {/* Hero 文案 */}
          <div className="space-y-4">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-xs mb-4">
              <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse" />
              AI 驱动的商业智能
            </div>
            <h1 className="text-5xl md:text-6xl font-bold tracking-tight">
              <span className="bg-gradient-to-r from-white via-zinc-200 to-zinc-400 bg-clip-text text-transparent">
                问任何数据问题
              </span>
            </h1>
            <p className="text-lg text-zinc-500 max-w-xl mx-auto">
              连接你的数据，用自然语言提问，立即获得可视化洞察
            </p>
          </div>

          {/* 输入框 */}
          <div className="max-w-2xl mx-auto">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleQuickStart();
              }}
              className="relative group"
            >
              <div className="relative">
                <input
                  type="text"
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  placeholder="比如：上个月销售额是多少？环比增长如何？"
                  className="w-full rounded-2xl bg-zinc-900/80 border border-zinc-700/50 px-6 py-4 pr-14 text-zinc-100 placeholder-zinc-500 text-lg transition-all focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500/50"
                  autoFocus
                />
                <button
                  type="submit"
                  className="absolute right-2 top-1/2 -translate-y-1/2 w-10 h-10 rounded-xl bg-indigo-600 hover:bg-indigo-500 flex items-center justify-center transition-all opacity-0 group-hover:opacity-100"
                >
                  <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
                  </svg>
                </button>
              </div>
            </form>

            {/* 快捷问题 */}
            <div className="mt-6 flex flex-wrap justify-center gap-2">
              {[
                "上周销售额 Top 3 的产品？",
                "本月营收趋势如何？",
                "哪个区域增长最快？",
                "客户流失率分析",
              ].map((q) => (
                <button
                  key={q}
                  onClick={() => {
                    setQuestion(q);
                    handleQuickStart();
                  }}
                  className="px-4 py-2 rounded-xl bg-zinc-900/50 border border-zinc-800/50 text-sm text-zinc-400 hover:text-zinc-200 hover:border-zinc-700 transition-all"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>

          {/* 信任背书 */}
          <div className="pt-12">
            <p className="text-xs text-zinc-600 mb-4">已帮助 500+ 企业实现数据驱动</p>
            <div className="flex justify-center items-center gap-8 opacity-40 grayscale">
              {/* 简化 Logo 占位 */}
              <div className="h-6 w-20 bg-zinc-800 rounded" />
              <div className="h-6 w-20 bg-zinc-800 rounded" />
              <div className="h-6 w-20 bg-zinc-800 rounded" />
              <div className="h-6 w-20 bg-zinc-800 rounded" />
            </div>
          </div>
        </div>
      </main>

    </div>
  );
}
