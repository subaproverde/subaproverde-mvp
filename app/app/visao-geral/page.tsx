"use client";

import { useCallback, useEffect, useMemo, useState, type ComponentType } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  ArrowUpRight,
  Award,
  Clock3,
  MessageCircle,
  RefreshCw,
  Send,
  ShieldAlert,
  Sparkles,
  Store,
  TrendingUp,
  Users,
} from "lucide-react";
import { supabaseBrowser } from "@/lib/supabaseClient";
import { isAdminEmail } from "@/lib/adminEmails";

type TokenStatus = "connected" | "expiring" | "needs_reconnect" | "not_connected";
type ReputationLevel = "verde" | "amarelo" | "laranja" | "vermelho";

type AdminSellerItem = {
  id: string;
  name: string;
  nickname: string | null;
  ml_user_id: string;
  token: {
    status: TokenStatus;
    expires_at: string | null;
  };
};

type OverviewSeller = AdminSellerItem & {
  reputation: ReputationLevel;
  score: number | null;
  medal: string;
  metrics: {
    claims: number;
    mediations: number;
    cancellations: number;
    delays: number;
  };
  rates: {
    claims: number | null;
    mediations: number | null;
    cancellations: number | null;
    delays: number | null;
  };
  periodDays: number;
  riskScore: number;
  alerts: SellerAlert[];
};

type SellerAlert = {
  key: string;
  label: string;
  severity: "critico" | "atencao";
  detail: string;
};

type MlMeResponse = {
  ok?: boolean;
  data?: {
    nickname?: string | null;
    seller_reputation?: {
      level_id?: string | null;
      power_seller_status?: string | null;
      metrics?: {
        claims?: { value?: number | string | null; rate?: number | string | null };
        cancellations?: { value?: number | string | null; rate?: number | string | null };
        delayed_handling_time?: { value?: number | string | null; rate?: number | string | null };
        sales?: { period?: string | null };
      };
    };
    power_seller_status?: string | null;
    tags?: string[];
  };
  computed?: {
    score?: number | null;
  };
};

type MediationResponse = {
  ok?: boolean;
  metric?: {
    value?: number | string | null;
    rate?: number | string | null;
    periodDays?: number | string | null;
  };
};

const RATE_LIMITS = {
  claims: 0.01,
  mediations: 0.02,
  cancellations: 0.005,
  delays: 0.08,
} as const;

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
  const num = Number(raw.split("_")[0]);
  if (!Number.isNaN(num) && num > 0) {
    if (num === 1) return "vermelho";
    if (num === 2) return "laranja";
    if (num === 3) return "amarelo";
    return "verde";
  }

  if (raw.includes("red")) return "vermelho";
  if (raw.includes("orange")) return "laranja";
  if (raw.includes("yellow") || raw.includes("amber")) return "amarelo";
  if (raw.includes("green")) return "verde";
  return "amarelo";
}

function reputationLabel(level: ReputationLevel) {
  if (level === "verde") return "Saudável";
  if (level === "amarelo") return "Atenção";
  if (level === "laranja") return "Alto risco";
  return "Crítico";
}

