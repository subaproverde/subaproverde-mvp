"use client";

import { useCallback, useEffect, useState } from "react";
import { BrainCircuit, Check, CircleDollarSign, Eye, Lightbulb, RefreshCw, ShieldCheck, Sparkles, X } from "lucide-react";
import { authFetch } from "@/lib/authFetch";
import type { CrmOverview } from "@/lib/crm/types";
import CrmSectionNav from "../components/CrmSectionNav";

export default function IntelligenceClient() {
  const [overview, setOverview] = useState<CrmOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [reviewing, setReviewing] = useState("");
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try { const response = await authFetch("/api/admin/crm/overview", { cache: "no-store" }); const data = await response.json(); if (!response.ok) throw new Error(data.error || "Falha ao carregar inteligência."); setOverview(data); }
    catch (failure) { setError(failure instanceof Error ? failure.message : "Falha ao carregar inteligência."); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  async function review(suggestionId: string, action: "approve" | "reject") {
    setReviewing(suggestionId); setError("");
    try { const response = await authFetch("/api/admin/crm/intelligence/review", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ suggestionId, action }) }); const data = await response.json().catch(() => ({})); if (!response.ok) throw new Error(data.error || "Falha ao revisar sugestão."); await load(); }
    catch (failure) { setError(failure instanceof Error ? failure.message : "Falha ao revisar sugestão."); }
    finally { setReviewing(""); }
  }

  const intelligence = overview?.intelligence;
  return <div>
    <CrmSectionNav />
    <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between"><div><div className="text-xs font-semibold uppercase tracking-[0.16em] text-violet-300/75">Bastidores auditáveis</div><h1 className="mt-1 text-3xl font-semibold tracking-tight text-white">Inteligência e memórias</h1><p className="mt-2 max-w-2xl text-sm text-white/43">Aqui você confere o que a Bia entendeu, a evidência usada e o que será transformado em dado do CRM.</p></div><button type="button" onClick={() => void load()} className="inline-flex h-10 items-center gap-2 rounded-xl border border-white/[0.08] px-3 text-sm text-white/58 hover:bg-white/[0.05]"><RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /> Atualizar</button></header>
    <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><Metric icon={BrainCircuit} label="Análises hoje" value={String(intelligence?.runsToday || 0)} /><Metric icon={Lightbulb} label="Aguardando revisão" value={String(intelligence?.pendingSuggestions || 0)} /><Metric icon={ShieldCheck} label="Confiança média" value={`${Math.round((intelligence?.averageConfidence || 0) * 100)}%`} /><Metric icon={CircleDollarSign} label="Custo hoje" value={`US$ ${(intelligence?.totalCostUsdToday || 0).toFixed(3)}`} /></div>
    {error ? <div className="mt-4 rounded-xl border border-rose-300/15 bg-rose-300/[0.06] px-4 py-3 text-sm text-rose-100/75">{error}</div> : null}
    <section className="mt-5 rounded-[24px] border border-violet-300/12 bg-violet-300/[0.025] p-5"><div className="flex items-start gap-3"><div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-300/[0.08] text-violet-200"><Sparkles className="h-4.5 w-4.5" /></div><div><div className="text-sm font-semibold text-white/82">A IA não é o CRM</div><p className="mt-1 text-sm leading-6 text-white/42">Ela apenas observa as conversas e propõe atualizações. Clientes, funil, agenda, pedidos e financeiro continuam sendo os registros oficiais e controláveis por você.</p></div></div></section>
    <div className="mt-5 grid gap-4 xl:grid-cols-2">{intelligence?.suggestions?.map((suggestion) => <article key={suggestion.id} className="rounded-[22px] border border-white/[0.09] bg-white/[0.035] p-4"><div className="flex items-start justify-between gap-3"><div><div className="flex flex-wrap items-center gap-2"><span className="font-semibold text-white">{suggestion.contactName}</span><span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.1em] ${suggestion.type === "fact" ? "bg-cyan-300/10 text-cyan-200" : "bg-violet-300/10 text-violet-200"}`}>{suggestion.type === "fact" ? "Memória" : "Ação"}</span>{suggestion.status !== "pending" ? <span className="rounded-full bg-white/[0.06] px-2 py-0.5 text-[10px] uppercase text-white/38">{suggestion.status === "applied" ? "Aplicado" : suggestion.status === "rejected" ? "Rejeitado" : suggestion.status}</span> : null}</div><h2 className="mt-2 text-sm font-semibold text-white/82">{suggestion.title}</h2></div><div className="text-right"><div className="text-lg font-semibold text-emerald-200">{Math.round(suggestion.confidence * 100)}%</div><div className="text-[9px] uppercase tracking-[0.1em] text-white/25">confiança</div></div></div>{suggestion.description ? <p className="mt-2 text-sm leading-5 text-white/46">{suggestion.description}</p> : null}<div className="mt-3 rounded-xl border border-white/[0.07] bg-black/15 p-3"><div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-white/30"><Eye className="h-3.5 w-3.5" /> Evidência</div><p className="mt-1.5 text-xs leading-5 text-white/52">{suggestion.evidence || "Sem trecho informado."}</p>{suggestion.reason ? <p className="mt-2 border-t border-white/[0.06] pt-2 text-xs leading-5 text-white/38"><span className="font-semibold text-white/55">Interpretação:</span> {suggestion.reason}</p> : null}</div><div className="mt-3 flex flex-wrap items-center justify-between gap-3"><div className="text-[10px] text-white/25">{suggestion.model || "modelo não informado"}{suggestion.ruleIds?.length ? ` · ${suggestion.ruleIds.join(", ")}` : ""}</div>{suggestion.status === "pending" ? <div className="flex gap-2"><button type="button" disabled={Boolean(reviewing)} onClick={() => void review(suggestion.id, "reject")} className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-rose-300/14 bg-rose-300/[0.06] px-3 text-xs font-semibold text-rose-100 disabled:opacity-45"><X className="h-3.5 w-3.5" /> Rejeitar</button><button type="button" disabled={Boolean(reviewing)} onClick={() => void review(suggestion.id, "approve")} className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-emerald-300/18 bg-emerald-300/[0.1] px-3 text-xs font-semibold text-emerald-100 disabled:opacity-45">{reviewing === suggestion.id ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />} Aprovar</button></div> : null}</div></article>)}{!loading && !intelligence?.suggestions?.length ? <div className="xl:col-span-2 rounded-2xl border border-dashed border-white/10 px-6 py-14 text-center"><ShieldCheck className="mx-auto h-8 w-8 text-emerald-300/55" /><div className="mt-3 text-sm font-medium text-white/65">Nenhuma sugestão pendente</div><div className="mt-1 text-xs text-white/30">As próximas conclusões aparecerão aqui com evidência e justificativa.</div></div> : null}</div>
  </div>;
}

function Metric({ icon: Icon, label, value }: { icon: typeof BrainCircuit; label: string; value: string }) { return <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-4"><div className="flex items-center justify-between"><span className="text-xs uppercase tracking-[0.1em] text-white/30">{label}</span><Icon className="h-4 w-4 text-violet-200/70" /></div><div className="mt-3 text-2xl font-semibold text-white">{value}</div></div>; }
