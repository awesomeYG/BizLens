"use client";

// 通知规则已合并到 /alerts 页面（自动规则 Tab），此页面已废弃
import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function NotificationRulesRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/alerts");
  }, [router]);

  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
      <p className="text-zinc-400">正在跳转到告警与通知页面...</p>
    </div>
  );
}
