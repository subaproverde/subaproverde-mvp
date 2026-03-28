"use client";
console.log("🔥🔥🔥 NOVO CODIGO /app RODANDO 🔥🔥🔥");
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabaseBrowser } from "@/lib/supabaseClient";
import {
  ReputationThermometer,
  type ReputationLevel,
} from "@/app/components/reputation/ReputationThermometer";

type MlMe = {
  nickname?: string;
  seller_reputation?: {
    level_id?: string | null;
    metrics?: any;
  };
};

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
  if (raw.includes("yellow") || raw.includes("amarelo") || raw.includes("amber"))
    return "amarelo";
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
  if (level === "vermelho") return "red";
  if (level === "laranja") return "orange";
  if (level === "amarelo") return "yellow";
  return "green";
}

function toneGlow(tone: "red" | "orange" | "yellow" | "green") {
  if (tone === "red") return "shadow-[0_0_70px_rgba(255,60,60,0.12)]";
  if (tone === "orange") return "shadow-[0_0_70px_rgba(255,155,60,0.13)]";
  if (tone === "yellow") return "shadow-[0_0_70px_rgba(255,220,90,0.12)]";
  return "shadow-[0_0_70px_rgba(70,255,140,0.12)]";
}

function toneLine(tone: "red" | "orange" | "yellow" | "green") {
  if (tone === "red") return "from-red-500/70 via-red-500/22 to-transparent";
  if (tone === "orange")
    return "from-orange-500/70 via-orange-500/22 to-transparent";
  if (tone === "yellow")
    return "from-yellow-400/60 via-yellow-400/18 to-transparent";
  return "from-emerald-400/60 via-emerald-400/18 to-transparent";
}

function tonePill(tone: "red" | "orange" | "yellow" | "green") {
  if (tone === "red") return "border-red-500/30 bg-red-500/10 text-red-200";
  if (tone === "orange")
    return "border-orange-500/35 bg-orange-500/10 text-orange-200";
  if (tone === "yellow")
    return "border-yellow-400/30 bg-yellow-400/10 text-yellow-100";
  return "border-emerald-400/30 bg-emerald-400/10 text-emerald-100";
}

function panelSurface() {
  return "border border-white/10 bg-gradient-to-b from-white/[0.06] to-black/[0.25] backdrop-blur-md";
}

