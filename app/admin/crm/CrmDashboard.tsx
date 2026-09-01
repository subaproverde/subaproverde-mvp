"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Activity,
  AlertCircle,
  ArrowRight,
  BadgeCheck,
  BrainCircuit,
  Building2,
  CheckCircle2,
  Check,
  CircleDollarSign,
  Clock3,
  Eye,
  FileText,
  Lightbulb,
  MessagesSquare,
  ReceiptText,
  RefreshCw,
  Sparkles,
  Target,
  TimerReset,
  UsersRound,
  WalletCards,
  X,
} from "lucide-react";
import { authFetch } from "@/lib/authFetch";
import { crmDemoOverview } from "@/lib/crm/demo";
import type { CrmOverview, CrmPriorityKind } from "@/lib/crm/types";

const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

function relativeTime(value: string | null) {
  if (!value) return "sem horário";
  const diffMinutes = Math.round((Date.now() - new Date(value).getTime()) / 60_000);
  if (diffMinutes < 1) return "agora";
  if (diffMinutes < 60) return `há ${diffMinutes} min`;
  const hours = Math.round(diffMinutes / 60);
  if (hours < 24) return `há ${hours}h`;
  return new Date(value).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
}

const priorityIcons: Record<CrmPriorityKind, typeof MessagesSquare> = {
  conversation: MessagesSquare,
  task: TimerReset,
  receipt: ReceiptText,
};

