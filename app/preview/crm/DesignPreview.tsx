"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowDownLeft, ArrowRight, ArrowUpRight, CalendarDays, Check, CheckCheck, ChevronDown, ChevronLeft, ChevronRight, Circle, Copy, CreditCard, LayoutDashboard, Menu, MessageCircle, MoreHorizontal, Plus, Search, SlidersHorizontal, Users, X } from "lucide-react";
import s from "./design.module.css";

type Palette = "sand" | "mist" | "graphite";
const palettes: { id: Palette; label: string; color: string; description: string }[] = [
  { id: "sand", label: "Areia", color: "#ad563a", description: "Fundo quente, terracota e tons naturais." },
  { id: "mist", label: "Névoa", color: "#3d5fc0", description: "Cinza suave, azul e contraste preciso." },
  { id: "graphite", label: "Grafite", color: "#dfac72", description: "Escuro acolhedor, cobre e luz moderada." },
];
const initialTasks = [
  { id: 1, initials: "LC", name: "Laura Costa", company: "Casa & Forma", title: "Retomar a proposta enviada", detail: "A cliente recebeu a proposta de remoção de 12 impactos. O próximo passo é confirmar se ficou alguma dúvida.", tag: "Follow-up", time: "Há 40 min", value: "R$ 1.200", stage: "Proposta", cta: "Ver conversa" },
  { id: 2, initials: "RM", name: "Rafael Martins", company: "Martins Autopeças", title: "Conferir o pagamento recebido", detail: "Há um comprovante recebido para conferência. Na operação real, a baixa depende da conciliação financeira.", tag: "Financeiro", time: "Há 25 min", value: "R$ 850", stage: "Serviço concluído", cta: "Ver detalhes" },
  { id: 3, initials: "BS", name: "Beatriz Santos", company: "Ateliê Essencial", title: "Dar continuidade ao atendimento", detail: "A cliente já informou que o problema é com reclamações. A próxima etapa é entender a quantidade de impactos e o histórico da conta.", tag: "Atendimento", time: "Há 10 min", value: "A definir", stage: "Qualificação", cta: "Ver conversa" },
];
type Task = typeof initialTasks[number];
const initialAppointments = [
  { id: 1, time: "09:30", name: "Diagnóstico de reputação", person: "Laura Costa", duration: "30 min", done: true },
  { id: 2, time: "14:00", name: "Análise da conta", person: "Beatriz Santos", duration: "45 min", done: false },
  { id: 3, time: "16:00", name: "Retorno sobre remoções", person: "Rafael Martins", duration: "20 min", done: false },
];
const pipeline = [ { label: "Novos", value: 8 }, { label: "Em conversa", value: 7 }, { label: "Qualificados", value: 5 }, { label: "Proposta", value: 3 }, { label: "Fechamento", value: 1 } ];

