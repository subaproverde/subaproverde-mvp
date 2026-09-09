"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowRight, BarChart3, BrainCircuit, CalendarDays, CheckCircle2, ChevronRight,
  CircleDollarSign, Clock3, KanbanSquare, MessageCircleMore, RefreshCw,
  Search, Sparkles, Target, UserRoundSearch, UsersRound,
} from "lucide-react";
import { authFetch } from "@/lib/authFetch";
import { crmDemoOverview } from "@/lib/crm/demo";
import type { CrmOverview, CrmPriorityKind } from "@/lib/crm/types";

const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const priorityLabels: Record<CrmPriorityKind, string> = { conversation: "Conversa", task: "Tarefa", receipt: "Financeiro" };
const priorityIcons: Record<CrmPriorityKind, typeof MessageCircleMore> = { conversation: MessageCircleMore, task: Clock3, receipt: CircleDollarSign };

function relativeTime(value: string | null) {
  if (!value) return "sem horário";
  const date = new Date(value);
  const minutes = Math.round((date.getTime() - Date.now()) / 60_000);
  if (Math.abs(minutes) < 1) return "agora";
  if (minutes > 0 && minutes < 60) return `em ${minutes} min`;
  if (minutes < 0 && minutes > -60) return `há ${Math.abs(minutes)} min`;
  if (date.toDateString() === new Date().toDateString()) return date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  return date.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
}

