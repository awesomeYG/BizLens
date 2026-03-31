"use client";

import Link from "next/link";
import { useState } from "react";
import { forgotPassword } from "@/lib/auth/api";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");
    setMessage("");

    if (!email.trim()) {
      setError("请输入邮箱地址");
      return;
    }

    setLoading(true);
    try {
      const response = await forgotPassword({ email: email.trim() });
      setMessage(response.message);
    } catch (err) {
      setError(err instanceof Error ? err.message : "发送重置邮件失败");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col lg:flex-row">
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden bg-gradient-to-br from-emerald-600 via-teal-600 to-cyan-500">
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute -top-40 -right-40 h-96 w-96 rounded-full bg-white/10 blur-3xl"></div>
          <div className="absolute -bottom-40 -left-40 h-96 w-96 rounded-full bg-white/10 blur-3xl"></div>
          <div className="absolute left-1/2 top-1/2 h-64 w-64 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/5 blur-2xl"></div>
        </div>

        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iMC4xIj48Y2lyY2xlIGN4PSIzIiBjeT0iMyIgcj0iMyIvPjwvZz48L2c+PC9zdmc+')] opacity-20"></div>

        <div className="relative z-10 flex flex-col justify-center px-12 text-white">
          <div className="mb-8 flex items-center space-x-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/20 backdrop-blur-sm">
              <svg className="h-7 w-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 11c1.657 0 3-1.343 3-3S13.657 5 12 5 9 6.343 9 8s1.343 3 3 3zm0 0c-2.761 0-5 2.239-5 5v1h10v-1c0-2.761-2.239-5-5-5zm7-2a4 4 0 00-4-4"
                />
              </svg>
            </div>
            <span className="text-2xl font-bold">BizLens</span>
          </div>

          <h1 className="mb-6 text-5xl font-bold leading-tight">
            邮件找回密码<br />
            <span className="text-white/80">用安全链接恢复访问权限</span>
          </h1>
          <p className="mb-8 max-w-md text-xl text-white/80">
            输入邮箱后，系统会发送一封包含重置链接的邮件。整个流程统一使用安全提示，不暴露账号是否存在。
          </p>

          <div className="space-y-4">
            {[
              "重置链接默认 30 分钟内有效",
              "同一时间仅保留最新一封可用邮件",
              "重置成功后旧登录会话会自动失效",
            ].map((item) => (
              <div key={item} className="flex items-center space-x-3">
                <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-white/20 backdrop-blur-sm">
                  <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
                    <path
                      fillRule="evenodd"
                      d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                      clipRule="evenodd"
                    />
                  </svg>
                </div>
                <span>{item}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="relative flex flex-1 items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 px-4 py-12 sm:px-6 lg:px-8">
        <div className="absolute left-8 top-8 flex items-center space-x-2 lg:hidden">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-600 to-cyan-600">
            <svg className="h-6 w-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 11c1.657 0 3-1.343 3-3S13.657 5 12 5 9 6.343 9 8s1.343 3 3 3zm0 0c-2.761 0-5 2.239-5 5v1h10v-1c0-2.761-2.239-5-5-5zm7-2a4 4 0 00-4-4"
              />
            </svg>
          </div>
          <span className="text-xl font-bold text-gray-900">BizLens</span>
        </div>

        <div className="w-full max-w-lg">
          <div className="rounded-3xl border border-white/70 bg-white/90 p-8 shadow-2xl shadow-slate-200/70 backdrop-blur-xl sm:p-10">
            <div className="mb-8">
              <div className="mb-4 inline-flex rounded-full bg-emerald-50 px-4 py-1 text-sm font-medium text-emerald-700">
                Password Recovery
              </div>
              <h2 className="text-3xl font-bold text-gray-900">发送重置邮件</h2>
              <p className="mt-3 text-base leading-7 text-gray-600">
                输入你的登录邮箱。无论邮箱是否存在，页面都会返回同一条提示，以避免暴露账号状态。
              </p>
            </div>

            <form className="space-y-5" onSubmit={handleSubmit}>
              <div>
                <label htmlFor="email" className="mb-2 block text-sm font-medium text-gray-700">
                  邮箱地址
                </label>
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-gray-900 outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
                />
              </div>

              {error && (
                <div className="rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {error}
                </div>
              )}

              {message && (
                <div className="rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
                  {message}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="flex w-full items-center justify-center rounded-2xl bg-gradient-to-r from-emerald-600 to-cyan-600 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-emerald-500/25 transition-transform duration-200 hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? "发送中..." : "发送重置邮件"}
              </button>
            </form>

            <div className="mt-8 rounded-2xl border border-slate-200 bg-slate-50 p-5">
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">找回流程</p>
              <div className="mt-4 space-y-3 text-sm text-slate-700">
                <p>1. 提交邮箱后查收邮件中的重置链接。</p>
                <p>2. 打开链接并设置新密码。</p>
                <p>3. 使用新密码重新登录 BizLens。</p>
              </div>
            </div>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link
                href="/auth/login"
                className="flex flex-1 items-center justify-center rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition-colors duration-200 hover:border-slate-300 hover:bg-slate-50"
              >
                返回登录
              </Link>
              <Link
                href="/auth/activate"
                className="flex flex-1 items-center justify-center rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition-colors duration-200 hover:border-slate-300 hover:bg-slate-50"
              >
                前往系统激活
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
