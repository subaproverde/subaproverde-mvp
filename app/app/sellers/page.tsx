import AdminSellersClient from "./AdminSellersClient";

export const dynamic = "force-dynamic";

export default function AppSellersPage() {
  return (
    <div className="mx-auto max-w-6xl px-6 pb-14">
      <AdminSellersClient />
    </div>
  );
}