"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Bot,
  BrainCircuit,
  CheckCheck,
  Clock3,
  Hand,
  Loader2,
  MessageCircle,
  RefreshCw,
  RotateCcw,
  Search,
  Send,
  Sparkles,
  UserRound,
} from "lucide-react";
import { authFetch } from "@/lib/authFetch";

type ConversationItem = {
  id: string;
  contact_id: string;
  status: string;
  assistant_mode: string;
  unread_count: number;
  needs_human: boolean;
  last_message_at: string | null;
  contactName: string;
  phone: string;
  leadStage: string;
  estimatedValue: number;
  latestMessage: null | { direction: string; senderType: string; messageType: string; text: string; occurredAt: string };
};

type ConversationDetail = {
  conversation: ConversationItem;
  contact: { id: string; name: string; company_name: string; phone: string; jid: string; lifecycle_stage: string; tags: string[]; notes: string };
  lead: null | { id: string; stage: string; status: string; score: number; estimated_value: number; summary: string; next_follow_up_at: string | null };
  messages: Array<{ id: string; direction: "inbound" | "outbound"; sender_type: string; message_type: string; body: string; transcription: string; media_url: string; occurred_at: string }>;
  intelligence: {
    runs: Array<{ id: string; decision: string; proposed_reply: string; reason: string; confidence: number; model: string; provider: string; rule_ids: string[]; created_at: string }>;
    suggestions: Array<{ id: string; suggestion_type: string; category: string; title: string; description: string; structured_data: Record<string, unknown>; confidence: number; evidence: string; status: string; created_at: string }>;
    facts: Array<{ id: string; fact_type: string; fact_key: string; fact_value: Record<string, unknown>; confidence: number; status: string; evidence: string; observed_at: string }>;
  };
  orders: Array<{ id: string; status: string; total_amount: number; payment_timing: string; notes: string; created_at: string }>;
  tasks: Array<{ id: string; title: string; status: string; due_at: string | null }>;
};

const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const dateTime = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

function relativeTime(value: string | null) {
  if (!value) return "sem mensagens";
  const minutes = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 60_000));
  if (minutes < 1) return "agora";
  if (minutes < 60) return `${minutes} min`;
  if (minutes < 1440) return `${Math.floor(minutes / 60)}h`;
  return new Date(value).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

function stageLabel(stage: string) {
  return ({ new: "Novo", contacted: "Em conversa", qualified: "Qualificado", proposal: "Proposta", negotiation: "Negociação", won: "Cliente", lost: "Perdido" } as Record<string, string>)[stage] || stage;
}

