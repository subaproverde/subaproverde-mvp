"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, CheckCircle2, FileText, RefreshCcw, ShieldCheck, Truck } from "lucide-react";
import { authFetch } from "@/lib/authFetch";
import { supabaseBrowser } from "@/lib/supabaseClient";

type ReturnShippingCost = {
  claimId: string;
  saleId: string | null;
  amount: number;
  currencyId: string;
  status: string | null;
  stage: string | null;
  dateCreated: string | null;
  reason: string | null;
};

type ReportResponse = {
  ok?: boolean;
  error?: string;
  items?: ReturnShippingCost[];
  impactingClaims?: number;
};

const money = (amount: number, currency = "BRL") =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency }).format(amount);

const date = (value: string | null) =>
  value
    ? new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(value))
    : "—";

export default function ReturnShippingCostsReportPage() {
  const [items, setItems] = useState<ReturnShippingCost[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [impactingClaims, setImpactingClaims] = useState(0);

  const selectedItems = useMemo(() => items.filter((item) => selected.has(item.claimId)), [items, selected]);
  const total = useMemo(() => selectedItems.reduce((sum, item) => sum + item.amount, 0), [selectedItems]);

  async function load() {
    setLoading(true);
    setError("");

    try {
      const { data } = await supabaseBrowser.auth.getUser();
      if (!data?.user?.id) throw new Error("Você não está logado. Faça login novamente.");

      const sellerResponse = await authFetch(`/api/me/seller?userId=${encodeURIComponent(data.user.id)}`, { cache: "no-store" });
      const seller = await sellerResponse.json().catch(() => ({}));
      if (!sellerResponse.ok || !seller?.sellerId) {
        throw new Error(seller?.error ?? "Não foi possível identificar o seller ativo.");
      }

      const response = await authFetch(
        `/api/ml/reports/return-shipping-costs?sellerId=${encodeURIComponent(String(seller.sellerId))}`,
        { cache: "no-store" }
      );
      const report = (await response.json().catch(() => ({}))) as ReportResponse;
      if (!response.ok || !report.ok) throw new Error(report.error ?? "Não foi possível carregar o relatório.");

      const newItems = report.items ?? [];
      setItems(newItems);
      setImpactingClaims(Number(report.impactingClaims ?? 0));
    } catch (cause: any) {
      setError(cause?.message ?? "Erro ao carregar o relatório.");
      setItems([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  function toggle(claimId: string) {
    setSelected((current) => {
      const next = new Set(current);
      next.has(claimId) ? next.delete(claimId) : next.add(claimId);
      return next;
    });
  }

  function toggleAll() {
    setSelected(selected.size === items.length ? new Set() : new Set(items.map((item) => item.claimId)));
  }

  function printReport() {
    window.print();
  }

  return (
    <div className="mx-auto max-w-6xl pb-14">
      <div className="print-only mb-6">
        <div className="text-2xl font-semibold text-spv-ink">Possíveis recuperações de frete de devolução</div>
        <div className="mt-1 text-sm text-spv-muted">Relatório gerado em {new Intl.DateTimeFormat("pt-BR", { dateStyle: "long" }).format(new Date())}</div>
      </div>
      <div className="no-print flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <Link href="/app/reports" className="inline-flex items-center gap-2 text-[12px] font-semibold text-spv-accent-text hover:text-spv-ink">
            <ArrowLeft className="h-4 w-4" /> Voltar para Relatórios
          </Link>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-spv-ink">Custos de frete de devolução</h1>
          <p className="mt-2 max-w-3xl text-sm leading-relaxed text-spv-muted">
            Possíveis recuperações ao remover impactos de reclamação. A lista traz somente vendas que afetam a reputação e tiveram cobrança de devolução confirmada pelo Mercado Livre.
          </p>
        </div>
        <button onClick={() => load()} disabled={loading} className="inline-flex items-center justify-center gap-2 rounded-xl border border-spv-line bg-spv-surface px-4 py-3 text-sm font-bold text-spv-ink hover:bg-spv-raised disabled:opacity-50">
          <RefreshCcw className={loading ? "h-4 w-4 animate-spin" : "h-4 w-4"} /> Atualizar
        </button>
      </div>

      {error && <div role="alert" className="mt-5 rounded-xl border border-rose-400/20 bg-rose-500/10 p-4 text-sm text-rose-100">{error}</div>}

      <section className="mt-6 grid gap-4 lg:grid-cols-[1.25fr_.75fr]">
        <div className="rounded-xl border border-spv-line bg-spv-surface p-5">
          <div className="flex gap-3">
            <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-spv-line bg-spv-page text-spv-accent-text"><Truck className="h-5 w-5" /></div>
            <div>
              <h2 className="text-sm font-semibold text-spv-ink">Valor real, sem estimativa</h2>
              <p className="mt-1 text-sm leading-relaxed text-spv-muted">Cada valor vem do lançamento de tarifa de devolução no Faturamento do Mercado Livre, vinculado à venda. Não incluímos tarifa de venda, cancelamento ou outros lançamentos.</p>
            </div>
          </div>
        </div>
        <div className="rounded-xl border border-emerald-400/25 bg-emerald-500/10 p-5">
          <div className="text-[11px] font-bold uppercase tracking-wide text-spv-accent-text">Possível recuperação selecionada</div>
          <div className="mt-2 text-3xl font-semibold text-spv-ink">{money(total)}</div>
          <div className="mt-1 text-xs text-spv-muted">{selectedItems.length} {selectedItems.length === 1 ? "venda" : "vendas"} selecionada{selectedItems.length === 1 ? "" : "s"}</div>
        </div>
      </section>

      <section className="mt-6 overflow-hidden rounded-xl border border-spv-line bg-spv-surface">
        <div className="no-print flex flex-col gap-3 border-b border-spv-line p-5 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-base font-semibold text-spv-ink">Vendas elegíveis</h2>
            <p className="mt-1 text-xs text-spv-muted">Selecione as vendas em que a remoção do impacto está sendo tratada.{!loading && impactingClaims > 0 ? ` Analisadas ${impactingClaims} vendas que impactam a reputação.` : ""}</p>
          </div>
          <button onClick={printReport} disabled={selectedItems.length === 0} className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-500 px-4 py-3 text-sm font-semibold text-spv-ink hover:bg-emerald-600 disabled:cursor-not-allowed disabled:opacity-40">
            <FileText className="h-4 w-4" /> Gerar relatório
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="bg-spv-page text-[11px] uppercase tracking-wide text-spv-muted">
              <tr>
                <th className="w-12 px-5 py-4"><input aria-label="Selecionar todas as vendas carregadas" type="checkbox" checked={items.length > 0 && selected.size === items.length} onChange={toggleAll} className="h-4 w-4 accent-emerald-500" /></th>
                <th className="px-3 py-4">Venda</th><th className="px-3 py-4">Reclamação</th><th className="px-3 py-4">Data</th><th className="px-3 py-4">Situação</th><th className="px-5 py-4 text-right">Tarifa de devolução</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-spv-line">
              {loading ? <tr><td colSpan={6} className="px-5 py-12 text-center text-sm text-spv-muted">Consultando cobranças no Mercado Livre...</td></tr> : null}
              {!loading && items.length === 0 ? <tr><td colSpan={6} className="px-5 py-12 text-center text-sm text-spv-muted">Nenhuma das {impactingClaims} vendas que impactam a reputação teve tarifa de devolução cobrada identificada.</td></tr> : null}
              {items.map((item) => <tr key={item.claimId} className={`report-row ${selected.has(item.claimId) ? "selected" : ""} text-spv-ink hover:bg-spv-raised/50`}>
                <td className="px-5 py-4"><input aria-label={`Selecionar venda ${item.saleId ?? item.claimId}`} type="checkbox" checked={selected.has(item.claimId)} onChange={() => toggle(item.claimId)} className="h-4 w-4 accent-emerald-500" /></td>
                <td className="px-3 py-4 font-mono text-xs font-semibold">{item.saleId ? `#${item.saleId}` : "Venda não informada"}</td>
                <td className="px-3 py-4 font-mono text-xs text-spv-muted">#{item.claimId}</td>
                <td className="px-3 py-4 text-xs text-spv-muted">{date(item.dateCreated)}</td>
                <td className="px-3 py-4"><span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-400/20 bg-emerald-500/10 px-2.5 py-1 text-[11px] font-semibold text-spv-accent-text"><CheckCircle2 className="h-3.5 w-3.5" /> Impacta reputação</span></td>
                <td className="px-5 py-4 text-right font-semibold text-spv-ink">{money(item.amount, item.currencyId)}</td>
              </tr>)}
            </tbody>
          </table>
        </div>
      </section>

      <section className="print-report mt-6 rounded-xl border border-spv-line bg-spv-page p-5">
        <div className="flex items-start gap-3"><ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-spv-accent-text" /><div><h2 className="text-sm font-semibold text-spv-ink">Como interpretar este relatório</h2><p className="mt-1 text-sm leading-relaxed text-spv-muted">O total é um cenário de recuperação possível, não uma confirmação de crédito. O Mercado Livre define o crédito na conta Mercado Pago após a remoção do impacto da reclamação.</p></div></div>
      </section>
    </div>
  );
}
