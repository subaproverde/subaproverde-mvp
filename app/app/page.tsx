"use client";

import { useEffect, useMemo, useState, type ComponentType } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  Award,
  BadgeCheck,
  BarChart3,
  CalendarClock,
  CircleGauge,
  Clock3,
  Flag,
  MessageSquareWarning,
  RefreshCw,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  Trophy,
  XCircle,
} from "lucide-react";
import { supabaseBrowser } from "@/lib/supabaseClient";
import {
  ReputationThermometer,
  type ReputationLevel,
} from "@/app/components/reputation/ReputationThermometer";
import SellerSwitcher from "@/app/components/SellerSwitcher";

type MlMetric = {
  value?: number | string | null;
  rate?: number | string | null;
  period?: string | null;
};

type MlMe = {
  id?: number | string;
  nickname?: string;
  seller_experience?: string | null;
  power_seller_status?: string | null;
  tags?: string[];
  seller_reputation?: {
    level_id?: string | null;
    power_seller_status?: string | null;
    transactions?: {
      completed?: number;
      canceled?: number;
      ratings?: {
        positive?: number;
        neutral?: number;
        negative?: number;
      };
    };
    metrics?: {
      claims?: MlMetric;
      delayed_handling_time?: MlMetric;
      cancellations?: MlMetric;
      [key: string]: MlMetric | undefined;
    };
  };
};

type ImpactMetrics = {
  claims: number;
  mediations: number;
  cancellations: number;
  delays: number;
};

type MetricRates = {
  claims: number | null;
  cancellations: number | null;
  delays: number | null;
};

type MedalInfo = {
  label: string;
  detail: string;
  tone: "emerald" | "amber" | "sky" | "slate";
  raw: string;
};

type SellerCommerce = {
  completed: number;
  canceled: number;
  positive: number;
  neutral: number;
  negative: number;
  experience: string;
};

type AlertItem = {
  id: string | number;
  ml_case_id?: string | null;
  reason?: string | null;
  status?: string | null;
  synced_at?: string | null;
};

type CaseItem = {
  id: string | number;
  status?: string | null;
  protocol_number?: string | null;
  created_at?: string | null;
};

const emptyImpact: ImpactMetrics = {
  claims: 0,
  mediations: 0,
  cancellations: 0,
  delays: 0,
};

const emptyRates: MetricRates = {
  claims: null,
  cancellations: null,
  delays: null,
};

const emptyCommerce: SellerCommerce = {
  completed: 0,
  canceled: 0,
  positive: 0,
  neutral: 0,
  negative: 0,
  experience: "-",
};

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function numberValue(value: unknown) {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
}

