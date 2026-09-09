"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity, AlertTriangle, ArrowRight, Bot, BrainCircuit, CheckCircle2, CircleDollarSign,
  Clock3, Gauge, HeartPulse, Lightbulb, MessageCircleMore, RefreshCw, ShieldCheck,
  Sparkles, Target, WandSparkles, Zap,
} from "lucide-react";
import { authFetch } from "@/lib/authFetch";
import CrmSectionNav from "../components/CrmSectionNav";

type ManagerData = {
  generatedAt: string;
  health: {
    bridgeOnline: boolean; agentOnline: boolean; whatsapp: string; autoSend: boolean; model: string; effort: string;
    lastPollAt: string | null; lastError: string | null; transcriptionEnabled: boolean; crmSyncEnabled: boolean;
    messageSettleSeconds: number;
    queues: { inbox: number; outbox: number; awaitingApproval: number; failed: number; paused: number; learnedRules: number };
  };
  metrics: {
    analyses24h: number; analyses7d: number; autonomyRate: number; approvalRate: number; averageConfidence: number;
    cost24h: number; cost7d: number; averageCost: number; pendingMemories: number; pendingActions: number;
  };
  attention: Array<{ id: string; kind: string; contactName: string; title: string; detail: string; href: string; priority: number; occurredAt: string | null }>;
  models: Array<{ model: string; calls: number; cost: number }>;
  savings: { paidNoReplyRuns: number; closelyRepeatedRuns: number; estimatedAvoidableCalls: number };
  automations: Array<{ id: string; title: string; detail: string; status: "active" | "human_review" | "evaluation"; impact: string }>;
  guardrails: Array<{ title: string; detail: string; active: boolean }>;
};

const usd = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "USD", minimumFractionDigits: 3 });

function relative(value: string | null) {
  if (!value) return "sem registro";
  const minutes = Math.max(0, Math.round((Date.now() - new Date(value).getTime()) / 60_000));
  if (minutes < 1) return "agora";
  if (minutes < 60) return `há ${minutes} min`;
  if (minutes < 1_440) return `há ${Math.round(minutes / 60)}h`;
  return `há ${Math.round(minutes / 1_440)}d`;
}

