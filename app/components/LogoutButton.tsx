"use client";

import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";

export default function LogoutButton() {
  const router = useRouter();

  async function logout() {
    await supabase.auth.signOut();
    router.replace("/login");
  }

  return (
    <button onClick={logout} style={{ padding: 8, borderRadius: 8 }}>
      Sair
    </button>
  );
}
