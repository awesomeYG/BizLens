import AdminLayout from "@/components/admin/AdminLayout";
import AdminHeaderNav from "@/components/admin/AdminHeaderNav";

export default function AdminRootLayout({ children }: { children: React.ReactNode }) {
  return (
    <AdminLayout>
      <div className="mb-6">
        <AdminHeaderNav />
      </div>
      {children}
    </AdminLayout>
  );
}
