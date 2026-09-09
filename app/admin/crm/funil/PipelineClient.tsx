"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { DndContext, DragEndEvent, PointerSensor, useDraggable, useDroppable, useSensor, useSensors } from "@dnd-kit/core";
import { CircleDollarSign, GripVertical, MessageCircleMore, RefreshCw, Search, Sparkles, UserRoundCheck } from "lucide-react";
import { authFetch } from "@/lib/authFetch";
import CrmSectionNav from "../components/CrmSectionNav";

type Lead = {
  id: string; contact_id: string; title: string; stage: string; status: string; score: number; estimated_value: number;
  summary: string; next_follow_up_at: string | null; updated_at: string;
  contact: null | { id: string; name: string; company_name: string; phone: string; tags: string[]; last_interaction_at: string | null };
  conversation: null | { id: string; needs_human: boolean; unread_count: number; last_message_at: string | null };
};

const stageDefinitions = [
  { id: "new", label: "Novos", color: "bg-sky-400" },
  { id: "contacted", label: "Em conversa", color: "bg-cyan-400" },
  { id: "qualified", label: "Qualificados", color: "bg-emerald-400" },
  { id: "proposal", label: "Proposta", color: "bg-violet-400" },
  { id: "negotiation", label: "Negociação", color: "bg-amber-400" },
  { id: "won", label: "Ganhos", color: "bg-green-400" },
  { id: "lost", label: "Perdidos", color: "bg-rose-400" },
];
const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

export default function PipelineClient() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [moving, setMoving] = useState("");
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try { const response = await authFetch("/api/admin/crm/leads", { cache: "no-store" }); const data = await response.json(); if (!response.ok) throw new Error(data.error || "Falha ao carregar funil."); setLeads(data.leads || []); }
    catch (failure) { setError(failure instanceof Error ? failure.message : "Falha ao carregar funil."); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const visible = useMemo(() => leads.filter((lead) => `${lead.title} ${lead.contact?.name || ""} ${lead.contact?.company_name || ""}`.toLowerCase().includes(search.toLowerCase())), [leads, search]);

  async function moveLead(leadId: string, stage: string) {
    const previous = leads;
    setMoving(leadId); setLeads((items) => items.map((item) => item.id === leadId ? { ...item, stage } : item));
    try { const response = await authFetch("/api/admin/crm/leads", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ leadId, stage }) }); if (!response.ok) throw new Error(); }
    catch { setLeads(previous); setError("Não foi possível mover a oportunidade."); }
    finally { setMoving(""); }
  }
  function onDragEnd(event: DragEndEvent) { const leadId = String(event.active.id); const target = event.over?.id ? String(event.over.id) : ""; if (target && stageDefinitions.some((item) => item.id === target)) void moveLead(leadId, target); }

  const totalValue = visible.reduce((sum, lead) => sum + Number(lead.estimated_value || 0), 0);
  const qualified = visible.filter((lead) => lead.score >= 60 || ["qualified", "proposal", "negotiation", "won"].includes(lead.stage)).length;

  return <div>
    <CrmSectionNav />
    <header className="flex min-w-0 flex-col gap-4 lg:flex-row lg:items-end lg:justify-between"><div><div className="text-xs font-semibold uppercase tracking-[0.16em] text-spv-accent-text">Pipeline comercial</div><h1 className="mt-1 text-2xl font-semibold tracking-tight text-spv-ink sm:text-3xl">Funil de vendas</h1><p className="mt-2 text-sm text-spv-muted">Deslize pelas etapas e mova cada lead pelo seletor do cartão.</p></div><div className="grid w-full grid-cols-3 gap-2 lg:w-auto"><Summary label="Oportunidades" value={String(visible.length)} /><Summary label="Qualificados" value={String(qualified)} /><Summary label="Potencial" value={money.format(totalValue)} /></div></header>
    <div className="mt-5 flex min-w-0 gap-2 sm:gap-3"><label className="relative min-w-0 max-w-lg flex-1"><Search className="absolute left-3 top-3 h-4 w-4 text-spv-muted" /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar no funil" className="h-10 w-full rounded-xl border border-spv-line bg-spv-surface pl-10 pr-3 text-sm text-spv-ink outline-none placeholder:text-spv-muted focus:border-emerald-300/30" /></label><button type="button" onClick={() => void load()} className="inline-flex h-10 shrink-0 items-center gap-2 rounded-xl border border-spv-line px-3 text-sm text-spv-muted hover:bg-spv-raised" aria-label="Atualizar funil"><RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /><span className="hidden sm:inline">Atualizar</span></button></div>
    {error ? <div className="mt-4 rounded-xl border border-rose-300/15 bg-rose-300/[0.06] px-4 py-3 text-sm text-rose-100/75">{error}</div> : null}
    <DndContext sensors={sensors} onDragEnd={onDragEnd}><div className="-mx-3 mt-5 max-w-[calc(100%+1.5rem)] overflow-x-auto overscroll-x-contain px-3 pb-4 sm:mx-0 sm:max-w-full sm:px-0"><div className="grid w-max grid-flow-col auto-cols-[min(84vw,320px)] gap-3 sm:auto-cols-[270px]">{stageDefinitions.map((stage) => <PipelineColumn key={stage.id} stage={stage} leads={visible.filter((lead) => lead.stage === stage.id)} moving={moving} onMove={moveLead} />)}</div></div></DndContext>
  </div>;
}