export default function AiManagerClient() {
  const [data, setData] = useState<ManagerData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true);
    setError("");
    try {
      const response = await authFetch("/api/admin/crm/ai-manager", { cache: "no-store" });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || "Não foi possível carregar a gestão da IA.");
      setData(body as ManagerData);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Falha ao carregar a central.");
    } finally {
      if (!quiet) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    const timer = window.setInterval(() => void load(true), 30_000);
    return () => window.clearInterval(timer);
  }, [load]);

  const healthy = Boolean(data?.health.agentOnline && data?.health.bridgeOnline && data?.health.whatsapp === "open");
  const topModel = useMemo(() => data?.models[0], [data]);

  return (
    <div className="space-y-5">
      <CrmSectionNav />

      <section className="overflow-hidden rounded-xl border border-cyan-300/15 bg-spv-surface p-5 shadow-none sm:p-7">
        <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-cyan-300/20 bg-cyan-300/10 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.16em] text-cyan-100"><WandSparkles className="h-3.5 w-3.5" /> Gestor de IA</div>
            <h1 className="mt-3 text-3xl font-semibold tracking-[-0.035em] text-spv-ink sm:text-4xl">A Bia trabalha.<span className="block text-cyan-200">Você enxerga e governa.</span></h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-spv-muted sm:text-base">Operação, autonomia, custos e ações prioritárias em uma única tela. A IA cuida do volume; você entra apenas nas exceções relevantes.</p>
          </div>
          <div className="flex items-center gap-3">
            <div className={`flex items-center gap-3 rounded-xl border px-4 py-3 ${healthy ? "border-emerald-300/20 bg-emerald-300/[0.08]" : "border-amber-300/20 bg-amber-300/[0.08]"}`}>
              <span className={`relative flex h-3 w-3 ${healthy ? "text-spv-accent-text" : "text-amber-300"}`}><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-current opacity-50" /><span className="relative inline-flex h-3 w-3 rounded-full bg-current" /></span>
              <div><div className="text-sm font-semibold text-spv-ink">{healthy ? "Bia ativa" : "Verificar operação"}</div><div className="text-xs text-spv-muted">{data?.health.lastPollAt ? `último ciclo ${relative(data.health.lastPollAt)}` : "aguardando estado"}</div></div>
            </div>
            <button type="button" onClick={() => void load()} disabled={loading} className="inline-flex h-12 w-12 items-center justify-center rounded-xl border border-spv-line bg-spv-surface text-spv-ink hover:bg-spv-raised" aria-label="Atualizar central"><RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /></button>
          </div>
        </div>
      </section>

      {error ? <div className="rounded-xl border border-rose-300/15 bg-rose-300/[0.07] px-4 py-3 text-sm text-rose-100/80">{error}</div> : null}

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <Metric icon={HeartPulse} label="Operação" value={healthy ? "Online" : "Atenção"} detail={data?.health.autoSend ? "envio autônomo ativo" : "envio autônomo pausado"} tone={healthy ? "emerald" : "amber"} />
        <Metric icon={Gauge} label="Autonomia em 7 dias" value={`${Math.round((data?.metrics.autonomyRate || 0) * 100)}%`} detail={`${data?.metrics.analyses7d || 0} decisões observadas`} tone="cyan" />
        <Metric icon={CircleDollarSign} label="Custo em 24h" value={usd.format(data?.metrics.cost24h || 0)} detail={`${usd.format(data?.metrics.cost7d || 0)} em 7 dias`} tone="violet" />
        <Metric icon={ShieldCheck} label="Confiança média" value={`${Math.round((data?.metrics.averageConfidence || 0) * 100)}%`} detail={`${Math.round((data?.metrics.approvalRate || 0) * 100)}% escalaram`} tone="sky" />
        <Metric icon={Lightbulb} label="Aprendizados" value={String(data?.health.queues.learnedRules || 0)} detail={`${(data?.metrics.pendingMemories || 0) + (data?.metrics.pendingActions || 0)} aguardam revisão`} tone="amber" />
      </section>

      <div className="grid gap-5 xl:grid-cols-[1.2fr_0.8fr]">
        <section className="rounded-xl border border-spv-line bg-spv-surface p-5 sm:p-6">
          <div className="flex items-start justify-between gap-4"><div><div className="flex items-center gap-2 text-sm font-semibold text-spv-ink"><Target className="h-4 w-4 text-spv-accent-text" /> Próximas melhores ações</div><p className="mt-1 text-sm text-spv-muted">Uma fila curta e ordenada para você não depender da memória.</p></div><span className="rounded-full bg-emerald-300/10 px-2.5 py-1 text-xs font-semibold text-spv-accent-text">{data?.attention.length || 0} prioridades</span></div>
          <div className="mt-4 space-y-2.5">
            {data?.attention.length ? data.attention.map((item, index) => (
              <Link key={item.id} href={item.href} className="group flex items-start gap-3 rounded-xl border border-spv-line bg-spv-page p-4 transition hover:border-emerald-300/20 hover:bg-emerald-300/[0.035]">
                <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-sm font-semibold ${index < 3 ? "bg-amber-300/10 text-amber-200" : "bg-spv-surface text-spv-muted"}`}>{index + 1}</div>
                <div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><span className="font-semibold text-spv-ink">{item.contactName}</span><span className="text-xs text-spv-muted">{relative(item.occurredAt)}</span></div><div className="mt-1 text-sm font-medium text-spv-ink">{item.title}</div><p className="mt-1 line-clamp-2 text-xs leading-5 text-spv-muted">{item.detail}</p></div>
                <ArrowRight className="mt-3 h-4 w-4 shrink-0 text-spv-muted transition group-hover:translate-x-0.5 group-hover:text-spv-accent-text" />
              </Link>
            )) : <div className="rounded-xl border border-dashed border-spv-line px-5 py-10 text-center"><CheckCircle2 className="mx-auto h-7 w-7 text-spv-accent-text" /><div className="mt-2 text-sm font-medium text-spv-muted">Nada urgente agora</div><div className="mt-1 text-xs text-spv-muted">A central continuará acompanhando.</div></div>}
          </div>
        </section>

        <section className="rounded-xl border border-cyan-300/12 bg-cyan-300/[0.035] p-5 sm:p-6">
          <div className="flex items-center gap-2 text-sm font-semibold text-spv-ink"><Bot className="h-4 w-4 text-cyan-200" /> Motor da Bia</div>
          <div className="mt-4 space-y-3">
            <StatusLine label="WhatsApp" value={data?.health.whatsapp === "open" ? "Conectado" : data?.health.whatsapp || "Desconhecido"} ok={data?.health.whatsapp === "open"} />
            <StatusLine label="Agente" value={data?.health.agentOnline ? "Processando" : "Sem sinal"} ok={Boolean(data?.health.agentOnline)} />
            <StatusLine label="Transcrição" value={data?.health.transcriptionEnabled ? "Ativa" : "Desativada"} ok={Boolean(data?.health.transcriptionEnabled)} />
            <StatusLine label="Sincronização CRM" value={data?.health.crmSyncEnabled ? "Ativa" : "Desativada"} ok={Boolean(data?.health.crmSyncEnabled)} />
          </div>
          <div className="mt-5 rounded-xl border border-spv-line bg-spv-page p-4"><div className="text-[10px] font-semibold uppercase tracking-[0.13em] text-spv-muted">Configuração de qualidade</div><div className="mt-2 text-lg font-semibold text-spv-ink">{data?.health.model || "Claude Opus"}</div><div className="mt-1 text-xs text-spv-muted">Esforço {data?.health.effort || "high"} · agrupa mensagens por {data?.health.messageSettleSeconds || 60}s</div></div>
          {data?.health.lastError ? <div className="mt-3 flex min-w-0 gap-2 break-words rounded-xl border border-rose-300/14 bg-rose-300/[0.06] p-3 text-xs leading-5 text-rose-100/70"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> <span className="min-w-0">{data.health.lastError}</span></div> : null}
          <Link href="/admin/crm/conversas" className="mt-4 inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl border border-spv-line bg-spv-surface text-sm font-medium text-spv-ink hover:bg-spv-raised">Abrir conversas <MessageCircleMore className="h-4 w-4" /></Link>
        </section>
      </div>

      <section className="rounded-xl border border-spv-line bg-spv-surface p-5 sm:p-6">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between"><div><div className="flex items-center gap-2 text-sm font-semibold text-spv-ink"><Zap className="h-4 w-4 text-amber-200" /> Automações da operação</div><p className="mt-1 text-sm text-spv-muted">O que já funciona, o que exige conferência e o que está em avaliação.</p></div><div className="text-xs text-spv-muted">Foco: mais autonomia sem trocar qualidade por economia</div></div>
        <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {data?.automations.map((automation) => <article key={automation.id} className="rounded-xl border border-spv-line bg-spv-page p-4"><div className="flex items-start justify-between gap-3"><div className="flex h-9 w-9 items-center justify-center rounded-xl bg-cyan-300/[0.08] text-cyan-200"><Sparkles className="h-4 w-4" /></div><AutomationBadge status={automation.status} /></div><h2 className="mt-3 text-sm font-semibold text-spv-ink">{automation.title}</h2><p className="mt-1.5 text-xs leading-5 text-spv-muted">{automation.detail}</p><div className="mt-3 text-[10px] font-semibold uppercase tracking-[0.12em] text-cyan-200/55">Impacto: {automation.impact}</div></article>)}
        </div>
      </section>

      <div className="grid gap-5 xl:grid-cols-2">
        <section className="rounded-xl border border-spv-line bg-spv-surface p-5 sm:p-6"><div className="flex items-center gap-2 text-sm font-semibold text-spv-ink"><ShieldCheck className="h-4 w-4 text-spv-accent-text" /> Limites que protegem a operação</div><div className="mt-4 space-y-2.5">{data?.guardrails.map((item) => <div key={item.title} className="flex items-start gap-3 rounded-xl border border-spv-line bg-spv-page p-3"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-spv-accent-text" /><div><div className="text-sm font-medium text-spv-ink">{item.title}</div><div className="mt-0.5 text-xs leading-5 text-spv-muted">{item.detail}</div></div></div>)}</div></section>
        <section className="min-w-0 rounded-xl border border-spv-line bg-spv-surface p-5 sm:p-6"><div className="flex items-center gap-2 text-sm font-semibold text-spv-ink"><CircleDollarSign className="h-4 w-4 text-violet-200" /> Eficiência de créditos</div><div className="mt-4 grid grid-cols-2 gap-3"><SmallMetric label="Média por análise" value={usd.format(data?.metrics.averageCost || 0)} /><SmallMetric label="Chamadas evitáveis" value={String(data?.savings.estimatedAvoidableCalls || 0)} /></div><div className="mt-4 rounded-xl border border-violet-300/12 bg-violet-300/[0.05] p-4"><div className="text-sm font-medium text-violet-100">Estratégia recomendada</div><p className="mt-1.5 text-xs leading-5 text-spv-muted">Opus continua nas conversas. Antes de reduzir modelo, a economia vem de eliminar chamadas repetidas, encerramentos simples e análises de ruído. O roteador econômico só entra após passar pelos exemplos reais da Bia.</p></div>{topModel ? <div className="mt-3 flex min-w-0 flex-col gap-1 rounded-xl border border-spv-line px-3 py-2.5 text-xs sm:flex-row sm:items-center sm:justify-between"><span className="min-w-0 truncate text-spv-muted">Maior consumo: {topModel.model}</span><span className="shrink-0 font-semibold text-spv-ink">{topModel.calls} chamadas · {usd.format(topModel.cost)}</span></div> : null}<Link href="/admin/crm/inteligencia" className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-violet-200 hover:text-violet-100">Ver decisões e memórias <ArrowRight className="h-4 w-4" /></Link></section>
      </div>

      <div className="flex items-start gap-3 rounded-xl border border-spv-line bg-spv-page p-4"><BrainCircuit className="mt-0.5 h-5 w-5 shrink-0 text-cyan-200" /><div><div className="text-sm font-semibold text-spv-ink">Como essa central evolui</div><p className="mt-1 text-xs leading-5 text-spv-muted">Cada correção sua vira regra versionada. A autonomia só aumenta quando os testes reais confirmarem qualidade; toda mudança de modelo terá comparação, limite de custo e retorno rápido para a versão anterior.</p></div></div>
    </div>
  );
}

const tones = { emerald: "border-emerald-300/14 bg-emerald-300/[0.055] text-spv-accent-text", amber: "border-amber-300/14 bg-amber-300/[0.055] text-amber-200", cyan: "border-cyan-300/14 bg-cyan-300/[0.055] text-cyan-200", sky: "border-sky-300/14 bg-sky-300/[0.055] text-sky-200", violet: "border-violet-300/14 bg-violet-300/[0.055] text-violet-200" };

function Metric({ icon: Icon, label, value, detail, tone }: { icon: typeof Activity; label: string; value: string; detail: string; tone: keyof typeof tones }) { return <article className={`rounded-xl border p-4 ${tones[tone]}`}><div className="flex items-center justify-between gap-3"><div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-spv-muted">{label}</div><Icon className="h-4 w-4" /></div><div className="mt-3 truncate text-2xl font-semibold text-spv-ink">{value}</div><div className="mt-1 text-xs text-spv-muted">{detail}</div></article>; }
function SmallMetric({ label, value }: { label: string; value: string }) { return <div className="rounded-xl border border-spv-line bg-spv-page p-3"><div className="text-[10px] uppercase tracking-[0.1em] text-spv-muted">{label}</div><div className="mt-1.5 text-lg font-semibold text-spv-ink">{value}</div></div>; }
function StatusLine({ label, value, ok }: { label: string; value: string; ok: boolean }) { return <div className="flex items-center justify-between gap-3 rounded-xl border border-spv-line bg-spv-page px-3 py-2.5"><span className="text-xs text-spv-muted">{label}</span><span className={`inline-flex items-center gap-1.5 text-xs font-semibold ${ok ? "text-spv-accent-text" : "text-amber-200"}`}><span className={`h-1.5 w-1.5 rounded-full ${ok ? "bg-emerald-300" : "bg-amber-300"}`} />{value}</span></div>; }
function AutomationBadge({ status }: { status: "active" | "human_review" | "evaluation" }) { const labels = { active: "Ativa", human_review: "Confere", evaluation: "Em teste" }; const classes = { active: "bg-emerald-300/10 text-spv-accent-text", human_review: "bg-amber-300/10 text-amber-200", evaluation: "bg-violet-300/10 text-violet-200" }; return <span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.1em] ${classes[status]}`}>{labels[status]}</span>; }