export default function CrmDashboard() {
  const [overview, setOverview] = useState<CrmOverview>(crmDemoOverview);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reviewingId, setReviewingId] = useState("");
  const [reviewError, setReviewError] = useState("");

  const loadOverview = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await authFetch("/api/admin/crm/overview", { cache: "no-store" });
      if (!response.ok) throw new Error("Não foi possível carregar o CRM.");
      const data = (await response.json()) as CrmOverview;
      setOverview(data.setupRequired ? crmDemoOverview : data);
    } catch (loadError) {
      setOverview(crmDemoOverview);
      setError(loadError instanceof Error ? loadError.message : "Falha ao carregar o CRM.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadOverview();
  }, [loadOverview]);

  const reviewSuggestion = useCallback(async (suggestionId: string, action: "approve" | "reject") => {
    setReviewingId(suggestionId);
    setReviewError("");
    try {
      const response = await authFetch("/api/admin/crm/intelligence/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ suggestionId, action }),
      });
      const data = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) throw new Error(data.error || "Não foi possível revisar a sugestão.");
      await loadOverview();
    } catch (reviewFailure) {
      setReviewError(reviewFailure instanceof Error ? reviewFailure.message : "Falha ao revisar a sugestão.");
    } finally {
      setReviewingId("");
    }
  }, [loadOverview]);

  const maxPipelineCount = useMemo(
    () => Math.max(1, ...overview.pipeline.map((stage) => stage.count)),
    [overview.pipeline]
  );

  const isPreview = overview.setupRequired;

  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-[28px] border border-emerald-300/15 bg-[linear-gradient(135deg,rgba(15,46,34,0.82),rgba(9,18,16,0.94)_58%,rgba(10,31,38,0.82))] p-5 shadow-[0_24px_80px_rgba(0,0,0,0.24)] sm:p-7">
        <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
          <div className="max-w-3xl">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-emerald-300/20 bg-emerald-300/10 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.16em] text-emerald-100">
              <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
              CRM inteligente
            </div>
            <h1 className="text-3xl font-semibold tracking-[-0.035em] text-white sm:text-4xl">
              A jornada inteira do cliente,
              <span className="block text-emerald-200">organizada pela conversa.</span>
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-white/62 sm:text-base">
              A Bia observa o WhatsApp, atualiza o funil, prepara pedidos e lembra você apenas do que realmente precisa de decisão.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Link href="/admin/crm/conversas" className="inline-flex h-11 items-center gap-2 rounded-xl bg-emerald-400 px-4 text-sm font-semibold text-[#052216] transition hover:bg-emerald-300">
              <MessagesSquare className="h-4 w-4" aria-hidden="true" /> Abrir conversas
            </Link>
            <div className="inline-flex items-center gap-2 rounded-xl border border-emerald-300/15 bg-black/20 px-3.5 py-2.5 text-sm text-white/75">
              <span className="relative flex h-2.5 w-2.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-300 opacity-50" />
                <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-400" />
              </span>
              Observador {overview.intelligence.observerActive ? "ativo" : "preparado"}
            </div>
            <button
              type="button"
              onClick={() => void loadOverview()}
              disabled={loading}
              className="inline-flex h-11 items-center gap-2 rounded-xl border border-white/12 bg-white/[0.07] px-4 text-sm font-medium text-white transition hover:bg-white/[0.12] disabled:cursor-wait disabled:opacity-60"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} aria-hidden="true" />
              Atualizar
            </button>
          </div>
        </div>
      </section>

      {isPreview ? (
        <div className="flex items-start gap-3 rounded-2xl border border-amber-300/18 bg-amber-300/[0.07] px-4 py-3.5 text-sm text-amber-50/80">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-200" aria-hidden="true" />
          <div>
            <span className="font-semibold text-amber-100">Prévia segura.</span>{" "}
            Estes dados ilustram a operação. A base real só será ativada depois da migração e da validação antes de produção.
            {error ? <span className="block pt-1 text-xs text-amber-100/55">{error}</span> : null}
          </div>
        </div>
      ) : null}

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard icon={UsersRound} label="Leads ativos" value={String(overview.metrics.activeLeads)} detail="em jornada comercial" tone="emerald" />
        <MetricCard icon={MessagesSquare} label="Aguardando você" value={String(overview.metrics.waitingTeam)} detail="somente decisões reais" tone="sky" />
        <MetricCard icon={Clock3} label="Follow-ups vencidos" value={String(overview.metrics.overdueFollowUps)} detail="priorizados pela IA" tone="amber" />
        <MetricCard icon={CircleDollarSign} label="A receber" value={money.format(overview.metrics.openReceivables)} detail="pagamento após serviço" tone="violet" />
      </section>

      <section id="inteligencia" className="scroll-mt-24 rounded-[24px] border border-emerald-300/14 bg-[linear-gradient(145deg,rgba(16,56,41,0.34),rgba(255,255,255,0.025)_50%)] p-5 sm:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="flex items-center gap-2 text-sm font-semibold text-white">
              <Lightbulb className="h-4 w-4 text-emerald-300" aria-hidden="true" />
              Caixa de inteligência
            </div>
            <p className="mt-1 max-w-2xl text-sm leading-5 text-white/45">
              O que a Bia entendeu das conversas, com fonte, justificativa e revisão antes de virar dado oficial.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <MiniStat label="Análises hoje" value={String(overview.intelligence.runsToday)} />
            <MiniStat label="Pendentes" value={String(overview.intelligence.pendingSuggestions)} />
            <MiniStat label="Confiança média" value={`${Math.round(overview.intelligence.averageConfidence * 100)}%`} />
            <MiniStat label="Custo hoje" value={`US$ ${overview.intelligence.totalCostUsdToday.toFixed(3)}`} />
          </div>
        </div>

        {reviewError ? (
          <div className="mt-4 rounded-xl border border-rose-300/15 bg-rose-300/[0.07] px-3.5 py-3 text-sm text-rose-100/80">{reviewError}</div>
        ) : null}

        <div className="mt-5 grid gap-3 xl:grid-cols-2">
          {overview.intelligence.suggestions.length ? overview.intelligence.suggestions.map((suggestion) => (
            <article key={suggestion.id} className="rounded-2xl border border-white/[0.09] bg-black/20 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-semibold text-white">{suggestion.contactName}</span>
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.1em] ${suggestion.type === "fact" ? "bg-cyan-300/10 text-cyan-200" : "bg-violet-300/10 text-violet-200"}`}>
                      {suggestion.type === "fact" ? "dado" : "ação"}
                    </span>
                    {suggestion.status !== "pending" ? (
                      <span className="rounded-full bg-white/[0.06] px-2 py-0.5 text-[10px] uppercase tracking-[0.1em] text-white/40">
                        {suggestion.status === "applied" ? "aplicado" : suggestion.status === "rejected" ? "rejeitado" : suggestion.status}
                      </span>
                    ) : null}
                  </div>
                  <div className="mt-2 text-sm font-medium text-white/85">{suggestion.title}</div>
                </div>
                <div className="text-right">
                  <div className="text-lg font-semibold text-emerald-200">{Math.round(suggestion.confidence * 100)}%</div>
                  <div className="text-[10px] uppercase tracking-[0.1em] text-white/28">confiança</div>
                </div>
              </div>

              {suggestion.description ? <p className="mt-2 text-sm leading-5 text-white/52">{suggestion.description}</p> : null}
              <div className="mt-3 rounded-xl border border-white/[0.06] bg-white/[0.025] p-3">
                <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.1em] text-white/34">
                  <Eye className="h-3.5 w-3.5" aria-hidden="true" /> De onde veio
                </div>
                <p className="mt-1.5 text-xs leading-5 text-white/55">{suggestion.evidence || "Trecho ainda não informado pela análise."}</p>
                {suggestion.reason ? <p className="mt-2 border-t border-white/[0.06] pt-2 text-xs leading-5 text-white/42"><span className="font-semibold text-white/60">Por que a Bia pensou assim:</span> {suggestion.reason}</p> : null}
              </div>

              <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                <div className="text-[11px] text-white/30">
                  {suggestion.model || "modelo não informado"}{suggestion.provider ? ` · ${suggestion.provider}` : ""} · {relativeTime(suggestion.occurredAt)}
                  {suggestion.ruleIds.length ? <span className="block pt-0.5">Regras: {suggestion.ruleIds.join(", ")}</span> : null}
                </div>
                {suggestion.status === "pending" ? (
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => void reviewSuggestion(suggestion.id, "reject")}
                      disabled={Boolean(reviewingId)}
                      className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-rose-300/14 bg-rose-300/[0.06] px-3 text-xs font-semibold text-rose-100 transition hover:bg-rose-300/[0.1] disabled:opacity-45"
                    >
                      <X className="h-3.5 w-3.5" aria-hidden="true" /> Rejeitar
                    </button>
                    <button
                      type="button"
                      onClick={() => void reviewSuggestion(suggestion.id, "approve")}
                      disabled={Boolean(reviewingId)}
                      className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-emerald-300/18 bg-emerald-300/[0.1] px-3 text-xs font-semibold text-emerald-100 transition hover:bg-emerald-300/[0.16] disabled:opacity-45"
                    >
                      {reviewingId === suggestion.id ? <RefreshCw className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> : <Check className="h-3.5 w-3.5" aria-hidden="true" />} Aprovar
                    </button>
                  </div>
                ) : null}
              </div>
            </article>
          )) : (
            <div className="xl:col-span-2">
              <EmptyState title="Nenhuma sugestão pendente" detail="As próximas conclusões da Bia aparecerão aqui com a origem e a justificativa." />
            </div>
          )}
        </div>
      </section>

      <section className="rounded-[24px] border border-white/10 bg-white/[0.035] p-5 sm:p-6">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="flex items-center gap-2 text-sm font-semibold text-white">
              <Target className="h-4 w-4 text-emerald-300" aria-hidden="true" />
              Funil comercial
            </div>
            <p className="mt-1 text-sm text-white/45">Atualizado automaticamente conforme a conversa evolui.</p>
          </div>
          <button type="button" className="inline-flex items-center gap-1.5 text-sm font-medium text-emerald-200 transition hover:text-emerald-100">
            Ver todos os leads <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        <div className="mt-5 grid gap-3 lg:grid-cols-5">
          {overview.pipeline.map((stage, index) => (
            <div key={stage.stage} className="relative overflow-hidden rounded-2xl border border-white/9 bg-black/20 p-4">
              <div className="absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-emerald-400 via-cyan-300 to-transparent" style={{ opacity: 1 - index * 0.12 }} />
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-[0.12em] text-white/42">{stage.label}</div>
                  <div className="mt-2 text-2xl font-semibold text-white">{stage.count}</div>
                </div>
                <div className="rounded-lg bg-white/[0.06] px-2 py-1 text-[11px] text-white/55">{money.format(stage.value)}</div>
              </div>
              <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
                <div className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-cyan-300" style={{ width: `${Math.max(8, (stage.count / maxPipelineCount) * 100)}%` }} />
              </div>
            </div>
          ))}
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-[1.35fr_0.65fr]">
        <section className="rounded-[24px] border border-white/10 bg-white/[0.035] p-5 sm:p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 text-sm font-semibold text-white">
                <AlertCircle className="h-4 w-4 text-amber-300" aria-hidden="true" />
                Sua atenção agora
              </div>
              <p className="mt-1 text-sm text-white/45">Sem ruído: apenas conversas, tarefas e pagamentos que exigem ação.</p>
            </div>
            <span className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-xs text-white/50">{overview.priorities.length} itens</span>
          </div>

          <div className="mt-5 divide-y divide-white/[0.07]">
            {overview.priorities.length ? overview.priorities.map((item) => {
              const Icon = priorityIcons[item.kind];
              return (
                <button key={`${item.kind}-${item.id}`} type="button" className="group flex w-full items-start gap-3 py-4 text-left first:pt-0 last:pb-0">
                  <div className={`mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border ${item.urgent ? "border-amber-300/18 bg-amber-300/[0.09] text-amber-200" : "border-sky-300/15 bg-sky-300/[0.07] text-sky-200"}`}>
                    <Icon className="h-4.5 w-4.5" aria-hidden="true" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <span className="font-semibold text-white">{item.contactName}</span>
                      <span className="text-xs text-white/34">{relativeTime(item.occurredAt)}</span>
                    </div>
                    <div className="mt-1 text-sm font-medium text-white/80">{item.title}</div>
                    <p className="mt-1 text-sm leading-5 text-white/46">{item.detail}</p>
                  </div>
                  <ArrowRight className="mt-3 h-4 w-4 shrink-0 text-white/22 transition group-hover:translate-x-0.5 group-hover:text-emerald-200" aria-hidden="true" />
                </button>
              );
            }) : <EmptyState />}
          </div>
        </section>

        <div className="space-y-6">
          <section className="rounded-[24px] border border-emerald-300/14 bg-emerald-300/[0.045] p-5">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-sm font-semibold text-white">
                <BrainCircuit className="h-4 w-4 text-emerald-300" aria-hidden="true" />
                Observador da Bia
              </div>
              <span className="rounded-full bg-emerald-300/10 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-emerald-200">{overview.intelligence.observerActive ? "ativo" : "preparado"}</span>
            </div>
            <p className="mt-3 text-sm leading-6 text-white/55">
              Cada conclusão será salva com confiança, evidência da conversa e histórico de alterações.
            </p>
            <div className="mt-4 grid grid-cols-3 gap-2">
              <MiniStat label="Memórias" value="auditáveis" />
              <MiniStat label="Decisões" value="explicadas" />
              <MiniStat label="Envio" value="separado" />
            </div>
          </section>

          <section className="rounded-[24px] border border-white/10 bg-white/[0.035] p-5">
            <div className="flex items-center gap-2 text-sm font-semibold text-white">
              <WalletCards className="h-4 w-4 text-violet-300" aria-hidden="true" />
              Financeiro
            </div>
            <div className="mt-4 space-y-2.5">
              {overview.finance.accounts.map((account) => (
                <div key={account.id} className="flex items-center justify-between gap-3 rounded-xl border border-white/[0.08] bg-black/15 px-3.5 py-3">
                  <div className="flex items-center gap-2.5">
                    <Building2 className="h-4 w-4 text-white/45" aria-hidden="true" />
                    <div>
                      <div className="text-sm font-medium text-white/82">{account.name}</div>
                      <div className="text-[11px] text-white/35">conciliação manual inicial</div>
                    </div>
                  </div>
                  <span className="h-2 w-2 rounded-full bg-amber-300" title="Integração ainda não configurada" />
                </div>
              ))}
            </div>
            <div className="mt-3 flex items-center justify-between rounded-xl bg-amber-300/[0.06] px-3.5 py-3 text-xs">
              <span className="text-white/48">Comprovantes para conferir</span>
              <span className="font-semibold text-amber-200">{overview.finance.receiptsToReview}</span>
            </div>
          </section>

          <section className="rounded-[24px] border border-white/10 bg-white/[0.035] p-5">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-sm font-semibold text-white">
                <FileText className="h-4 w-4 text-sky-300" aria-hidden="true" />
                Fiscal
              </div>
              <span className="rounded-full border border-white/10 px-2 py-1 text-[10px] uppercase tracking-[0.12em] text-white/40">desativado</span>
            </div>
            <p className="mt-3 text-sm leading-5 text-white/45">Ambiente preparado para nota fiscal futura, sem emitir nada agora.</p>
          </section>
        </div>
      </div>

      <section className="rounded-[24px] border border-white/10 bg-white/[0.035] p-5 sm:p-6">
        <div className="flex items-center gap-2 text-sm font-semibold text-white">
          <Activity className="h-4 w-4 text-cyan-300" aria-hidden="true" />
          Atividade do WhatsApp
        </div>
        <p className="mt-1 text-sm text-white/45">Histórico técnico de mensagens recebidas e enviadas. Isso é coleta bruta; dados entendidos pela IA aparecem na Caixa de inteligência.</p>
        <div className="mt-5 grid gap-3 lg:grid-cols-3">
          {overview.recentActivities.length ? overview.recentActivities.slice(0, 6).map((item) => (
            <article key={item.id} className="rounded-2xl border border-white/[0.08] bg-black/15 p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="text-sm font-semibold text-white">{item.contactName}</div>
                <div className="text-[11px] text-white/30">{relativeTime(item.occurredAt)}</div>
              </div>
              <div className="mt-3 flex items-start gap-2">
                <BadgeCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-300" aria-hidden="true" />
                <div>
                  <div className="text-sm font-medium text-white/78">{item.title}</div>
                  <p className="mt-1 text-xs leading-5 text-white/42">{item.description}</p>
                </div>
              </div>
            </article>
          )) : <div className="lg:col-span-3"><EmptyState /></div>}
        </div>
      </section>
    </div>
  );
}

type MetricCardProps = {
  icon: typeof UsersRound;
  label: string;
  value: string;
  detail: string;
  tone: "emerald" | "sky" | "amber" | "violet";
};

const metricTones = {
  emerald: "border-emerald-300/14 bg-emerald-300/[0.055] text-emerald-200",
  sky: "border-sky-300/14 bg-sky-300/[0.055] text-sky-200",
  amber: "border-amber-300/14 bg-amber-300/[0.055] text-amber-200",
  violet: "border-violet-300/14 bg-violet-300/[0.055] text-violet-200",
};

function MetricCard({ icon: Icon, label, value, detail, tone }: MetricCardProps) {
  return (
    <article className={`rounded-[22px] border p-4 ${metricTones[tone]}`}>
      <div className="flex items-center justify-between gap-3">
        <div className="text-xs font-semibold uppercase tracking-[0.12em] text-white/42">{label}</div>
        <Icon className="h-4 w-4" aria-hidden="true" />
      </div>
      <div className="mt-3 truncate text-2xl font-semibold tracking-tight text-white">{value}</div>
      <div className="mt-1 text-xs text-white/38">{detail}</div>
    </article>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/[0.07] bg-black/15 px-2.5 py-3 text-center">
      <div className="text-[10px] uppercase tracking-[0.1em] text-white/30">{label}</div>
      <div className="mt-1 text-xs font-semibold text-emerald-100/80">{value}</div>
    </div>
  );
}

function EmptyState({ title = "Tudo em dia por aqui", detail = "Novas prioridades aparecerão automaticamente." }: { title?: string; detail?: string }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-white/10 px-5 py-10 text-center">
      <CheckCircle2 className="h-7 w-7 text-emerald-300/70" aria-hidden="true" />
      <div className="mt-3 text-sm font-medium text-white/70">{title}</div>
      <div className="mt-1 text-xs text-white/35">{detail}</div>
    </div>
  );
}
