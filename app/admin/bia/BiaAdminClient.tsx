"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { Bot, CirclePlus, MessageCircleMore, RefreshCw, ShieldCheck, Sparkles } from "lucide-react";
import { authFetch } from "@/lib/authFetch";

type CaseItem = { id: string; title: string; status: string; updated_at: string };
type Message = { id: string; case_id: string; role: "operator" | "assistant" | "system"; body: string; created_at: string };
type Payload = { cases: CaseItem[]; activeCaseId: string | null; messages: Message[]; configured: boolean };

function relative(value: string) {
  const minutes = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 60_000));
  return minutes < 1 ? "agora" : minutes < 60 ? `há ${minutes} min` : minutes < 1440 ? `há ${Math.round(minutes / 60)}h` : `há ${Math.round(minutes / 1440)}d`;
}

export default function BiaAdminClient() {
  const [data, setData] = useState<Payload | null>(null);
  const [activeCaseId, setActiveCaseId] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async (caseId?: string | null, quiet = false) => {
    if (!quiet) setLoading(true);
    setError("");
    try {
      const url = caseId ? `/api/admin/bia?caseId=${encodeURIComponent(caseId)}` : "/api/admin/bia";
      const response = await authFetch(url, { cache: "no-store" });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || "Não foi possível carregar a Central da Bia.");
      setData(payload);
      setActiveCaseId(payload.activeCaseId || null);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Falha ao carregar a Central da Bia.");
    } finally {
      if (!quiet) setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const activeTitle = useMemo(() => data?.cases.find((item) => item.id === activeCaseId)?.title || "Novo atendimento", [data?.cases, activeCaseId]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    const message = text.trim();
    if (!message || sending) return;
    setSending(true);
    setError("");
    try {
      const response = await authFetch("/api/admin/bia/message", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ caseId: activeCaseId || undefined, message }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || "A Bia não conseguiu registrar sua orientação.");
      setText("");
      await load(payload.caseId, true);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Falha ao conversar com a Bia.");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <section className="rounded-2xl border border-emerald-300/16 bg-spv-surface p-5 sm:p-7">
        <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-300/20 bg-emerald-300/[0.08] px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.16em] text-spv-accent-text"><Sparkles className="h-3.5 w-3.5" /> Central da Bia</div>
            <h1 className="mt-3 text-3xl font-semibold tracking-[-0.035em] text-spv-ink sm:text-4xl">A Bia no sistema.<span className="block text-spv-accent-text">Você continua no comando.</span></h1>
            <p className="mt-3 text-sm leading-6 text-spv-muted sm:text-base">Área exclusiva da administração para abrir casos, orientar a Bia e preservar as decisões operacionais. A ação no Chrome será conectada a esta central na etapa de migração do conector.</p>
          </div>
          <div className={`flex items-center gap-3 rounded-xl border px-4 py-3 ${data?.configured ? "border-emerald-300/20 bg-emerald-300/[0.08]" : "border-amber-300/20 bg-amber-300/[0.08]"}`}>
            <ShieldCheck className={`h-5 w-5 ${data?.configured ? "text-spv-accent-text" : "text-amber-300"}`} />
            <div><div className="text-sm font-semibold text-spv-ink">{data?.configured ? "Modelo configurado" : "Configuração pendente"}</div><div className="text-xs text-spv-muted">Acesso restrito ao administrador</div></div>
          </div>
        </div>
      </section>

      {error ? <p role="alert" className="rounded-xl border border-rose-300/20 bg-rose-300/[0.08] px-4 py-3 text-sm text-rose-100">{error}</p> : null}

      <section className="grid min-h-[580px] overflow-hidden rounded-2xl border border-spv-line bg-spv-surface lg:grid-cols-[280px_minmax(0,1fr)]">
        <aside className="border-b border-spv-line p-3 lg:border-b-0 lg:border-r">
          <button type="button" onClick={() => { setActiveCaseId(null); setData((previous) => previous ? { ...previous, activeCaseId: null, messages: [] } : previous); setText(""); }} className="flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-spv-line bg-spv-raised text-sm font-semibold text-spv-ink hover:bg-spv-page"><CirclePlus className="h-4 w-4" /> Novo caso</button>
          <div className="mt-4 flex items-center justify-between px-1"><span className="text-xs font-semibold uppercase tracking-[0.14em] text-spv-muted">Casos recentes</span><button type="button" onClick={() => void load(activeCaseId, true)} className="rounded p-1 text-spv-muted hover:text-spv-ink" aria-label="Atualizar casos"><RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} /></button></div>
          <div className="mt-2 space-y-1">{(data?.cases || []).map((item) => <button key={item.id} type="button" onClick={() => void load(item.id)} className={`w-full rounded-xl px-3 py-3 text-left transition ${item.id === activeCaseId ? "bg-emerald-300/[0.1] text-spv-ink" : "text-spv-muted hover:bg-spv-raised hover:text-spv-ink"}`}><div className="line-clamp-2 text-sm font-medium">{item.title}</div><div className="mt-1 text-[11px] opacity-70">{item.status === "active" ? "Em andamento" : item.status} · {relative(item.updated_at)}</div></button>) || <p className="px-2 py-5 text-sm text-spv-muted">Ainda não há casos na central.</p>}</div>
        </aside>

        <div className="flex min-w-0 flex-col">
          <header className="flex items-center gap-3 border-b border-spv-line px-5 py-4"><div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-300/[0.1] text-spv-accent-text"><Bot className="h-4 w-4" /></div><div className="min-w-0"><div className="truncate text-sm font-semibold text-spv-ink">{activeTitle}</div><div className="text-xs text-spv-muted">Memória e orientações registradas neste caso</div></div></header>
          <div className="min-h-[370px] flex-1 space-y-4 overflow-y-auto p-5">{loading ? <p className="text-sm text-spv-muted">Carregando a Bia…</p> : (data?.messages || []).length ? data?.messages.map((message) => <article key={message.id} className={`max-w-[88%] rounded-2xl px-4 py-3 text-sm leading-6 ${message.role === "operator" ? "ml-auto bg-emerald-400 text-spv-on-accent" : "border border-spv-line bg-spv-raised text-spv-ink"}`}><div className="mb-1 text-[10px] font-semibold uppercase tracking-[0.12em] opacity-70">{message.role === "operator" ? "Você" : "Bia"}</div><p className="whitespace-pre-wrap">{message.body}</p></article>) : <div className="flex h-full min-h-[280px] flex-col items-center justify-center text-center"><MessageCircleMore className="h-8 w-8 text-spv-muted" /><p className="mt-3 text-sm font-medium text-spv-ink">Comece um novo atendimento</p><p className="mt-1 max-w-sm text-sm text-spv-muted">Diga à Bia o que precisa; suas orientações ficam ligadas ao caso.</p></div>}</div>
          <form onSubmit={submit} className="border-t border-spv-line p-4"><label className="sr-only" htmlFor="bia-message">Mensagem para a Bia</label><textarea id="bia-message" value={text} onChange={(event) => setText(event.target.value)} placeholder="Ex.: Bia, preciso abrir um atendimento para tratar atrasos da conta Junior." rows={3} className="w-full resize-none rounded-xl border border-spv-line bg-spv-page px-3 py-2.5 text-sm text-spv-ink outline-none placeholder:text-spv-muted focus:border-emerald-300/40" /><div className="mt-3 flex justify-end"><button type="submit" disabled={!text.trim() || sending} className="inline-flex h-10 items-center gap-2 rounded-xl bg-emerald-400 px-4 text-sm font-semibold text-spv-on-accent transition hover:bg-emerald-300 disabled:cursor-not-allowed disabled:opacity-50"><Sparkles className="h-4 w-4" />{sending ? "Bia está registrando…" : "Enviar para a Bia"}</button></div></form>
        </div>
      </section>
    </div>
  );
}
