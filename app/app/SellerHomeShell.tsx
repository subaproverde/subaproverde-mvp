"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowUpRight, BarChart3, BriefcaseBusiness, CalendarDays, BrainCircuit, CircleDollarSign, ClipboardList, KanbanSquare, MessageCircle, ChevronRight, LayoutDashboard, LogOut, Menu, Settings2, ShieldCheck, Users, X } from "lucide-react";
import s from "./seller-home.module.css";

export default function SellerHomeShell({ children, isAdmin, onConnect, mode = "seller", email }: { children: ReactNode; isAdmin: boolean; onConnect?: () => Promise<void>; mode?: "seller" | "admin"; email?: string }) {
  const pathname = usePathname();
  const [menu, setMenu] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState("");
  const menuRef = useRef<HTMLDivElement>(null);
  const menuButton = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!menu) return;
    const previous = document.body.style.overflow;
    const trigger = menuButton.current;
    document.body.style.overflow = "hidden";
    menuRef.current?.querySelector<HTMLElement>("button, a")?.focus();
    function keydown(event: KeyboardEvent) {
      if (event.key === "Escape") setMenu(false);
      if (event.key !== "Tab") return;
      const items = menuRef.current?.querySelectorAll<HTMLElement>("a, button");
      if (!items?.length) return;
      const first = items[0], last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    }
    window.addEventListener("keydown", keydown);
    return () => { document.body.style.overflow = previous; window.removeEventListener("keydown", keydown); trigger?.focus(); };
  }, [menu]);
  const sellerItems = [
    { href: "/app", label: "Resumo da conta", icon: LayoutDashboard },
    { href: "/app/cases", label: "Meus chamados", icon: BriefcaseBusiness },
    { href: "/app/reports", label: "Relatórios", icon: BarChart3 },
    { href: "/app/settings", label: "Configurações", icon: Settings2 },
  ];
  const crmItems = [
    { href: "/admin/crm", label: "Visão do CRM", icon: LayoutDashboard },
    { href: "/admin/crm/funil", label: "Funil de vendas", icon: KanbanSquare },
    { href: "/admin/crm/clientes", label: "Clientes", icon: Users },
    { href: "/admin/crm/agenda", label: "Agenda", icon: CalendarDays },
    { href: "/admin/crm/conversas", label: "Conversas", icon: MessageCircle },
    { href: "/admin/crm/financeiro", label: "Financeiro", icon: CircleDollarSign },
    { href: "/admin/crm/relatorios", label: "Relatórios do CRM", icon: BarChart3 },
    { href: "/admin/crm/gestor-ia", label: "Gestor de IA", icon: BrainCircuit },
    { href: "/admin/crm/inteligencia", label: "Inteligência", icon: BrainCircuit },
  ];
  const managementItems = [
    { href: "/admin/dashboard", label: "Administração", icon: ShieldCheck },
    { href: "/admin/relatorios/atrasos", label: "Relatório de atrasos", icon: ClipboardList },
    { href: "/app/visao-geral", label: "Visão geral", icon: LayoutDashboard },
    { href: "/admin/remocoes", label: "Remoções", icon: BriefcaseBusiness },
    { href: "/app/sellers", label: "Sellers", icon: Users },
    { href: "/app/influencers", label: "Influencers", icon: Users },
  ];
  const allItems = [...sellerItems, ...crmItems, ...managementItems];
  const current = allItems.filter(item => pathname === item.href || pathname?.startsWith(item.href + "/")).sort((a,b)=>b.href.length-a.href.length)[0];
  function links(items: typeof sellerItems) { return items.map(item => <Link key={item.href} href={item.href} className={current?.href === item.href ? s.activeNav : undefined} aria-current={current?.href === item.href ? "page" : undefined} onClick={() => setMenu(false)}><item.icon size={18} />{item.label}</Link>); }
  const navigation = <>
    {mode === "admin" && isAdmin ? <><span className={s.navLabel}>CRM COMERCIAL</span>{links(crmItems)}<details className={s.navGroup}><summary>Meu espaço</summary>{links(sellerItems)}</details></> : <><span className={s.navLabel}>MEU ESPAÇO</span>{links(sellerItems)}{isAdmin && <details className={s.navGroup}><summary>CRM comercial</summary>{links(crmItems)}</details>}</>}
    {isAdmin && <details className={s.navGroup} open={managementItems.some(item => current?.href === item.href)}><summary>Gestão da operação</summary>{links(managementItems)}</details>}
  </>;
  return <div className={`${s.root} spv-workspace`} data-workspace={mode}>
    <a href="#seller-summary" className={s.skip}>Ir para o conteúdo</a>
    <aside className={s.sidebar}>
      <Link href="/app" className={s.logo}><Image src="/brand/suba-logo.png" alt="Suba Pro Verde" width={170} height={54} priority /></Link>
      <div className={s.workspaceLabel}>RADAR SPV <span>{mode === "admin" ? "Operação e relacionamento" : "Painel de reputação"}</span></div>
      <nav className={s.nav} aria-label="Navegação principal">{navigation}</nav>
      <div className={s.sidebarFoot}><ShieldCheck size={20} /><span>Clareza para crescer.<small>Sua operação, em perspectiva.</small></span></div>
      <Link href="/logout" className={s.logout}><LogOut size={17} /> Sair da conta</Link>
    </aside>
    <div className={s.shellPage}>
      <header className={s.topbar}>
        <div className={s.breadcrumb}><button className={s.menuButton} ref={menuButton} aria-label="Abrir menu" aria-expanded={menu} onClick={() => setMenu(true)}><Menu size={21} /></button><span>{mode === "admin" ? "Operação" : "Meu espaço"}</span><ChevronRight size={13} /><strong>{current?.label ?? "Radar SPV"}</strong></div>
        {onConnect ? <button className={s.connect} disabled={connecting} onClick={async () => { setConnecting(true); setError(""); try { await onConnect(); } catch { setError("Não foi possível conectar. Tente novamente."); } finally { setConnecting(false); } }}>{connecting ? "Conectando…" : "Acessar Mercado Livre"}<ArrowUpRight size={16} /></button> : <span className={s.accountLabel}>{email || "Suba Pro Verde"}<small>Administração</small></span>}
      </header>
      {error && <p role="alert" className={s.connectionError}>{error}</p>}
      <main id="seller-summary" className={s.main}>{children}</main>
      <footer className={s.footer}><span>Suba Pro Verde · Radar SPV</span><span>Mais clareza. Menos ruído.</span></footer>
    </div>
    {menu && <div className={s.menuOverlay} onClick={() => setMenu(false)}><div ref={menuRef} role="dialog" aria-modal="true" aria-label="Menu de navegação" className={s.mobileDrawer} onClick={(e) => e.stopPropagation()}><div className={s.mobileDrawerHead}><strong>Radar SPV</strong><button aria-label="Fechar menu" onClick={() => setMenu(false)}><X size={22} /></button></div><nav className={s.nav}>{navigation}<Link href="/logout"><LogOut size={18} /> Sair da conta</Link></nav></div></div>}
  </div>;
}
