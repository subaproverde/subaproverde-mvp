"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { isAdminEmail } from "@/lib/adminEmails";
import { applySpvTheme, readSpvTheme } from "@/lib/spvTheme";

function navLinkClass(active: boolean) {
  return [
    "px-3 py-2 rounded-xl text-sm transition",
    active ? "text-white bg-white/10" : "text-white/70 hover:bg-white/5 hover:text-white/90",
  ].join(" ");
}

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
        const r = await fetch(`/api/me/seller?userId=${encodeURIComponent(user.id)}`, {
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

  function handleConnectMl() {
    if (!currentUserId) {
      window.location.href = "/login";
      return;
    }

    const params = new URLSearchParams({ userId: currentUserId });
    if (activeSellerId && !isAdmin) params.set("sellerId", activeSellerId);
    window.location.href = `/api/ml/connect?${params.toString()}`;
  }

  return (
    <div className="min-h-screen bg-[#0a0f15] text-white">
      <header className="sticky top-0 z-50 border-b border-white/10 bg-[#0a0f15]/80 backdrop-blur">
        <div className="mx-auto max-w-7xl px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/app" className="relative w-[170px] h-[36px]">
              <Image
                src="/brand/suba-logo.png"
                alt="Suba Pro Verde"
                fill
                sizes="170px"
                className="object-contain"
                priority
              />
            </Link>

            <div className="hidden md:block leading-tight">
              <div className="text-sm font-semibold tracking-wide">
                SUBA <span className="text-white/30">|</span> RADAR SPV
              </div>
              <div className="text-xs text-white/50">Painel do seller</div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleConnectMl}
              className="inline-flex items-center gap-2 rounded-xl border border-emerald-400/20 bg-gradient-to-b from-emerald-400/20 to-emerald-900/20 px-4 py-2 text-sm font-semibold text-white/90 hover:from-emerald-400/25 hover:to-emerald-900/25"
            >
              <span className="inline-block h-2 w-2 rounded-full bg-emerald-400" />
              Acessar Mercado Livre
            </button>

            <Link
              href="/app/account"
              className="hidden sm:inline-flex items-center rounded-xl border border-white/10 px-3 py-2 text-sm text-white/80 hover:bg-white/5"
            >
              Conta
            </Link>

            <Link
              href="/logout"
              className="inline-flex items-center rounded-xl border border-white/10 px-3 py-2 text-sm text-white/80 hover:bg-white/5"
            >
              Sair
            </Link>
          </div>
        </div>

        <div className="mx-auto max-w-7xl px-6 pb-3">
          <nav className="flex items-center gap-2">
            <Link href="/app" className={navLinkClass(pathname === "/app")}>
              Resumo
            </Link>

            {isAdmin ? (
              <>
                <Link
                  href="/admin/dashboard"
                  className={navLinkClass(!!pathname?.startsWith("/admin/dashboard"))}
                >
                  Admin
                </Link>

                <Link
                  href="/admin/remocoes"
                  className={navLinkClass(!!pathname?.startsWith("/admin/remocoes"))}
                >
                  Remoções
                </Link>

                <Link
                  href="/app/sellers"
                  className={navLinkClass(!!pathname?.startsWith("/app/sellers"))}
                >
                  Sellers
                </Link>

                <Link
                  href="/app/influencers"
                  className={navLinkClass(!!pathname?.startsWith("/app/influencers"))}
                >
                  Influencers
                </Link>
              </>
            ) : null}

            <Link href="/app/cases" className={navLinkClass(!!pathname?.startsWith("/app/cases"))}>
              Cases
            </Link>

            <Link href="/app/account" className={navLinkClass(!!pathname?.startsWith("/app/account"))}>
              Conta
            </Link>

            <Link href="/app/reports" className={navLinkClass(!!pathname?.startsWith("/app/reports"))}>
              Relatórios
            </Link>

            <Link href="/app/settings" className={navLinkClass(!!pathname?.startsWith("/app/settings"))}>
              Configurações
            </Link>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-6 py-8">{children}</main>
    </div>
  );
}
