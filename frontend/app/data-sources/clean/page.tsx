"use client";

import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";

/**
 * 数据清洗已迁至 /settings/data-sources/clean，保留此路由以兼容旧链接。
 */
function LegacyCleanRedirect() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const q = searchParams.toString();
    router.replace(q ? `/settings/data-sources/clean?${q}` : "/settings/data-sources/clean");
  }, [router, searchParams]);

  return (
    <div className="flex min-h-[40vh] items-center justify-center">
      <p className="text-sm text-zinc-400">正在跳转到数据清洗...</p>
    </div>
  );
}

export default function LegacyDataCleanPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[40vh] items-center justify-center">
          <p className="text-sm text-zinc-400">加载中...</p>
        </div>
      }
    >
      <LegacyCleanRedirect />
    </Suspense>
  );
}
