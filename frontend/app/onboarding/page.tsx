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

    setCompanyInfo(user.companyInfo ?? EMPTY_COMPANY_INFO);
    setCompanyProfile(user.companyProfile ?? DEFAULT_COMPANY_PROFILE);
    setDataSources(user.dataSources ?? []);
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
    return <div className="min-h-screen bg-zinc-950" />;
  }

  return (
    <main className="min-h-screen bg-zinc-950 px-6 py-12 text-zinc-100">
      <div className="mx-auto max-w-5xl">
        <div className="mb-10">
          <div className="inline-flex items-center rounded-full border border-cyan-500/30 bg-cyan-500/10 px-3 py-1 text-xs text-cyan-300">
            首次使用引导
          </div>
          <h1 className="mt-4 text-4xl font-semibold tracking-tight">先完成初始化，再进入数据大屏</h1>
          <p className="mt-3 max-w-3xl text-zinc-400">
            公司信息和分析偏好已经迁移到设置中心维护。你可以先快速完成初始化进入系统，随后随时去设置页修改；也可以现在就去补充。
          </p>
        </div>

        <div className="grid gap-8 lg:grid-cols-[1.15fr_0.85fr]">
          <div className="space-y-6">
            <section className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-lg font-medium">1. 企业档案与分析偏好</h2>
                  <p className="mt-2 text-sm text-zinc-400">
                    首次进入时不再在引导页里一次性填写。请前往设置中心维护，这样后续可以持续调整，不会被锁死在 onboarding 里。
                  </p>
                </div>
                <button
                  onClick={() => router.push("/settings/profile?returnTo=/onboarding")}
                  className="rounded-xl border border-cyan-500/40 px-4 py-2 text-sm font-medium text-cyan-200 transition hover:border-cyan-400 hover:bg-cyan-500/10"
                >
                  去设置中心编辑
                </button>
              </div>

              <div className="mt-5 grid gap-3 md:grid-cols-2">
                {companyInfoItems.map((item) => (
                  <div key={item.label} className="rounded-xl border border-zinc-800 bg-zinc-950/70 p-4">
                    <div className="text-xs uppercase tracking-[0.2em] text-zinc-500">{item.label}</div>
                    <div className="mt-3 text-sm text-zinc-200">{item.value || "未填写，可稍后在设置中心补充"}</div>
                  </div>
                ))}
              </div>

              <div className="mt-5 rounded-2xl border border-zinc-800 bg-zinc-950/60 p-5">
                <div className="text-xs uppercase tracking-[0.2em] text-zinc-500">当前分析偏好</div>
                <div className="mt-4 grid gap-5 md:grid-cols-2">
                  <div>
                    <div className="text-sm text-zinc-300">重点分析方向</div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {(companyProfile.analysisFocuses?.length ? companyProfile.analysisFocuses : DEFAULT_COMPANY_PROFILE.analysisFocuses).map((item) => (
                        <span key={item} className="rounded-full border border-cyan-500/20 bg-cyan-500/10 px-3 py-1 text-xs text-cyan-200">
                          {item}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div>
                    <div className="text-sm text-zinc-300">推荐指标</div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {(companyProfile.recommendedMetrics?.length ? companyProfile.recommendedMetrics : DEFAULT_COMPANY_PROFILE.recommendedMetrics).map((item) => (
                        <span key={item} className="rounded-full border border-zinc-700 bg-zinc-900 px-3 py-1 text-xs text-zinc-300">
                          {item}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </section>

            <section className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-lg font-medium">2. 数据源</h2>
                  <p className="mt-2 text-sm text-zinc-400">
                    数据源依然在独立页面统一维护，支持持续新增。它不是首登必填项，但越早接入，AI 和大屏就越快进入可用状态。
                  </p>
                </div>
                <button
                  onClick={() => router.push("/data-sources?returnTo=/onboarding")}
                  className="rounded-xl border border-cyan-500/40 px-4 py-2 text-sm font-medium text-cyan-200 transition hover:border-cyan-400 hover:bg-cyan-500/10"
                >
                  前往数据源页面
                </button>
              </div>

              <div className="mt-5 grid gap-3 md:grid-cols-2">
                {dataSources.length ? dataSources.map((source) => (
                  <div key={source.id} className="rounded-xl border border-zinc-800 bg-zinc-950/70 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="text-sm font-medium text-zinc-100">{source.name}</div>
                        <div className="mt-1 text-xs uppercase tracking-wide text-cyan-300">{source.type}</div>
                      </div>
                      <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-1 text-xs text-emerald-200">
                        {source.status || "connected"}
                      </span>
                    </div>
                    {source.description ? <p className="mt-3 text-sm text-zinc-400">{source.description}</p> : null}
                  </div>
                )) : (
                  <div className="rounded-xl border border-dashed border-zinc-700 bg-zinc-950/50 p-4 text-sm text-zinc-400 md:col-span-2">
                    还没有已保存的数据源。你可以先完成初始化，后续再去独立页面补充。
                  </div>
                )}
              </div>
            </section>
          </div>

          <aside className="space-y-6">
            <section className="rounded-2xl border border-cyan-500/20 bg-gradient-to-br from-cyan-500/10 to-sky-500/5 p-6">
              <h2 className="text-xl font-medium">完成初始化</h2>
              <p className="mt-3 text-sm text-zinc-300">
                初始化现在只负责带你确认入口，不再把企业信息锁在一次性表单里。进入系统后，你仍然可以随时去设置中心和数据源页面继续补充。
              </p>
              <div className="mt-6 flex flex-col gap-3">
                <button
                  onClick={() => router.push("/settings/profile?returnTo=/onboarding")}
                  className="rounded-xl border border-cyan-500/40 px-5 py-3 font-medium text-cyan-200 transition hover:border-cyan-400 hover:bg-cyan-500/10"
                >
                  先去补充企业档案
                </button>
                <button
                  onClick={() => router.push("/data-sources?returnTo=/onboarding")}
                  className="rounded-xl border border-cyan-500/40 px-5 py-3 font-medium text-cyan-200 transition hover:border-cyan-400 hover:bg-cyan-500/10"
                >
                  现在去配置数据源
                </button>
                <button
                  onClick={() => void handleComplete()}
                  disabled={submitting}
                  className="rounded-xl bg-cyan-500 px-5 py-3 font-medium text-slate-950 transition hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {submitting ? "初始化中..." : "跳过并进入系统"}
                </button>
                <button
                  onClick={() => {
                    completeOnboarding(MOCK_DATA.companyInfo, MOCK_DATA.dataSources, MOCK_DATA.companyProfile);
                    router.replace("/chat");
                  }}
                  className="rounded-xl border border-zinc-700 px-5 py-3 font-medium text-zinc-200 transition hover:border-zinc-500 hover:bg-zinc-800"
                >
                  使用演示数据快速体验
                </button>
              </div>
            </section>

            <section className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-6 text-sm text-zinc-400">
              <h2 className="text-lg font-medium text-zinc-100">使用建议</h2>
              <ul className="mt-4 space-y-3">
                <li>公司信息和分析偏好统一在 `设置中心 / 企业档案` 维护，后续可持续更新。</li>
                <li>数据源不是首登必填项，可以先进入系统，等拿到连接信息后再补充。</li>
                <li>如果希望 AI 一上来就给出更贴合业务的建议，建议先补充企业档案。</li>
              </ul>
            </section>

            {!hasCompanyInfo(companyInfo) ? (
              <section className="rounded-2xl border border-amber-500/20 bg-amber-500/10 p-6 text-sm text-amber-100">
                当前还没有填写公司信息。你仍然可以先进入系统，但 AI 建议会以通用模式为主。
              </section>
            ) : null}
          </aside>
        </div>
      </div>
    </main>
  );
}
