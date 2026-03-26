"use client";

import { useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";

/* ---------- AI 头像（与 SimpleChatPanel 一致） ---------- */
function AiAvatar() {
  return (
    <div className="w-9 h-9 shrink-0 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
      <svg className="w-4.5 h-4.5" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09Z" />
      </svg>
    </div>
  );
}

/* ---------- 导航项定义 ---------- */
interface NavItem {
  href: string;
  label: string;
  /** 是否为当前高亮项 */
  active?: boolean;
  /** 特殊样式：purple 用于集成按钮 */
  variant?: "default" | "purple";
  /** 图标 SVG path */
  iconPath?: string;
}

interface AppHeaderProps {
  /** 页面标题，默认 "AI 数据分析师" */
  title?: string;
  /** 副标题 */
  subtitle?: string;
  /** 返回链接，不传则不显示返回箭头 */
  backHref?: string;
  /** 返回文字，默认不显示 */
  backLabel?: string;
  /** 面包屑路径，如 ["BizLens", "设置中心"] */
  breadcrumb?: string[];
  /** 右侧额外操作按钮（在标准导航项之前） */
  actions?: React.ReactNode;
  /** 是否显示标准导航项（对话、大屏、报表、集成与告警、设置、退出），默认 true */
  showNav?: boolean;
  /** 是否显示退出按钮，默认 true */
  showLogout?: boolean;
  /** 是否显示在线状态指示器，默认 false */
  showOnlineStatus?: boolean;
  /** 自定义导航项，覆盖默认导航 */
  navItems?: NavItem[];
}

/* ---------- IM 集成图标 ---------- */
const IM_ICON_PATH = "M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 0 1 .865-.501 48.172 48.172 0 0 0 3.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0 0 12 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018Z";
const SETTINGS_ICON_PATH = "M10.343 3.94c.09-.542.56-.94 1.11-.94h1.093c.55 0 1.02.398 1.11.94l.149.894c.07.424.384.764.78.93.398.164.855.142 1.205-.108l.737-.527a1.125 1.125 0 0 1 1.45.12l.773.774c.39.389.44 1.002.12 1.45l-.527.737c-.25.35-.272.806-.107 1.204.165.397.505.71.93.78l.893.15c.543.09.94.56.94 1.109v1.094c0 .55-.397 1.02-.94 1.11l-.894.149c-.424.07-.764.383-.929.78-.165.398-.143.854.107 1.204l.527.738c.32.447.269 1.06-.12 1.45l-.774.773a1.125 1.125 0 0 1-1.449.12l-.738-.527c-.35-.25-.806-.272-1.203-.107-.397.165-.71.505-.781.929l-.149.894c-.09.542-.56.94-1.11.94h-1.094c-.55 0-1.019-.398-1.11-.94l-.148-.894c-.071-.424-.384-.764-.781-.93-.398-.164-.854-.142-1.204.108l-.738.527c-.447.32-1.06.269-1.45-.12l-.773-.774a1.125 1.125 0 0 1-.12-1.45l.527-.737c.25-.35.273-.806.108-1.204-.165-.397-.505-.71-.93-.78l-.894-.15c-.542-.09-.94-.56-.94-1.109v-1.094c0-.55.398-1.02.94-1.11l.894-.149c.424-.07.765-.383.93-.78.165-.398.143-.854-.107-1.204l-.527-.738a1.125 1.125 0 0 1 .12-1.45l.773-.773a1.125 1.125 0 0 1 1.45-.12l.737.527c.35.25.807.272 1.204.107.397-.165.71-.505.78-.929l.15-.894Z";
const SETTINGS_ICON_PATH_2 = "M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z";
const LOGOUT_ICON_PATH = "M15.75 9V5.25A2.25 2.25 0 0 0 13.5 3h-6a2.25 2.25 0 0 0-2.25 2.25v13.5A2.25 2.25 0 0 0 7.5 21h6a2.25 2.25 0 0 0 2.25-2.25V15m3 0 3-3m0 0-3-3m3 3H9";
const BACK_ICON_PATH = "M15.75 19.5 8.25 12l7.5-7.5";

export default function AppHeader({
  title = "AI 数据分析师",
  subtitle,
  backHref,
  backLabel,
  breadcrumb,
  actions,
  showNav = true,
  showLogout = true,
  showOnlineStatus = false,
  navItems,
}: AppHeaderProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  const handleLogout = () => {
    setShowLogoutConfirm(true);
  };

  const handleConfirmLogout = () => {
    localStorage.clear();
    router.push("/auth/login");
  };

  /* 默认导航项 */
  const defaultNavItems: NavItem[] = [
    { href: "/chat", label: "AI 对话" },
    { href: "/insights", label: "洞察" },
    { href: "/dashboards", label: "观测中心" },
    { href: "/reports", label: "报表" },
  ];

  const resolvedNavItems = navItems ?? defaultNavItems;

  /* 判断是否高亮 */
  const isActive = (item: NavItem) => {
    if (item.active !== undefined) return item.active;
    return pathname === item.href || pathname.startsWith(item.href + "/");
  };

  return (
    <>
      <header className="relative sticky top-0 z-40 shrink-0 px-5 py-3 border-b border-zinc-800/40 bg-zinc-900/60 backdrop-blur-xl">
        {/* 底部微光线 */}
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-1/2 h-px bg-gradient-to-r from-transparent via-indigo-500/20 to-transparent" />

        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
        {/* 左侧 */}
        <div className="flex items-center gap-3 min-w-0">
          {/* 返回箭头 */}
          {backHref && (
            <Link href={backHref} className="p-1 -ml-1 rounded-lg text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800/50 transition-all">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d={BACK_ICON_PATH} />
              </svg>
            </Link>
          )}

          {/* AI 头像 */}
          <AiAvatar />

          <div className="min-w-0">
            {/* 面包屑 or 标题 */}
            {breadcrumb && breadcrumb.length > 0 ? (
              <div className="flex items-center gap-2 text-sm">
                {breadcrumb.map((seg, i) => (
                  <span key={i} className="flex items-center gap-2">
                    {i > 0 && <span className="text-zinc-700">/</span>}
                    <span className={i === breadcrumb.length - 1 ? "font-semibold text-zinc-100" : "text-zinc-500"}>
                      {seg}
                    </span>
                  </span>
                ))}
                {showOnlineStatus && (
                  <span className="relative flex h-2 w-2 ml-1">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                  </span>
                )}
              </div>
            ) : (
              <h1 className="text-sm font-semibold text-zinc-100 tracking-wide flex items-center gap-2">
                {backLabel || title}
                {showOnlineStatus && (
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                  </span>
                )}
              </h1>
            )}
            {subtitle && (
              <p className="text-xs text-zinc-500 truncate">{subtitle}</p>
            )}
          </div>
        </div>

        {/* 右侧 */}
        <div className="flex items-center gap-1.5">
          {/* 标准导航项 */}
          {showNav && resolvedNavItems.map((item) => {
            const active = isActive(item);
            if (item.variant === "purple") {
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg bg-purple-500/10 hover:bg-purple-500/20 text-purple-300 border border-purple-500/30 transition-all"
                  title={item.label}
                >
                  {item.iconPath && (
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d={item.iconPath} />
                    </svg>
                  )}
                  {item.label}
                </Link>
              );
            }
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`px-3 py-1.5 text-xs rounded-lg transition-all ${
                  active
                    ? "bg-indigo-500/15 text-indigo-300 border border-indigo-500/25"
                    : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/70"
                }`}
              >
                {item.label}
              </Link>
            );
          })}

          {/* 分隔线 */}
          {showNav && <div className="w-px h-4 bg-zinc-800 mx-1" />}

          {/* IM 与告警（通知走 IM 能力） */}
          {showNav && (
            <div className="flex items-center gap-1">
              <Link
                href="/im/settings"
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg bg-purple-500/10 hover:bg-purple-500/20 text-purple-300 border border-purple-500/30 transition-all"
                title="IM 集成与通知"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d={IM_ICON_PATH} />
                </svg>
                集成
              </Link>
              <Link
                href="/alerts"
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg border transition-all ${
                  pathname === "/alerts" || pathname.startsWith("/alerts/")
                    ? "bg-purple-500/20 text-purple-200 border-purple-400/40"
                    : "bg-purple-500/10 hover:bg-purple-500/20 text-purple-300 border-purple-500/30"
                }`}
                title="告警与通知（快速告警 + 自动规则）"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
                </svg>
                告警与通知
              </Link>
            </div>
          )}

          {/* 额外操作按钮 */}
          {actions}

          {/* 设置按钮 */}
          {showNav && (
            <Link
              href="/settings/profile"
              className="p-1.5 rounded-lg text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/70 transition-all"
              title="系统设置"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d={SETTINGS_ICON_PATH} />
                <path strokeLinecap="round" strokeLinejoin="round" d={SETTINGS_ICON_PATH_2} />
              </svg>
            </Link>
          )}

          {/* 退出按钮 */}
          {showLogout && (
            <button
              onClick={handleLogout}
              className="p-1.5 rounded-lg text-zinc-500 hover:text-rose-400 hover:bg-rose-500/10 transition-all"
              title="退出登录"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d={LOGOUT_ICON_PATH} />
              </svg>
            </button>
          )}
        </div>
        </div>
      </header>

      {showLogoutConfirm ? (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-zinc-950/70 px-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-2xl border border-zinc-700/60 bg-zinc-900/95 p-5 shadow-2xl shadow-black/50">
            <div className="mb-4 flex items-start gap-3">
              <div className="mt-0.5 rounded-xl bg-rose-500/15 p-2 text-rose-300">
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d={LOGOUT_ICON_PATH} />
                </svg>
              </div>
              <div>
                <p className="text-sm font-semibold text-zinc-100">确认退出登录？</p>
                <p className="mt-1 text-xs leading-5 text-zinc-400">退出后将返回登录页，如需继续使用请重新登录。</p>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowLogoutConfirm(false)}
                className="rounded-lg border border-zinc-700/60 bg-zinc-800/70 px-3 py-1.5 text-xs text-zinc-200 transition hover:bg-zinc-700/80"
              >
                取消
              </button>
              <button
                onClick={handleConfirmLogout}
                className="rounded-lg bg-rose-500/90 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-rose-500"
              >
                确认退出
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
