"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { CompanyInfo, CompanyProfile, DataSourceConfig } from "@/lib/types";
import { getAccessToken } from "@/lib/auth/api";
import { completeOnboarding, getCurrentUser, MOCK_DATA, saveOnboardingDraft } from "@/lib/user-store";

export default function OnboardingPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [companyInfo, setCompanyInfo] = useState<CompanyInfo>({
    companyName: "",
    industry: "",
    size: "",
    region: "",
    businessModel: "",
    coreGoals: "",
  });
  const [analysisFocuses, setAnalysisFocuses] = useState([
    "收入增长趋势",
    "客户留存与复购",
    "利润结构优化",
  ]);
  const [recommendedMetrics, setRecommendedMetrics] = useState([
    "营收",
    "毛利率",
    "复购率",
  ]);
  const [dataSources, setDataSources] = useState<DataSourceConfig[]>([]);

  useEffect(() => {
    const user = getCurrentUser();
    if (!user) {
      router.replace("/auth/login");
      return;
    }

    if (user.isOnboarded) {
      router.replace("/dashboards");
      return;
    }

    if (user.companyInfo) {
      setCompanyInfo(user.companyInfo);
    }

    if (user.companyProfile?.analysisFocuses?.length) {
      setAnalysisFocuses(user.companyProfile.analysisFocuses.slice(0, 3));
    }

    if (user.companyProfile?.recommendedMetrics?.length) {
      setRecommendedMetrics(user.companyProfile.recommendedMetrics.slice(0, 3));
    }

    setDataSources(user.dataSources ?? []);
    setReady(true);

    const syncDataSources = async () => {
      try {
        const token = getAccessToken();
        const response = await fetch(`/api/tenants/${user.id}/data-sources`, {
          headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        });

        if (!response.ok) {
          return;
        }

        const savedDataSources = (await response.json()) as DataSourceConfig[];
        const normalizedDataSources = Array.isArray(savedDataSources) ? savedDataSources : [];
        setDataSources(normalizedDataSources);
        saveOnboardingDraft({ dataSources: normalizedDataSources });
      } catch {
        // ignore data source sync failure and keep local draft
      }
    };

    void syncDataSources();
  }, [router]);

  const updateFocus = (index: number, value: string) => {
    setAnalysisFocuses((current) => current.map((item, idx) => (idx === index ? value : item)));
  };

  const updateMetric = (index: number, value: string) => {
    setRecommendedMetrics((current) => current.map((item, idx) => (idx === index ? value : item)));
  };

  const saveDraftBeforeNavigate = () => {
    saveOnboardingDraft({
      companyInfo: {
        companyName: companyInfo.companyName.trim(),
        industry: companyInfo.industry.trim(),
        size: companyInfo.size.trim(),
        region: companyInfo.region.trim(),
        businessModel: companyInfo.businessModel.trim(),
        coreGoals: companyInfo.coreGoals.trim(),
      },
      companyProfile: {
        summary: "",
        analysisFocuses: analysisFocuses.map((item) => item.trim()).filter(Boolean).slice(0, 3),
        recommendedMetrics: recommendedMetrics.map((item) => item.trim()).filter(Boolean).slice(0, 3),
      },
    });
  };

  const handleComplete = async () => {
    const currentUser = getCurrentUser();
    const normalizedCompanyInfo: CompanyInfo = {
      companyName: companyInfo.companyName.trim(),
      industry: companyInfo.industry.trim(),
      size: companyInfo.size.trim(),
      region: companyInfo.region.trim(),
      businessModel: companyInfo.businessModel.trim(),
      coreGoals: companyInfo.coreGoals.trim(),
    };
    const currentDataSources = dataSources.length ? dataSources : currentUser?.dataSources ?? [];

    if (Object.values(normalizedCompanyInfo).some((value) => !value)) {
      setError("请完整填写公司信息。");
      return;
    }

    setError("");
    setSubmitting(true);

    let companyProfile: CompanyProfile = {
      summary: `${normalizedCompanyInfo.companyName} 正在建设以 ${normalizedCompanyInfo.coreGoals} 为核心目标的数据分析体系。`,
      analysisFocuses: analysisFocuses.map((item) => item.trim()).filter(Boolean).slice(0, 3),
      recommendedMetrics: recommendedMetrics.map((item) => item.trim()).filter(Boolean).slice(0, 3),
    };

    try {
      const response = await fetch("/api/company-profile", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          companyInfo: normalizedCompanyInfo,
          dataSources: currentDataSources,
        }),
      });

      if (response.ok) {
        const profile = (await response.json()) as CompanyProfile;
        companyProfile = {
          summary: profile.summary,
          analysisFocuses: profile.analysisFocuses?.length
            ? profile.analysisFocuses.slice(0, 3)
            : companyProfile.analysisFocuses,
          recommendedMetrics: profile.recommendedMetrics?.length
            ? profile.recommendedMetrics.slice(0, 3)
            : companyProfile.recommendedMetrics,
        };
      }
    } catch {
      // ignore profile generation failure and fallback to form values
    }

    completeOnboarding(normalizedCompanyInfo, currentDataSources, companyProfile);
    router.replace("/dashboard");
  };

  if (!ready) {
    return <div className="min-h-screen bg-zinc-950" />;
  }

  return (
    <main className="min-h-screen bg-zinc-950 px-6 py-12 text-zinc-100">
      <div className="mx-auto max-w-4xl">
        <div className="mb-10">
          <div className="inline-flex items-center rounded-full border border-cyan-500/30 bg-cyan-500/10 px-3 py-1 text-xs text-cyan-300">
            首次使用引导
          </div>
          <h1 className="mt-4 text-4xl font-semibold tracking-tight">先完成初始化，再进入数据大屏</h1>
          <p className="mt-3 max-w-2xl text-zinc-400">
            公司信息和分析偏好在这里填写。数据源统一在独立的数据源页面维护，属于可选项，后续随时都能补充。
          </p>
        </div>

        <div className="grid gap-8 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="space-y-6">
            <section className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-6">
              <h2 className="text-lg font-medium">1. 公司信息</h2>
              <div className="mt-5 grid gap-4 md:grid-cols-2">
                <label className="text-sm text-zinc-300">
                  公司名称
                  <input value={companyInfo.companyName} onChange={(e) => setCompanyInfo((current) => ({ ...current, companyName: e.target.value }))} className="mt-2 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-zinc-100 outline-none transition focus:border-cyan-500" />
                </label>
                <label className="text-sm text-zinc-300">
                  所属行业
                  <input value={companyInfo.industry} onChange={(e) => setCompanyInfo((current) => ({ ...current, industry: e.target.value }))} className="mt-2 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-zinc-100 outline-none transition focus:border-cyan-500" />
                </label>
                <label className="text-sm text-zinc-300">
                  公司规模
                  <input value={companyInfo.size} onChange={(e) => setCompanyInfo((current) => ({ ...current, size: e.target.value }))} className="mt-2 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-zinc-100 outline-none transition focus:border-cyan-500" />
                </label>
                <label className="text-sm text-zinc-300">
                  区域市场
                  <input value={companyInfo.region} onChange={(e) => setCompanyInfo((current) => ({ ...current, region: e.target.value }))} className="mt-2 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-zinc-100 outline-none transition focus:border-cyan-500" />
                </label>
              </div>
              <div className="mt-4 grid gap-4">
                <label className="text-sm text-zinc-300">
                  商业模式
                  <input value={companyInfo.businessModel} onChange={(e) => setCompanyInfo((current) => ({ ...current, businessModel: e.target.value }))} className="mt-2 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-zinc-100 outline-none transition focus:border-cyan-500" />
                </label>
                <label className="text-sm text-zinc-300">
                  核心目标
                  <textarea value={companyInfo.coreGoals} onChange={(e) => setCompanyInfo((current) => ({ ...current, coreGoals: e.target.value }))} rows={3} className="mt-2 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-zinc-100 outline-none transition focus:border-cyan-500" />
                </label>
              </div>
            </section>

            <section className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-lg font-medium">2. 数据源</h2>
                  <p className="mt-2 text-sm text-zinc-400">
                    数据源统一在独立页面填写，支持连续添加多种类型；这一步不是必填，你也可以稍后再补充。
                  </p>
                </div>
                <button
                  onClick={() => {
                    saveDraftBeforeNavigate();
                    router.push("/data-sources?returnTo=/onboarding");
                  }}
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
                     还没有已保存的数据源。你可以先完成初始化，后续再到数据源页面继续补充。
                   </div>
                )}
              </div>
            </section>

            <section className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-6">
              <h2 className="text-lg font-medium">3. 分析偏好</h2>
              <div className="mt-5 grid gap-6 md:grid-cols-2">
                <div>
                  <p className="text-sm text-zinc-400">重点分析方向</p>
                  <div className="mt-3 space-y-3">
                    {analysisFocuses.map((item, index) => (
                      <input key={`focus-${index}`} value={item} onChange={(e) => updateFocus(index, e.target.value)} className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-zinc-100 outline-none transition focus:border-cyan-500" />
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-sm text-zinc-400">推荐指标</p>
                  <div className="mt-3 space-y-3">
                    {recommendedMetrics.map((item, index) => (
                      <input key={`metric-${index}`} value={item} onChange={(e) => updateMetric(index, e.target.value)} className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-zinc-100 outline-none transition focus:border-cyan-500" />
                    ))}
                  </div>
                </div>
              </div>
            </section>
          </div>

          <aside className="space-y-6">
            <section className="rounded-2xl border border-cyan-500/20 bg-gradient-to-br from-cyan-500/10 to-sky-500/5 p-6">
              <h2 className="text-xl font-medium">完成初始化</h2>
              <p className="mt-3 text-sm text-zinc-300">
                提交后我会结合你当前填写的信息生成一份初始画像，并把当前账号标记为已完成 onboarding；如果已经配置了数据源，也会一并纳入分析。
              </p>
              {error ? <p className="mt-4 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">{error}</p> : null}
              <div className="mt-6 flex flex-col gap-3">
                <button
                  onClick={() => {
                    saveDraftBeforeNavigate();
                    router.push("/data-sources?returnTo=/onboarding");
                  }}
                  className="rounded-xl border border-cyan-500/40 px-5 py-3 font-medium text-cyan-200 transition hover:border-cyan-400 hover:bg-cyan-500/10"
                >
                  现在去配置数据源
                </button>
                <button
                  onClick={handleComplete}
                  disabled={submitting}
                  className="rounded-xl bg-cyan-500 px-5 py-3 font-medium text-slate-950 transition hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {submitting ? "初始化中..." : "完成初始化并进入大屏"}
                </button>
                <button
                  onClick={() => {
                    completeOnboarding(MOCK_DATA.companyInfo, MOCK_DATA.dataSources, MOCK_DATA.companyProfile);
                    router.replace("/dashboard");
                  }}
                  className="rounded-xl border border-zinc-700 px-5 py-3 font-medium text-zinc-200 transition hover:border-zinc-500 hover:bg-zinc-800"
                >
                  使用演示数据快速体验
                </button>
              </div>
            </section>

            <section className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-6 text-sm text-zinc-400">
              <h2 className="text-lg font-medium text-zinc-100">填写建议</h2>
              <ul className="mt-4 space-y-3">
                <li>公司信息尽量写业务语言，便于后续 AI 生成更贴近场景的分析建议。</li>
                <li>数据源不是必填项，可以先完成初始化，后续再去独立页面补充。</li>
                <li>分析偏好会直接影响默认大屏和告警的方向。</li>
              </ul>
            </section>
          </aside>
        </div>
      </div>
    </main>
  );
}
