"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { CompanyInfo, CompanyProfile } from "@/lib/types";
import {
  DEFAULT_COMPANY_PROFILE,
  EMPTY_COMPANY_INFO,
  getCurrentUser,
  updateCompanySettings,
} from "@/lib/user-store";

const isCompleteCompanyInfo = (companyInfo: CompanyInfo) =>
  Object.values(companyInfo).every((value) => value.trim());

const buildFallbackSummary = (companyInfo: CompanyInfo) => {
  const parts = [companyInfo.companyName, companyInfo.industry, companyInfo.coreGoals]
    .map((item) => item.trim())
    .filter(Boolean);

  if (!parts.length) {
    return "补充公司信息后，我会基于你的业务背景生成更贴合的企业画像。";
  }

  if (parts.length === 1) {
    return `${parts[0]} 的企业画像已保存，你可以继续补充行业、目标和经营特征，获得更具体的分析建议。`;
  }

  return `${parts[0]} 当前聚焦于 ${parts.slice(1).join("，")}，后续可继续补充数据源以生成更完整的经营分析画像。`;
};

export default function ProfileSettingsPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const [returnTo, setReturnTo] = useState<string | null>(null);
  const [companyInfo, setCompanyInfo] = useState<CompanyInfo>(EMPTY_COMPANY_INFO);
  const [analysisFocuses, setAnalysisFocuses] = useState<string[]>(DEFAULT_COMPANY_PROFILE.analysisFocuses);
  const [recommendedMetrics, setRecommendedMetrics] = useState<string[]>(DEFAULT_COMPANY_PROFILE.recommendedMetrics);
  const [profileSummary, setProfileSummary] = useState(DEFAULT_COMPANY_PROFILE.summary);

  useEffect(() => {
    if (typeof window !== "undefined") {
      setReturnTo(new URLSearchParams(window.location.search).get("returnTo"));
    }

    const user = getCurrentUser();
    if (!user) {
      router.replace("/auth/login");
      return;
    }

    setCompanyInfo(user.companyInfo ?? EMPTY_COMPANY_INFO);
    setAnalysisFocuses(user.companyProfile?.analysisFocuses?.length ? user.companyProfile.analysisFocuses.slice(0, 3) : DEFAULT_COMPANY_PROFILE.analysisFocuses);
    setRecommendedMetrics(user.companyProfile?.recommendedMetrics?.length ? user.companyProfile.recommendedMetrics.slice(0, 3) : DEFAULT_COMPANY_PROFILE.recommendedMetrics);
    setProfileSummary(user.companyProfile?.summary || buildFallbackSummary(user.companyInfo ?? EMPTY_COMPANY_INFO));
    setReady(true);
  }, [router]);

  const normalizedProfile = useMemo<CompanyProfile>(() => ({
    summary: profileSummary || buildFallbackSummary(companyInfo),
    analysisFocuses: analysisFocuses.map((item) => item.trim()).filter(Boolean).slice(0, 3),
    recommendedMetrics: recommendedMetrics.map((item) => item.trim()).filter(Boolean).slice(0, 3),
  }), [analysisFocuses, companyInfo, profileSummary, recommendedMetrics]);

  const updateFocus = (index: number, value: string) => {
    setAnalysisFocuses((current) => current.map((item, idx) => (idx === index ? value : item)));
  };

  const updateMetric = (index: number, value: string) => {
    setRecommendedMetrics((current) => current.map((item, idx) => (idx === index ? value : item)));
  };

  const handleSave = async (navigateBack = false) => {
    const user = getCurrentUser();
    if (!user) {
      router.replace("/auth/login");
      return;
    }

    const normalizedCompanyInfo: CompanyInfo = {
      companyName: companyInfo.companyName.trim(),
      industry: companyInfo.industry.trim(),
      size: companyInfo.size.trim(),
      region: companyInfo.region.trim(),
      businessModel: companyInfo.businessModel.trim(),
      coreGoals: companyInfo.coreGoals.trim(),
    };

    let nextProfile: CompanyProfile = {
      ...normalizedProfile,
      summary: buildFallbackSummary(normalizedCompanyInfo),
    };

    setSaving(true);
    setSaved(false);
    setError("");

    if (isCompleteCompanyInfo(normalizedCompanyInfo)) {
      try {
        const response = await fetch("/api/company-profile", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            companyInfo: normalizedCompanyInfo,
            dataSources: user.dataSources ?? [],
          }),
        });

        if (response.ok) {
          const generatedProfile = (await response.json()) as CompanyProfile;
          nextProfile = {
            summary: generatedProfile.summary || nextProfile.summary,
            analysisFocuses: generatedProfile.analysisFocuses?.length ? generatedProfile.analysisFocuses.slice(0, 3) : nextProfile.analysisFocuses,
            recommendedMetrics: generatedProfile.recommendedMetrics?.length ? generatedProfile.recommendedMetrics.slice(0, 3) : nextProfile.recommendedMetrics,
          };
        }
      } catch {
        // ignore profile generation failure and keep fallback profile
      }
    }

    updateCompanySettings({
      companyInfo: normalizedCompanyInfo,
      companyProfile: nextProfile,
    });

    setCompanyInfo(normalizedCompanyInfo);
    setAnalysisFocuses(nextProfile.analysisFocuses);
    setRecommendedMetrics(nextProfile.recommendedMetrics);
    setProfileSummary(nextProfile.summary);
    setSaved(true);
    setSaving(false);

    if (navigateBack && returnTo) {
      router.push(returnTo);
    }
  };

  if (!ready) {
    return <div className="min-h-[60vh] rounded-3xl border border-zinc-900 bg-zinc-950/40" />;
  }

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-zinc-800 bg-zinc-900/70 p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="inline-flex items-center rounded-full border border-cyan-500/30 bg-cyan-500/10 px-3 py-1 text-xs text-cyan-300">
              企业档案
            </div>
            <h1 className="mt-4 text-3xl font-semibold tracking-tight text-zinc-100">公司信息与分析偏好</h1>
            <p className="mt-3 max-w-3xl text-sm text-zinc-400">
              这里是可持续维护的设置页。首次进入系统时可以先到这里补充业务背景，后续也能随时回来调整，不再是一次性填写。
            </p>
          </div>
          {returnTo ? (
            <button
              onClick={() => router.push(returnTo)}
              className="rounded-xl border border-zinc-700 px-4 py-2 text-sm text-zinc-300 transition hover:border-zinc-500 hover:bg-zinc-800"
            >
              返回引导页
            </button>
          ) : null}
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <div className="space-y-6">
          <section className="rounded-3xl border border-zinc-800 bg-zinc-900/70 p-6">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-medium text-zinc-100">公司信息</h2>
                <p className="mt-2 text-sm text-zinc-400">支持逐步保存，不需要一次填完。信息越完整，AI 分析越贴近你的真实场景。</p>
              </div>
            </div>

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

          <section className="rounded-3xl border border-zinc-800 bg-zinc-900/70 p-6">
            <h2 className="text-lg font-medium text-zinc-100">分析偏好</h2>
            <p className="mt-2 text-sm text-zinc-400">这些偏好会影响默认分析建议、企业画像和后续的报表方向。</p>
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
          <section className="rounded-3xl border border-cyan-500/20 bg-gradient-to-br from-cyan-500/10 to-sky-500/5 p-6">
            <h2 className="text-xl font-medium text-zinc-100">保存企业画像</h2>
            <p className="mt-3 text-sm text-zinc-300">
              当公司信息填写完整时，我会自动重新生成一份更准确的企业画像；如果暂时只填了一部分，也会先按当前内容保存，方便你之后继续完善。
            </p>
            {error ? <p className="mt-4 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">{error}</p> : null}
            {saved ? <p className="mt-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">已保存设置。</p> : null}
            <div className="mt-6 flex flex-col gap-3">
              <button
                onClick={() => void handleSave(Boolean(returnTo))}
                disabled={saving}
                className="rounded-xl bg-cyan-500 px-5 py-3 font-medium text-slate-950 transition hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {saving ? "保存中..." : returnTo ? "保存并返回引导页" : "保存设置"}
              </button>
              {returnTo ? (
                <button
                  onClick={() => void handleSave(false)}
                  disabled={saving}
                  className="rounded-xl border border-zinc-700 px-5 py-3 font-medium text-zinc-200 transition hover:border-zinc-500 hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  仅保存，暂不返回
                </button>
              ) : null}
            </div>
          </section>

          <section className="rounded-3xl border border-zinc-800 bg-zinc-900/70 p-6">
            <h2 className="text-lg font-medium text-zinc-100">当前画像预览</h2>
            <p className="mt-4 text-sm leading-7 text-zinc-300">{normalizedProfile.summary}</p>
            <div className="mt-6 grid gap-5">
              <div>
                <div className="text-xs uppercase tracking-[0.2em] text-zinc-500">重点分析方向</div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {normalizedProfile.analysisFocuses.map((item) => (
                    <span key={item} className="rounded-full border border-cyan-500/20 bg-cyan-500/10 px-3 py-1 text-xs text-cyan-200">
                      {item}
                    </span>
                  ))}
                </div>
              </div>
              <div>
                <div className="text-xs uppercase tracking-[0.2em] text-zinc-500">推荐指标</div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {normalizedProfile.recommendedMetrics.map((item) => (
                    <span key={item} className="rounded-full border border-zinc-700 bg-zinc-950 px-3 py-1 text-xs text-zinc-300">
                      {item}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}
