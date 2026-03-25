"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { CompanyInfo, CompanyProfile, DataSourceConfig } from "@/lib/types";
import {
  DEFAULT_COMPANY_PROFILE,
  EMPTY_COMPANY_INFO,
  MOCK_DATA,
  finishOnboarding,
  getCurrentUser,
  completeOnboarding,
  saveOnboardingDraft,
} from "@/lib/user-store";
import { getAccessToken } from "@/lib/auth/api";

const hasCompanyInfo = (companyInfo: CompanyInfo) => Object.values(companyInfo).some((value) => value.trim());

export default function OnboardingPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [companyInfo, setCompanyInfo] = useState<CompanyInfo>(EMPTY_COMPANY_INFO);
  const [companyProfile, setCompanyProfile] = useState<CompanyProfile>(DEFAULT_COMPANY_PROFILE);
  const [dataSources, setDataSources] = useState<DataSourceConfig[]>([]);

  useEffect(() => {
    const user = getCurrentUser();
    if (!user) {
      router.replace("/auth/login");
      return;
    }

    if (user.isOnboarded) {
      router.replace("/chat");
      return;
    }

    const effectiveCompanyInfo = user.companyInfo ?? EMPTY_COMPANY_INFO;
    const effectiveCompanyProfile = user.companyProfile ?? DEFAULT_COMPANY_PROFILE;
    setCompanyInfo(effectiveCompanyInfo);
    setCompanyProfile(effectiveCompanyProfile);
    setDataSources(user.dataSources ?? []);

    // 将预设值立即持久化到 localStorage，避免跳转设置中心时数据丢失
    saveOnboardingDraft({ companyInfo: effectiveCompanyInfo, companyProfile: effectiveCompanyProfile });

    setReady(true);

    const syncDataSources = async () => {
      try {
        const token = getAccessToken();
        const tenantId = user.tenantId || user.id;
        const response = await fetch(`/api/tenants/${tenantId}/data-sources`, {
          headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        });

        if (!response.ok) {
          return;
        }

        const savedDataSources = (await response.json()) as DataSourceConfig[];
        setDataSources(Array.isArray(savedDataSources) ? savedDataSources : []);
      } catch {
        // ignore data source sync failure and keep local state
      }
    };

    void syncDataSources();
  }, [router]);

  const companyInfoItems = useMemo(
    () => [
      { label: "公司名称", value: companyInfo.companyName },
      { label: "所属行业", value: companyInfo.industry },
      { label: "公司规模", value: companyInfo.size },
      { label: "区域市场", value: companyInfo.region },
      { label: "商业模式", value: companyInfo.businessModel },
      { label: "核心目标", value: companyInfo.coreGoals },
    ],
    [companyInfo],
  );

  const handleComplete = async () => {
    setSubmitting(true);
    finishOnboarding();
    router.replace("/chat");
  };

  if (!ready) {
    return <div className="min-h-screen bg-slate-950" />;
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-930 to-slate-950 text-slate-100">
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_20%_20%,rgba(56,189,248,0.12),transparent_35%),radial-gradient(circle_at_80%_0%,rgba(129,140,248,0.12),transparent_30%),radial-gradient(circle_at_70%_80%,rgba(16,185,129,0.12),transparent_30%)]" />

      <div className="mx-auto flex max-w-6xl flex-col gap-8 px-6 py-12 lg:px-10">
        <header className="flex flex-col gap-4 rounded-3xl border border-white/5 bg-white/5/10 backdrop-blur-xl px-6 py-5 shadow-[0_20px_60px_-28px_rgba(0,0,0,0.6)]">
          <div className="flex flex-wrap items-center gap-3">
            <span className="inline-flex items-center gap-2 rounded-full border border-cyan-400/30 bg-cyan-500/10 px-3 py-1 text-xs text-cyan-200">
              <span className="h-1.5 w-1.5 rounded-full bg-cyan-300 animate-pulse" />
              首次使用引导
            </span>
            <span className="inline-flex items-center gap-2 rounded-full border border-slate-400/20 px-3 py-1 text-[11px] text-slate-300">
              准备就绪后随时可修改
            </span>
          </div>
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="space-y-2">
              <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">完成初始化，直接开始提问数据</h1>
              <p className="max-w-3xl text-sm text-slate-300/90 md:text-base">
                企业档案、分析偏好和数据源都可以后续在设置中心与数据源页面持续维护。先完成引导，立刻进入 AI 对话与大屏探索。
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <button
                onClick={() => router.push("/settings/profile?returnTo=/onboarding")}
                className="rounded-xl border border-cyan-400/40 bg-cyan-500/10 px-4 py-2 text-sm font-medium text-cyan-100 transition hover:border-cyan-300 hover:bg-cyan-500/20"
              >
                去设置中心补充档案
              </button>
              <button
                onClick={() => router.push("/settings/data-sources?returnTo=/onboarding")}
                className="rounded-xl border border-indigo-400/40 bg-indigo-500/10 px-4 py-2 text-sm font-medium text-indigo-100 transition hover:border-indigo-300 hover:bg-indigo-500/20"
              >
                管理数据源
              </button>
            </div>
          </div>
        </header>

        <div className="grid gap-6 lg:grid-cols-[1.4fr_0.85fr]">
          <section className="space-y-6">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-2xl border border-slate-800/80 bg-slate-900/60 p-5 shadow-inner shadow-black/30">
                <p className="text-xs uppercase tracking-[0.2em] text-slate-400">建议动作</p>
                <h3 className="mt-3 text-lg font-semibold text-white">快速完成并进入系统</h3>
                <p className="mt-2 text-sm text-slate-300/90">完成后可随时返回设置和数据源页面调整，无需一次填完。</p>
                <div className="mt-4 flex flex-col gap-3">
                  <button
                    onClick={() => void handleComplete()}
                    disabled={submitting}
                    className="rounded-xl bg-gradient-to-r from-cyan-400 to-indigo-500 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:from-cyan-300 hover:to-indigo-400 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {submitting ? "初始化中..." : "跳过并进入系统"}
                  </button>
                  <button
                    onClick={() => {
                      completeOnboarding(MOCK_DATA.companyInfo, MOCK_DATA.dataSources, MOCK_DATA.companyProfile);
                      router.replace("/chat");
                    }}
                    className="rounded-xl border border-slate-700/80 bg-slate-900/70 px-4 py-3 text-sm font-medium text-slate-100 transition hover:border-slate-500"
                  >
                    使用演示数据快速体验
                  </button>
                </div>
              </div>

              <div className="rounded-2xl border border-emerald-500/20 bg-gradient-to-br from-emerald-500/10 to-cyan-500/5 p-5 text-sm text-emerald-50 shadow-[0_10px_40px_-24px_rgba(16,185,129,0.8)]">
                <div className="flex items-center gap-2 text-emerald-100">
                  <span className="h-2 w-2 rounded-full bg-emerald-300" />
                  更贴合业务的回答
                </div>
                <p className="mt-3 text-slate-100/90">
                  补充企业档案与分析偏好后，AI 回复和报表推荐会更贴近你的行业与核心目标。
                </p>
                <button
                  onClick={() => router.push("/settings/profile?returnTo=/onboarding")}
                  className="mt-4 inline-flex items-center justify-center rounded-lg border border-emerald-400/50 bg-emerald-500/10 px-3 py-2 text-xs font-medium text-emerald-50 transition hover:border-emerald-300"
                >
                  前往企业档案
                </button>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-800/80 bg-slate-900/60 p-6 shadow-inner shadow-black/30">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-slate-500">企业档案与分析偏好</p>
                  <h3 className="mt-2 text-lg font-semibold text-white">随时可在设置中心更新</h3>
                  <p className="mt-2 text-sm text-slate-300/90">档案用于个性化回答与指标推荐，后续变更不会影响你现在的引导流。</p>
                </div>
                <button
                  onClick={() => router.push("/settings/profile?returnTo=/onboarding")}
                  className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs font-medium text-slate-100 transition hover:border-slate-500"
                >
                  去编辑
                </button>
              </div>

              <div className="mt-5 grid gap-3 md:grid-cols-2">
                {companyInfoItems.map((item) => (
                  <div key={item.label} className="rounded-xl border border-slate-800/80 bg-slate-950/60 p-4">
                    <div className="text-[11px] uppercase tracking-[0.2em] text-slate-500">{item.label}</div>
                    <div className="mt-3 text-sm text-slate-100">
                      {item.value || "未填写，可稍后在设置中心补充"}
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-5 rounded-2xl border border-slate-800/80 bg-slate-950/60 p-5">
                <div className="text-[11px] uppercase tracking-[0.2em] text-slate-500">当前分析偏好</div>
                <div className="mt-4 grid gap-5 md:grid-cols-2">
                  <div>
                    <div className="text-sm text-slate-200">重点分析方向</div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {(companyProfile.analysisFocuses?.length ? companyProfile.analysisFocuses : DEFAULT_COMPANY_PROFILE.analysisFocuses).map((item) => (
                        <span
                          key={item}
                          className="rounded-full border border-cyan-400/30 bg-cyan-500/10 px-3 py-1 text-xs text-cyan-100"
                        >
                          {item}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div>
                    <div className="text-sm text-slate-200">推荐指标</div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {(companyProfile.recommendedMetrics?.length ? companyProfile.recommendedMetrics : DEFAULT_COMPANY_PROFILE.recommendedMetrics).map((item) => (
                        <span
                          key={item}
                          className="rounded-full border border-slate-700 bg-slate-900 px-3 py-1 text-xs text-slate-200"
                        >
                          {item}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-800/80 bg-slate-900/60 p-6 shadow-inner shadow-black/30">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-slate-500">数据源</p>
                  <h3 className="mt-2 text-lg font-semibold text-white">越早接入，越快获得可用洞察</h3>
                  <p className="mt-2 text-sm text-slate-300/90">支持持续新增，未填也可先进入系统。连接后 AI 和大屏会即时利用数据。</p>
                </div>
                <button
                  onClick={() => router.push("/settings/data-sources?returnTo=/onboarding")}
                  className="rounded-lg border border-indigo-500/40 bg-indigo-500/10 px-3 py-1.5 text-xs font-medium text-indigo-100 transition hover:border-indigo-300"
                >
                  前往数据源
                </button>
              </div>

              <div className="mt-5 grid gap-3 md:grid-cols-2">
                {dataSources.length ? (
                  dataSources.map((source) => (
                    <div key={source.id} className="rounded-xl border border-slate-800/80 bg-slate-950/60 p-4">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <div className="text-sm font-medium text-white">{source.name}</div>
                          <div className="mt-1 text-[11px] uppercase tracking-wide text-indigo-200">{source.type}</div>
                        </div>
                        <span className="rounded-full border border-emerald-400/30 bg-emerald-500/10 px-2 py-1 text-[11px] text-emerald-100">
                          {source.status || "connected"}
                        </span>
                      </div>
                      {source.description ? <p className="mt-3 text-sm text-slate-300/90">{source.description}</p> : null}
                    </div>
                  ))
                ) : (
                  <div className="rounded-xl border border-dashed border-slate-700 bg-slate-950/60 p-4 text-sm text-slate-400 md:col-span-2">
                    还没有已保存的数据源。你可以先完成初始化，稍后再到独立页面补充。
                  </div>
                )}
              </div>
            </div>
          </section>

          <aside className="space-y-4 lg:space-y-5">
            <div className="rounded-2xl border border-slate-800/80 bg-slate-950/60 p-5 shadow-inner shadow-black/30">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-500">步骤进度</p>
              <div className="mt-4 space-y-4">
                {[{
                  title: "补充企业档案与偏好",
                  description: "在设置中心维护档案，驱动个性化回答与指标推荐。",
                  action: () => router.push("/settings/profile?returnTo=/onboarding"),
                  done: hasCompanyInfo(companyInfo),
                }, {
                  title: "连接数据源",
                  description: "接入数据库或文件，获得真实业务数据洞察。",
                  action: () => router.push("/settings/data-sources?returnTo=/onboarding"),
                  done: Boolean(dataSources.length),
                }, {
                  title: "进入系统体验",
                  description: "完成引导或直接跳过，开始 AI 对话与报表。",
                  action: () => void handleComplete(),
                  done: false,
                }].map((item) => (
                  <div key={item.title} className="flex items-start gap-3 rounded-xl border border-slate-800/80 bg-slate-900/60 p-4">
                    <div className={`mt-0.5 h-3 w-3 rounded-full ${item.done ? "bg-emerald-400" : "bg-slate-600"}`} />
                    <div className="space-y-1">
                      <div className="text-sm font-semibold text-white">{item.title}</div>
                      <p className="text-xs text-slate-400">{item.description}</p>
                      <button
                        onClick={item.action}
                        className="text-xs font-medium text-cyan-200 underline-offset-4 hover:text-cyan-100 hover:underline"
                      >
                        去完成
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 p-5 text-sm text-amber-50 shadow-[0_10px_40px_-24px_rgba(245,158,11,0.5)]">
              <div className="flex items-center gap-2 text-amber-100">
                <span className="h-2 w-2 rounded-full bg-amber-300" />
                小贴士
              </div>
              <ul className="mt-3 space-y-2 text-amber-50/90">
                <li>登录后所有入口都可回到设置中心与数据源页面补充资料。</li>
                <li>没有数据源也能先体验 AI，对话将使用通用建议。</li>
                <li>演示数据适合快速试用，真实效果以你接入的数据为准。</li>
              </ul>
              {!hasCompanyInfo(companyInfo) ? (
                <div className="mt-4 rounded-xl border border-amber-300/40 bg-amber-300/10 p-3 text-amber-50">
                  当前还没有填写公司信息，AI 将以通用模式回复。
                </div>
              ) : null}
            </div>
          </aside>
        </div>
      </div>
    </main>
  );
}
