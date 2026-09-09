"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { supabaseBrowser } from "@/lib/supabaseClient";
import { authFetch } from "@/lib/authFetch";
import type { ReputationLevel } from "@/app/components/reputation/ReputationThermometer";
import SellerSwitcher from "@/app/components/SellerSwitcher";
import SellerSummaryView from "./SellerSummaryView";
import s from "./seller-home.module.css";

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
  mediations: number | null;
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
  mediations: null,
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

export default function SellerSummaryPage() {
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [accountAvailable, setAccountAvailable] = useState(false);
  const [mediationAvailable, setMediationAvailable] = useState(false);

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
  const [mediationsPeriod, setMediationsPeriod] = useState("60 dias");

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
        const sellerRes = await authFetch(`/api/me/seller?userId=${encodeURIComponent(user.id)}`, {
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
          authFetch(`/api/ml/account/me?sellerId=${encodeURIComponent(sid)}`, {
            cache: "no-store",
          }),
          authFetch(`/api/ml/reputation/mediations?sellerId=${encodeURIComponent(sid)}`, {
            cache: "no-store",
          }),
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
          setAccountAvailable(true);
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
            mediations: null,
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
          setMediationAvailable(true);
          const mediations = numberValue(mediationJson.metric?.value);
          const mediationRate = nullableNumber(mediationJson.metric?.rate);
          const periodDays = numberValue(mediationJson.metric?.periodDays);
          setImpactMetrics((current) => ({ ...current, mediations }));
          setRates((current) => ({ ...current, mediations: mediationRate }));
          setMediationsPeriod(periodDays > 0 ? `${periodDays} dias` : "período do ML");
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

  const repText = useMemo(() => repTextFromLevel(repLevel), [repLevel]);

  const totalImpact = useMemo(
    () =>
      impactMetrics.claims +
      impactMetrics.mediations +
      impactMetrics.cancellations +
      impactMetrics.delays,
    [impactMetrics]
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
    return <div className={s.loading} role="status" aria-label="Carregando resumo da conta"><span>Preparando o resumo da sua conta…</span><div className={s.skeleton} /></div>;
  }
  if (!sellerId) {
    return <section className={`${s.panel} ${s.unavailable}`}><AlertTriangle size={30} /><h1>Vamos conectar sua operação.</h1><p>{loadError || "Entre na sua conta para visualizar o seller conectado e acompanhar a reputação."}</p><Link className={s.primary} href="/login?next=%2Fapp">Entrar na minha conta</Link></section>;
  }
  const display = (value: number) => accountAvailable ? formatNumber(value) : "—";
  return <SellerSummaryView
    name={storeName}
    sellerId={sellerId}
    mlUserId={mlUserId}
    actions={<><SellerSwitcher variant="graphite" /><button type="button" onClick={() => window.location.reload()} className={s.secondaryButton}><RefreshCw size={15} aria-hidden="true" />Atualizar</button></>}
    reputation={{ level: repLevel, label: repText, score, available: accountAvailable }}
    medal={accountAvailable ? medal : { label: "Indisponível", detail: "Aguardando dados da conta" }}
    totalImpact={accountAvailable && mediationAvailable ? totalImpact : null}
    priority={accountAvailable && mediationAvailable ? topRisk : "Atualize os dados para identificar a prioridade da conta."}
    impacts={[
      { label: "Reclamações", value: accountAvailable ? impactMetrics.claims : null, rate: accountAvailable ? formatPercent(rates.claims) : "—" },
      { label: "Mediações", value: mediationAvailable ? impactMetrics.mediations : null, rate: mediationAvailable ? formatPercent(rates.mediations) : "—", period: mediationsPeriod },
      { label: "Cancelamentos", value: accountAvailable ? impactMetrics.cancellations : null, rate: accountAvailable ? formatPercent(rates.cancellations) : "—" },
      { label: "Atrasos", value: accountAvailable ? impactMetrics.delays : null, rate: accountAvailable ? formatPercent(rates.delays) : "—" },
    ]}
    commerce={{ completed: display(commerce.completed), canceled: display(commerce.canceled), positive: display(commerce.positive), neutral: display(commerce.neutral), negative: display(commerce.negative), experience: accountAvailable ? experienceLabel(commerce.experience) : "—" }}
    alerts={alerts.map((item) => ({ id: item.id, title: item.reason ?? "Reclamação", meta: `Caso ML ${item.ml_case_id ?? "—"} · ${item.status ?? "sem status"} · ${formatDateTime(item.synced_at)}` }))}
    cases={inProgress.map((item) => ({ id: item.id, title: `Caso #${String(item.id).slice(0, 6)} · ${item.status ?? "aberto"}`, meta: `Protocolo ${item.protocol_number ?? "—"} · ${formatDateTime(item.created_at)}` }))}
  />;
}