export default function CrmDashboard() {
  const [overview, setOverview] = useState<CrmOverview>(crmDemoOverview);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

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

  useEffect(() => { void loadOverview(); }, [loadOverview]);

  const todayPriorities = useMemo(() => overview.priorities.filter((item) => item.kind === "task").slice(0, 4), [overview.priorities]);
  const commercialPriorities = useMemo(() => overview.priorities.filter((item) => item.kind !== "task").slice(0, 5), [overview.priorities]);

  return (
    <div className="space-y-5">
      <section className="border-b border-spv-line pb-7">
        <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
          <div className="max-w-3xl">
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-emerald-300/20 bg-emerald-300/10 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.16em] text-spv-accent-text">
              <Sparkles className="h-3.5 w-3.5" aria-hidden="true" /> Central comercial
            </div>
            <h1 className="text-3xl font-semibold tracking-[-0.035em] text-spv-ink sm:text-4xl">Sua operação de vendas,<span className="block text-spv-accent-text">sem depender da sua memória.</span></h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-spv-muted sm:text-base">Veja quem precisa de atenção, organize cada oportunidade e acompanhe os próximos compromissos em um só lugar.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Link href="/admin/crm/clientes" className="inline-flex h-11 items-center gap-2 rounded-xl bg-emerald-400 px-4 text-sm font-semibold text-spv-on-accent transition hover:bg-emerald-300"><UsersRound className="h-4 w-4" aria-hidden="true" /> Clientes</Link>
            <Link href="/admin/crm/agenda" className="inline-flex h-11 items-center gap-2 rounded-xl border border-spv-line bg-spv-surface px-4 text-sm font-medium text-spv-ink transition hover:bg-spv-raised"><CalendarDays className="h-4 w-4" aria-hidden="true" /> Novo compromisso</Link>
            <button type="button" onClick={() => void loadOverview()} disabled={loading} className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-spv-line bg-spv-surface text-spv-ink transition hover:bg-spv-raised disabled:cursor-wait disabled:opacity-60" aria-label="Atualizar CRM"><RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} aria-hidden="true" /></button>
          </div>
        </div>
      </section>

      {error ? <div className="rounded-xl border border-amber-300/15 bg-amber-300/[0.07] px-4 py-3 text-sm text-amber-100/75">Exibindo a estrutura do CRM enquanto os dados são atualizados. {error}</div> : null}

      <nav className="grid gap-2 sm:grid-cols-2 min-[951px]:hidden" aria-label="Áreas do CRM">
        <WorkspaceLink href="/admin/crm/funil" icon={KanbanSquare} title="Funil" detail="Jornada dos leads" />
        <WorkspaceLink href="/admin/crm/clientes" icon={UserRoundSearch} title="Clientes" detail="Cadastro e qualificação" />
        <WorkspaceLink href="/admin/crm/agenda" icon={CalendarDays} title="Agenda" detail="Atendimentos e follow-ups" />
        <WorkspaceLink href="/admin/crm/conversas" icon={MessageCircleMore} title="Conversas" detail="WhatsApp integrado" />
        <WorkspaceLink href="/admin/crm/financeiro" icon={CircleDollarSign} title="Financeiro" detail="Contas e comprovantes" />
        <WorkspaceLink href="/admin/crm/relatorios" icon={BarChart3} title="Relatórios" detail="Remoções e resultados" />
        <WorkspaceLink href="/admin/crm/gestor-ia" icon={Sparkles} title="Gestor de IA" detail="Operação, custos e autonomia" />
        <WorkspaceLink href="/admin/crm/inteligencia" icon={BrainCircuit} title="Inteligência" detail="Memórias e auditoria" subdued />
      </nav>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard icon={UsersRound} label="Leads ativos" value={String(overview.metrics.activeLeads)} detail="em negociação agora" tone="emerald" />
        <MetricCard icon={MessageCircleMore} label="Precisam de você" value={String(overview.metrics.waitingTeam)} detail="decisões e conversas" tone="sky" />
        <MetricCard icon={Clock3} label="Follow-ups vencidos" value={String(overview.metrics.overdueFollowUps)} detail="retornos atrasados" tone="amber" />
        <MetricCard icon={CircleDollarSign} label="A receber" value={money.format(overview.metrics.openReceivables)} detail="serviços concluídos" tone="violet" />
      </section>

      <div className="grid gap-5 xl:grid-cols-[1.25fr_0.75fr]">
        <section className="rounded-xl border border-spv-line bg-spv-surface p-5 sm:p-6">
          <div className="flex items-start justify-between gap-4">
            <div><div className="flex items-center gap-2 text-sm font-semibold text-spv-ink"><Target className="h-4 w-4 text-spv-accent-text" aria-hidden="true" /> Funil de vendas</div><p className="mt-1 text-sm text-spv-muted">Onde cada oportunidade está e quanto ela representa.</p></div>
            <Link href="/admin/crm/funil" className="inline-flex items-center gap-1 text-sm font-medium text-spv-accent-text hover:text-spv-accent-text">Abrir funil <ArrowRight className="h-4 w-4" aria-hidden="true" /></Link>
          </div>
          <div className="mt-5 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
            {overview.pipeline.map((stage, index) => (
              <article key={stage.stage} className="relative overflow-hidden rounded-xl border border-spv-line bg-spv-page p-3.5">
                <div className="absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-emerald-400 to-cyan-300" style={{ opacity: 1 - index * 0.12 }} />
                <div className="text-[11px] font-semibold uppercase tracking-[0.11em] text-spv-muted">{stage.label}</div>
                <div className="mt-3 flex items-end justify-between gap-2"><span className="text-2xl font-semibold text-spv-ink">{stage.count}</span><span className="text-[11px] text-spv-muted">{money.format(stage.value)}</span></div>
              </article>
            ))}
          </div>
        </section>

        <section className="rounded-xl border border-emerald-300/12 bg-emerald-300/[0.04] p-5 sm:p-6">
          <div className="flex items-start justify-between gap-3"><div><div className="flex items-center gap-2 text-sm font-semibold text-spv-ink"><CalendarDays className="h-4 w-4 text-spv-accent-text" aria-hidden="true" /> Agenda de hoje</div><p className="mt-1 text-sm text-spv-muted">Compromissos e retornos prioritários.</p></div><Link href="/admin/crm/agenda" className="text-xs font-semibold text-spv-accent-text hover:text-spv-accent-text">Ver agenda</Link></div>
          <div className="mt-4 space-y-2.5">
            {todayPriorities.length ? todayPriorities.map((item) => <AgendaItem key={item.id} title={item.title} name={item.contactName} time={relativeTime(item.occurredAt)} urgent={item.urgent} />) : (
              <div className="rounded-xl border border-dashed border-spv-line px-4 py-6 text-center"><CheckCircle2 className="mx-auto h-6 w-6 text-spv-accent-text" aria-hidden="true" /><div className="mt-2 text-sm font-medium text-spv-ink">Agenda em dia</div><div className="mt-1 text-xs text-spv-muted">Novos compromissos aparecerão aqui.</div></div>
            )}
          </div>
        </section>
      </div>

      <section className="rounded-xl border border-spv-line bg-spv-surface p-5 sm:p-6">
        <div className="flex items-start justify-between gap-4"><div><div className="flex items-center gap-2 text-sm font-semibold text-spv-ink"><UserRoundSearch className="h-4 w-4 text-sky-300" aria-hidden="true" /> Clientes que precisam de ação</div><p className="mt-1 text-sm text-spv-muted">A lista que você realmente precisa olhar agora.</p></div><Link href="/admin/crm/clientes" className="inline-flex items-center gap-1 text-sm font-medium text-spv-accent-text hover:text-spv-accent-text">Ver todos <ArrowRight className="h-4 w-4" aria-hidden="true" /></Link></div>
        <div className="mt-5 grid gap-3 lg:grid-cols-2">
          {commercialPriorities.length ? commercialPriorities.map((item) => {
            const Icon = priorityIcons[item.kind];
            return <article key={`${item.kind}-${item.id}`} className="group flex items-start gap-3 rounded-xl border border-spv-line bg-spv-page p-4 transition hover:border-emerald-300/20 hover:bg-emerald-300/[0.035]">
              <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border ${item.urgent ? "border-amber-300/20 bg-amber-300/[0.08] text-amber-200" : "border-sky-300/15 bg-sky-300/[0.07] text-sky-200"}`}><Icon className="h-4.5 w-4.5" aria-hidden="true" /></div>
              <div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><span className="font-semibold text-spv-ink">{item.contactName}</span><span className="rounded-full bg-spv-surface px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-spv-muted">{priorityLabels[item.kind]}</span><span className="text-xs text-spv-muted">{relativeTime(item.occurredAt)}</span></div><div className="mt-1.5 text-sm font-medium text-spv-ink">{item.title}</div><p className="mt-1 line-clamp-2 text-sm leading-5 text-spv-muted">{item.detail}</p></div>
              <ChevronRight className="mt-3 h-4 w-4 shrink-0 text-spv-muted transition group-hover:translate-x-0.5 group-hover:text-spv-accent-text" aria-hidden="true" />
            </article>;
          }) : <div className="rounded-xl border border-dashed border-spv-line px-5 py-8 text-center text-sm text-spv-muted lg:col-span-2">Nenhum cliente exige ação imediata.</div>}
        </div>
      </section>

      <section className="flex flex-col gap-4 rounded-xl border border-spv-line bg-spv-page p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3"><div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-300/[0.08] text-violet-200"><BrainCircuit className="h-4.5 w-4.5" aria-hidden="true" /></div><div><div className="text-sm font-semibold text-spv-ink">Inteligência trabalhando nos bastidores</div><p className="mt-1 text-xs leading-5 text-spv-muted">{overview.intelligence.pendingSuggestions} sugestões aguardando revisão · {overview.intelligence.runsToday} análises hoje</p></div></div>
        <Link href="/admin/crm/inteligencia" className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-spv-line bg-spv-surface px-4 text-sm font-medium text-spv-ink hover:bg-spv-raised hover:text-spv-ink">Ver memórias e decisões <ArrowRight className="h-4 w-4" aria-hidden="true" /></Link>
      </section>
    </div>
  );
}

function WorkspaceLink({ href, icon: Icon, title, detail, subdued = false }: { href: string; icon: typeof Search; title: string; detail: string; subdued?: boolean }) {
  return <Link href={href} className={`group flex items-center gap-3 rounded-xl border p-3.5 transition ${subdued ? "border-spv-line bg-spv-surface" : "border-spv-line bg-spv-surface hover:border-emerald-300/20 hover:bg-emerald-300/[0.045]"}`}><div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${subdued ? "bg-violet-300/[0.07] text-violet-200" : "bg-emerald-300/[0.08] text-spv-accent-text"}`}><Icon className="h-4.5 w-4.5" aria-hidden="true" /></div><div className="min-w-0 flex-1"><div className="text-sm font-semibold text-spv-ink">{title}</div><div className="truncate text-xs text-spv-muted">{detail}</div></div><ChevronRight className="h-4 w-4 text-spv-muted transition group-hover:translate-x-0.5 group-hover:text-spv-accent-text" aria-hidden="true" /></Link>;
}

const metricTones = { emerald: "border-spv-line bg-spv-surface text-spv-accent-text", sky: "border-spv-line bg-spv-surface text-spv-accent-text", amber: "border-spv-line bg-spv-surface text-amber-300", violet: "border-spv-line bg-spv-surface text-spv-accent-text" };

function MetricCard({ icon: Icon, label, value, detail, tone }: { icon: typeof UsersRound; label: string; value: string; detail: string; tone: keyof typeof metricTones }) {
  return <article className={`rounded-xl border p-4 ${metricTones[tone]}`}><div className="flex items-center justify-between gap-3"><div className="text-xs font-semibold uppercase tracking-[0.12em] text-spv-muted">{label}</div><Icon className="h-4 w-4" aria-hidden="true" /></div><div className="mt-3 truncate text-2xl font-semibold tracking-tight text-spv-ink">{value}</div><div className="mt-1 text-xs text-spv-muted">{detail}</div></article>;
}

function AgendaItem({ title, name, time, urgent }: { title: string; name: string; time: string; urgent: boolean }) {
  return <div className="flex items-center gap-3 rounded-xl border border-spv-line bg-spv-page px-3 py-3"><div className={`w-12 shrink-0 rounded-lg px-2 py-1.5 text-center text-xs font-semibold ${urgent ? "bg-amber-300/10 text-amber-200" : "bg-emerald-300/10 text-spv-accent-text"}`}>{time}</div><div className="min-w-0 flex-1"><div className="truncate text-sm font-medium text-spv-ink">{title}</div><div className="mt-0.5 truncate text-xs text-spv-muted">{name}</div></div></div>;
}
