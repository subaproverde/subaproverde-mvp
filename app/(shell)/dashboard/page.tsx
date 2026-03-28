"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabaseBrowser } from "@/lib/supabaseClient";

type CaseRow = {
  id: string;
  kind: string;
  title: string;
  status: string;
  priority?: string | null;
  due_date?: string | null;
  updated_at?: string | null;
  protocol?: string | null;
};

type MeSellerResp =
  | {
      ok: true;
      userId: string;
      sellerId: string;
      sellerAccountId: string;
      ml_user_id?: string | null;
      nickname?: string | null;
    }
  | { ok?: false; error: string; details?: string };

type MlAccountMeResp =
  | {
      ok: true;
      sellerId: string;
      data: any;
    }
  | { ok?: false; error: string; details?: string };

const ACTIVE = ["novo", "em_analise", "aguardando_cliente", "chamado_aberto"];

function niceKind(kind: string) {
  if (kind === "impact_claims" || kind === "impact_claims_metric") return "Reclamação";
  if (kind === "delayed_handling_time" || kind === "impact_delayed_handling_metric") return "Atraso";
  if (kind === "cancellations") return "Cancelamento";
  return "Outro";
}

function isOverdue(due?: string | null) {
  if (!due) return false;
  const t = new Date(due).getTime();
  if (Number.isNaN(t)) return false;
  return t < Date.now();
}

