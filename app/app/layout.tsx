"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter, usePathname } from "next/navigation";
import { supabase } from "@/lib/supabase";

function navLinkClass(active: boolean) {
  return [
    "px-3 py-2 rounded-xl text-sm transition",
    active ? "text-white bg-white/10" : "text-white/70 hover:bg-white/5 hover:text-white/90",
  ].join(" ");
}

export default function SellerAppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();

  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    let alive = true;

    (async () => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData?.user) {
        if (alive) setIsAdmin(false);
        return;
      }

      const { data, error } = await supabase.rpc("is_admin");
      if (!alive) return;

      if (error) {
        setIsAdmin(false);
        return;
      }

      setIsAdmin(!!data);
    })();

    return () => {
      alive = false;
    };
  }, []);

  const activeSellerId = useMemo(() => {
    try {
      return typeof window !== "undefined" ? window.localStorage.getItem("activeSellerId") : null;
    } catch {
      return null;
    }
  }, [pathname]);

  function goHome(e: React.MouseEvent) {
    e.preventDefault();

    // ✅ Início sempre leva pro dashboard do seller ativo
    if (activeSellerId) {
      router.push(`/app/sellers/${encodeURIComponent(activeSellerId)}/dashboard`);
      return;
    }

    // sem seller ativo:
    router.push(isAdmin ? "/dashboard/sellers" : "/app");
  }

  function handleConnectMl() {
    const sid = (() => {
      try {
        return typeof window !== "undefined" ? window.localStorage.getItem("activeSellerId") : null;
      } catch {
        return null;
      }
    })();

    if (!sid) {
      window.location.href = isAdmin ? "/dashboard/sellers" : "/app";
      return;
    }

    window.location.href = `/api/ml/connect?sellerId=${encodeURIComponent(sid)}`;
  }

  return (
    <div className="min-h-screen bg-[#0a0f15] text-white">
      <header className="sticky top-0 z-50 border-b border-white/10 bg-[#0a0f15]/80 backdrop-blur">
        <div className="mx-auto max-w-7xl px-6 h-16 flex items-center justify-between">
          {/* LOGO */}
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

          {/* RIGHT */}
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

        {/* MENU */}
        <div className="mx-auto max-w-7xl px-6 pb-3">
          <nav className="flex items-center gap-2">
            <a href="#" onClick={goHome} className={navLinkClass(false)}>
              Início
            </a>

            {/* ✅ ADMIN ONLY */}
            {isAdmin ? (
              <>
                <Link
                  href="/dashboard/sellers"
                  className={navLinkClass(pathname?.startsWith("/dashboard/sellers"))}
                >
                  Sellers
                </Link>

                <Link
                  href="/dashboard/influencers"
                  className={navLinkClass(pathname?.startsWith("/dashboard/influencers"))}
                >
                  Influencers
                </Link>
              </>
            ) : null}

            <Link href="/app/account" className={navLinkClass(pathname?.startsWith("/app/account"))}>
              Conta
            </Link>

            <Link href="/app/reports" className={navLinkClass(pathname?.startsWith("/app/reports"))}>
              Relatórios
            </Link>

            <Link href="/app/settings" className={navLinkClass(pathname?.startsWith("/app/settings"))}>
              Configuração
            </Link>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-6 py-8">{children}</main>
    </div>
  );
}
