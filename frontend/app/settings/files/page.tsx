"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * 文件管理页面已迁移至统一数据源管理页面。
 * 此页面仅用于向后兼容，自动重定向到 /data-sources?tab=files。
 */
export default function FilesSettingsRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/data-sources?tab=files");
  }, [router]);

  return (
    <div className="flex items-center justify-center py-20">
      <p className="text-sm text-zinc-400">正在跳转到数据源管理...</p>
    </div>
  );
}