export default function DashboardHome() {
  const [loading, setLoading] = useState(true);

  const [userId, setUserId] = useState<string>("");
  const [sellerId, setSellerId] = useState<string>("");
  const [nickname, setNickname] = useState<string>("");

  const [cases, setCases] = useState<CaseRow[]>([]);
  const [mlMe, setMlMe] = useState<any>(null);

  async function loadAll(currentSellerId: string) {
    console.log("[dashboard] loadAll currentSellerId =", currentSellerId);

    setLoading(true);
    try {
      const url = new URL(`/api/ml/cases/list`, window.location.origin);
      url.searchParams.set("sellerId", currentSellerId);
      url.searchParams.set("limit", "500");

      console.log("[dashboard] chamando cases/list =", url.toString());

      const rCases = await fetch(url.toString(), { cache: "no-store" });
      const jCases = await rCases.json().catch(() => ({}));

      console.log("[dashboard] resposta cases/list =", jCases);

      setCases(jCases.items ?? []);

      console.log("[dashboard] chamando /api/ml/account/me com sellerId =", currentSellerId);

      const rMe = await fetch(`/api/ml/account/me?sellerId=${currentSellerId}`, {
        cache: "no-store",
      });
      const jMe = (await rMe.json().catch(() => ({}))) as MlAccountMeResp;

      console.log("[dashboard] resposta /api/ml/account/me =", jMe);

      if (rMe.ok && "data" in jMe) setMlMe(jMe.data ?? null);
      else setMlMe(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    (async () => {
      console.log("🔥 DASHBOARD /shell/dashboard/page RODANDO 🔥");
      setLoading(true);

      const { data } = await supabaseBrowser.auth.getUser();
      const user = data?.user;

      console.log("[dashboard] user =", user);

      if (!user) {
        setUserId("");
        setSellerId("");
        setNickname("");
        setCases([]);
        setMlMe(null);
        setLoading(false);
        return;
      }

      setUserId(user.id);

      let sid = "";

      console.log(
        "[dashboard] localStorage activeSellerId =",
        localStorage.getItem("activeSellerId")
      );

      try {
        sid = localStorage.getItem("activeSellerId") ?? "";
      } catch (err) {
        console.log("[dashboard] erro lendo localStorage =", err);
      }

      if (!sid) {
        console.log("[dashboard] sem activeSellerId, usando fallback /api/me/seller");

        const r = await fetch(`/api/me/seller?userId=${user.id}`, {
          cache: "no-store",
        });
        const j = (await r.json().catch(() => ({}))) as MeSellerResp;

        console.log("[dashboard] resposta /api/me/seller =", j);

        if (!r.ok || !("sellerId" in j) || !j.sellerId) {
          setSellerId("");
          setNickname("");
          setCases([]);
          setMlMe(null);
          setLoading(false);
          return;
        }

        sid = j.sellerId;

        try {
          localStorage.setItem("activeSellerId", sid);
          console.log("[dashboard] salvou activeSellerId fallback =", sid);
        } catch (err) {
          console.log("[dashboard] erro salvando localStorage =", err);
        }

        setSellerId(sid);
        setNickname(j.nickname ?? "");

        await loadAll(sid);
        return;
      }

      console.log("[dashboard] usando activeSellerId do localStorage =", sid);

      setSellerId(sid);

      try {
        const r = await fetch(`/api/ml/account/me?sellerId=${sid}`, {
          cache: "no-store",
        });
        const j = (await r.json().catch(() => ({}))) as MlAccountMeResp;

        console.log("[dashboard] nickname preload /api/ml/account/me =", j);

        if (r.ok && "data" in j) {
          setNickname(j.data?.nickname ?? "");
        } else {
          setNickname("");
        }
      } catch (err) {
        console.log("[dashboard] erro preload nickname =", err);
        setNickname("");
      }

      await loadAll(sid);
    })();
  }, []);

  const stats = useMemo(() => {
    const total = cases.length;
    const open = cases.filter((c) => ACTIVE.includes(c.status)).length;

    const claimsImpact = Number(mlMe?.seller_reputation?.metrics?.claims?.value ?? 0);
    const delaysImpact = Number(mlMe?.seller_reputation?.metrics?.delayed_handling_time?.value ?? 0);
    const cancImpact = Number(mlMe?.seller_reputation?.metrics?.cancellations?.value ?? 0);

    const overdue = cases.filter((c) => ACTIVE.includes(c.status) && isOverdue(c.due_date)).length;

    const inProgress = cases.filter(
      (c) => c.status === "chamado_aberto" && (c.protocol ?? "").trim().length > 0
    ).length;

    return {
      total,
      open,
      claimsImpact,
      delaysImpact,
      cancImpact,
      overdue,
      inProgress,
    };
  }, [cases, mlMe]);

  const alerts = useMemo(() => {
    const allowed = new Set(["impact_claims", "delayed_handling_time", "cancellations"]);
    return cases
      .filter((c) => ACTIVE.includes(c.status))
      .filter((c) => allowed.has(c.kind))
      .slice(0, 8);
  }, [cases]);

  const ongoing = useMemo(() => {
    return cases.filter((c) => c.status === "chamado_aberto").slice(0, 6);
  }, [cases]);

  if (!userId) {
    return (
      <div className="p-6 space-y-3">
        <h1 className="text-2xl font-semibold text-gray-900">Início</h1>
        <p className="text-sm text-gray-500">Você não está logado.</p>
        <Link
          href="/login"
          className="inline-block rounded-xl bg-white px-4 py-2 text-sm shadow-sm border border-gray-200 hover:bg-gray-50"
        >
          Ir para Login
        </Link>
      </div>
    );
  }

  if (!sellerId) {
    return (
      <div className="p-6 space-y-2">
        <h1 className="text-2xl font-semibold text-gray-900">Início</h1>
        <p className="text-sm text-gray-500">Usuário logado, mas sem seller conectado.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Início</h1>
          <p className="text-sm text-gray-500">
            Painel administrativo · visão geral da operação {nickname ? `· ${nickname}` : ""}
          </p>
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => loadAll(sellerId)}
            className="rounded-xl bg-white px-4 py-2 text-sm shadow-sm border border-gray-200 hover:bg-gray-50"
          >
            {loading ? "Atualizando..." : "Atualizar"}
          </button>

          <Link
            href={`/dashboard/cases?sellerId=${sellerId}`}
            className="rounded-xl bg-green-600 px-4 py-2 text-sm font-medium text-white shadow hover:bg-green-700"
          >
            Ir para Cases
          </Link>
        </div>
      </div>

      <div className="rounded-3xl border border-gray-200 bg-white shadow-sm p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-xs font-semibold text-amber-700 bg-amber-50 inline-flex px-3 py-1 rounded-full border border-amber-100">
              ⚠️ ALERTA DA CONTA — ALTO RISCO
            </div>

            <div className="mt-2 text-lg font-semibold text-gray-900">
              Impactos detectados (oficial ML)
            </div>

            <div className="mt-3 flex flex-wrap gap-2 text-xs">
              <span className="rounded-full border border-gray-200 bg-gray-50 px-3 py-1">
                Reclamações impactando: <b>{stats.claimsImpact}</b>
              </span>
              <span className="rounded-full border border-gray-200 bg-gray-50 px-3 py-1">
                Atrasos impactando: <b>{stats.delaysImpact}</b>
              </span>
              <span className="rounded-full border border-gray-200 bg-gray-50 px-3 py-1">
                Cancelamentos impactando: <b>{stats.cancImpact}</b>
              </span>
              <span className="rounded-full border border-gray-200 bg-gray-50 px-3 py-1">
                SLA vencidos (operação): <b>{stats.overdue}</b>
              </span>
              <span className="rounded-full border border-gray-200 bg-gray-50 px-3 py-1">
                Chamados em andamento: <b>{stats.inProgress}</b>
              </span>
            </div>
          </div>

          <Link
            href={`/dashboard/cases?sellerId=${sellerId}`}
            className="rounded-xl bg-green-600 px-4 py-2 text-sm font-medium text-white shadow hover:bg-green-700"
          >
            Abrir defesa urgente →
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        {[
          { label: "Total de cases (operação)", value: stats.total },
          { label: "Abertos (operação)", value: stats.open },
          { label: "Reclamações impactando (ML)", value: stats.claimsImpact },
          { label: "Atrasos impactando (ML)", value: stats.delaysImpact },
          { label: "SLA vencidos (operação)", value: stats.overdue },
        ].map((k) => (
          <div
            key={k.label}
            className="rounded-2xl bg-white p-4 shadow-sm border border-gray-200"
          >
            <div className="text-xs text-gray-500">{k.label}</div>
            <div className="text-2xl font-semibold text-gray-900 mt-1">
              {k.value}
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <div className="rounded-3xl bg-white shadow-sm border border-gray-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-200 flex items-center justify-between">
            <div>
              <div className="font-semibold text-gray-900">Alertas — ação necessária</div>
              <div className="text-xs text-gray-500">Impactos em aberto na operação</div>
            </div>
            <Link
              href={`/dashboard/cases?sellerId=${sellerId}`}
              className="text-sm text-green-700 hover:underline"
            >
              Ver todos →
            </Link>
          </div>

          <div className="divide-y divide-gray-100">
            {alerts.map((c) => (
              <div key={c.id} className="px-5 py-4 flex items-center justify-between hover:bg-gray-50">
                <div>
                  <div className="text-sm font-medium text-gray-900">{niceKind(c.kind)}</div>
                  <div className="text-xs text-gray-500 line-clamp-1">{c.title}</div>
                </div>

                <span className="rounded-full bg-red-50 border border-red-100 px-3 py-1 text-xs font-semibold text-red-700">
                  RISCO
                </span>
              </div>
            ))}

            {alerts.length === 0 && (
              <div className="px-5 py-6 text-sm text-gray-500">Nenhum alerta ativo 🎉</div>
            )}
          </div>
        </div>

        <div className="rounded-3xl bg-white shadow-sm border border-gray-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-200 flex items-center justify-between">
            <div>
              <div className="font-semibold text-gray-900">Chamados em andamento</div>
              <div className="text-xs text-gray-500">Cases com protocolo / em análise do ML</div>
            </div>
            <Link
              href={`/dashboard/cases?sellerId=${sellerId}`}
              className="text-sm text-green-700 hover:underline"
            >
              Operar →
            </Link>
          </div>

          <div className="divide-y divide-gray-100">
            {ongoing.map((c) => (
              <div key={c.id} className="px-5 py-4 flex items-center justify-between hover:bg-gray-50">
                <div>
                  <div className="text-sm font-medium text-gray-900">{niceKind(c.kind)}</div>
                  <div className="text-xs text-gray-500 line-clamp-1">{c.title}</div>
                  <div className="text-xs text-gray-500 mt-1">
                    Protocolo: <span className="font-mono">{c.protocol ?? "—"}</span>
                  </div>
                </div>

                <span className="rounded-full bg-amber-50 border border-amber-100 px-3 py-1 text-xs font-semibold text-amber-800">
                  EM ANDAMENTO
                </span>
              </div>
            ))}

            {ongoing.length === 0 && (
              <div className="px-5 py-6 text-sm text-gray-500">Nenhum chamado em andamento.</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}