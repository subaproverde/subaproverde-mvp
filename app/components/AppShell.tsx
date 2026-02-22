"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

function cn(...c: Array<string | false | null | undefined>) {
  return c.filter(Boolean).join(" ");
}

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  const nav = [
  { href: "/app", label: "Influencers" },
  { href: "/app/cases", label: "Casos" },
  { href: "/app/sellers", label: "Sellers" },
];


  return (
    <div className="min-h-screen">
      {/* Fundo padrão do sistema (o mesmo estilo do /app) */}
      <div className="min-h-screen bg-[radial-gradient(1200px_600px_at_20%_10%,rgba(16,185,129,0.18),transparent_60%),radial-gradient(900px_500px_at_80%_20%,rgba(56,189,248,0.14),transparent_55%),linear-gradient(to_bottom,rgba(2,44,34,1),rgba(1,20,16,1))]">
        {/* Topbar padrão */}
        <header className="sticky top-0 z-40">
          <div className="mx-auto max-w-[1120px] px-6 lg:px-8 py-4">
            <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl shadow-[0_20px_80px_rgba(0,0,0,0.35)] px-4 py-3">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-2xl bg-white/10 border border-white/10 flex items-center justify-center font-extrabold text-white">
                    SPV
                  </div>
                  <div className="leading-tight">
                    <div className="text-[13px] font-extrabold text-white">SUBA PRO VERDE</div>
                    <div className="text-[11px] text-white/70">Seller dashboard</div>
                  </div>
                </div>

                <nav className="hidden md:flex items-center gap-2">
                  {nav.map((it) => {
                    const active = pathname === it.href;
                    return (
                      <Link
                        key={it.href}
                        href={it.href}
                        className={cn(
                          "rounded-xl px-3 py-2 text-[13px] font-semibold transition",
                          active
                            ? "bg-emerald-500/20 text-white border border-white/10"
                            : "text-white/80 hover:text-white hover:bg-white/10"
                        )}
                      >
                        {it.label}
                      </Link>
                    );
                  })}
                </nav>

                <div className="flex items-center gap-2">
                  <div className="hidden sm:flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-3 py-2">
                    <div className="h-8 w-8 rounded-xl bg-white/10 border border-white/10" />
                    <div className="leading-tight">
                      <div className="text-[12px] font-extrabold text-white">Marcela Lima</div>
                      <div className="text-[10px] text-emerald-200/90 font-semibold">Reputação • ações & sugestões</div>
                    </div>
                  </div>

                  <button className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-[12px] font-semibold text-white/85 hover:bg-white/10">
                    Logout
                  </button>
                </div>
              </div>
            </div>
          </div>
        </header>

        {/* Conteúdo */}
        <main className="mx-auto max-w-[1120px] px-6 lg:px-8 py-6">
          {children}
        </main>
      </div>
    </div>
  );
}
