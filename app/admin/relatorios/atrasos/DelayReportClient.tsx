"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, CalendarDays, ClipboardList, RefreshCw } from "lucide-react";
import { authFetch } from "@/lib/authFetch";

type Seller = { id: string; name: string; token?: { status?: string } };
type ReportRow = { orderId: string; shipmentId: string; service: string; expectedDispatchAt: string | null; shippedAt: string | null; impactType: string };
type ReportData = {
  ok: boolean; error?: string; items: ReportRow[]; seller?: { id: string; name: string };
  expectedImpactCount: number; periodDays: number; ordersScanned: number; shipmentsChecked: number;
  shipmentChecksUnavailable: number; complete: boolean;
};

function formatDate(value: string | null) {
  if (!value) return "Não despachado";
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(parsed);
}

function impactTone(value: string) {
  if (value === "Sistema Correios") return "border-sky-300/20 bg-sky-400/10 text-sky-100";
  if (value === "Bipagem Tardia") return "border-amber-300/20 bg-amber-400/10 text-amber-100";
  if (value === "Instabilidade NFe") return "border-violet-300/20 bg-violet-400/10 text-violet-100";
  return "border-spv-line bg-spv-page text-spv-muted";
}

export default function DelayReportClient() {
  const [sellers, setSellers] = useState<Seller[]>([]);
  const [sellerId, setSellerId] = useState("");
  const [expectedFrom, setExpectedFrom] = useState("");
  const [expectedTo, setExpectedTo] = useState("");
  const [data, setData] = useState<ReportData | null>(null);
  const [loadingSellers, setLoadingSellers] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const loadSellers = useCallback(async () => {
    setLoadingSellers(true);
    try {
      const response = await authFetch("/api/admin/sellers/list", { cache: "no-store" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Não foi possível carregar os sellers.");
      const connected = (result.items || []).filter((seller: Seller) => ["connected", "expiring"].includes(seller.token?.status || ""));
      setSellers(connected);
      setSellerId((current) => current || connected[0]?.id || "");
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Não foi possível carregar os sellers.");
    } finally {
      setLoadingSellers(false);
    }
  }, []);

  const loadReport = useCallback(async () => {
    if (!sellerId) return;
    setLoading(true); setError("");
    try {
      const params = new URLSearchParams({ sellerId });
      if (expectedFrom) params.set("expectedFrom", expectedFrom);
      if (expectedTo) params.set("expectedTo", expectedTo);
      const response = await authFetch(`/api/admin/reports/delays?${params.toString()}`, { cache: "no-store" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Não foi possível montar o relatório.");
      setData(result);
    } catch (failure) {
      setData(null);
      setError(failure instanceof Error ? failure.message : "Não foi possível montar o relatório.");
    } finally {
      setLoading(false);
    }
  }, [sellerId, expectedFrom, expectedTo]);

  useEffect(() => { void loadSellers(); }, [loadSellers]);
  useEffect(() => { if (sellerId) void loadReport(); }, [sellerId, loadReport]);

  const statusText = useMemo(() => {
    if (!data) return "Selecione um seller conectado para consultar os atrasos.";
    return `${data.expectedImpactCount} impacto${data.expectedImpactCount === 1 ? "" : "s"} no termômetro · ${data.ordersScanned} vendas conferidas.`;
  }, [data]);

  return <div className="mx-auto max-w-[1440px] pb-12">
    <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
      <div>
        <div className="text-xs font-semibold uppercase tracking-[0.16em] text-amber-200/80">Uso administrativo</div>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight text-spv-ink">Relatório de atrasos</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-spv-muted">Vendas com atraso confirmado no envio e que compõem o percentual de atraso do Mercado Livre.</p>
      </div>
      <button type="button" onClick={() => void loadReport()} disabled={!sellerId || loading} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-spv-line bg-spv-surface px-4 text-sm font-semibold text-spv-ink transition hover:bg-spv-raised disabled:cursor-not-allowed disabled:opacity-50"><RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /> Atualizar</button>
    </header>

    <section className="mt-5 rounded-xl border border-spv-line bg-spv-surface p-4 sm:p-5">
      <div className="grid gap-3 lg:grid-cols-[minmax(220px,1fr)_190px_190px_auto] lg:items-end">
        <label className="block"><span className="mb-1.5 block text-xs font-medium text-spv-muted">Seller</span><select value={sellerId} onChange={(event) => setSellerId(event.target.value)} disabled={loadingSellers} className="h-11 w-full rounded-xl border border-spv-line bg-spv-page px-3 text-sm text-spv-ink outline-none focus:border-emerald-300/35"><option value="">{loadingSellers ? "Carregando sellers..." : "Selecione um seller"}</option>{sellers.map((seller) => <option key={seller.id} value={seller.id}>{seller.name}</option>)}</select></label>
        <label className="block"><span className="mb-1.5 block text-xs font-medium text-spv-muted">Envio previsto a partir de</span><input type="date" value={expectedFrom} onChange={(event) => setExpectedFrom(event.target.value)} className="h-11 w-full rounded-xl border border-spv-line bg-spv-page px-3 text-sm text-spv-ink outline-none focus:border-emerald-300/35" /></label>
        <label className="block"><span className="mb-1.5 block text-xs font-medium text-spv-muted">Envio previsto até</span><input type="date" value={expectedTo} onChange={(event) => setExpectedTo(event.target.value)} className="h-11 w-full rounded-xl border border-spv-line bg-spv-page px-3 text-sm text-spv-ink outline-none focus:border-emerald-300/35" /></label>
        <button type="button" onClick={() => { setExpectedFrom(""); setExpectedTo(""); }} className="h-11 rounded-xl border border-spv-line bg-spv-page px-4 text-sm font-medium text-spv-muted transition hover:bg-spv-raised hover:text-spv-ink">Limpar filtro</button>
      </div>
    </section>

    {error ? <div className="mt-4 rounded-xl border border-rose-300/20 bg-rose-400/[0.08] px-4 py-3 text-sm text-rose-100">{error}</div> : null}

    <section className="mt-5 overflow-hidden rounded-xl border border-spv-line bg-spv-surface">
      <div className="flex flex-col gap-3 border-b border-spv-line p-4 sm:flex-row sm:items-start sm:justify-between sm:p-5">
        <div><h2 className="flex items-center gap-2 text-lg font-semibold text-spv-ink"><ClipboardList className="h-5 w-5 text-amber-200" /> Vendas impactantes</h2><p className="mt-1 text-sm text-spv-muted">{statusText}</p></div>
        {data ? <div className="inline-flex items-center gap-2 text-xs font-medium text-spv-muted"><CalendarDays className="h-4 w-4 text-spv-accent-text" /> Período de reputação: {data.periodDays} dias</div> : null}
      </div>
      {data && !data.complete ? <div className="flex gap-2 border-b border-amber-300/15 bg-amber-400/[0.06] px-4 py-3 text-sm text-amber-100"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />A consulta ainda não alcançou todos os impactos informados pelo Mercado Livre. Atualize novamente para concluir a conferência.</div> : null}
      <div className="overflow-x-auto"><table className="min-w-[1040px] w-full text-left"><thead className="bg-spv-page"><tr className="border-b border-spv-line text-[11px] font-semibold uppercase tracking-wide text-spv-muted"><th className="px-5 py-3">Venda</th><th className="px-4 py-3">Serviço de envio</th><th className="px-4 py-3">Envio previsto</th><th className="px-4 py-3">Envio realizado</th><th className="px-5 py-3">Tipo impacto</th></tr></thead><tbody>{loading ? <tr><td colSpan={5} className="px-5 py-14 text-center text-sm text-spv-muted">Consultando vendas e envios no Mercado Livre...</td></tr> : null}{!loading && data?.items.map((item) => <tr key={item.orderId} className="border-b border-spv-line last:border-0"><td className="px-5 py-4 text-sm font-semibold text-spv-ink">#{item.orderId}</td><td className="px-4 py-4 text-sm text-spv-muted">{item.service}</td><td className="px-4 py-4 text-sm text-spv-ink">{formatDate(item.expectedDispatchAt)}</td><td className="px-4 py-4 text-sm text-spv-ink">{formatDate(item.shippedAt)}</td><td className="px-5 py-4"><span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${impactTone(item.impactType)}`}>{item.impactType}</span></td></tr>)}{!loading && data && data.items.length === 0 ? <tr><td colSpan={5} className="px-5 py-14 text-center text-sm text-spv-muted">Nenhuma venda com atraso confirmado foi encontrada para este seller e filtro.</td></tr> : null}{!loading && !data && !error ? <tr><td colSpan={5} className="px-5 py-14 text-center text-sm text-spv-muted">Selecione um seller para iniciar a consulta.</td></tr> : null}</tbody></table></div>
    </section>
    <p className="mt-3 text-xs leading-5 text-spv-muted">Atrasos são confirmados pelo endpoint de atrasos do envio. A coluna “Tipo impacto” aplica apenas as regras informadas; serviços ou datas fora delas ficam como “Sem regra definida”.</p>
  </div>;
}