export default function ConversationsClient() {
  const [items, setItems] = useState<ConversationItem[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [detail, setDetail] = useState<ConversationDetail | null>(null);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"all" | "unread" | "human">("all");
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [acting, setActing] = useState("");
  const [notice, setNotice] = useState("");

  const loadList = useCallback(async () => {
    try {
      const response = await authFetch("/api/admin/crm/conversations", { cache: "no-store" });
      if (!response.ok) throw new Error();
      const data = await response.json() as { items: ConversationItem[] };
      setItems(data.items ?? []);
      setSelectedId((current) => current || data.items?.[0]?.id || "");
    } catch {
      setNotice("Não foi possível atualizar as conversas.");
    } finally {
      setLoading(false);
    }
  }, []);

  const loadDetail = useCallback(async (id: string, quiet = false) => {
    if (!id) return;
    if (!quiet) setDetailLoading(true);
    try {
      const response = await authFetch(`/api/admin/crm/conversations/${encodeURIComponent(id)}`, { cache: "no-store" });
      if (!response.ok) throw new Error();
      setDetail(await response.json() as ConversationDetail);
    } catch {
      setNotice("Não foi possível abrir esta conversa.");
    } finally {
      setDetailLoading(false);
    }
  }, []);

  useEffect(() => { void loadList(); }, [loadList]);
  useEffect(() => { if (selectedId) void loadDetail(selectedId); }, [selectedId, loadDetail]);
  useEffect(() => {
    const timer = window.setInterval(() => {
      void loadList();
      if (selectedId) void loadDetail(selectedId, true);
    }, 15_000);
    return () => window.clearInterval(timer);
  }, [loadList, loadDetail, selectedId]);

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return items.filter((item) => {
      if (filter === "unread" && !item.unread_count) return false;
      if (filter === "human" && item.assistant_mode !== "human" && !item.needs_human) return false;
      return !normalized || item.contactName.toLowerCase().includes(normalized) || item.phone.includes(normalized) || item.latestMessage?.text.toLowerCase().includes(normalized);
    });
  }, [items, query, filter]);

  const sendMessage = async () => {
    const text = message.trim();
    if (!selectedId || !text || sending) return;
    setSending(true);
    setNotice("");
    try {
      const response = await authFetch(`/api/admin/crm/conversations/${encodeURIComponent(selectedId)}/send`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text }),
      });
      const data = await response.json().catch(() => ({})) as { error?: string; status?: string };
      if (!response.ok) throw new Error(data.error || "Falha no envio.");
      setMessage("");
      setNotice(data.status === "sent" ? "Mensagem enviada pelo WhatsApp." : "Mensagem enfileirada para envio.");
      window.setTimeout(() => { void loadDetail(selectedId, true); void loadList(); }, 1_500);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "A mensagem não foi enviada.");
    } finally {
      setSending(false);
    }
  };

  const runAction = async (action: "mark_read" | "take_over" | "return_to_bia" | "follow_up") => {
    if (!selectedId || acting) return;
    setActing(action);
    setNotice("");
    try {
      const response = await authFetch(`/api/admin/crm/conversations/${encodeURIComponent(selectedId)}/action`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action }),
      });
      const data = await response.json().catch(() => ({})) as { error?: string };
      if (!response.ok) throw new Error(data.error || "Falha ao executar a ação.");
      setNotice(action === "take_over" ? "Você assumiu esta conversa." : action === "return_to_bia" ? "Conversa devolvida para a Bia." : action === "follow_up" ? "Follow-up criado para amanhã." : "Conversa marcada como lida.");
      await Promise.all([loadDetail(selectedId, true), loadList()]);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Não foi possível executar a ação.");
    } finally {
      setActing("");
    }
  };

  const currentItem = items.find((item) => item.id === selectedId);
  const latestRun = detail?.intelligence.runs[0];

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Link href="/admin/crm" className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-200/75 hover:text-emerald-100">
            <ArrowLeft className="h-3.5 w-3.5" /> Visão geral do CRM
          </Link>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-white">Conversas do WhatsApp</h1>
          <p className="mt-1 text-sm text-white/45">Atenda, assuma ou devolva conversas para a Bia sem sair do CRM.</p>
        </div>
        <button type="button" onClick={() => { void loadList(); if (selectedId) void loadDetail(selectedId); }} className="inline-flex h-10 items-center gap-2 self-start rounded-xl border border-white/10 bg-white/[0.05] px-3.5 text-sm text-white/70 hover:bg-white/[0.09]">
          <RefreshCw className="h-4 w-4" /> Atualizar
        </button>
      </div>

      {notice ? <div className="rounded-xl border border-emerald-300/14 bg-emerald-300/[0.07] px-4 py-3 text-sm text-emerald-50/80">{notice}</div> : null}

      <div className="grid min-h-[720px] overflow-hidden rounded-[24px] border border-white/10 bg-[#07100d]/90 lg:grid-cols-[330px_minmax(0,1fr)]">
        <aside className="border-b border-white/10 lg:border-b-0 lg:border-r">
          <div className="border-b border-white/10 p-3.5">
            <label className="flex h-10 items-center gap-2 rounded-xl border border-white/10 bg-black/20 px-3 text-white/45">
              <Search className="h-4 w-4" />
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar cliente ou mensagem" className="min-w-0 flex-1 bg-transparent text-sm text-white outline-none placeholder:text-white/30" />
            </label>
            <div className="mt-2.5 flex gap-1.5">
              {([['all', 'Todas'], ['unread', 'Não lidas'], ['human', 'Comigo']] as const).map(([value, label]) => (
                <button key={value} type="button" onClick={() => setFilter(value)} className={`rounded-lg px-2.5 py-1.5 text-xs font-medium ${filter === value ? "bg-emerald-300/12 text-emerald-100" : "text-white/42 hover:bg-white/[0.05]"}`}>{label}</button>
              ))}
            </div>
          </div>
          <div className="max-h-[640px] overflow-y-auto">
            {loading ? <div className="flex justify-center py-16"><Loader2 className="h-5 w-5 animate-spin text-emerald-200" /></div> : filtered.length ? filtered.map((item) => (
              <button key={item.id} type="button" onClick={() => setSelectedId(item.id)} className={`w-full border-b border-white/[0.06] p-3.5 text-left transition ${selectedId === item.id ? "bg-emerald-300/[0.08]" : "hover:bg-white/[0.035]"}`}>
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-emerald-300/20 to-cyan-300/10 text-sm font-semibold text-emerald-100">{item.contactName.slice(0, 1).toUpperCase()}</div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2"><span className="truncate text-sm font-semibold text-white/88">{item.contactName}</span><span className="shrink-0 text-[10px] text-white/28">{relativeTime(item.last_message_at)}</span></div>
                    <p className="mt-1 truncate text-xs text-white/42">{item.latestMessage?.direction === "outbound" ? "Você: " : ""}{item.latestMessage?.text || "Sem prévia"}</p>
                    <div className="mt-2 flex items-center gap-2"><span className="rounded bg-white/[0.05] px-1.5 py-0.5 text-[10px] text-white/38">{stageLabel(item.leadStage)}</span>{item.assistant_mode === "human" ? <span className="text-[10px] text-amber-200/75">com você</span> : <span className="text-[10px] text-emerald-200/55">Bia ativa</span>}</div>
                  </div>
                  {item.unread_count ? <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-emerald-400 px-1.5 text-[10px] font-bold text-[#042014]">{item.unread_count}</span> : null}
                </div>
              </button>
            )) : <div className="px-5 py-16 text-center text-sm text-white/35">Nenhuma conversa encontrada.</div>}
          </div>
        </aside>

        {!selectedId ? <div className="flex items-center justify-center p-8 text-white/35"><MessageCircle className="mr-2 h-5 w-5" /> Selecione uma conversa</div> : detailLoading && !detail ? <div className="flex items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-emerald-200" /></div> : (
          <div className="grid min-w-0 xl:grid-cols-[minmax(0,1fr)_300px]">
            <main className="flex min-w-0 flex-col border-r-0 border-white/10 xl:border-r">
              <header className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 px-4 py-3.5">
                <div className="min-w-0"><div className="truncate font-semibold text-white">{detail?.contact.name || currentItem?.contactName}</div><div className="mt-0.5 text-xs text-white/36">{detail?.contact.phone || currentItem?.phone} · {stageLabel(detail?.lead?.stage || currentItem?.leadStage || "new")}</div></div>
                <div className="flex flex-wrap gap-2">
                  <button type="button" onClick={() => void runAction("mark_read")} disabled={Boolean(acting)} className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-white/10 px-2.5 text-xs text-white/60 hover:bg-white/[0.06]"><CheckCheck className="h-3.5 w-3.5" /> Lida</button>
                  <button type="button" onClick={() => void runAction("follow_up")} disabled={Boolean(acting)} className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-white/10 px-2.5 text-xs text-white/60 hover:bg-white/[0.06]"><Clock3 className="h-3.5 w-3.5" /> Follow-up</button>
                  {detail?.conversation.assistant_mode === "human" ? (
                    <button type="button" onClick={() => void runAction("return_to_bia")} disabled={Boolean(acting)} className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-emerald-300/12 px-2.5 text-xs font-medium text-emerald-100"><RotateCcw className="h-3.5 w-3.5" /> Devolver à Bia</button>
                  ) : (
                    <button type="button" onClick={() => void runAction("take_over")} disabled={Boolean(acting)} className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-amber-300/10 px-2.5 text-xs font-medium text-amber-100"><Hand className="h-3.5 w-3.5" /> Assumir</button>
                  )}
                </div>
              </header>

              <div className="flex-1 space-y-3 overflow-y-auto bg-[radial-gradient(circle_at_50%_0%,rgba(16,185,129,0.045),transparent_38%)] p-4 sm:p-6">
                {detail?.messages.map((item) => {
                  const outbound = item.direction === "outbound";
                  const text = item.transcription || item.body || `[${item.message_type}]`;
                  return <div key={item.id} className={`flex ${outbound ? "justify-end" : "justify-start"}`}>
                    <div className={`max-w-[86%] rounded-2xl px-3.5 py-2.5 text-sm shadow-sm sm:max-w-[72%] ${outbound ? "rounded-br-md bg-emerald-500/18 text-emerald-50" : "rounded-bl-md border border-white/[0.07] bg-white/[0.055] text-white/82"}`}>
                      {item.message_type !== "text" ? <div className="mb-1 text-[10px] font-semibold uppercase tracking-[0.1em] text-white/35">{item.message_type === "audio" ? "Áudio transcrito" : item.message_type}</div> : null}
                      <p className="whitespace-pre-wrap leading-5">{text}</p>
                      <div className={`mt-1.5 flex items-center gap-1 text-[10px] ${outbound ? "justify-end text-emerald-100/42" : "text-white/28"}`}>{outbound ? (item.sender_type === "operator" ? "Bruno" : "Bia") : "Cliente"} · {dateTime.format(new Date(item.occurred_at))}</div>
                    </div>
                  </div>;
                })}
                {!detail?.messages.length ? <div className="py-20 text-center text-sm text-white/32">Ainda não há mensagens nesta conversa.</div> : null}
              </div>

              <div className="border-t border-white/10 p-3.5">
                <div className="flex items-end gap-2 rounded-2xl border border-white/10 bg-black/25 p-2">
                  <textarea value={message} onChange={(event) => setMessage(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); void sendMessage(); } }} rows={2} maxLength={4000} placeholder="Escreva para o cliente…" className="max-h-32 min-h-12 flex-1 resize-none bg-transparent px-2 py-1.5 text-sm leading-5 text-white outline-none placeholder:text-white/28" />
                  <button type="button" onClick={() => void sendMessage()} disabled={!message.trim() || sending} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-400 text-[#062417] transition hover:bg-emerald-300 disabled:opacity-35">{sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}</button>
                </div>
                <div className="mt-1.5 px-1 text-[10px] text-white/27">Enter envia · Shift + Enter quebra a linha · envio pelo mesmo WhatsApp da Suba</div>
              </div>
            </main>

            <aside className="space-y-4 p-4">
              <section className="rounded-2xl border border-emerald-300/12 bg-emerald-300/[0.045] p-4">
                <div className="flex items-center gap-2 text-sm font-semibold text-white"><BrainCircuit className="h-4 w-4 text-emerald-300" /> Inteligência desta conversa</div>
                {latestRun ? <div className="mt-3"><div className="flex items-center justify-between gap-2"><span className="rounded bg-white/[0.05] px-2 py-1 text-[10px] uppercase tracking-[0.1em] text-white/46">{latestRun.decision}</span><span className="text-sm font-semibold text-emerald-200">{Math.round(Number(latestRun.confidence) * 100)}%</span></div><p className="mt-2 text-xs leading-5 text-white/52">{latestRun.reason}</p><div className="mt-2 text-[10px] text-white/28">{latestRun.model || "regra determinística"} · {latestRun.provider}</div></div> : <p className="mt-3 text-xs leading-5 text-white/38">A IA ainda não analisou esta conversa. As mensagens abaixo são coleta bruta, não aprendizado.</p>}
              </section>

              <section className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-4">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 text-sm font-semibold text-white"><Sparkles className="h-4 w-4 text-cyan-300" /> O que a IA captou</div>
                  <Link href="/admin/crm#inteligencia" className="text-[10px] font-medium text-cyan-200/65 hover:text-cyan-100">Revisar</Link>
                </div>
                <div className="mt-3 space-y-2">
                  {detail?.intelligence.suggestions.length ? detail.intelligence.suggestions.slice(0, 8).map((item) => (
                    <div key={item.id} className="rounded-xl bg-black/20 p-2.5">
                      <div className="flex items-start justify-between gap-2"><div className="text-xs font-medium text-white/72">{item.title}</div><span className={`rounded px-1.5 py-0.5 text-[9px] ${item.status === "pending" ? "bg-amber-300/10 text-amber-100/75" : "bg-emerald-300/10 text-emerald-100/70"}`}>{item.status === "pending" ? "aguarda revisão" : item.status}</span></div>
                      <div className="mt-1 text-[11px] leading-4 text-white/40">{item.description || item.evidence || item.category}</div>
                    </div>
                  )) : detail?.intelligence.facts.length ? detail.intelligence.facts.slice(0, 8).map((fact) => (
                    <div key={fact.id} className="rounded-xl bg-black/20 p-2.5"><div className="text-xs font-medium text-white/72">{fact.fact_key}</div><div className="mt-1 text-[11px] text-white/40">{String(fact.fact_value?.valueText || fact.evidence || fact.fact_type)}</div></div>
                  )) : <div className="text-xs leading-5 text-white/34">Nenhum fato estruturado ainda. A conversa pode existir sem ter sido analisada pela Bia.</div>}
                </div>
              </section>

              <section className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-4">
                <div className="flex items-center gap-2 text-sm font-semibold text-white"><UserRound className="h-4 w-4 text-violet-300" /> Operação</div>
                <div className="mt-3 grid grid-cols-2 gap-2"><SmallStat label="Pedidos" value={String(detail?.orders.length || 0)} /><SmallStat label="Tarefas" value={String(detail?.tasks.filter((task) => task.status === "pending").length || 0)} /></div>
                {detail?.orders[0] ? <div className="mt-2.5 rounded-xl bg-black/20 p-2.5 text-xs text-white/48">Último pedido: <span className="font-semibold text-white/72">{money.format(Number(detail.orders[0].total_amount))}</span> · {detail.orders[0].status}</div> : null}
              </section>
            </aside>
          </div>
        )}
      </div>
    </div>
  );
}

function SmallStat({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl bg-black/20 p-2.5 text-center"><div className="text-[10px] uppercase tracking-[0.1em] text-white/28">{label}</div><div className="mt-1 text-lg font-semibold text-white/78">{value}</div></div>;
}
