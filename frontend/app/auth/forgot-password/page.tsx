import Link from "next/link";

export default function ForgotPasswordPage() {
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
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
            </div>
            <span className="text-2xl font-bold">BizLens</span>
          </div>

          <h1 className="mb-6 text-5xl font-bold leading-tight">
            找回密码<br />
            <span className="text-white/80">先恢复访问，再继续分析</span>
          </h1>
          <p className="mb-8 max-w-md text-xl text-white/80">
            当前版本已经提供忘记密码入口，避免用户点击后直接落到 404 页面。
          </p>

          <div className="space-y-4">
            {[
              "登录入口统一保留忘记密码路径",
              "重置提示采用通用文案，避免暴露账号状态",
              "引导用户通过管理员完成安全重置",
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
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
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
              <h2 className="text-3xl font-bold text-gray-900">忘记密码</h2>
              <p className="mt-3 text-base leading-7 text-gray-600">
                出于安全考虑，这里统一展示通用找回说明，不区分邮箱是否存在。当前环境下请联系系统管理员完成密码重置，然后返回登录页重新登录。
              </p>
            </div>

            <div className="space-y-4">
              <div className="rounded-2xl border border-amber-100 bg-amber-50 p-5 text-sm leading-6 text-amber-900">
                如果你无法登录，请优先联系管理员或运维同学重置密码。这样可以避免通过页面反馈泄露账号是否存在。
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
                <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">建议操作</p>
                <div className="mt-4 space-y-3 text-sm text-slate-700">
                  <div className="flex items-start space-x-3">
                    <span className="mt-0.5 flex h-6 w-6 items-center justify-center rounded-full bg-slate-900 text-xs font-semibold text-white">1</span>
                    <p>确认你使用的是注册或激活时填写的邮箱地址。</p>
                  </div>
                  <div className="flex items-start space-x-3">
                    <span className="mt-0.5 flex h-6 w-6 items-center justify-center rounded-full bg-slate-900 text-xs font-semibold text-white">2</span>
                    <p>联系系统管理员，说明需要重置 BizLens 登录密码。</p>
                  </div>
                  <div className="flex items-start space-x-3">
                    <span className="mt-0.5 flex h-6 w-6 items-center justify-center rounded-full bg-slate-900 text-xs font-semibold text-white">3</span>
                    <p>密码重置完成后，返回登录页重新登录系统。</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link
                href="/auth/login"
                className="flex flex-1 items-center justify-center rounded-2xl bg-gradient-to-r from-emerald-600 to-cyan-600 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-emerald-500/25 transition-transform duration-200 hover:-translate-y-0.5"
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