function medalLabel(data?: MlMeResponse["data"]) {
  const raw = [
    data?.seller_reputation?.power_seller_status,
    data?.power_seller_status,
    ...(Array.isArray(data?.tags) ? data.tags : []),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  if (raw.includes("platinum")) return "Platinum";
  if (raw.includes("gold")) return "Gold";
  if (raw.includes("silver") || raw.includes("leader") || raw.includes("mercado_lider")) {
    return "Mercado Líder";
  }
  return "Sem medalha";
}

function formatPercent(value: number | null) {
  if (value === null) return "-";
  const normalized = value > 1 ? value : value * 100;
  return `${normalized.toLocaleString("pt-BR", {
    maximumFractionDigits: normalized >= 10 ? 1 : 2,
  })}%`;
}

function parsePeriodDays(period?: string | null) {
  const raw = String(period ?? "").toLowerCase();
  const match = raw.match(/(\d+)/);
  const n = match ? Number(match[1]) : 60;
  if (!Number.isFinite(n) || n <= 0) return 60;
  if (raw.includes("month")) return n * 30;
  return n;
}

function metricAlerts(seller: {
  rates: OverviewSeller["rates"];
  metrics: OverviewSeller["metrics"];
  periodDays: number;
}) {
  const defs = [
    { key: "claims", label: "Reclamações", limit: RATE_LIMITS.claims, value: seller.rates.claims },
    { key: "mediations", label: "Mediações", limit: RATE_LIMITS.mediations, value: seller.rates.mediations },
    {
      key: "cancellations",
      label: "Cancelamentos",
      limit: RATE_LIMITS.cancellations,
      value: seller.rates.cancellations,
    },
    { key: "delays", label: "Atrasos", limit: RATE_LIMITS.delays, value: seller.rates.delays },
  ];

  return defs.flatMap((item) => {
    if (item.value === null) return [];
    const ratio = item.value / item.limit;
    if (ratio < 0.75) return [];

    return [
      {
        key: item.key,
        label: item.label,
        severity: ratio >= 1 ? ("critico" as const) : ("atencao" as const),
        detail: `${formatPercent(item.value)} na janela de ${seller.periodDays} dias`,
      },
    ];
  });
}

function riskScore(input: {
  reputation: ReputationLevel;
  rates: OverviewSeller["rates"];
  alerts: SellerAlert[];
  tokenStatus: TokenStatus;
}) {
  const levelPenalty = {
    verde: 0,
    amarelo: 16,
    laranja: 32,
    vermelho: 48,
  }[input.reputation];

  const ratePenalty =
    Math.min(numberValue(input.rates.claims) / RATE_LIMITS.claims, 1.4) * 12 +
    Math.min(numberValue(input.rates.mediations) / RATE_LIMITS.mediations, 1.4) * 10 +
    Math.min(numberValue(input.rates.cancellations) / RATE_LIMITS.cancellations, 1.4) * 12 +
    Math.min(numberValue(input.rates.delays) / RATE_LIMITS.delays, 1.4) * 14;
  const tokenPenalty = input.tokenStatus === "connected" ? 0 : 12;

  return Math.round(Math.min(100, levelPenalty + ratePenalty + input.alerts.length * 8 + tokenPenalty));
}

function sellerMessage(seller?: OverviewSeller | null) {
  if (!seller) return "";
  const alerts = seller.alerts.length
    ? seller.alerts.map((alert) => `${alert.label}: ${alert.detail}`).join("; ")
    : "sem alerta crítico no momento";

  return `Resumo Suba Pro Verde - ${seller.name}\n\nReputação: ${reputationLabel(
    seller.reputation
  )}\nMedalha: ${seller.medal}\nAlertas: ${alerts}\n\nPrioridade sugerida: revisar impactos e abrir defesa nos casos elegíveis.`;
}

export default function AdminOverviewPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [items, setItems] = useState<OverviewSeller[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [message, setMessage] = useState("");
  const [sendStatus, setSendStatus] = useState("");

  const load = useCallback(async () => {
    try {
      setRefreshing(true);
      setError("");

      const {
        data: { session },
      } = await supabaseBrowser.auth.getSession();
      const user = session?.user;

      if (!session?.access_token || !user) {
        router.replace("/login");
        return;
      }

      const { data: rpcAdmin } = await supabaseBrowser.rpc("is_admin");
      if (!isAdminEmail(user.email) && !rpcAdmin) {
        router.replace("/app");
        return;
      }

      const sellersResponse = await fetch("/api/admin/sellers/list", {
        cache: "no-store",
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const sellersJson = await sellersResponse.json().catch(() => ({}));

      if (!sellersResponse.ok || sellersJson?.ok === false) {
        throw new Error(sellersJson?.error ?? "Falha ao carregar sellers.");
      }

      const sellers = ((sellersJson.items ?? []) as AdminSellerItem[]).filter(
        (seller) => seller.token.status === "connected" || seller.token.status === "expiring"
      );

      const hydrated = await Promise.all(
        sellers.slice(0, 24).map(async (seller) => {
          const [meResponse, mediationResponse] = await Promise.all([
            fetch(`/api/ml/account/me?sellerId=${encodeURIComponent(seller.id)}`, {
              cache: "no-store",
            }),
            fetch(`/api/ml/reputation/mediations?sellerId=${encodeURIComponent(seller.id)}`, {
              cache: "no-store",
            }),
          ]);

          const meJson = (await meResponse.json().catch(() => ({}))) as MlMeResponse;
          const mediationJson = (await mediationResponse.json().catch(() => ({}))) as MediationResponse;
          const data = meJson.data;
          const metrics = data?.seller_reputation?.metrics ?? {};
          const reputation = levelFromMl(data?.seller_reputation?.level_id ?? null);
          const periodDays = parsePeriodDays(metrics.sales?.period);
          const mediationRate = nullableNumber(mediationJson.metric?.rate);

          const overviewBase = {
            ...seller,
            name: data?.nickname ?? seller.name,
            reputation,
            score: nullableNumber(meJson.computed?.score),
            medal: medalLabel(data),
            metrics: {
              claims: numberValue(metrics.claims?.value),
              mediations: numberValue(mediationJson.metric?.value),
              cancellations: numberValue(metrics.cancellations?.value),
              delays: numberValue(metrics.delayed_handling_time?.value),
            },
            rates: {
              claims: nullableNumber(metrics.claims?.rate),
              mediations: mediationRate,
              cancellations: nullableNumber(metrics.cancellations?.rate),
              delays: nullableNumber(metrics.delayed_handling_time?.rate),
            },
            periodDays: numberValue(mediationJson.metric?.periodDays) || periodDays,
          };
          const alerts = metricAlerts(overviewBase);

          return {
            ...overviewBase,
            alerts,
            riskScore: riskScore({
              reputation,
              rates: overviewBase.rates,
              alerts,
              tokenStatus: seller.token.status,
            }),
          };
        })
      );

      const sorted = hydrated.sort((a, b) => b.riskScore - a.riskScore);
      setItems(sorted);
      setSelectedId((current) => current || sorted[0]?.id || "");
      setMessage((current) => current || sellerMessage(sorted[0]));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao carregar Visão Geral.");
      setItems([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [router]);

  useEffect(() => {
    load();
  }, [load]);

  const selected = useMemo(
    () => items.find((item) => item.id === selectedId) ?? items[0] ?? null,
    [items, selectedId]
  );

  const summary = useMemo(() => {
    const totalImpact = items.reduce(
      (acc, item) =>
        acc +
        item.metrics.claims +
        item.metrics.mediations +
        item.metrics.cancellations +
        item.metrics.delays,
      0
    );

    return {
      sellers: items.length,
      attention: items.filter((item) => item.riskScore >= 45).length,
      medalRisk: items.filter((item) => item.medal !== "Sem medalha" && item.alerts.length > 0).length,
      totalImpact,
    };
  }, [items]);

  function selectSeller(seller: OverviewSeller) {
    setSelectedId(seller.id);
    setMessage(sellerMessage(seller));
    setSendStatus("");
  }

  async function sendToAdminWhatsapp() {
    if (!message.trim()) return;
    setSendStatus("Enviando...");
    const response = await fetch("/api/admin/notifications/whatsapp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: message.trim(), forceText: true }),
    });
    const json = await response.json().catch(() => ({}));
    setSendStatus(response.ok && json?.ok !== false ? "Mensagem enviada." : "Falha ao enviar.");
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-9 w-56 animate-pulse rounded-full bg-white/10" />
        <div className="h-[560px] animate-pulse rounded-[2rem] border border-white/10 bg-white/[0.04]" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <section className="rounded-[1.7rem] border border-white/10 bg-white/[0.055] p-5 shadow-[0_24px_80px_rgba(0,0,0,0.18)] backdrop-blur-xl">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-300/20 bg-emerald-400/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-emerald-100">
              <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
              Admin
            </div>
            <h1 className="mt-4 text-3xl font-black text-white">Visão Geral</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-white/50">
              Reputação dos sellers ativos, alertas próximos do limite e oportunidades de ação.
            </p>
          </div>

          <button
            type="button"
            onClick={load}
            disabled={refreshing}
            className="inline-flex h-11 items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 text-sm font-semibold text-white/75 hover:bg-white/10 disabled:opacity-60"
          >
            <RefreshCw className={cn("h-4 w-4", refreshing && "animate-spin")} aria-hidden="true" />
            Atualizar
          </button>
        </div>

        {error ? (
          <div className="mt-4 rounded-2xl border border-rose-300/20 bg-rose-400/10 p-4 text-sm text-rose-50">
            {error}
          </div>
        ) : null}

        <div className="mt-5 grid gap-3 md:grid-cols-4">
          <TopMetric icon={Users} label="Sellers ativos" value={summary.sellers} tone="emerald" />
          <TopMetric icon={ShieldAlert} label="Em atenção" value={summary.attention} tone="amber" />
          <TopMetric icon={Award} label="Medalhas em risco" value={summary.medalRisk} tone="rose" />
          <TopMetric icon={TrendingUp} label="Impactos no radar" value={summary.totalImpact} tone="sky" />
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.15fr_.85fr]">
        <div className="rounded-[1.7rem] border border-white/10 bg-white/[0.055] p-4 backdrop-blur-xl">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-white">Sellers por prioridade</h2>
              <p className="mt-1 text-sm text-white/45">Lista compacta, ordenada por risco operacional.</p>
            </div>
            <Store className="h-5 w-5 text-white/45" aria-hidden="true" />
          </div>

          <div className="space-y-3">
            {items.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-white/10 p-6 text-sm text-white/50">
                Nenhum seller conectado para exibir.
              </div>
            ) : (
              items.map((seller) => (
                <SellerPriorityCard
                  key={seller.id}
                  seller={seller}
                  selected={selected?.id === seller.id}
                  onSelect={() => selectSeller(seller)}
                />
              ))
            )}
          </div>
        </div>

        <aside className="space-y-4">
          <div className="rounded-[1.7rem] border border-white/10 bg-white/[0.055] p-4 backdrop-blur-xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold text-white">Central de ação</h2>
                <p className="mt-1 text-sm text-white/45">
                  {selected ? selected.name : "Selecione um seller"}
                </p>
              </div>
              <MessageCircle className="h-5 w-5 text-emerald-100/70" aria-hidden="true" />
            </div>

            <textarea
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              rows={9}
              className="mt-4 w-full resize-none rounded-2xl border border-white/10 bg-black/20 p-4 text-sm leading-6 text-white outline-none placeholder:text-white/30"
              placeholder="Mensagem operacional..."
            />

            <div className="mt-3 flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={sendToAdminWhatsapp}
                className="inline-flex items-center gap-2 rounded-xl border border-emerald-300/20 bg-emerald-400/10 px-4 py-2 text-sm font-semibold text-emerald-50 hover:bg-emerald-400/15"
              >
                <Send className="h-4 w-4" aria-hidden="true" />
                Enviar alerta
              </button>
              {selected ? (
                <Link
                  href={`/app/cases?sellerId=${encodeURIComponent(selected.id)}`}
                  className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-white/70 hover:bg-white/10"
                >
                  Abrir cases
                  <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
                </Link>
              ) : null}
            </div>

            {sendStatus ? <div className="mt-3 text-xs text-white/45">{sendStatus}</div> : null}
          </div>

          <div className="rounded-[1.7rem] border border-white/10 bg-white/[0.055] p-4 backdrop-blur-xl">
            <h2 className="text-base font-semibold text-white">Alertas quentes</h2>
            <div className="mt-4 space-y-2">
              {items.flatMap((seller) =>
                seller.alerts.slice(0, 2).map((alert) => (
                  <button
                    key={`${seller.id}-${alert.key}`}
                    type="button"
                    onClick={() => selectSeller(seller)}
                    className="w-full rounded-2xl border border-white/10 bg-white/[0.04] p-3 text-left hover:bg-white/[0.07]"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-sm font-semibold text-white">{seller.name}</span>
                      <SeverityBadge severity={alert.severity} />
                    </div>
                    <div className="mt-1 text-xs text-white/45">
                      {alert.label} | {alert.detail}
                    </div>
                  </button>
                ))
              ).slice(0, 6)}
            </div>
          </div>
        </aside>
      </section>
    </div>
  );
}

function TopMetric({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
  label: string;
  value: number;
  tone: "emerald" | "amber" | "rose" | "sky";
}) {
  return (
    <div
      className={cn(
        "rounded-2xl border p-4",
        tone === "emerald" && "border-emerald-300/18 bg-emerald-400/10",
        tone === "amber" && "border-amber-300/18 bg-amber-400/10",
        tone === "rose" && "border-rose-300/18 bg-rose-400/10",
        tone === "sky" && "border-sky-300/18 bg-sky-400/10"
      )}
    >
      <div className="flex items-center justify-between">
        <Icon className="h-5 w-5 text-white/60" aria-hidden={true} />
        <div className="text-3xl font-black text-white">{value}</div>
      </div>
      <div className="mt-3 text-xs font-semibold uppercase tracking-[0.14em] text-white/45">{label}</div>
    </div>
  );
}

function SellerPriorityCard({
  seller,
  selected,
  onSelect,
}: {
  seller: OverviewSeller;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "w-full rounded-2xl border p-4 text-left transition",
        selected ? "border-emerald-300/25 bg-emerald-400/10" : "border-white/10 bg-white/[0.04] hover:bg-white/[0.07]"
      )}
    >
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="truncate text-base font-bold text-white">{seller.name}</span>
            <ReputationBadge level={seller.reputation} />
            <span className="rounded-full border border-white/10 px-2 py-1 text-[11px] text-white/45">
              {seller.medal}
            </span>
          </div>
          <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-white/45">
            <span>Claims {formatPercent(seller.rates.claims)}</span>
            <span>Mediações {formatPercent(seller.rates.mediations)}</span>
            <span>Atrasos {formatPercent(seller.rates.delays)}</span>
            <span>Janela {seller.periodDays}d</span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="text-right">
            <div className="text-2xl font-black text-white">{seller.riskScore}</div>
            <div className="text-[11px] text-white/40">risco</div>
          </div>
          <div className="grid grid-cols-4 gap-1 text-center text-[11px] text-white/55">
            <MiniImpact label="R" value={seller.metrics.claims} />
            <MiniImpact label="M" value={seller.metrics.mediations} />
            <MiniImpact label="C" value={seller.metrics.cancellations} />
            <MiniImpact label="A" value={seller.metrics.delays} />
          </div>
        </div>
      </div>

      {seller.alerts.length > 0 ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {seller.alerts.slice(0, 3).map((alert) => (
            <span
              key={alert.key}
              className={cn(
                "rounded-full border px-2 py-1 text-[11px]",
                alert.severity === "critico"
                  ? "border-rose-300/25 bg-rose-400/10 text-rose-50"
                  : "border-amber-300/25 bg-amber-400/10 text-amber-50"
              )}
            >
              {alert.label}: {alert.detail}
            </span>
          ))}
        </div>
      ) : null}
    </button>
  );
}

function MiniImpact({ label, value }: { label: string; value: number }) {
  return (
    <div className="min-w-10 rounded-xl border border-white/10 bg-black/15 px-2 py-1">
      <div className="font-bold text-white">{value}</div>
      <div className="text-white/35">{label}</div>
    </div>
  );
}

function ReputationBadge({ level }: { level: ReputationLevel }) {
  return (
    <span
      className={cn(
        "rounded-full border px-2 py-1 text-[11px] font-semibold",
        level === "verde" && "border-emerald-300/25 bg-emerald-400/10 text-emerald-50",
        level === "amarelo" && "border-amber-300/25 bg-amber-400/10 text-amber-50",
        level === "laranja" && "border-orange-300/25 bg-orange-400/10 text-orange-50",
        level === "vermelho" && "border-rose-300/25 bg-rose-400/10 text-rose-50"
      )}
    >
      {reputationLabel(level)}
    </span>
  );
}

function SeverityBadge({ severity }: { severity: SellerAlert["severity"] }) {
  const Icon = severity === "critico" ? AlertTriangle : Clock3;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[11px] font-semibold",
        severity === "critico"
          ? "border-rose-300/25 bg-rose-400/10 text-rose-50"
          : "border-amber-300/25 bg-amber-400/10 text-amber-50"
      )}
    >
      <Icon className="h-3 w-3" aria-hidden="true" />
      {severity === "critico" ? "Crítico" : "Atenção"}
    </span>
  );
}
