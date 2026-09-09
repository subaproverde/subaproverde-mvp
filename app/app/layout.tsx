"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { isAdminEmail } from "@/lib/adminEmails";
import { applySpvTheme, readSpvTheme } from "@/lib/spvTheme";
import { authFetch } from "@/lib/authFetch";
import SellerHomeShell from "./SellerHomeShell";

type MeSellerResp =
  | {
      ok: true;
      userId: string;
      sellerId: string;
      sellerAccountId?: string | null;
      ml_user_id?: string | null;
      nickname?: string | null;
      source?: string;
    }
  | { ok?: false; error: string; details?: string };

export default function SellerAppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  const [isAdmin, setIsAdmin] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string>("");
  const [activeSellerId, setActiveSellerId] = useState<string | null>(null);

  useEffect(() => {
    const syncTheme = () => applySpvTheme(readSpvTheme());

    syncTheme();
    window.addEventListener("storage", syncTheme);
    window.addEventListener("spv-theme-change", syncTheme);

    return () => {
      window.removeEventListener("storage", syncTheme);
      window.removeEventListener("spv-theme-change", syncTheme);
    };
  }, []);

  useEffect(() => {
    let alive = true;

    (async () => {
      const { data: userData } = await supabase.auth.getUser();
      const user = userData?.user;

      if (!user) {
        if (!alive) return;
        setCurrentUserId("");
        setActiveSellerId(null);
        setIsAdmin(false);
        return;
      }

      if (!alive) return;
      setCurrentUserId(user.id);

      const adminByEmail = isAdminEmail(user.email);
      const { data, error } = await supabase.rpc("is_admin");
      if (!alive) return;

      if (error) {
        setIsAdmin(adminByEmail);
      } else {
        setIsAdmin(adminByEmail || !!data);
      }

      let localSellerId: string | null = null;

      try {
        localSellerId =
          typeof window !== "undefined"
            ? window.localStorage.getItem("activeSellerId")
            : null;
      } catch {
        localSellerId = null;
      }

      try {
        const r = await authFetch(`/api/me/seller?userId=${encodeURIComponent(user.id)}`, {
          cache: "no-store",
        });

        const j = (await r.json().catch(() => ({}))) as MeSellerResp;

        if (alive && r.ok && "sellerId" in j && j.sellerId) {
          const sellerId = String(j.sellerId);

          if (localSellerId !== sellerId) {
            try {
              if (typeof window !== "undefined") {
                window.localStorage.setItem("activeSellerId", sellerId);
              }
            } catch {
              // ignore
            }
          }

          setActiveSellerId(sellerId);
          return;
        }
      } catch {
        // ignore fallback abaixo
      }

      if (alive) {
        setActiveSellerId(localSellerId);
      }
    })();

    return () => {
      alive = false;
    };
  }, [pathname]);

  async function handleConnectMl() {
    if (!currentUserId) {
      window.location.href = "/login";
      return;
    }

    const params = new URLSearchParams({ json: "1" });
    if (activeSellerId && !isAdmin) params.set("sellerId", activeSellerId);

    const response = await authFetch(`/api/ml/connect?${params.toString()}`, { cache: "no-store" });
    const json = await response.json().catch(() => ({}));
    if (response.ok && json?.authUrl) {
      window.location.href = json.authUrl;
      return;
    }

    window.location.href = "/login";
  }

  return <SellerHomeShell isAdmin={isAdmin} onConnect={handleConnectMl}>{children}</SellerHomeShell>;
}
