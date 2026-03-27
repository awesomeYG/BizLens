import AdminLayout from "@/components/admin/AdminLayout";
import AdminHeaderNav from "@/components/admin/AdminHeaderNav";
import AdminStats from "@/components/admin/AdminStats";
import { Suspense } from "react";

export default function AdminDashboardPage() {
  return (
    <AdminLayout>
      <div className="mb-6">
        <AdminHeaderNav />
      </div>
      <Suspense fallback={<div className="min-h-[40vh] rounded-3xl border border-zinc-900 bg-zinc-950/40" />}>
        <AdminStats />
      </Suspense>
    </AdminLayout>
  );
}