function PipelineColumn({ stage, leads, moving, onMove }: { stage: (typeof stageDefinitions)[number]; leads: Lead[]; moving: string; onMove: (id: string, stage: string) => Promise<void> }) {
  const { setNodeRef, isOver } = useDroppable({ id: stage.id });
  const value = leads.reduce((sum, lead) => sum + Number(lead.estimated_value || 0), 0);
  return <section ref={setNodeRef} className={`w-full rounded-xl border p-3 transition ${isOver ? "border-emerald-300/35 bg-emerald-300/[0.07]" : "border-spv-line bg-spv-surface"}`}><div className="flex items-center justify-between gap-2 px-1"><div className="flex items-center gap-2"><span className={`h-2.5 w-2.5 rounded-full ${stage.color}`} /><span className="text-xs font-semibold uppercase tracking-[0.1em] text-spv-muted">{stage.label}</span><span className="rounded-full bg-spv-surface px-1.5 py-0.5 text-[10px] text-spv-muted">{leads.length}</span></div><span className="text-[10px] text-spv-muted">{money.format(value)}</span></div><div className="mt-3 min-h-28 space-y-2.5">{leads.map((lead) => <LeadCard key={lead.id} lead={lead} moving={moving === lead.id} onMove={onMove} />)}{!leads.length ? <div className="rounded-xl border border-dashed border-spv-line px-3 py-7 text-center text-xs text-spv-muted">Solte um lead aqui</div> : null}</div></section>;
}

function LeadCard({ lead, moving, onMove }: { lead: Lead; moving: boolean; onMove: (id: string, stage: string) => Promise<void> }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: lead.id });
  const style = transform ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`, zIndex: 50 } : undefined;
  const name = lead.contact?.name || lead.contact?.company_name || lead.title || "Contato sem nome";
  return <article ref={setNodeRef} style={style} className={`rounded-xl border border-spv-line bg-spv-page p-3 shadow-lg ${isDragging ? "opacity-80 ring-2 ring-emerald-300/30" : ""}`}><div className="flex items-start gap-2"><button type="button" {...attributes} {...listeners} className="mt-0.5 hidden cursor-grab text-spv-muted active:cursor-grabbing sm:block"><GripVertical className="h-4 w-4" /></button><div className="min-w-0 flex-1"><div className="truncate text-sm font-semibold text-spv-ink">{name}</div><div className="mt-0.5 truncate text-[11px] text-spv-muted">{lead.contact?.company_name || lead.contact?.phone || lead.title}</div></div>{lead.conversation?.unread_count ? <span className="rounded-full bg-emerald-400 px-1.5 py-0.5 text-[10px] font-bold text-spv-on-accent">{lead.conversation.unread_count}</span> : null}</div>{lead.summary ? <p className="mt-2 line-clamp-2 text-xs leading-4 text-spv-muted">{lead.summary}</p> : null}<div className="mt-3 flex items-center justify-between gap-2"><div className="flex items-center gap-1 text-xs text-spv-muted"><CircleDollarSign className="h-3.5 w-3.5 text-spv-accent-text" />{money.format(Number(lead.estimated_value || 0))}</div><div className="flex items-center gap-1 text-xs font-semibold text-spv-muted"><UserRoundCheck className="h-3.5 w-3.5" />{lead.score}</div></div><div className="mt-2 h-1 overflow-hidden rounded-full bg-spv-surface"><div className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-cyan-300" style={{ width: `${lead.score}%` }} /></div><div className="mt-3 flex items-center gap-2"><select value={lead.stage} disabled={moving} onChange={(e) => void onMove(lead.id, e.target.value)} className="h-8 min-w-0 flex-1 rounded-lg border border-spv-line bg-spv-page px-2 text-[11px] text-spv-muted outline-none">{stageDefinitions.map((stage) => <option key={stage.id} value={stage.id}>{stage.label}</option>)}</select><button title="Abrir conversa" className="flex h-8 w-8 items-center justify-center rounded-lg border border-spv-line text-spv-muted hover:text-spv-accent-text"><MessageCircleMore className="h-3.5 w-3.5" /></button></div></article>;
}

function Summary({ label, value }: { label: string; value: string }) { return <div className="min-w-0 rounded-xl border border-spv-line bg-spv-surface px-2.5 py-2 sm:px-3"><div className="truncate text-[9px] uppercase tracking-[0.06em] text-spv-muted sm:text-[10px]">{label}</div><div className="mt-0.5 truncate text-xs font-semibold text-spv-ink sm:text-sm">{value}</div></div>; }