export default function DesignPreview() {
  const [palette, setPalette] = useState<Palette>("sand");
  const [editorial, setEditorial] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [menu, setMenu] = useState(false);
  const [query, setQuery] = useState("");
  const [completed, setCompleted] = useState<number[]>([]);
  const [selected, setSelected] = useState<Task | null>(null);
  const [appointments, setAppointments] = useState(initialAppointments);
  const [day, setDay] = useState(0);
  const [toast, setToast] = useState("");
  const [newAppointment, setNewAppointment] = useState(false);
  const [showDone, setShowDone] = useState(false);
  const closeButton = useRef<HTMLButtonElement>(null);
  const drawerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const frame = requestAnimationFrame(() => { try {
      const saved = JSON.parse(localStorage.getItem("spv-design-preview") || "null");
      if (saved && palettes.some((item) => item.id === saved.palette)) setPalette(saved.palette);
      if (saved) { setEditorial(saved.editorial === true); setExpanded(saved.expanded === true); }
    } catch { /* Use default appearance when storage is unavailable. */ } });
    return () => cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(""), 3500);
    return () => clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    if (!selected && !newAppointment) return;
    const previous = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeButton.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") { setSelected(null); setNewAppointment(false); }
      if (event.key !== "Tab") return;
      const controls = drawerRef.current?.querySelectorAll<HTMLElement>('button, input, select, textarea, a[href]');
      if (!controls?.length) return;
      const first = controls[0]; const last = controls[controls.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    window.addEventListener("keydown", onKey);
    return () => { window.removeEventListener("keydown", onKey); document.body.style.overflow = previousOverflow; previous?.focus(); };
  }, [selected, newAppointment]);

  function choose(next: Palette, nextEditorial = editorial, nextExpanded = expanded) {
    setPalette(next); setEditorial(nextEditorial); setExpanded(nextExpanded);
    try { localStorage.setItem("spv-design-preview", JSON.stringify({ palette: next, editorial: nextEditorial, expanded: nextExpanded })); } catch { /* Preview remains usable without persistence. */ }
  }
  function scrollTo(id: string) { document.getElementById(id)?.scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth", block: "center" }); setMenu(false); }
  function finish(id: number) { setCompleted((value) => [...value, id]); setSelected(null); setToast("Concluído apenas nesta demonstração."); }
  const openTasks = initialTasks.filter((item) => !completed.includes(item.id));
  const filtered = (showDone ? initialTasks.filter((item) => completed.includes(item.id)) : openTasks).filter((item) => `${item.name} ${item.company} ${item.title}`.toLocaleLowerCase("pt-BR").includes(query.toLocaleLowerCase("pt-BR")));
  const activePalette = palettes.find((item) => item.id === palette)!;

  return <div className={s.root} data-palette={palette} data-editorial={editorial}>
    <div className={s.previewBar}>
      <span><span className={s.previewDot} /> Estúdio de design <b>01</b><span className={s.previewLabel}> · Prévia com dados fictícios</span></span>
      <a href="/admin/crm" target="_blank" rel="noreferrer">Comparar com o atual <ArrowUpRight size={13} /></a>
    </div>
    <div className={s.workspace}>
      {menu && <button className={s.menuShade} onClick={() => setMenu(false)} aria-label="Fechar menu" />}
      <aside className={`${s.sidebar} ${menu ? s.sidebarOpen : ""}`}>
        <a className={s.brand} href="#"><span className={s.brandMark}>s<span>↗</span></span><span>suba pro verde<small>SEU ESPAÇO DE OPERAÇÃO</small></span></a>
        <div className={s.workspaceName}><span className={s.workspaceAvatar}>SP</span><span>Suba Pro Verde<small>Espaço de demonstração</small></span><ChevronDown size={14} /></div>
        <div className={s.navLabel}>PRINCIPAL</div>
        <nav aria-label="Navegação da prévia">
          <button className={s.navActive} onClick={() => scrollTo("preview-top")}><LayoutDashboard size={18} /> Visão geral</button>
          <button onClick={() => scrollTo("preview-priorities")}><MessageCircle size={18} /> Atendimento <span className={s.navBadge}>{openTasks.length}</span></button>
          <button onClick={() => { setQuery(""); scrollTo("preview-priorities"); }}><Users size={18} /> Clientes</button>
          <button onClick={() => scrollTo("preview-agenda")}><CalendarDays size={18} /> Agenda</button>
          <button onClick={() => { setExpanded(true); setTimeout(() => scrollTo("preview-pipeline"), 50); }}><SlidersHorizontal size={18} /> Funil de vendas</button>
          <button onClick={() => setSelected(initialTasks[1])}><CreditCard size={18} /> Financeiro</button>
        </nav>
        <div className={s.sidebarBottom}>
          <div className={s.assistant}><span className={s.pauseIcon}>Ⅱ</span><div>Bia está pausada<small>Status ilustrativo · sem ações reais</small></div></div>
          <div className={s.profile}><span className={s.profileAvatar}>B</span><span>Bruno<small>Seu espaço de trabalho</small></span><MoreHorizontal size={18} /></div>
        </div>
      </aside>
      <div className={s.page}>
        <header className={s.topbar}>
          <div><button className={s.mobileMenu} onClick={() => setMenu(!menu)} aria-label="Abrir menu" aria-expanded={menu}><Menu size={20} /></button><span>Seu espaço <span className={s.breadcrumbSlash}>/</span> <strong>Visão geral</strong></span></div>
          <span className={s.topNote}><Circle size={7} fill="currentColor" /> Tudo no seu tempo</span>
        </header>
        <main className={s.main} id="preview-top">
          <section className={s.headingRow}>
            <div><div className={s.eyebrow}>MENOS RUÍDO. MAIS CLAREZA.</div><h1>Seu dia, com clareza.</h1><p>As pessoas, os próximos passos e o que realmente precisa de você.</p></div>
            <button className={s.primary} onClick={() => setNewAppointment(true)}><Plus size={16} /> Novo compromisso</button>
          </section>
          <section className={s.themeStudio} aria-label="Experimente o novo visual">
            <div className={s.studioIntro}><SlidersHorizontal size={17} /><div>Encontre o seu tom<small>{activePalette.description}</small></div></div>
            <div className={s.swatches}>{palettes.map((item) => <button key={item.id} aria-pressed={palette === item.id} onClick={() => choose(item.id)}><i style={{ background: item.color }}>{palette === item.id && <Check size={11} />}</i>{item.label}</button>)}</div>
            <div className={s.typeControls}><button aria-pressed={editorial} onClick={() => choose(palette, !editorial)} title="Alternar estilo dos títulos"><span className={s.typeSymbol}>Aa</span>{editorial ? "Editorial" : "Contemporânea"}</button><button aria-pressed={expanded} onClick={() => choose(palette, editorial, !expanded)}>{expanded ? "Visão completa" : "Só o essencial"}<ChevronDown size={12} /></button></div>
          </section>
          <section className={s.metrics} aria-label="Resumo da operação">
            <div><span>Precisam de você</span><strong>{openTasks.length.toString().padStart(2, "0")}<i className={s.metricAccent} /></strong><small>Seu foco para agora</small></div>
            <div><span>Compromissos hoje</span><strong>{appointments.length.toString().padStart(2, "0")}</strong><small>{appointments.filter((item) => !item.done).length} ainda na sua agenda</small></div>
            <div><span>Leads em andamento</span><strong>24</strong><small>Ao longo do funil</small></div>
            <div><span>A receber</span><strong><em>R$</em> 6.400</strong><small>Serviços já concluídos</small></div>
          </section>
          <div className={s.columns}>
            <section className={s.priorities} id="preview-priorities">
              <div className={s.sectionTitle}><div><span className={s.smallLabel}>UM PASSO DE CADA VEZ</span><h2>O que merece sua atenção</h2></div><span className={s.count}>{openTasks.length}</span></div>
              <div className={s.taskToolbar}><div className={s.tabs}><button aria-pressed={!showDone} onClick={() => setShowDone(false)}>Pendentes</button><button aria-pressed={showDone} onClick={() => setShowDone(true)}>Concluídos {completed.length ? `(${completed.length})` : ""}</button></div><label className={s.search}><Search size={15} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar cliente" aria-label="Buscar cliente na demonstração" /></label></div>
              <div className={s.taskList}>
                {filtered.map((task) => <article className={s.taskRow} key={task.id}>
                  <div className={s.taskTop}><span className={s.avatar}>{task.initials}</span><div className={s.person}><strong>{task.name}</strong><span>{task.company}</span></div><span className={s.tag}>{task.tag}</span></div>
                  <h3>{task.title}</h3>
                  {expanded && <p className={s.taskDetail}>{task.detail}</p>}
                  <div className={s.taskFooter}><span><span className={s.tinyDot} />{task.time}</span><div>{showDone ? <button onClick={() => setCompleted((value) => value.filter((id) => id !== task.id))}>Reabrir</button> : <><button className={s.complete} onClick={() => finish(task.id)} aria-label={`Concluir tarefa de ${task.name}`}><Check size={17} /></button><button onClick={() => setSelected(task)}>{task.cta}<ArrowRight size={14} /></button></>}</div></div>
                </article>)}
                {!filtered.length && <div className={s.empty}><CheckCheck size={30} /><h3>{query ? "Nenhum cliente encontrado" : showDone ? "Suas conclusões aparecem aqui" : "Tudo em dia por aqui"}</h3><p>{query ? "Tente buscar por outro nome." : "A próxima ação fica mais fácil quando o essencial está à vista."}</p></div>}
              </div>
              <div className={s.listBottom}><CheckCheck size={15} /><span>Resolva uma coisa. Siga para a próxima.</span></div>
            </section>
            <aside className={s.rightColumn}>
              <section className={s.agenda} id="preview-agenda">
                <div className={s.sectionTitle}><h2>Sua agenda</h2><CalendarDays size={18} /></div>
                <div className={s.daySelector}><button onClick={() => setDay(0)} disabled={day === 0} aria-label="Dia anterior"><ChevronLeft size={16} /></button><span>{day === 0 ? "Hoje, quarta-feira" : "Amanhã, quinta-feira"}<small>{day === 0 ? "09 de setembro · demonstração" : "10 de setembro · demonstração"}</small></span><button onClick={() => setDay(1)} disabled={day === 1} aria-label="Próximo dia"><ChevronRight size={16} /></button></div>
                <div className={s.timeline}>{day === 0 ? appointments.map((item) => <div className={`${s.appointment} ${item.done ? s.appointmentDone : ""}`} key={item.id}><span className={s.appointmentTime}>{item.time}</span><div className={s.timelineRail}><i>{item.done && <Check size={9} />}</i></div><div><span className={s.appointmentStatus}>{item.done ? "CONCLUÍDO" : item.id === 2 ? "PRÓXIMO COMPROMISSO" : "MAIS TARDE"}</span><h3>{item.name}</h3><p>{item.person} <span>·</span> {item.duration}</p>{!item.done && <button onClick={() => setAppointments((value) => value.map((task) => task.id === item.id ? { ...task, done: true } : task))}><Check size={12} /> Marcar como feito</button>}</div></div>) : <div className={s.agendaEmpty}><CalendarDays size={24} /><p>Um dia com espaço para novas possibilidades.</p><button onClick={() => setNewAppointment(true)}>Adicionar compromisso <Plus size={13} /></button></div>}</div>
                <button className={s.fullAgenda} onClick={() => { choose(palette, editorial, true); setToast("Prévia da agenda. Experimente concluir ou criar um compromisso fictício."); }}>Explorar a agenda <ArrowUpRight size={14} /></button>
              </section>
              <section className={s.focusNote}><div><ArrowDownLeft size={19} /><span>MAIS ESPAÇO PARA PENSAR</span></div><p>Você não precisa ver tudo.<br /><strong>Só saber qual é o próximo passo.</strong></p></section>
            </aside>
          </div>
          {expanded && <section className={s.pipeline} id="preview-pipeline"><div className={s.sectionTitle}><div><span className={s.smallLabel}>VISÃO DO NEGÓCIO</span><h2>Oportunidades em movimento</h2></div><span className={s.secondary}>24 leads</span></div><div className={s.pipelineBars}>{pipeline.map((stage, index) => <div key={stage.label}><div><strong>{stage.value}</strong><span>{stage.label}</span></div><i style={{ width: `${Math.max(10, stage.value / 8 * 100)}%`, opacity: 1 - index * .13 }} /></div>)}</div></section>}
          <footer className={s.footer}><span>Uma nova direção para a Suba Pro Verde.</span><button onClick={async () => { const text = `Minha escolha para o novo CRM: ${activePalette.label}, títulos ${editorial ? "editoriais" : "contemporâneos"}, ${expanded ? "visão completa" : "só o essencial"}.`; try { await navigator.clipboard.writeText(text); setToast("Escolha copiada. Pode colar na nossa conversa."); } catch { setToast(text); } }}><Copy size={13} /> Copiar minha escolha</button></footer>
        </main>
      </div>
    </div>
    {(selected || newAppointment) && <div className={s.overlay} onClick={() => { setSelected(null); setNewAppointment(false); }}><div className={s.drawer} role="dialog" aria-modal="true" aria-labelledby="preview-dialog-title" ref={drawerRef} onClick={(event) => event.stopPropagation()}><div className={s.drawerTop}><span>DEMONSTRAÇÃO INTERATIVA</span><button ref={closeButton} onClick={() => { setSelected(null); setNewAppointment(false); }} aria-label="Fechar detalhes"><X size={20} /></button></div>
      {selected ? <><span className={s.bigAvatar}>{selected.initials}</span><h2 id="preview-dialog-title">{selected.name}</h2><p className={s.secondary}>{selected.company}</p><div className={s.drawerMeta}><div><span>Etapa</span><strong>{selected.stage}</strong></div><div><span>Valor</span><strong>{selected.value}</strong></div></div><h3>O próximo passo</h3><p>{selected.detail}</p><div className={s.demoNote}>Dados fictícios. Esta prévia não envia mensagens, não confirma pagamentos e não altera clientes.</div><button className={s.primary} onClick={() => finish(selected.id)}><Check size={16} /> Concluir esta tarefa na prévia</button></> : <><h2 id="preview-dialog-title">Abra espaço na agenda.</h2><p className={s.secondary}>Crie um compromisso fictício para experimentar.</p><form className={s.form} onSubmit={(event) => { event.preventDefault(); const data = new FormData(event.currentTarget); setAppointments((value) => [...value, { id: Date.now(), name: String(data.get("title")), person: String(data.get("person")), time: String(data.get("time")), duration: "30 min", done: false }].sort((a, b) => a.time.localeCompare(b.time))); setDay(0); setNewAppointment(false); setToast("Compromisso adicionado só na demonstração."); }}><label>Compromisso<input name="title" required maxLength={70} placeholder="Ex.: Retorno sobre a proposta" /></label><label>Cliente<input name="person" required maxLength={50} placeholder="Nome do cliente fictício" /></label><label>Horário de hoje<input name="time" type="time" required defaultValue="15:00" /></label><button className={s.primary} type="submit"><Plus size={16} /> Adicionar à prévia</button></form></>}
    </div></div>}
    <div className={s.toastRegion} role="status" aria-live="polite">{toast && <div className={s.toast}><Check size={16} />{toast}</div>}</div>
  </div>;
}