function nullableNumber(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function levelFromMl(levelId?: string | null): ReputationLevel {
  const raw = String(levelId ?? "").trim().toLowerCase();
  if (!raw) return "amarelo";

  const num = Number(raw.split("_")[0]);
  if (!Number.isNaN(num) && num > 0) {
    if (num === 1) return "vermelho";
    if (num === 2) return "laranja";
    if (num === 3) return "amarelo";
    if (num === 4) return "verde";
    if (num === 5) return "verde";
  }

  if (raw.includes("red") || raw.includes("vermelho")) return "vermelho";
  if (raw.includes("orange") || raw.includes("laranja")) return "laranja";
  if (raw.includes("yellow") || raw.includes("amarelo") || raw.includes("amber")) return "amarelo";
  if (raw.includes("green") || raw.includes("verde")) return "verde";

  return "amarelo";
}

function repTextFromLevel(level: ReputationLevel) {
  if (level === "vermelho") return "Conta em risco";
  if (level === "laranja") return "Alto risco";
  if (level === "amarelo") return "Atenção";
  return "Saudável";
}

function repLabelFromLevel(level: ReputationLevel) {
  if (level === "vermelho") return "ALTO RISCO";
  if (level === "laranja") return "ALTO RISCO";
  if (level === "amarelo") return "ATENÇÃO";
  return "BOM";
}

function toneFromLevel(level: ReputationLevel) {
  if (level === "vermelho") return "rose";
  if (level === "laranja") return "orange";
  if (level === "amarelo") return "amber";
  return "emerald";
}

function medalFromMl(data: MlMe | null): MedalInfo {
  const rep = data?.seller_reputation ?? {};
  const rawCandidates = [
    rep.power_seller_status,
    data?.power_seller_status,
    ...(Array.isArray(data?.tags) ? data.tags : []),
  ]
    .filter(Boolean)
    .map((item) => String(item).toLowerCase());

  const raw = rawCandidates.join(" ");

  if (raw.includes("platinum")) {
    return {
      label: "Mercado Líder Platinum",
      detail: "Maior faixa de medalha do Mercado Livre",
      tone: "sky",
      raw,
    };
  }

  if (raw.includes("gold")) {
    return {
      label: "Mercado Líder Gold",
      detail: "Medalha avançada de performance",
      tone: "amber",
      raw,
    };
  }

  if (
    raw.includes("silver") ||
    raw.includes("mercadolider") ||
    raw.includes("mercado_lider") ||
    raw.includes("leader")
  ) {
    return {
      label: "Mercado Líder",
      detail: "Conta com medalha ativa",
      tone: "emerald",
      raw,
    };
  }

  return {
    label: "Sem medalha",
    detail: "ML não retornou medalha ativa",
    tone: "slate",
    raw,
  };
}

function metricRate(metric?: MlMetric) {
  return nullableNumber(metric?.rate);
}

function formatPercent(value: number | null) {
  if (value === null) return "-";
  const normalized = value > 1 ? value : value * 100;
  return `${normalized.toLocaleString("pt-BR", {
    maximumFractionDigits: normalized >= 10 ? 1 : 2,
  })}%`;
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("pt-BR").format(value);
}

function formatDateTime(value?: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function experienceLabel(value: string) {
  const raw = value.toUpperCase();
  if (raw === "NEWBIE") return "Nova";
  if (raw === "INTERMEDIATE") return "Intermediária";
  if (raw === "ADVANCED") return "Avançada";
  if (raw === "EXPERT") return "Especialista";
  return value && value !== "-" ? value : "-";
}

function panelClass(extra?: string) {
  return cn(
    "rounded-[1.6rem] border border-white/10 bg-white/[0.055] shadow-[0_24px_80px_rgba(0,0,0,0.18)] backdrop-blur-xl",
    extra
  );
}

export default function SellerSummaryPage() {
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  const [sellerId, setSellerId] = useState<string | null>(null);
  const [mlUserId, setMlUserId] = useState("");
  const [storeName, setStoreName] = useState("-");

  const [repLevel, setRepLevel] = useState<ReputationLevel>("amarelo");
  const [score, setScore] = useState<number | null>(null);
  const [medal, setMedal] = useState<MedalInfo>(() => medalFromMl(null));
  const [impactMetrics, setImpactMetrics] = useState<ImpactMetrics>(emptyImpact);
  const [rates, setRates] = useState<MetricRates>(emptyRates);
  const [commerce, setCommerce] = useState<SellerCommerce>(emptyCommerce);

  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [inProgress, setInProgress] = useState<CaseItem[]>([]);
  const [mediationsSource, setMediationsSource] = useState("cases");

  useEffect(() => {
    let alive = true;

    async function load() {
      setLoading(true);
      setLoadError("");

      const { data } = await supabaseBrowser.auth.getUser();
      const user = data?.user;

      if (!user) {
        if (!alive) return;
        setSellerId(null);
        setStoreName("-");
        setAlerts([]);
        setInProgress([]);
        setLoading(false);
        return;
      }

      try {
        const sellerRes = await fetch(`/api/me/seller?userId=${encodeURIComponent(user.id)}`, {
          cache: "no-store",
        });
        const sellerJson = await sellerRes.json().catch(() => ({}));

        if (!sellerRes.ok || !sellerJson?.sellerId) {
          throw new Error(sellerJson?.error ?? "Não foi possível identificar o seller ativo.");
        }

        const sid = String(sellerJson.sellerId);

        try {
          localStorage.setItem("activeSellerId", sid);
        } catch {
          // ignore
        }

        if (!alive) return;
        setSellerId(sid);

        const [meRes, mediationRes, compResult, casesResult] = await Promise.all([
          fetch(`/api/ml/account/me?sellerId=${encodeURIComponent(sid)}`, {
            cache: "no-store",
          }),
          fetch(
            `/api/ml/cases?sellerId=${encodeURIComponent(
              sid
            )}&type=mediacoes&impactFilter=impacting&page=1&limit=1`,
            { cache: "no-store" }
          ),
          supabaseBrowser
            .from("complaints")
            .select("id, ml_case_id, reason, status, impact_level, synced_at")
            .eq("seller_id", sid)
            .order("synced_at", { ascending: false })
            .limit(6),
          supabaseBrowser
            .from("cases")
            .select("id, status, protocol_number, created_at, complaint_id")
            .eq("seller_id", sid)
            .neq("status", "resolvido")
            .order("created_at", { ascending: false })
            .limit(5),
        ]);

        const meJson = await meRes.json().catch(() => ({}));

        if (alive && meRes.ok && meJson?.data) {
          const d: MlMe = meJson.data;
          const rep = d.seller_reputation ?? {};
          const metrics = rep.metrics ?? {};
          const transactions = rep.transactions ?? {};
          const ratings = transactions.ratings ?? {};

          const nextLevel = levelFromMl(rep.level_id ?? null);
          setStoreName(d.nickname ?? "-");
          setMlUserId(d.id ? String(d.id) : "");
          setRepLevel(nextLevel);
          setScore(numberValue(meJson?.computed?.score) || null);
          setMedal(medalFromMl(d));
          setImpactMetrics({
            claims: numberValue(metrics.claims?.value),
            mediations: 0,
            cancellations: numberValue(metrics.cancellations?.value),
            delays: numberValue(metrics.delayed_handling_time?.value),
          });
          setRates({
            claims: metricRate(metrics.claims),
            cancellations: metricRate(metrics.cancellations),
            delays: metricRate(metrics.delayed_handling_time),
          });
          setCommerce({
            completed: numberValue(transactions.completed),
            canceled: numberValue(transactions.canceled),
            positive: numberValue(ratings.positive),
            neutral: numberValue(ratings.neutral),
            negative: numberValue(ratings.negative),
            experience: String(d.seller_experience ?? "-"),
          });
        } else if (alive) {
          setRepLevel("amarelo");
          setScore(null);
          setStoreName("-");
          setMlUserId("");
          setMedal(medalFromMl(null));
          setImpactMetrics(emptyImpact);
          setRates(emptyRates);
          setCommerce(emptyCommerce);
        }

        const mediationJson = await mediationRes.json().catch(() => ({}));
        if (alive && mediationRes.ok && mediationJson?.ok) {
          const impactingMediations = numberValue(
            mediationJson.total ?? mediationJson.filterCounts?.impact?.impacting
          );
          const fallbackMediations = numberValue(mediationJson.counts?.mediacoes);
          const mediations = impactingMediations || fallbackMediations;
          setImpactMetrics((current) => ({ ...current, mediations }));
          setMediationsSource(impactingMediations ? "impactantes" : "detectadas");
        }

        if (alive) {
          setAlerts(compResult.data ?? []);
          setInProgress(casesResult.data ?? []);
        }
      } catch (err: unknown) {
        if (!alive) return;
        setLoadError(err instanceof Error ? err.message : "Não foi possível carregar o resumo.");
        setSellerId(null);
        setAlerts([]);
        setInProgress([]);
      } finally {
        if (alive) setLoading(false);
      }
    }

    load();

    return () => {
      alive = false;
    };
  }, []);

  const repLabel = useMemo(() => repLabelFromLevel(repLevel), [repLevel]);
  const repText = useMemo(() => repTextFromLevel(repLevel), [repLevel]);
  const tone = useMemo(() => toneFromLevel(repLevel), [repLevel]);

  const totalImpact = useMemo(
    () =>
      impactMetrics.claims +
      impactMetrics.mediations +
      impactMetrics.cancellations +
      impactMetrics.delays,
    [impactMetrics]
  );

  const maxImpact = Math.max(
    impactMetrics.claims,
    impactMetrics.mediations,
    impactMetrics.cancellations,
    impactMetrics.delays,
    1
  );

  const topRisk = useMemo(() => {
    const ordered = [
      { label: "reclamações", value: impactMetrics.claims },
      { label: "mediações", value: impactMetrics.mediations },
      { label: "cancelamentos", value: impactMetrics.cancellations },
      { label: "atrasos", value: impactMetrics.delays },
    ].sort((a, b) => b.value - a.value);

    if (!ordered[0]?.value) return "Sem impacto ativo no termômetro.";
    return `${ordered[0].value} ${ordered[0].label} puxando a prioridade.`;
  }, [impactMetrics]);

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-44 animate-pulse rounded-full bg-white/10" />
        <div className="h-[520px] animate-pulse rounded-[2rem] border border-white/10 bg-white/[0.04]" />
      </div>
    );
  }

  if (!sellerId) {
    return (
      <div className={cn(panelClass("p-8"), "max-w-2xl")}>
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-amber-300/20 bg-amber-400/10 text-amber-100">
          <AlertTriangle className="h-5 w-5" aria-hidden="true" />
        </div>
        <h1 className="mt-5 text-2xl font-semibold text-white">Resumo indisponível</h1>
        <p className="mt-2 text-sm leading-6 text-white/55">
          {loadError || "Você não tem seller conectado nesta conta."}
        </p>
        <Link
          className="mt-5 inline-flex rounded-xl border border-white/10 px-4 py-2 text-sm text-white/80 hover:bg-white/5"
          href="/login"
        >
          Voltar ao login
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <section className={cn(panelClass("overflow-hidden"), "relative")}>
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_0%,rgba(16,185,129,0.18),transparent_35%),radial-gradient(circle_at_92%_6%,rgba(250,204,21,0.13),transparent_28%)]" />
        <div className="relative p-5 lg:p-6">
          <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-[0.22em] text-emerald-100/70">
                <span>Resumo</span>
                <span className="h-1 w-1 rounded-full bg-emerald-300/60" />
                <span>Seller selecionado</span>
              </div>
              <div className="mt-3 flex flex-col gap-3 lg:flex-row lg:items-end">
                <h1 className="truncate text-3xl font-black text-white sm:text-4xl">
                  {storeName}
                </h1>
                <StatusPill tone={tone} label={repText} />
              </div>
              <div className="mt-3 flex flex-wrap gap-2 text-xs text-white/50">
                <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">
                  sellerId: <span className="font-mono text-white/70">{sellerId}</span>
                </span>
                {mlUserId ? (
                  <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">
                    ML user: <span className="font-mono text-white/70">{mlUserId}</span>
                  </span>
                ) : null}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <SellerSwitcher />
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="inline-flex h-11 items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 text-sm font-semibold text-white/75 hover:bg-white/10"
              >
                <RefreshCw className="h-4 w-4" aria-hidden="true" />
                Atualizar
              </button>
              <Link
                href="/app/cases"
                className="inline-flex h-11 items-center gap-2 rounded-xl border border-emerald-300/20 bg-emerald-400/10 px-4 text-sm font-semibold text-emerald-50 hover:bg-emerald-400/15"
              >
                Ver cases
              </Link>
            </div>
          </div>

          <div className="mt-6 grid gap-4 xl:grid-cols-[1.05fr_.95fr]">
            <div className="rounded-[1.4rem] border border-white/10 bg-black/20 p-4">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-white">Reputação do seller</div>
                  <div className="mt-1 text-xs text-white/45">Termômetro oficial da conta ativa</div>
                </div>
                <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/55">
                  {score ? `Score ${score}` : "Score -"}
                </div>
              </div>

              <div className="flex justify-center">
                <div className="w-full max-w-[620px]">
                  <ReputationThermometer
                    level={repLevel}
                    label={repLabel}
                    subtitle={repText}
                    scoreText={score ? `Score ${score}` : "Score -"}
                  />
                </div>
              </div>
            </div>

            <div className="grid gap-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <MedalCard medal={medal} />
                <FocusCard totalImpact={totalImpact} topRisk={topRisk} tone={tone} />
              </div>

              <div className="rounded-[1.4rem] border border-white/10 bg-black/20 p-4">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold text-white">Impactos no termômetro</div>
                    <div className="mt-1 text-xs text-white/45">
                      Reclamações, mediações, cancelamentos e atrasos
                    </div>
                  </div>
                  <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/55">
                    {formatNumber(totalImpact)} no total
                  </div>
                </div>

                <div className="space-y-3">
                  <ImpactRow
                    icon={MessageSquareWarning}
                    label="Reclamações"
                    value={impactMetrics.claims}
                    hint={`Taxa ${formatPercent(rates.claims)}`}
                    color="emerald"
                    max={maxImpact}
                  />
                  <ImpactRow
                    icon={Flag}
                    label="Mediações"
                    value={impactMetrics.mediations}
                    hint={mediationsSource === "impactantes" ? "Impactando reputação" : "Detectadas em cases"}
                    color="sky"
                    max={maxImpact}
                  />
                  <ImpactRow
                    icon={XCircle}
                    label="Cancelamentos"
                    value={impactMetrics.cancellations}
                    hint={`Taxa ${formatPercent(rates.cancellations)}`}
                    color="rose"
                    max={maxImpact}
                  />
                  <ImpactRow
                    icon={Clock3}
                    label="Atrasos"
                    value={impactMetrics.delays}
                    hint={`Taxa ${formatPercent(rates.delays)}`}
                    color="amber"
                    max={maxImpact}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-[.95fr_1.05fr]">
        <div className={panelClass("p-5")}>
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-white">Leitura rápida</h2>
              <p className="mt-1 text-sm text-white/45">O que merece atenção nesta conta agora.</p>
            </div>
            <Sparkles className="h-5 w-5 text-emerald-100/70" aria-hidden="true" />
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <InsightCard
              icon={CircleGauge}
              label="Prioridade"
              value={topRisk}
              tone={totalImpact > 0 ? "amber" : "emerald"}
            />
            <InsightCard
              icon={Trophy}
              label="Medalha"
              value={`${medal.label} | ${medal.detail}`}
              tone={medal.tone === "slate" ? "slate" : "emerald"}
            />
            <InsightCard
              icon={ShoppingBag}
              label="Vendas concluídas"
              value={`${formatNumber(commerce.completed)} concluídas no histórico ML`}
              tone="sky"
            />
            <InsightCard
              icon={BadgeCheck}
              label="Experiência ML"
              value={experienceLabel(commerce.experience)}
              tone="slate"
            />
          </div>
        </div>

        <div className={panelClass("p-5")}>
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-white">Saúde comercial</h2>
              <p className="mt-1 text-sm text-white/45">Volume, avaliações e sinal de confiança da conta.</p>
            </div>
            <BarChart3 className="h-5 w-5 text-emerald-100/70" aria-hidden="true" />
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            <CommerceStat label="Positivas" value={commerce.positive} tone="emerald" />
            <CommerceStat label="Neutras" value={commerce.neutral} tone="amber" />
            <CommerceStat label="Negativas" value={commerce.negative} tone="rose" />
          </div>

          <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.04] p-4">
            <div className="flex items-center justify-between gap-3 text-sm">
              <span className="text-white/55">Canceladas no histórico</span>
              <span className="font-semibold text-white">{formatNumber(commerce.canceled)}</span>
            </div>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full rounded-full bg-gradient-to-r from-emerald-300 via-amber-300 to-rose-300"
                style={{
                  width: `${Math.min(
                    100,
                    commerce.completed > 0 ? (commerce.canceled / commerce.completed) * 100 : 0
                  )}%`,
                }}
              />
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <TimelinePanel
          title="Alertas recentes"
          subtitle="Ocorrências sincronizadas para defesa"
          icon={AlertTriangle}
          empty="Nenhum alerta por enquanto."
          items={alerts}
          getTitle={(item) => item.reason ?? "Reclamação"}
          getMeta={(item) =>
            `Caso ML ${item.ml_case_id ?? "-"} | ${item.status ?? "sem status"} | ${formatDateTime(
              item.synced_at
            )}`
          }
        />
        <TimelinePanel
          title="Chamados em andamento"
          subtitle="Casos ainda não finalizados"
          icon={CalendarClock}
          empty="Nenhum chamado em andamento."
          items={inProgress}
          getTitle={(item) => `Caso #${String(item.id).slice(0, 6)} | ${item.status ?? "aberto"}`}
          getMeta={(item) =>
            `Protocolo ${item.protocol_number ?? "-"} | ${formatDateTime(item.created_at)}`
          }
        />
      </section>
    </div>
  );
}

