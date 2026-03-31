"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";
import { resetPassword, validateResetPasswordToken } from "@/lib/auth/api";

function ResetPasswordContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = useMemo(() => searchParams.get("token") || "", [searchParams]);

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [validating, setValidating] = useState(true);
  const [tokenValid, setTokenValid] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      if (!token) {
        setError("缺少重置令牌，请重新从邮件中的链接进入。");
        setValidating(false);
        return;
      }

      try {
        const result = await validateResetPasswordToken(token);
        if (cancelled) {
          return;
        }

        if (!result.valid) {
          setTokenValid(false);
          setError(result.message || "重置链接无效或已失效");
        } else {
          setTokenValid(true);
          setError("");
        }
      } catch (err) {
        if (!cancelled) {
          setTokenValid(false);
          setError(err instanceof Error ? err.message : "校验重置链接失败");
        }
      } finally {
        if (!cancelled) {
          setValidating(false);
        }
      }
    };

    run();
    return () => {
      cancelled = true;
    };
  }, [token]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (password.length < 6) {
      setError("新密码长度至少 6 位");
      return;
    }
    if (password !== confirmPassword) {
      setError("两次输入的密码不一致");
      return;
    }

    setLoading(true);
    try {
      const response = await resetPassword({ token, newPassword: password });
      setSuccess(response.message);
      setTimeout(() => {
        router.push("/auth/login");
      }, 1200);
    } catch (err) {
      setError(err instanceof Error ? err.message : "重置密码失败");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col lg:flex-row">
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden bg-gradient-to-br from-sky-600 via-cyan-600 to-emerald-500">
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
                  d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2h-1V9a5 5 0 00-10 0v2H6a2 2 0 00-2 2v6a2 2 0 002 2zm3-10V9a3 3 0 016 0v2H9z"
                />
              </svg>
            </div>
            <span className="text-2xl font-bold">BizLens</span>
          </div>

          <h1 className="mb-6 text-5xl font-bold leading-tight">
            设置新密码<br />
            <span className="text-white/80">完成后即可回到工作台</span>
          </h1>
          <p className="mb-8 max-w-md text-xl text-white/80">
            只有有效邮件中的最新链接才能完成重置。成功后，系统会撤销旧会话，确保账号安全。
          </p>

          <div className="space-y-4">
            {[
              "链接过期后需要重新申请邮件",
              "新密码至少 6 位，建议同时包含字母和数字",
              "重置完成后请使用新密码重新登录",
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
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-sky-600 to-emerald-600">
            <svg className="h-6 w-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2h-1V9a5 5 0 00-10 0v2H6a2 2 0 00-2 2v6a2 2 0 002 2zm3-10V9a3 3 0 016 0v2H9z"
              />
            </svg>
          </div>
          <span className="text-xl font-bold text-gray-900">BizLens</span>
        </div>

        <div className="w-full max-w-lg">
          <div className="rounded-3xl border border-white/70 bg-white/90 p-8 shadow-2xl shadow-slate-200/70 backdrop-blur-xl sm:p-10">
            <div className="mb-8">
              <div className="mb-4 inline-flex rounded-full bg-sky-50 px-4 py-1 text-sm font-medium text-sky-700">
                Reset Password
              </div>
              <h2 className="text-3xl font-bold text-gray-900">重置密码</h2>
              <p className="mt-3 text-base leading-7 text-gray-600">
                {validating
                  ? "正在校验邮件中的重置链接..."
                  : tokenValid
                    ? "链接有效，请设置你的新密码。"
                    : "当前链接不可用，请重新申请一封重置邮件。"}
              </p>
            </div>

            {error && (
              <div className="mb-5 rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            )}

            {success && (
              <div className="mb-5 rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
                {success}
              </div>
            )}

            {tokenValid && !success && (
              <form className="space-y-5" onSubmit={handleSubmit}>
                <div>
                  <label htmlFor="password" className="mb-2 block text-sm font-medium text-gray-700">
                    新密码
                  </label>
                  <input
                    id="password"
                    type="password"
                    autoComplete="new-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-gray-900 outline-none transition focus:border-sky-500 focus:ring-4 focus:ring-sky-100"
                  />
                </div>

                <div>
                  <label htmlFor="confirmPassword" className="mb-2 block text-sm font-medium text-gray-700">
                    确认新密码
                  </label>
                  <input
                    id="confirmPassword"
                    type="password"
                    autoComplete="new-password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-gray-900 outline-none transition focus:border-sky-500 focus:ring-4 focus:ring-sky-100"
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading || validating}
                  className="flex w-full items-center justify-center rounded-2xl bg-gradient-to-r from-sky-600 to-emerald-600 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-sky-500/25 transition-transform duration-200 hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {loading ? "提交中..." : "确认重置密码"}
                </button>
              </form>
            )}

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link
                href="/auth/forgot-password"
                className="flex flex-1 items-center justify-center rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition-colors duration-200 hover:border-slate-300 hover:bg-slate-50"
              >
                重新申请邮件
              </Link>
              <Link
                href="/auth/login"
                className="flex flex-1 items-center justify-center rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition-colors duration-200 hover:border-slate-300 hover:bg-slate-50"
              >
                返回登录
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense>
      <ResetPasswordContent />
    </Suspense>
  );
}
