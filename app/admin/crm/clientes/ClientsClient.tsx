"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { CalendarPlus, ChevronDown, CircleDollarSign, Filter, MessageCircleMore, Phone, Plus, RefreshCw, Search, Sparkles, UserRound, X } from "lucide-react";
import { authFetch } from "@/lib/authFetch";
import CrmSectionNav from "../components/CrmSectionNav";

type Contact = {
  id: string; displayName: string; name: string; company_name: string; phone: string; email: string;
  lifecycle_stage: string; source: string; tags: string[]; notes: string; last_interaction_at: string | null;
  lead: null | { id: string; stage: string; status: string; score: number; estimated_value: number; summary: string; next_follow_up_at: string | null };
  conversation: null | { id: string; status: string; needs_human: boolean; unread_count: number; last_message_at: string | null };
  openTasks: number; nextTaskAt: string | null; ordersCount: number; ordersValue: number;
};

const stages: Record<string, string> = { new: "Novo", contacted: "Em conversa", qualified: "Qualificado", proposal: "Proposta", negotiation: "Negociação", won: "Cliente", lost: "Perdido" };
const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

function dateLabel(value: string | null) {
  if (!value) return "Sem data";
  return new Date(value).toLocaleString("pt-BR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

export default function ClientsClient() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [stage, setStage] = useState("all");
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const response = await authFetch("/api/admin/crm/contacts", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Falha ao carregar clientes.");
      setContacts(data.contacts || []);
    } catch (failure) { setError(failure instanceof Error ? failure.message : "Falha ao carregar clientes."); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const filtered = useMemo(() => contacts.filter((contact) => {
    const haystack = `${contact.displayName} ${contact.company_name} ${contact.phone} ${contact.email}`.toLowerCase();
    return haystack.includes(search.toLowerCase()) && (stage === "all" || contact.lead?.stage === stage);
  }), [contacts, search, stage]);

  async function createContact(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSaving(true); setError("");
    const form = new FormData(event.currentTarget);
    try {
      const response = await authFetch("/api/admin/crm/contacts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(Object.fromEntries(form.entries())) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Falha ao criar lead.");
      setShowForm(false); await load();
    } catch (failure) { setError(failure instanceof Error ? failure.message : "Falha ao criar lead."); }
    finally { setSaving(false); }
  }

  async function updateLead(leadId: string, updates: Record<string, unknown>) {
    const response = await authFetch("/api/admin/crm/leads", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ leadId, ...updates }) });
    if (response.ok) await load();
  }

  return <div>
    <CrmSectionNav />
    <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div><div className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-300/75">Relacionamento</div><h1 className="mt-1 text-3xl font-semibold tracking-tight text-white">Clientes e leads</h1><p className="mt-2 text-sm text-white/43">Cadastro, qualificação e próxima ação de cada contato.</p></div>
      <button type="button" onClick={() => setShowForm(true)} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-emerald-400 px-4 text-sm font-semibold text-[#052216] hover:bg-emerald-300"><Plus className="h-4 w-4" aria-hidden="true" /> Novo lead</button>
    </header>

    <div className="mt-5 flex flex-col gap-3 rounded-2xl border border-white/[0.08] bg-white/[0.03] p-3 sm:flex-row">
      <label className="relative flex-1"><Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-white/30" aria-hidden="true" /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar por nome, empresa ou telefone" className="h-10 w-full rounded-xl border border-white/[0.08] bg-black/20 pl-10 pr-3 text-sm text-white outline-none placeholder:text-white/25 focus:border-emerald-300/30" /></label>
      <label className="relative sm:w-52"><Filter className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-white/30" aria-hidden="true" /><select value={stage} onChange={(e) => setStage(e.target.value)} className="h-10 w-full appearance-none rounded-xl border border-white/[0.08] bg-[#0b1210] pl-10 pr-8 text-sm text-white/75 outline-none"><option value="all">Todas as etapas</option>{Object.entries(stages).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select><ChevronDown className="pointer-events-none absolute right-3 top-3 h-4 w-4 text-white/30" aria-hidden="true" /></label>
      <button type="button" onClick={() => void load()} className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-white/[0.08] px-3 text-sm text-white/60 hover:bg-white/[0.05]"><RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} aria-hidden="true" /> Atualizar</button>
    </div>

    {error ? <div className="mt-4 rounded-xl border border-rose-300/15 bg-rose-300/[0.06] px-4 py-3 text-sm text-rose-100/75">{error}</div> : null}
    <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {filtered.map((contact) => <article key={contact.id} className="rounded-[22px] border border-white/[0.09] bg-white/[0.035] p-4 transition hover:border-emerald-300/18">
        <div className="flex items-start gap-3"><div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-emerald-300/[0.09] text-sm font-bold text-emerald-200">{contact.displayName.slice(0, 2).toUpperCase()}</div><div className="min-w-0 flex-1"><div className="truncate font-semibold text-white">{contact.displayName}</div><div className="mt-0.5 truncate text-xs text-white/36">{contact.company_name || contact.phone || "Sem empresa informada"}</div></div>{contact.conversation?.needs_human ? <span className="rounded-full bg-amber-300/10 px-2 py-1 text-[10px] font-semibold text-amber-200">PRECISA DE VOCÊ</span> : null}</div>
        <div className="mt-4 grid grid-cols-[1fr_auto] gap-3 rounded-xl border border-white/[0.07] bg-black/15 p-3"><div><div className="text-[10px] uppercase tracking-[0.1em] text-white/28">Qualificação</div><div className="mt-1 flex items-center gap-2"><div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/[0.07]"><div className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-cyan-300" style={{ width: `${contact.lead?.score || 0}%` }} /></div><span className="text-sm font-semibold text-white/80">{contact.lead?.score || 0}</span></div></div><select value={contact.lead?.stage || "new"} disabled={!contact.lead} onChange={(e) => contact.lead && void updateLead(contact.lead.id, { stage: e.target.value })} className="rounded-lg border border-white/[0.08] bg-[#0b1210] px-2 text-xs text-white/65">{Object.entries(stages).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></div>
        {contact.lead?.summary ? <p className="mt-3 line-clamp-2 text-sm leading-5 text-white/48">{contact.lead.summary}</p> : <p className="mt-3 text-sm text-white/28">Ainda sem resumo comercial.</p>}
        <div className="mt-4 grid grid-cols-2 gap-2 text-xs"><Info label="Próxima ação" value={dateLabel(contact.lead?.next_follow_up_at || contact.nextTaskAt)} /><Info label="Valor potencial" value={money.format(contact.lead?.estimated_value || 0)} /></div>
        <div className="mt-4 flex flex-wrap gap-2"><Link href="/admin/crm/conversas" className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 text-xs font-medium text-white/65 hover:bg-white/[0.07]"><MessageCircleMore className="h-3.5 w-3.5" /> Conversa</Link><Link href={`/admin/crm/agenda?contactId=${contact.id}`} className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-emerald-300/13 bg-emerald-300/[0.06] px-3 text-xs font-medium text-emerald-100/75 hover:bg-emerald-300/[0.1]"><CalendarPlus className="h-3.5 w-3.5" /> Agendar</Link>{contact.phone ? <a href={`https://wa.me/${contact.phone.replace(/\D/g, "")}`} target="_blank" rel="noreferrer" className="inline-flex h-9 items-center gap-1.5 rounded-lg px-3 text-xs text-white/45 hover:text-white"><Phone className="h-3.5 w-3.5" /> WhatsApp</a> : null}</div>
      </article>)}
      {!loading && !filtered.length ? <div className="md:col-span-2 xl:col-span-3 rounded-2xl border border-dashed border-white/10 px-6 py-14 text-center"><UserRound className="mx-auto h-8 w-8 text-white/25" /><div className="mt-3 text-sm font-medium text-white/65">Nenhum contato encontrado</div><div className="mt-1 text-xs text-white/32">Ajuste os filtros ou cadastre um novo lead.</div></div> : null}
    </div>

    {showForm ? <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm" onMouseDown={() => setShowForm(false)}><form onSubmit={createContact} onMouseDown={(e) => e.stopPropagation()} className="w-full max-w-xl rounded-[24px] border border-white/12 bg-[#0a100e] p-5 shadow-2xl"><div className="flex items-start justify-between"><div><div className="flex items-center gap-2 font-semibold text-white"><Sparkles className="h-4 w-4 text-emerald-300" /> Novo lead</div><p className="mt-1 text-sm text-white/38">Comece com o básico. A conversa completará o cadastro.</p></div><button type="button" onClick={() => setShowForm(false)} className="rounded-lg p-2 text-white/40 hover:bg-white/[0.06] hover:text-white"><X className="h-4 w-4" /></button></div><div className="mt-5 grid gap-3 sm:grid-cols-2"><Field name="name" label="Nome" placeholder="Nome do contato" required /><Field name="companyName" label="Empresa / loja" placeholder="Nome da loja" /><Field name="phone" label="WhatsApp" placeholder="5511999999999" /><Field name="email" label="E-mail" placeholder="email@empresa.com" type="email" /><Field name="score" label="Nota inicial" placeholder="0 a 100" type="number" /><Field name="estimatedValue" label="Valor potencial" placeholder="0,00" type="number" /><div className="sm:col-span-2"><Field name="summary" label="Resumo" placeholder="O que esse lead precisa?" /></div></div><div className="mt-5 flex justify-end gap-2"><button type="button" onClick={() => setShowForm(false)} className="h-10 rounded-xl px-4 text-sm text-white/55 hover:bg-white/[0.05]">Cancelar</button><button disabled={saving} className="inline-flex h-10 items-center gap-2 rounded-xl bg-emerald-400 px-4 text-sm font-semibold text-[#052216] disabled:opacity-50">{saving ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Criar lead</button></div></form></div> : null}
  </div>;
}

function Info({ label, value }: { label: string; value: string }) { return <div className="rounded-lg bg-white/[0.025] p-2.5"><div className="text-[10px] uppercase tracking-[0.08em] text-white/25">{label}</div><div className="mt-1 truncate text-white/58">{value}</div></div>; }
function Field({ name, label, placeholder, type = "text", required = false }: { name: string; label: string; placeholder: string; type?: string; required?: boolean }) { return <label className="block"><span className="mb-1.5 block text-xs font-medium text-white/48">{label}</span><input name={name} type={type} required={required} placeholder={placeholder} className="h-10 w-full rounded-xl border border-white/[0.09] bg-black/20 px-3 text-sm text-white outline-none placeholder:text-white/22 focus:border-emerald-300/30" /></label>; }
