"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight, BarChart3, BriefcaseBusiness, ChevronRight, LayoutDashboard, LogOut, Menu, Settings2, ShieldCheck, Users, X } from "lucide-react";
import s from "./seller-home.module.css";

export default function SellerHomeShell({ children, isAdmin, onConnect }: { children: ReactNode; isAdmin: boolean; onConnect: () => Promise<void> }) {
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
  const navigation = <>
    <span className={s.navLabel}>MEU ESPAÇO</span>
    <Link href="/app" className={s.activeNav} aria-current="page" onClick={() => setMenu(false)}><LayoutDashboard size={18} /> Resumo da conta</Link>
    <Link href="/app/cases"><BriefcaseBusiness size={18} /> Meus chamados</Link>
    <Link href="/app/reports"><BarChart3 size={18} /> Relatórios</Link>
    <Link href="/app/settings"><Settings2 size={18} /> Configurações</Link>
    {isAdmin && <><span className={s.navLabel}>GESTÃO DA OPERAÇÃO</span>
      <Link href="/admin/dashboard"><ShieldCheck size={18} /> Administração</Link>
      <Link href="/app/visao-geral"><LayoutDashboard size={18} /> Visão geral</Link>
      <Link href="/admin/remocoes"><BriefcaseBusiness size={18} /> Remoções</Link>
      <Link href="/app/sellers"><Users size={18} /> Sellers</Link>
      <Link href="/app/influencers"><Users size={18} /> Influencers</Link>
    </>}
  </>;
  return <div className={s.root}>
    <a href="#seller-summary" className={s.skip}>Ir para o resumo</a>
    <aside className={s.sidebar}>
      <Link href="/app" className={s.logo}><Image src="/brand/suba-logo.png" alt="Suba Pro Verde" width={170} height={54} priority /></Link>
      <div className={s.workspaceLabel}>RADAR SPV <span>Painel de reputação</span></div>
      <nav className={s.nav} aria-label="Navegação do seller">{navigation}</nav>
      <div className={s.sidebarFoot}><ShieldCheck size={20} /><span>Clareza para crescer.<small>Sua operação, em perspectiva.</small></span></div>
      <Link href="/logout" className={s.logout}><LogOut size={17} /> Sair da conta</Link>
    </aside>
    <div className={s.shellPage}>
      <header className={s.topbar}>
        <div className={s.breadcrumb}><button className={s.menuButton} ref={menuButton} aria-label="Abrir menu" aria-expanded={menu} onClick={() => setMenu(true)}><Menu size={21} /></button><span>Meu espaço</span><ChevronRight size={13} /><strong>Resumo</strong></div>
        <button className={s.connect} disabled={connecting} onClick={async () => { setConnecting(true); setError(""); try { await onConnect(); } catch { setError("Não foi possível conectar. Tente novamente."); } finally { setConnecting(false); } }}>{connecting ? "Conectando…" : "Acessar Mercado Livre"}<ArrowUpRight size={16} /></button>
      </header>
      {error && <p role="alert" className={s.connectionError}>{error}</p>}
      <main id="seller-summary" className={s.main}>{children}</main>
      <footer className={s.footer}><span>Suba Pro Verde · Radar SPV</span><span>Mais clareza. Menos ruído.</span></footer>
    </div>
    {menu && <div className={s.menuOverlay} onClick={() => setMenu(false)}><div ref={menuRef} role="dialog" aria-modal="true" aria-label="Menu de navegação" className={s.mobileDrawer} onClick={(e) => e.stopPropagation()}><div className={s.mobileDrawerHead}><strong>Radar SPV</strong><button aria-label="Fechar menu" onClick={() => setMenu(false)}><X size={22} /></button></div><nav className={s.nav}>{navigation}<Link href="/logout"><LogOut size={18} /> Sair da conta</Link></nav></div></div>}
  </div>;
}
