"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function DashboardAliasPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/dashboards");
  }, [router]);

  return <div className="min-h-screen bg-slate-900" />;
}
