"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { activate, saveTokens } from "@/lib/auth/api";
import { saveCurrentUser } from "@/lib/user-store";

export default function ActivatePage() {
  const router = useRouter();

  const [form, setForm] = useState({
    license1: "",
    license2: "",
    license3: "",
    license4: "",
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const licenseRefs = [
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
  ];

  const handleLicenseInput = (index: number, value: string) => {
    const upper = value.toUpperCase().replace(/[^A-Z0-9]/g, "");

    // 检测粘贴场景：用户在第一个格子输入超长内容，或粘贴的内容包含连字符
    if (index === 0 && value.length > 4) {
      const clean = value.replace(/[^A-Z0-9-]/g, "").toUpperCase();
      const parts = clean.split("-");

      if (parts.length === 4) {
        // 标准 4 段格式 "BIZL-8K3M-A7PW-2N9Q"
        setForm({
          ...form,
          license1: (parts[0] || "").slice(0, 4),
          license2: (parts[1] || "").slice(0, 4),
          license3: (parts[2] || "").slice(0, 4),
          license4: (parts[3] || "").slice(0, 4),
        });
        licenseRefs[3].current?.focus();
        return;
      }

      // 无分隔符格式 "BIZL8K3MA7PW2N9Q"（恰好 16 个字符）
      if (upper.length === 16 && !upper.includes("-")) {
        setForm({
          ...form,
          license1: upper.slice(0, 4),
          license2: upper.slice(4, 8),
          license3: upper.slice(8, 12),
          license4: upper.slice(12, 16),
        });
        licenseRefs[3].current?.focus();
        return;
      }
    }

    const newForm = { ...form };
    const key = `license${index + 1}` as keyof typeof form;
    (newForm as Record<string, string>)[key] = upper.slice(0, 4);
    setForm(newForm);

    // 自动跳格
    if (upper.length === 4 && index < 3) {
      licenseRefs[index + 1].current?.focus();
    }
  };

  const handleActivate = async () => {
    const fullLicense = `${form.license1}-${form.license2}-${form.license3}-${form.license4}`;

    if (fullLicense.replace(/-/g, "").length !== 16) {
      setError("请输入完整的 16 位授权码");
      return;
    }
    if (!form.name.trim()) {
      setError("请输入管理员姓名");
      return;
    }
    if (!form.email.trim() || !form.email.includes("@")) {
      setError("请输入有效的邮箱地址");
      return;
    }
    if (form.password.length < 6) {
      setError("密码长度至少 6 位");
      return;
    }
    if (form.password !== form.confirmPassword) {
      setError("两次输入的密码不一致");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const response = await activate({
        licenseKey: fullLicense,
        name: form.name.trim(),
        email: form.email.trim(),
        password: form.password,
      });

      if (!response.activated) {
        setError(response.error || "激活失败，请检查授权码");
        return;
      }

      // 保存 token
      if (response.tokens) {
        saveTokens(response.tokens);
      }

      // 保存用户信息
      if (response.user) {
        const user = {
          id: response.user.id,
          tenantId: response.user.tenantId,
          name: response.user.name,
          email: response.user.email,
          role: response.user.role,
          createdAt: response.user.createdAt,
          isOnboarded: false,
        };
        saveCurrentUser(user as any);
      }

      router.push("/onboarding");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "网络错误，请重试";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col lg:flex-row">
      {/* 左侧装饰区域 */}
      <div className="hidden lg:flex lg:w-1/2 relative bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-500 overflow-hidden">
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute -top-40 -right-40 w-96 h-96 rounded-full bg-white/10 blur-3xl"></div>
          <div className="absolute -bottom-40 -left-40 w-96 h-96 rounded-full bg-white/10 blur-3xl"></div>
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 rounded-full bg-white/5 blur-2xl"></div>
        </div>

        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iMC4xIj48Y2lyY2xlIGN4PSIzIiBjeT0iMyIgcj0iMyIvPjwvZz48L2c+PC9zdmc+')] opacity-20"></div>

        <div className="relative z-10 flex flex-col justify-center px-12 text-white">
          <div className="mb-8">
            <div className="flex items-center space-x-3 mb-6">
              <div className="w-12 h-12 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
                <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
              </div>
              <span className="text-2xl font-bold">BizLens</span>
            </div>
          </div>

          <h1 className="text-5xl font-bold mb-6 leading-tight">
            激活您的<br />
            <span className="text-white/80">数据分析平台</span>
          </h1>
          <p className="text-xl text-white/80 mb-8 max-w-md">
            输入授权码完成系统激活，解锁完整的 BI 分析能力
          </p>

          <div className="space-y-4">
            {[
              "AI 驱动的数据分析",
              "实时仪表盘与可视化",
              "智能告警与通知",
            ].map((item, i) => (
              <div key={i} className="flex items-center space-x-3">
                <div className="w-8 h-8 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center flex-shrink-0">
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                </div>
                <span>{item}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 右侧表单区域 */}
      <div className="flex-1 flex items-center justify-center px-4 py-12 sm:px-6 lg:px-8 bg-gradient-to-br from-slate-50 to-slate-100">
        {/* 移动端 Logo */}
        <div className="lg:hidden absolute top-8 left-8 flex items-center space-x-2">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-600 to-purple-600 flex items-center justify-center">
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
          </div>
          <span className="text-xl font-bold text-gray-900">BizLens</span>
        </div>

        <div className="max-w-md w-full">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-600 to-purple-600 mb-4">
              <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            </div>
            <h2 className="text-3xl font-bold text-gray-900">
              激活系统
            </h2>
            <p className="mt-2 text-gray-600">
              输入授权码和管理员信息完成激活
            </p>
          </div>

          <div className="space-y-5">
            {/* 授权码 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                授权码
              </label>
              <div className="grid grid-cols-4 gap-2">
                {[0, 1, 2, 3].map((i) => (
                  <div key={i} className="relative">
                    <input
                      ref={licenseRefs[i]}
                      type="text"
                      inputMode="text"
                      autoCapitalize="characters"
                      maxLength={4}
                      value={[form.license1, form.license2, form.license3, form.license4][i]}
                      onChange={(e) => handleLicenseInput(i, e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Backspace" && ![form.license1, form.license2, form.license3, form.license4][i] && i > 0) {
                          licenseRefs[i - 1].current?.focus();
                        }
                      }}
                      className="block w-full text-center py-3 border border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all duration-200 bg-white/80 backdrop-blur-sm font-mono tracking-widest text-lg font-semibold"
                      placeholder={["XXXX", "XXXX", "XXXX", "XXXX"][i]}
                    />
                    {i < 3 && (
                      <span className="absolute right-[-10px] top-1/2 -translate-y-1/2 text-gray-400 text-lg">-</span>
                    )}
                  </div>
                ))}
              </div>
              <p className="mt-1.5 text-xs text-gray-400">
                可直接粘贴完整授权码，如 BIZL-8K3M-A7PW-2N9Q
              </p>
            </div>

            {/* 管理员姓名 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                管理员姓名
              </label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="block w-full px-4 py-3 border border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all duration-200 bg-white/80 backdrop-blur-sm"
                placeholder="请输入管理员姓名"
              />
            </div>

            {/* 管理员邮箱 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                管理员邮箱
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                      d="M16 12a4 4 0 10-8 0 4 4 0 008 0zm0 0v1.5a2.5 2.5 0 005 0V12a9 9 0 10-9 9m4.5-1.206a8.959 8.959 0 01-4.5 1.207" />
                  </svg>
                </div>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  className="block w-full pl-11 pr-4 py-3 border border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all duration-200 bg-white/80 backdrop-blur-sm"
                  placeholder="admin@company.com"
                />
              </div>
            </div>

            {/* 密码 */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  设置密码
                </label>
                <input
                  type="password"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  className="block w-full px-4 py-3 border border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all duration-200 bg-white/80 backdrop-blur-sm"
                  placeholder="6 位以上"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  确认密码
                </label>
                <input
                  type="password"
                  value={form.confirmPassword}
                  onChange={(e) => setForm({ ...form, confirmPassword: e.target.value })}
                  className="block w-full px-4 py-3 border border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all duration-200 bg-white/80 backdrop-blur-sm"
                  placeholder="再次输入"
                />
              </div>
            </div>

            {/* 错误提示 */}
            {error && (
              <div className="rounded-xl bg-red-50 border border-red-100 p-4">
                <div className="flex">
                  <div className="flex-shrink-0">
                    <svg className="h-5 w-5 text-red-500" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div className="ml-3">
                    <p className="text-sm font-medium text-red-800">{error}</p>
                  </div>
                </div>
              </div>
            )}

            {/* 激活按钮 */}
            <button
              onClick={handleActivate}
              disabled={loading}
              className="group relative w-full flex justify-center py-3.5 px-4 border border-transparent text-sm font-semibold rounded-xl text-white bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 shadow-lg shadow-indigo-500/30 hover:shadow-xl hover:shadow-indigo-500/40"
            >
              {loading ? (
                <span className="flex items-center">
                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  激活中...
                </span>
              ) : (
                <span className="flex items-center">
                  激活系统
                  <svg className="ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform duration-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                  </svg>
                </span>
              )}
            </button>

            {/* 已有账号 */}
            <p className="text-center text-sm text-gray-500">
              已有账号？
              <Link href="/auth/login"
                className="font-medium text-indigo-600 hover:text-indigo-500 transition-colors duration-200 ml-1">
                前往登录
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