function StatusPill({ tone, label }: { tone: string; label: string }) {
  return (
    <span
      className={cn(
        "inline-flex rounded-full border px-3 py-1 text-xs font-semibold",
        tone === "emerald" && "border-emerald-300/25 bg-emerald-400/10 text-emerald-50",
        tone === "amber" && "border-amber-300/25 bg-amber-400/10 text-amber-50",
        tone === "orange" && "border-orange-300/25 bg-orange-400/10 text-orange-50",
        tone === "rose" && "border-rose-300/25 bg-rose-400/10 text-rose-50"
      )}
    >
      {label}
    </span>
  );
}

function MedalCard({ medal }: { medal: MedalInfo }) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-[1.4rem] border p-4",
        medal.tone === "sky" && "border-sky-300/20 bg-sky-400/10",
        medal.tone === "amber" && "border-amber-300/25 bg-amber-400/10",
        medal.tone === "emerald" && "border-emerald-300/20 bg-emerald-400/10",
        medal.tone === "slate" && "border-white/10 bg-white/[0.045]"
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.18em] text-white/45">
            Medalha do seller
          </div>
          <div className="mt-2 text-xl font-black text-white">{medal.label}</div>
          <div className="mt-1 text-sm text-white/50">{medal.detail}</div>
        </div>
        <Award className="h-6 w-6 text-white/65" aria-hidden="true" />
      </div>
    </div>
  );
}

