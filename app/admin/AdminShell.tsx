"use client";

import { useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import {
  ArrowLeft,
  BarChart3,
  BriefcaseBusiness,
  CheckCircle2,
  MessagesSquare,
  LayoutDashboard,
  LogOut,
} from "lucide-react";
import { applySpvTheme, readSpvTheme } from "@/lib/spvTheme";

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

const navItems = [
  {
    href: "/admin/dashboard",
    label: "Dashboard",
    icon: LayoutDashboard,
  },
  {
    href: "/admin/crm",
    label: "CRM",
    icon: BriefcaseBusiness,
  },
  {
    href: "/admin/crm/conversas",
    label: "Conversas",
    icon: MessagesSquare,
  },
  {
    href: "/admin/remocoes",
    label: "Remoções",
    icon: CheckCircle2,
  },
];

export default function AdminShell({
  children,
  email,
}: {
  children: React.ReactNode;
  email: string;
}) {
  const pathname = usePathname();

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

  return (
    <div className="min-h-screen bg-[#050707] text-white">
      <div className="min-h-screen bg-[linear-gradient(180deg,rgba(8,20,16,0.96),rgba(5,7,7,1)_42%),radial-gradient(circle_at_18%_0%,rgba(0,255,136,0.10),transparent_34%),radial-gradient(circle_at_84%_10%,rgba(14,165,233,0.08),transparent_30%)]">
        <header className="sticky top-0 z-50 border-b border-white/10 bg-[#050707]/82 backdrop-blur-xl">
          <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-5 lg:px-8">
            <div className="flex min-w-0 items-center gap-3">
              <Link href="/admin/dashboard" className="relative h-10 w-[152px] shrink-0">
                <Image
                  src="/brand/suba-logo.png"
                  alt="Suba Pro Verde"
                  fill
                  sizes="152px"
                  className="object-contain"
                  priority
                />
              </Link>

              <div className="hidden min-w-0 sm:block">
                <div className="text-sm font-semibold tracking-wide text-white">
                  RADAR SPV
                </div>
                <div className="truncate text-xs text-white/50">Admin operacional</div>
              </div>
            </div>

            <nav className="hidden items-center gap-1 md:flex">
              {navItems.map((item) => {
                const Icon = item.icon;
                const active = item.href === "/admin/crm"
                  ? pathname?.startsWith(item.href) && !pathname?.startsWith("/admin/crm/conversas")
                  : pathname === item.href || pathname?.startsWith(`${item.href}/`);

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "inline-flex h-10 items-center gap-2 rounded-xl px-3 text-sm font-medium transition",
                      active
                        ? "border border-emerald-300/20 bg-emerald-400/12 text-white"
                        : "text-white/65 hover:bg-white/7 hover:text-white"
                    )}
                  >
                    <Icon className="h-4 w-4" aria-hidden="true" />
                    {item.label}
                  </Link>
                );
              })}
            </nav>

            <div className="flex items-center gap-2">
              <div className="hidden rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-right sm:block">
                <div className="text-xs font-medium text-white/80">{email}</div>
                <div className="text-[11px] text-emerald-200/75">admin</div>
              </div>

              <Link
                href="/app"
                className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-white/75 transition hover:bg-white/[0.08] hover:text-white"
                title="Voltar para o app"
                aria-label="Voltar para o app"
              >
                <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              </Link>

              <Link
                href="/logout"
                className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-white/75 transition hover:bg-white/[0.08] hover:text-white"
                title="Sair"
                aria-label="Sair"
              >
                <LogOut className="h-4 w-4" aria-hidden="true" />
              </Link>
            </div>
          </div>

          <div className="mx-auto flex max-w-7xl gap-2 overflow-x-auto px-5 pb-3 md:hidden">
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = item.href === "/admin/crm"
                ? pathname?.startsWith(item.href) && !pathname?.startsWith("/admin/crm/conversas")
                : pathname === item.href || pathname?.startsWith(`${item.href}/`);

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "inline-flex h-10 shrink-0 items-center gap-2 rounded-xl px-3 text-sm font-medium",
                    active
                      ? "border border-emerald-300/20 bg-emerald-400/12 text-white"
                      : "border border-white/10 bg-white/[0.04] text-white/65"
                  )}
                >
                  <Icon className="h-4 w-4" aria-hidden="true" />
                  {item.label}
                </Link>
              );
            })}
          </div>
        </header>

        <main className="mx-auto max-w-7xl px-5 py-6 lg:px-8 lg:py-8">
          <div className="mb-5 flex items-center gap-2 text-xs text-white/45">
            <BarChart3 className="h-4 w-4 text-emerald-200/70" aria-hidden="true" />
            {pathname?.startsWith("/admin/crm")
              ? "CRM comercial: clientes, funil, agenda e conversas em um único fluxo"
              : "Operação interna da Suba Pro Verde"}
          </div>
          {children}
        </main>
      </div>
    </div>
  );
}
