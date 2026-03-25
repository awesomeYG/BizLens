"use client";

import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";

/**
 * 数据源管理已迁至设置中心 /settings/data-sources，保留此路由以兼容旧链接。
 */
function LegacyRedirect() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const q = searchParams.toString();
    router.replace(q ? `/settings/data-sources?${q}` : "/settings/data-sources");
  }, [router, searchParams]);

  return (
    <div className="flex min-h-[40vh] items-center justify-center">
      <p className="text-sm text-zinc-400">正在跳转到数据源管理...</p>
    </div>
  );
}

export default function LegacyDataSourcesPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[40vh] items-center justify-center">
          <p className="text-sm text-zinc-400">加载中...</p>
        </div>
      }
    >
      <LegacyRedirect />
    </Suspense>
  );
}