export default function SellerDashboardPage() {
  console.log("### PAGE /app CARREGOU ###");
  const [loading, setLoading] = useState(true);

  const [sellerId, setSellerId] = useState<string | null>(null);
  const [storeName, setStoreName] = useState<string>("—");

  const [repLevel, setRepLevel] = useState<ReputationLevel>("amarelo");
  const [repText, setRepText] = useState<string>("Carregando...");

  const [claimsImpact, setClaimsImpact] = useState<number>(0);
  const [delaysImpact, setDelaysImpact] = useState<number>(0);
  const [claimsRecent, setClaimsRecent] = useState<number>(0);
  const [ordersLate, setOrdersLate] = useState<number>(0);

  const [alerts, setAlerts] = useState<any[]>([]);
  const [inProgress, setInProgress] = useState<any[]>([]);

  const [connectErr, setConnectErr] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);

  useEffect(() => {
    (async () => {
      setLoading(true);

      const { data } = await supabaseBrowser.auth.getUser();
      const user = data?.user;

      console.log("[/app] user =", user);

      if (!user) {
        console.log("[/app] sem usuário logado");
        setSellerId(null);
        setStoreName("—");
        setAlerts([]);
        setInProgress([]);
        setLoading(false);
        return;
      }

      let sid: string | null = null;

      console.log(
        "[/app] localStorage activeSellerId =",
        localStorage.getItem("activeSellerId")
      );

      try {
        sid = localStorage.getItem("activeSellerId");
      } catch (err) {
        console.log("[/app] erro lendo localStorage", err);
      }

      if (!sid) {
        console.log("[/app] sem activeSellerId, caindo no fallback /api/me/seller");

        const r = await fetch(`/api/me/seller?userId=${user.id}`, {
          cache: "no-store",
        });

        const j = await r.json().catch(() => ({}));

        console.log("[/app] resposta /api/me/seller =", j);

        if (!r.ok || !j?.sellerId) {
          console.log("[/app] /api/me/seller não retornou seller válido");
          setSellerId(null);
          setStoreName("—");
          setAlerts([]);
          setInProgress([]);
          setLoading(false);
          return;
        }

        sid = String(j.sellerId);

        try {
          localStorage.setItem("activeSellerId", sid);
          console.log("[/app] salvou activeSellerId no localStorage =", sid);
        } catch (err) {
          console.log("[/app] erro salvando localStorage", err);
        }
      }

      console.log("[/app] sid final antes dos fetches =", sid);

      setSellerId(sid);
      console.log("[/app] setSellerId =", sid);

      console.log("[/app] chamando /api/ml/account/me com sellerId =", sid);

      const meRes = await fetch(`/api/ml/account/me?sellerId=${sid}`, {
        cache: "no-store",
      });

      const meJson = await meRes.json().catch(() => ({}));

      console.log("[/app] resposta /api/ml/account/me =", meJson);

      if (meRes.ok && meJson?.data) {
        const d: MlMe = meJson.data;

        console.log("[/app] nickname vindo da API ML =", d.nickname);
        console.log(
          "[/app] reputation level vindo da API ML =",
          d.seller_reputation?.level_id
        );

        setStoreName(d.nickname ?? "—");

        const lvl = levelFromMl(d.seller_reputation?.level_id ?? null);
        setRepLevel(lvl);
        setRepText(repTextFromLevel(lvl));

        const m = d.seller_reputation?.metrics ?? {};
        const claims = Number(m?.claims?.value ?? 0);
        const delays = Number(m?.delayed_handling_time?.value ?? 0);

        console.log("[/app] metrics claims =", claims);
        console.log("[/app] metrics delays =", delays);

        setClaimsRecent(claims);
        setDelaysImpact(delays);

        setClaimsImpact(claims);
        setOrdersLate(delays);
      } else {
        console.log("[/app] /api/ml/account/me falhou ou veio sem data");

        setRepLevel("amarelo");
        setRepText("Indisponível");
        setStoreName("—");
        setClaimsRecent(0);
        setDelaysImpact(0);
        setClaimsImpact(0);
        setOrdersLate(0);
      }

      try {
        console.log("[/app] consultando complaints com seller_id =", sid);

        const { data: comp, error: compError } = await supabaseBrowser
          .from("complaints")
          .select("id, ml_case_id, reason, status, impact_level, synced_at")
          .eq("seller_id", sid)
          .order("synced_at", { ascending: false })
          .limit(8);

        console.log("[/app] resposta complaints =", comp);
        console.log("[/app] erro complaints =", compError);

        setAlerts(comp ?? []);

        console.log("[/app] consultando cases com seller_id =", sid);

        const { data: cs, error: csError } = await supabaseBrowser
          .from("cases")
          .select("id, status, protocol_number, created_at, complaint_id")
          .eq("seller_id", sid)
          .neq("status", "resolvido")
          .order("created_at", { ascending: false })
          .limit(6);

        console.log("[/app] resposta cases =", cs);
        console.log("[/app] erro cases =", csError);

        setInProgress(cs ?? []);
      } catch (err) {
        console.log("[/app] erro geral consultando Supabase =", err);
        setAlerts([]);
        setInProgress([]);
      }

      console.log("[/app] finalizou carregamento");
      setLoading(false);
    })();
  }, []);

  const repLabel = useMemo(() => repLabelFromLevel(repLevel), [repLevel]);
  const tone = useMemo(() => toneFromLevel(repLevel), [repLevel]);

  async function startConnect() {
    try {
      setConnectErr(null);
      setConnecting(true);

      const { data } = await supabaseBrowser.auth.getUser();
      const user = data?.user;

      if (!user?.id) {
        setConnectErr("Você não está logado. Faça login novamente.");
        setConnecting(false);
        return;
      }

      window.location.href = `/api/ml/connect?userId=${encodeURIComponent(user.id)}`;
    } catch (e: any) {
      setConnectErr(e?.message ?? "Falha ao iniciar conexão com Mercado Livre.");
      setConnecting(false);
    }
  }

  if (loading) {
    return (
      <div className="p-6">
        <div className="text-sm text-white/60">Carregando dashboard…</div>
      </div>
    );
  }

  if (!sellerId) {
    return (
      <div className="p-6 space-y-3">
        <h1 className="text-2xl font-semibold text-white">Dashboard</h1>
        <p className="text-sm text-white/60">
          Você não tem seller conectado nesta conta.
        </p>

        <div className="flex flex-wrap gap-2">
          <Link
            className="inline-flex rounded-xl border border-white/10 px-4 py-2 hover:bg-white/5 text-white/80"
            href="/login"
          >
            Voltar ao login
          </Link>

          <Link
            className="inline-flex rounded-xl border border-emerald-400/20 bg-gradient-to-b from-emerald-400/20 to-emerald-900/20 px-4 py-2 text-white/90 hover:from-emerald-400/25 hover:to-emerald-900/25"
            href="/app/sellers"
          >
            Conectar Mercado Livre
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <section
        className={[
          "rounded-2xl overflow-hidden",
          "border border-white/10",
          "bg-black/25",
          "backdrop-blur-md",
          toneGlow(tone),
        ].join(" ")}
      >
        <div className="relative">
          <div className="pointer-events-none absolute -inset-20 bg-[radial-gradient(ellipse_at_top_left,rgba(90,255,140,0.10),transparent_55%),radial-gradient(ellipse_at_top_right,rgba(255,210,90,0.10),transparent_55%)]" />
          <div className="relative">
            <div className="px-4 py-3">
              <div className={["rounded-xl", panelSurface(), "overflow-hidden"].join(" ")}>
                <div className={`h-1.5 bg-gradient-to-r ${toneLine(tone)}`} />
                <div className="px-3 py-2.5 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                  <div className="flex items-start gap-3 min-w-0">
                    <div className="h-9 w-9 rounded-xl border border-white/10 bg-black/40 flex items-center justify-center">
                      <span className="text-yellow-300">⚠️</span>
                    </div>

                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-white">
                        ALERTA DA CONTA —{" "}
                        <span className="text-yellow-200">{repLabel}</span>
                      </div>
                      <div className="text-[11px] text-white/50 truncate">
                        {storeName} — sellerId:{" "}
                        <span className="font-mono">{sellerId}</span>
                      </div>

                      <div className="mt-2 flex flex-wrap gap-2">
                        <span
                          className={`text-[11px] px-2 py-1 rounded-full border ${tonePill(tone)}`}
                        >
                          {repText}
                        </span>

                        <span className="text-[11px] px-2 py-1 rounded-full border border-white/10 bg-white/5 text-white/70">
                          Reclamações:{" "}
                          <span className="text-white/90">{claimsRecent}</span>
                        </span>

                        <span className="text-[11px] px-2 py-1 rounded-full border border-white/10 bg-white/5 text-white/70">
                          Atrasos:{" "}
                          <span className="text-white/90">{delaysImpact}</span>
                        </span>
                      </div>

                      {connectErr ? (
                        <div className="mt-2 text-[12px] text-red-300">
                          {connectErr}
                        </div>
                      ) : null}
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={startConnect}
                      disabled={connecting}
                      className={[
                        "inline-flex items-center justify-center rounded-xl border border-white/10",
                        "bg-gradient-to-b from-emerald-400/20 to-emerald-900/20 px-3.5 py-2 text-sm text-white/90",
                        "hover:from-emerald-400/25 hover:to-emerald-900/25",
                        "disabled:opacity-60 disabled:cursor-not-allowed",
                      ].join(" ")}
                    >
                      {connecting ? "Abrindo OAuth..." : "Conectar Mercado Livre"}
                    </button>

                    <Link
                      href="/app/cases"
                      className="inline-flex items-center justify-center rounded-xl border border-white/10 bg-white/5 px-3.5 py-2 text-sm text-white/85 hover:bg-white/10"
                    >
                      Abrir defesa urgente →
                    </Link>
                  </div>
                </div>
              </div>
            </div>

            <div className="px-4 pb-4">
              <div className="grid grid-cols-1 lg:grid-cols-[1.35fr_0.65fr] gap-3 items-stretch">
                <div className={["rounded-2xl", panelSurface(), "overflow-hidden"].join(" ")}>
                  <div className="px-4 py-3 border-b border-white/10 flex items-center justify-between">
                    <div className="text-sm font-semibold text-white/90">
                      Reputação do seller
                    </div>
                    <div className="text-xs text-white/45 rounded-full border border-white/10 bg-white/5 px-3 py-1">
                      Score —
                    </div>
                  </div>

                  <div className="p-4 flex items-center justify-center">
                    <div className="w-full flex justify-center origin-top scale-[0.90]">
                      <ReputationThermometer
                        level={repLevel}
                        label={repLabel}
                        subtitle={repText}
                      />
                    </div>
                  </div>
                </div>

                <div
                  className={[
                    "rounded-2xl overflow-hidden",
                    "border border-white/10",
                    "bg-gradient-to-b from-white/[0.07] to-black/[0.35]",
                    "backdrop-blur-md",
                    "relative",
                  ].join(" ")}
                >
                  <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,rgba(255,220,120,0.12),transparent_55%),radial-gradient(ellipse_at_bottom,rgba(0,255,140,0.10),transparent_60%)]" />

                  <div className="relative">
                    <div className="px-4 py-3 border-b border-white/10">
                      <div className="flex items-center gap-2">
                        <span className="text-yellow-300">⚠️</span>
                        <div className="text-sm font-semibold text-white/90">
                          ALERTA DETECTADO HOJE:
                        </div>
                      </div>
                    </div>

                    <div className="p-4 space-y-3">
                      <div className="space-y-2.5 text-sm text-white/80">
                        <div className="flex gap-3">
                          <div className="h-6 w-6 rounded-full border border-white/10 bg-white/5 flex items-center justify-center text-xs text-white/70">
                            1
                          </div>
                          <div>Reclamação que pode virar impacto.</div>
                        </div>

                        <div className="flex gap-3">
                          <div className="h-6 w-6 rounded-full border border-white/10 bg-white/5 flex items-center justify-center text-xs text-white/70">
                            2
                          </div>
                          <div>Atrasos que podem virar impacto.</div>
                        </div>
                      </div>

                      <Link
                        href="/app/cases"
                        className={[
                          "w-full inline-flex items-center justify-center rounded-xl px-4 py-2.5",
                          "border border-yellow-400/25",
                          "bg-gradient-to-r from-yellow-400/15 via-yellow-300/10 to-transparent",
                          "text-white font-semibold",
                          "shadow-[0_0_40px_rgba(255,220,90,0.08)]",
                          "hover:from-yellow-400/20 hover:via-yellow-300/12",
                        ].join(" ")}
                      >
                        ABRIR DEFESA URGENTE →
                      </Link>

                      <button
                        onClick={startConnect}
                        disabled={connecting}
                        className="w-full inline-flex items-center justify-center rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 font-semibold text-white/85 hover:bg-white/10 disabled:opacity-60 disabled:cursor-not-allowed"
                      >
                        {connecting ? "Abrindo OAuth..." : "Conectar Mercado Livre"}
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <KpiCardDark
                  n="1"
                  title="Reclamação"
                  subtitle="Impactante"
                  value={claimsImpact}
                  hint="Em espaço de impacto"
                />
                <KpiCardDark
                  n="2"
                  title="Atrasos Flex"
                  subtitle="Impactantes"
                  value={delaysImpact}
                  hint="Encaminhados"
                  badge="RISCO"
                />
                <KpiCardDark
                  n="6"
                  title="Reclamações"
                  subtitle="Recentes"
                  value={claimsRecent}
                  hint="Desde semana retrasada"
                />
                <KpiCardDark
                  n="9"
                  title="Pedidos"
                  subtitle="Atrasados"
                  value={ordersLate}
                  hint="Ainda não enviados"
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="rounded-2xl border border-white/10 bg-black/35 overflow-hidden">
          <div className="px-5 py-4 border-b border-white/10 flex items-center justify-between">
            <div>
              <div className="font-semibold text-white/90">Alertas — ação necessária</div>
              <div className="text-xs text-white/45">Itens recentes</div>
            </div>
            <Link href="/app/cases" className="text-sm text-white/60 hover:text-white">
              Ver todos →
            </Link>
          </div>

          <div className="p-3">
            {alerts.length === 0 ? (
              <div className="p-4 text-sm text-white/60">Nenhum alerta por enquanto.</div>
            ) : (
              alerts.map((a) => (
                <div
                  key={a.id}
                  className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/5 p-3 mb-2"
                >
                  <div className="min-w-0">
                    <div className="text-sm font-semibold truncate text-white/90">
                      {a.reason ?? "Reclamação"}
                    </div>
                    <div className="text-xs text-white/50">
                      Caso ML: <span className="font-mono">{a.ml_case_id}</span>
                    </div>
                  </div>
                  <Link
                    href="/app/cases"
                    className="shrink-0 rounded-xl border border-white/10 px-3 py-2 text-sm text-white/80 hover:bg-white/10"
                  >
                    Abrir defesa
                  </Link>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-black/35 overflow-hidden">
          <div className="px-5 py-4 border-b border-white/10 flex items-center justify-between">
            <div>
              <div className="font-semibold text-white/90">Chamados em andamento</div>
              <div className="text-xs text-white/45">Casos não finalizados</div>
            </div>
            <Link href="/app/cases" className="text-sm text-white/60 hover:text-white">
              Ver casos →
            </Link>
          </div>

          <div className="p-3">
            {inProgress.length === 0 ? (
              <div className="p-4 text-sm text-white/60">Nenhum chamado em andamento.</div>
            ) : (
              inProgress.map((cs) => (
                <div
                  key={cs.id}
                  className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/5 p-3 mb-2"
                >
                  <div className="min-w-0">
                    <div className="text-sm font-semibold truncate text-white/90">
                      Caso #{String(cs.id).slice(0, 6)} — {cs.status}
                    </div>
                    <div className="text-xs text-white/50">
                      Protocolo: <span className="font-mono">{cs.protocol_number ?? "-"}</span>
                    </div>
                  </div>
                  <Link
                    href="/app/cases"
                    className="shrink-0 rounded-xl border border-white/10 px-3 py-2 text-sm text-white/80 hover:bg-white/10"
                  >
                    Detalhar
                  </Link>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function KpiCardDark({
  n,
  title,
  subtitle,
  value,
  hint,
  badge,
}: {
  n: string;
  title: string;
  subtitle: string;
  value: number;
  hint?: string;
  badge?: string;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-gradient-to-b from-white/[0.06] to-black/[0.30] backdrop-blur-md p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="h-7 w-7 rounded-full border border-white/10 bg-white/5 flex items-center justify-center text-xs text-white/70">
            {n}
          </div>
          <div className="leading-tight">
            <div className="text-sm font-semibold text-white/90">{title}</div>
            <div className="text-xs text-white/60">{subtitle}</div>
          </div>
        </div>

        {badge ? (
          <span className="text-[11px] px-2 py-1 rounded-full border border-red-500/30 bg-red-500/10 text-red-200">
            {badge}
          </span>
        ) : null}
      </div>

      <div className="mt-3 text-3xl font-semibold text-white">{value}</div>

      {hint ? <div className="mt-1 text-xs text-white/45">{hint}</div> : null}
    </div>
  );
} 