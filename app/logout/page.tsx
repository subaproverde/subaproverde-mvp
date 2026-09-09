"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function LogoutPage() {
  const router = useRouter();

  useEffect(() => {
    (async () => {
      await supabase.auth.signOut();
      router.replace("/login");
    })();
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-spv-surface">
      <div className="rounded-xl border bg-spv-surface p-6 text-sm text-spv-muted">
        Saindo…
      </div>
    </div>
  );
}
