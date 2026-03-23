"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getCurrentUser, loginUser } from "@/lib/user-store";

export default function HomePage() {
  const router = useRouter();
  const [hydrated, setHydrated] = useState(false);
  const [question, setQuestion] = useState("");
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [loginForm, setLoginForm] = useState({ name: "", email: "" });

  useEffect(() => {
    const user = getCurrentUser();
    if (user) {
      router.push("/chat");
      return;
    }
    setHydrated(true);
  }, [router]);

  const handleQuickStart = () => {
    setIsLoggingIn(true);
    // 快速登录，使用 mock 数据
    const user = loginUser("演示用户", "demo@example.com");
    localStorage.setItem("mock_user", "true");
    router.push("/chat");
  };

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginForm.name.trim() || !loginForm.email.trim()) return;
    setIsLoggingIn(true);
    loginUser(loginForm.name.trim(), loginForm.email.trim());
    router.push("/chat");
  };

  if (!hydrated) {
    return <div className="min-h-screen bg-zinc-950" />;
  }

  return (
    <div className="min-h-screen bg-zinc-950 bg-grid bg-glow-top flex flex-col">
      {/* 顶部导航 */}
      <nav className="flex items-center justify-between px-6 py-4 border-b border-zinc-800/50">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
            <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v2.25c0 .621-.504 1.125-1.125 1.125H4.125A1.125 1.125 0 0 1 3 15.375v-2.25Z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 12a9 9 0 0 1 18 0v6a9 9 0 0 1-18 0v-6Zm9 9a9 9 0 0 0 9-9" />
            </svg>
          </div>
          <span className="text-xl font-semibold bg-gradient-to-r from-white to-zinc-400 bg-clip-text text-transparent">
            DataMind
          </span>
        </div>
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.push("/settings/ai")}
            className="flex items-center gap-2 px-4 py-2 text-sm text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50 rounded-lg transition-all"
            title="AI 设置"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.343 3.94c.09-.542.56-.94 1.11-.94h1.093c.55 0 1.02.398 1.11.94l.149.894c.07.424.384.764.78.93.398.164.855.142 1.205-.108l.737-.527a1.125 1.125 0 0 1 1.45.12l.773.774c.39.389.44 1.002.12 1.45l-.527.737c-.25.35-.272.806-.107 1.204.165.397.505.71.93.78l.893.15c.543.09.94.56.94 1.109v1.094c0 .55-.397 1.02-.94 1.11l-.894.149c-.424.07-.764.383-.929.78-.165.398-.143.854.107 1.204l.527.738c.32.447.269 1.06-.12 1.45l-.774.773a1.125 1.125 0 0 1-1.449.12l-.738-.527c-.35-.25-.806-.272-1.203-.107-.397.165-.71.505-.781.929l-.149.894c-.09.542-.56.94-1.11.94h-1.094c-.55 0-1.019-.398-1.11-.94l-.148-.894c-.071-.424-.384-.764-.781-.93-.398-.164-.854-.142-1.204.108l-.738.527c-.447.32-1.06.269-1.45-.12l-.773-.774a1.125 1.125 0 0 1-.12-1.45l.527-.737c.25-.35.273-.806.108-1.204-.165-.397-.505-.71-.93-.78l-.894-.15c-.542-.09-.94-.56-.94-1.109v-1.094c0-.55.398-1.02.94-1.11l.894-.149c.424-.07.765-.383.93-.78.165-.398.143-.854-.107-1.204l-.527-.738a1.125 1.125 0 0 1 .12-1.45l.773-.773a1.125 1.125 0 0 1 1.45-.12l.737.527c.35.25.807.272 1.204.107.397-.165.71-.505.78-.929l.15-.894Z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
            </svg>
            <span className="hidden md:inline">设置</span>
          </button>
          <button
            onClick={() => (document.getElementById("login-modal") as HTMLDialogElement)?.showModal()}
            className="px-4 py-2 text-sm text-zinc-400 hover:text-zinc-200 transition-colors"
          >
            登录
          </button>
          <button
            onClick={() => router.push("/auth/register")}
            className="px-4 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-500 transition-colors"
          >
            注册
          </button>
        </div>
      </nav>

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

      {/* 登录对话框 */}
      <dialog
        id="login-modal"
        className="backdrop:bg-black/50 backdrop:backdrop-blur-sm bg-zinc-900 rounded-2xl p-0 border border-zinc-800 shadow-2xl"
      >
        <div className="w-96 p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold text-zinc-100">登录</h2>
            <button
              onClick={() => (document.getElementById("login-modal") as HTMLDialogElement)?.close()}
              className="text-zinc-500 hover:text-zinc-300"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs text-zinc-500 mb-1.5 font-medium">姓名</label>
              <input
                value={loginForm.name}
                onChange={(e) => setLoginForm((p) => ({ ...p, name: e.target.value }))}
                placeholder="输入姓名"
                className="input-base"
                autoFocus
              />
            </div>
            <div>
              <label className="block text-xs text-zinc-500 mb-1.5 font-medium">邮箱</label>
              <input
                type="email"
                value={loginForm.email}
                onChange={(e) => setLoginForm((p) => ({ ...p, email: e.target.value }))}
                placeholder="name@company.com"
                className="input-base"
              />
            </div>
            <button
              type="submit"
              disabled={isLoggingIn}
              className="btn-primary w-full mt-2"
            >
              {isLoggingIn ? "登录中..." : "进入平台"}
            </button>
          </form>

          <div className="mt-4 text-center space-y-2">
            <button
              type="button"
              onClick={handleQuickStart}
              className="text-sm text-zinc-500 hover:text-zinc-300 transition-colors block w-full"
            >
              🚀 快速测试（使用演示数据）
            </button>
            <div className="text-sm text-zinc-600">
              还没有账号？
              <button
                type="button"
                onClick={() => {
                  (document.getElementById("login-modal") as HTMLDialogElement)?.close();
                  router.push("/auth/register");
                }}
                className="text-indigo-400 hover:text-indigo-300 ml-1"
              >
                立即注册
              </button>
            </div>
          </div>
        </div>
      </dialog>
    </div>
  );
}
