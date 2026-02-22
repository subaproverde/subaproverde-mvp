"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { supabase } from "@/lib/supabase";

function navLinkClass(active: boolean) {
  return [
    "px-3 py-2 rounded-xl text-sm transition",
    active ? "text-white bg-white/10" : "text-white/70 hover:bg-white/5 hover:text-white/90",
  ].join(" ");
}

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    let alive = true;

    (async () => {
      // se não estiver logado, nem tenta
      const { data: userData } = await supabase.auth.getUser();
      if (!userData?.user) {
        if (alive) setIsAdmin(false);
        return;
      }

      // usa a função do banco (RPC) que você já tem
      const { data, error } = await supabase.rpc("is_admin");
      if (!alive) return;

      if (error) {
        // se der erro, não quebra UX — só não mostra itens admin
        setIsAdmin(false);
        return;
      }

      setIsAdmin(!!data);
    })();

    return () => {
      alive = false;
    };
  }, []);

  return (
    <div className="min-h-screen bg-[#0a0f15] text-white">
      {/* TOP BAR */}
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
            <Link href="/app" className={navLinkClass(pathname === "/app")}>
              Início
            </Link>

            {/* ✅ APENAS ADMIN */}
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

            <Link
              href="/app/account"
              className={navLinkClass(pathname?.startsWith("/app/account"))}
            >
              Conta
            </Link>

            <Link
              href="/app/reports"
              className={navLinkClass(pathname?.startsWith("/app/reports"))}
            >
              Relatórios
            </Link>

            <Link
              href="/app/settings"
              className={navLinkClass(pathname?.startsWith("/app/settings"))}
            >
              Configuração
            </Link>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-6 py-8">{children}</main>
    </div>
  );
}
