"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function MeRedirect() {
  const router = useRouter();

  useEffect(() => {
    async function run() {
      const { data } = await supabase.auth.getUser();
      const user = data.user;

      if (!user) {
        router.replace("/login");
        return;
      }

      const { data: profile, error } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single();

      if (error || !profile?.role) {
        router.replace("/login");
        return;
      }

      if (profile.role === "seller") router.replace("/seller");
      else router.replace("/app");
    }

    run();
  }, [router]);

  return <p style={{ padding: 16 }}>Redirecionando...</p>;
}