function FocusCard({
  totalImpact,
  topRisk,
  tone,
}: {
  totalImpact: number;
  topRisk: string;
  tone: string;
}) {
  return (
    <div className="rounded-[1.4rem] border border-white/10 bg-white/[0.045] p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.18em] text-white/45">
            Foco do dia
          </div>
          <div className="mt-2 text-3xl font-black text-white">{formatNumber(totalImpact)}</div>
          <div className="mt-1 text-sm text-white/50">{topRisk}</div>
        </div>
        <ShieldCheck
          className={cn(
            "h-6 w-6",
            tone === "emerald" && "text-emerald-200",
            tone === "amber" && "text-amber-200",
            tone === "orange" && "text-orange-200",
            tone === "rose" && "text-rose-200"
          )}
          aria-hidden="true"
        />
      </div>
    </div>
  );
}

function ImpactRow({
  icon: Icon,
  label,
  value,
  hint,
  color,
  max,
}: {
  icon: ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
  label: string;
  value: number;
  hint: string;
  color: "emerald" | "sky" | "rose" | "amber";
  max: number;
}) {
  const width = Math.max(4, Math.min(100, (value / max) * 100));

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.045] p-3">
      <div className="flex items-center gap-3">
        <div
          className={cn(
            "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border",
            color === "emerald" && "border-emerald-300/20 bg-emerald-400/10 text-emerald-100",
            color === "sky" && "border-sky-300/20 bg-sky-400/10 text-sky-100",
            color === "rose" && "border-rose-300/20 bg-rose-400/10 text-rose-100",
            color === "amber" && "border-amber-300/20 bg-amber-400/10 text-amber-100"
          )}
        >
          <Icon className="h-5 w-5" aria-hidden={true} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-3">
            <div className="text-sm font-semibold text-white">{label}</div>
            <div className="text-xl font-black text-white">{formatNumber(value)}</div>
          </div>
          <div className="mt-1 text-xs text-white/45">{hint}</div>
          <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/10">
            <div
              className={cn(
                "h-full rounded-full",
                color === "emerald" && "bg-emerald-300",
                color === "sky" && "bg-sky-300",
                color === "rose" && "bg-rose-300",
                color === "amber" && "bg-amber-300"
              )}
              style={{ width: `${width}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function InsightCard({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
  label: string;
  value: string;
  tone: "emerald" | "amber" | "sky" | "slate";
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.045] p-4">
      <div className="flex items-start gap-3">
        <div
          className={cn(
            "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border",
            tone === "emerald" && "border-emerald-300/20 bg-emerald-400/10 text-emerald-100",
            tone === "amber" && "border-amber-300/20 bg-amber-400/10 text-amber-100",
            tone === "sky" && "border-sky-300/20 bg-sky-400/10 text-sky-100",
            tone === "slate" && "border-white/10 bg-white/5 text-white/60"
          )}
        >
          <Icon className="h-5 w-5" aria-hidden={true} />
        </div>
        <div className="min-w-0">
          <div className="text-xs font-semibold uppercase tracking-[0.14em] text-white/40">
            {label}
          </div>
          <div className="mt-1 text-sm font-semibold leading-5 text-white/85">{value}</div>
        </div>
      </div>
    </div>
  );
}

function CommerceStat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "emerald" | "amber" | "rose";
}) {
  return (
    <div
      className={cn(
        "rounded-2xl border p-4",
        tone === "emerald" && "border-emerald-300/18 bg-emerald-400/10",
        tone === "amber" && "border-amber-300/18 bg-amber-400/10",
        tone === "rose" && "border-rose-300/18 bg-rose-400/10"
      )}
    >
      <div className="text-xs text-white/45">{label}</div>
      <div className="mt-2 text-2xl font-black text-white">{formatNumber(value)}</div>
    </div>
  );
}

function TimelinePanel<T extends { id: string | number }>({
  title,
  subtitle,
  icon: Icon,
  empty,
  items,
  getTitle,
  getMeta,
}: {
  title: string;
  subtitle: string;
  icon: ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
  empty: string;
  items: T[];
  getTitle: (item: T) => string;
  getMeta: (item: T) => string;
}) {
  return (
    <div className={panelClass("overflow-hidden")}>
      <div className="flex items-center justify-between gap-3 border-b border-white/10 px-5 py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-white/70">
            <Icon className="h-5 w-5" aria-hidden={true} />
          </div>
          <div>
            <div className="font-semibold text-white/90">{title}</div>
            <div className="text-xs text-white/45">{subtitle}</div>
          </div>
        </div>
        <Link href="/app/cases" className="text-sm text-white/55 hover:text-white">
          Ver cases
        </Link>
      </div>

      <div className="p-3">
        {items.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.03] p-5 text-sm text-white/50">
            {empty}
          </div>
        ) : (
          items.map((item) => (
            <Link
              key={item.id}
              href="/app/cases"
              className="mb-2 block rounded-2xl border border-white/10 bg-white/[0.045] p-4 transition hover:bg-white/[0.07]"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold text-white/90">{getTitle(item)}</div>
                  <div className="mt-1 truncate text-xs text-white/45">{getMeta(item)}</div>
                </div>
                <span className="shrink-0 rounded-full border border-white/10 px-3 py-1 text-xs text-white/55">
                  Abrir
                </span>
              </div>
            </Link>
          ))
        )}
      </div>
    </div>
  );
}
