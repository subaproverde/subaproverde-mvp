"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { isAdminEmail } from "@/lib/adminEmails";
import AdminShell from "./AdminShell";

export default function AdminAuthGate({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [email, setEmail] = useState("");
  const [allowed, setAllowed] = useState(false);
  const [checking, setChecking] = useState(true);
  const isLiveDashboard = pathname?.startsWith("/admin/dashboard/live");

  useEffect(() => {
    let alive = true;

    (async () => {
      const { data, error } = await supabase.auth.getUser();
      const user = data?.user;

      if (!alive) return;

      if (error || !user) {
        router.replace(`/login?next=${encodeURIComponent(window.location.pathname + window.location.search)}`);
        return;
      }

      if (!isAdminEmail(user.email)) {
        router.replace("/app");
        return;
      }

      setEmail(user.email ?? "");
      setAllowed(true);
      setChecking(false);
    })();

    return () => {
      alive = false;
    };
  }, [router]);

  if (checking || !allowed) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-spv-page px-6 text-spv-ink">
        <div className="rounded-xl border border-spv-line bg-spv-surface p-6 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl border border-emerald-300/20 bg-emerald-400/10">
            <ShieldCheck className="h-5 w-5 text-spv-accent-text" aria-hidden="true" />
          </div>
          <div className="mt-4 text-sm font-semibold">Validando acesso admin</div>
          <div className="mt-1 text-xs text-spv-muted">Suba Pro Verde</div>
        </div>
      </div>
    );
  }

  if (isLiveDashboard) {
    return <div className="min-h-screen bg-spv-page text-spv-ink">{children}</div>;
  }

  return <AdminShell email={email}>{children}</AdminShell>;
}
