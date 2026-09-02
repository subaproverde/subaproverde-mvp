"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BrainCircuit, CalendarDays, KanbanSquare, LayoutDashboard, MessageCircleMore, Sparkles, UsersRound } from "lucide-react";

const items = [
  { href: "/admin/crm", label: "Visão geral", icon: LayoutDashboard },
  { href: "/admin/crm/funil", label: "Funil", icon: KanbanSquare },
  { href: "/admin/crm/clientes", label: "Clientes", icon: UsersRound },
  { href: "/admin/crm/agenda", label: "Agenda", icon: CalendarDays },
  { href: "/admin/crm/conversas", label: "Conversas", icon: MessageCircleMore },
  { href: "/admin/crm/gestor-ia", label: "Gestor de IA", icon: Sparkles },
  { href: "/admin/crm/inteligencia", label: "Inteligência", icon: BrainCircuit },
];

export default function CrmSectionNav() {
  const pathname = usePathname();
  return (
    <nav className="-mx-3 mb-5 flex max-w-[calc(100%+1.5rem)] gap-2 overflow-x-auto overscroll-x-contain px-3 pb-1 sm:mx-0 sm:max-w-full sm:px-0" aria-label="Navegação do CRM">
      {items.map((item) => {
        const Icon = item.icon;
        const active = item.href === "/admin/crm" ? pathname === item.href : pathname?.startsWith(item.href);
        return <Link key={item.href} href={item.href} className={`inline-flex h-10 shrink-0 items-center gap-2 rounded-xl border px-3 text-sm font-medium transition ${active ? "border-emerald-300/22 bg-emerald-300/[0.1] text-emerald-100" : "border-white/[0.08] bg-white/[0.025] text-white/52 hover:bg-white/[0.06] hover:text-white"}`}><Icon className="h-4 w-4" aria-hidden="true" />{item.label}</Link>;
      })}
    </nav>
  );
}
