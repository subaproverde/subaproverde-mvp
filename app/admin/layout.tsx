import type { Metadata } from "next";
import AdminAuthGate from "./AdminAuthGate";

export const metadata: Metadata = {
  title: "Admin | Suba Pro Verde",
  description: "Area administrativa privada da Suba Pro Verde.",
};

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AdminAuthGate>{children}</AdminAuthGate>;
}
