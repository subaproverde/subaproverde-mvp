"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  BadgeDollarSign, BarChart3, CheckCircle2, CircleDollarSign, RefreshCw,
  Target, TrendingUp, UserRoundCheck, UsersRound,
} from "lucide-react";
import { authFetch } from "@/lib/authFetch";
import CrmSectionNav from "../components/CrmSectionNav";

type ReportData = {
  ok: boolean; error?: string; range: string;
  metrics: { removals: number; completed: number; successRate: number; billed: number; received: number; averageTicket: number; activeClients: number };
  byType: Array<{ key: string; label: string; count: number; success: number; revenue: number }>;
  byClient: Array<{ id: string; name: string; count: number; success: number; revenue: number }>;
  byMonth: Array<{ key: string; label: string; removals: number; success: number; billed: number; received: number }>;
  byStatus: Array<{ status: string; count: number }>;
};

const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
const fullMoney = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const statusLabels: Record<string, string> = { pendente: "Pendente", em_andamento: "Em andamento", removido: "Removido", nao_removido: "Não removido", aguardando_cliente: "Aguardando cliente", finalizado: "Finalizado" };

export default function ReportsClient() {
  const [range, setRange] = useState("90");
  const [data, setData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const response = await authFetch(`/api/admin/crm/reports?range=${range}`, { cache: "no-store" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Não foi possível montar os relatórios.");
      setData(result);
    } catch (failure) { setError(failure instanceof Error ? failure.message : "Falha nos relatórios."); }
    finally { setLoading(false); }
  }, [range]);
  useEffect(() => { void load(); }, [load]);

  const maxMonth = useMemo(() => Math.max(1, ...(data?.byMonth || []).map((row) => row.removals)), [data?.byMonth]);
  const maxType = useMemo(() => Math.max(1, ...(data?.byType || []).map((row) => row.count)), [data?.byType]);

  return <div className="min-w-0">
    <CrmSectionNav />
    <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
      <div><div className="text-xs font-semibold uppercase tracking-[0.16em] text-cyan-300/75">Resultados da operação</div><h1 className="mt-1 text-3xl font-semibold tracking-tight text-white">Relatórios de remoções</h1><p className="mt-2 max-w-3xl text-sm leading-6 text-white/45">Volume, sucesso, faturamento, recebimentos, tipos de impacto e clientes — consolidados a partir da operação registrada.</p></div>
      <div className="flex flex-wrap items-center gap-2"><select value={range} onChange={(event) => setRange(event.target.value)} className="h-10 rounded-xl border border-white/10 bg-white/[0.04] px-3 text-sm text-white/65 outline-none"><option value="30">Últimos 30 dias</option><option value="90">Últimos 90 dias</option><option value="180">Últimos 6 meses</option><option value="365">Último ano</option><option value="all">Todo o período</option></select><button type="button" onClick={() => void load()} className="inline-flex h-10 items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-3 text-sm text-white/60"><RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /> Atualizar</button></div>
    </header>
    {error ? <div className="mt-4 rounded-xl border border-rose-300/18 bg-rose-300/[0.06] px-4 py-3 text-sm text-rose-100">{error}</div> : null}

    <section className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
      <Metric icon={Target} label="Remoções" value={String(data?.metrics.removals || 0)} detail={`${data?.metrics.completed || 0} concluídas`} />
      <Metric icon={CheckCircle2} label="Taxa de sucesso" value={`${Math.round((data?.metrics.successRate || 0) * 100)}%`} detail="impactos removidos" />
      <Metric icon={CircleDollarSign} label="Faturado" value={money.format(data?.metrics.billed || 0)} detail="serviços concluídos" />
      <Metric icon={BadgeDollarSign} label="Recebido" value={money.format(data?.metrics.received || 0)} detail="baixas financeiras" />
      <Metric icon={TrendingUp} label="Ticket médio" value={money.format(data?.metrics.averageTicket || 0)} detail="por remoção concluída" />
      <Metric icon={UsersRound} label="Clientes" value={String(data?.metrics.activeClients || 0)} detail="com remoções no período" />
    </section>

    <div className="mt-5 grid gap-5 xl:grid-cols-[1.25fr_0.75fr]">
      <section className="rounded-[24px] border border-white/10 bg-white/[0.03] p-4 sm:p-5"><div className="flex items-start justify-between"><div><h2 className="flex items-center gap-2 text-sm font-semibold text-white"><BarChart3 className="h-4 w-4 text-cyan-200" /> Evolução por mês</h2><p className="mt-1 text-xs text-white/35">Quantidade removida e movimentação financeira.</p></div></div><div className="mt-5 overflow-x-auto"><div className="flex min-w-[580px] items-end gap-3 border-b border-white/[0.08] pb-3" style={{ minHeight: 230 }}>{(data?.byMonth || []).map((month) => <div key={month.key} className="flex min-w-[66px] flex-1 flex-col items-center"><div className="mb-2 text-xs font-semibold text-white/65">{month.removals}</div><div className="flex h-36 w-full items-end justify-center gap-1 rounded-t-lg bg-white/[0.018] px-2"><div className="w-3 rounded-t bg-emerald-400/75" style={{ height: `${Math.max(4, (month.success / maxMonth) * 100)}%` }} title={`${month.success} removidas`} /><div className="w-3 rounded-t bg-cyan-300/45" style={{ height: `${Math.max(4, (month.removals / maxMonth) * 100)}%` }} title={`${month.removals} serviços`} /></div><div className="mt-2 text-[10px] text-white/35">{month.label}</div><div className="mt-1 text-[9px] text-emerald-200/55">{money.format(month.received)}</div></div>)}</div></div><div className="mt-3 flex flex-wrap gap-4 text-[10px] text-white/35"><span className="flex items-center gap-1.5"><i className="h-2 w-2 rounded-full bg-emerald-400" /> Removidas</span><span className="flex items-center gap-1.5"><i className="h-2 w-2 rounded-full bg-cyan-300/55" /> Total trabalhado</span><span>Valor abaixo: recebido no mês</span></div></section>

      <section className="rounded-[24px] border border-white/10 bg-white/[0.03] p-4 sm:p-5"><h2 className="text-sm font-semibold text-white">Situação da operação</h2><p className="mt-1 text-xs text-white/35">Distribuição atual no período.</p><div className="mt-5 space-y-3">{(data?.byStatus || []).map((row) => { const total = Math.max(1, data?.metrics.removals || 1); return <div key={row.status}><div className="mb-1.5 flex items-center justify-between text-xs"><span className="text-white/55">{statusLabels[row.status] || row.status}</span><span className="font-semibold text-white/75">{row.count}</span></div><div className="h-2 overflow-hidden rounded-full bg-white/[0.05]"><div className="h-full rounded-full bg-gradient-to-r from-emerald-400/70 to-cyan-300/65" style={{ width: `${Math.max(2, (row.count / total) * 100)}%` }} /></div></div>; })}</div></section>
    </div>

    <div className="mt-5 grid gap-5 xl:grid-cols-2">
      <section className="rounded-[24px] border border-white/10 bg-white/[0.03] p-4 sm:p-5"><h2 className="text-sm font-semibold text-white">Por tipo de remoção</h2><p className="mt-1 text-xs text-white/35">O que mais ocupa a operação e quanto gera.</p><div className="mt-5 space-y-4">{(data?.byType || []).map((row) => <article key={row.key}><div className="flex items-end justify-between gap-3"><div><div className="text-sm font-medium text-white/75">{row.label}</div><div className="mt-1 text-[10px] text-white/32">{row.success} removidas de {row.count} · {fullMoney.format(row.revenue)}</div></div><div className="text-xs font-semibold text-emerald-200">{row.count ? Math.round((row.success / row.count) * 100) : 0}%</div></div><div className="mt-2 h-2 overflow-hidden rounded-full bg-white/[0.05]"><div className="h-full rounded-full bg-emerald-400/70" style={{ width: `${Math.max(2, (row.count / maxType) * 100)}%` }} /></div></article>)}</div>{!loading && !data?.byType.length ? <Empty text="Nenhuma remoção no período." /> : null}</section>

      <section className="overflow-hidden rounded-[24px] border border-white/10 bg-white/[0.03]"><div className="p-4 sm:p-5"><h2 className="flex items-center gap-2 text-sm font-semibold text-white"><UserRoundCheck className="h-4 w-4 text-violet-200" /> Remoções por cliente</h2><p className="mt-1 text-xs text-white/35">Clientes com maior volume e faturamento.</p></div><div className="hidden max-h-[460px] overflow-y-auto md:block"><table className="w-full text-left"><thead className="sticky top-0 bg-[#0b1210]"><tr className="border-y border-white/[0.07] text-[10px] uppercase tracking-wide text-white/28"><th className="px-5 py-3">Cliente</th><th className="px-3 py-3 text-right">Volume</th><th className="px-3 py-3 text-right">Sucesso</th><th className="px-5 py-3 text-right">Faturado</th></tr></thead><tbody>{(data?.byClient || []).map((row) => <tr key={row.id} className="border-b border-white/[0.055] last:border-0"><td className="max-w-[260px] truncate px-5 py-3 text-sm font-medium text-white/75">{row.name}</td><td className="px-3 py-3 text-right text-sm text-white/50">{row.count}</td><td className="px-3 py-3 text-right text-sm text-emerald-200/65">{row.count ? Math.round((row.success / row.count) * 100) : 0}%</td><td className="px-5 py-3 text-right text-sm font-semibold text-white/72">{fullMoney.format(row.revenue)}</td></tr>)}</tbody></table></div><div className="max-h-[520px] divide-y divide-white/[0.07] overflow-y-auto md:hidden">{(data?.byClient || []).map((row) => <article key={row.id} className="p-4"><div className="truncate font-semibold text-white/80">{row.name}</div><div className="mt-3 grid grid-cols-3 gap-2 text-center"><Cell label="Remoções" value={String(row.count)} /><Cell label="Sucesso" value={`${row.count ? Math.round((row.success / row.count) * 100) : 0}%`} /><Cell label="Faturado" value={money.format(row.revenue)} /></div></article>)}</div>{!loading && !data?.byClient.length ? <Empty text="Nenhum cliente no período." /> : null}</section>
    </div>
  </div>;
}

function Metric({ icon: Icon, label, value, detail }: { icon: typeof Target; label: string; value: string; detail: string }) { return <article className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-4"><div className="flex items-center justify-between"><span className="text-[10px] font-semibold uppercase tracking-[0.1em] text-white/28">{label}</span><Icon className="h-4 w-4 text-cyan-200/65" /></div><div className="mt-3 truncate text-xl font-semibold text-white">{value}</div><div className="mt-1 text-xs text-white/30">{detail}</div></article>; }
function Cell({ label, value }: { label: string; value: string }) { return <div className="rounded-xl bg-black/15 px-2 py-2"><div className="text-[9px] uppercase tracking-wide text-white/25">{label}</div><div className="mt-1 truncate text-xs font-semibold text-white/65">{value}</div></div>; }
function Empty({ text }: { text: string }) { return <div className="px-6 py-14 text-center text-sm text-white/35">{text}</div>; }
