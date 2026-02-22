"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@supabase/supabase-js";

type SellerRow = {
  id: string;
  name: string | null;
  company_name: string | null;
  status: string | null;
  created_at: string | null;
  ml_user_id?: string | null; // <- se existir na tabela sellers
};

type SellerAccountRow = {
  id: string;
  seller_id: string | null;
  ml_user_id: string | null;
  nickname: string | null;
  created_at: string | null;
};

type MlTokenRow = {
  seller_id: string;
  expires_at: string | null;
  updated_at?: string | null;
  created_at?: string | null;
};

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

function panelSurface() {
  return "border border-white/10 bg-gradient-to-b from-white/[0.06] to-black/[0.35] backdrop-blur-md";
}

function pillBase() {
  return "inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[12px] font-semibold";
}

function isExpired(expiresAt: string | null | undefined) {
  if (!expiresAt) return false; // se não tem expires_at, tratamos como “tem token” mesmo assim
  const t = Date.parse(expiresAt);
  if (Number.isNaN(t)) return false;
  return t <= Date.now();
}

export default function AdminSellersClient() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);

  const [sellers, setSellers] = useState<SellerRow[]>([]);
  const [accounts, setAccounts] = useState<SellerAccountRow[]>([]);
  const [tokens, setTokens] = useState<MlTokenRow[]>([]);

  const [q, setQ] = useState("");
  const [mlFilter, setMlFilter] = useState<"all" | "connected" | "not_connected">("all");

  useEffect(() => {
    (async () => {
      setLoading(true);

      // sellers
      const { data: sellersData } = await supabase
        .from("sellers")
        .select("id, name, company_name, status, created_at, ml_user_id")
        .order("created_at", { ascending: false });

      // seller_accounts (nickname / info auxiliar)
      const { data: accData } = await supabase
        .from("seller_accounts")
        .select("id, seller_id, ml_user_id, nickname, created_at")
        .order("created_at", { ascending: false });

      // ✅ FONTE DA VERDADE da conexão: ml_tokens
      const { data: tokData } = await supabase
        .from("ml_tokens")
        .select("seller_id, expires_at, updated_at, created_at");

      setSellers((sellersData ?? []) as SellerRow[]);
      setAccounts((accData ?? []) as SellerAccountRow[]);
      setTokens((tokData ?? []) as MlTokenRow[]);

      setLoading(false);
    })();
  }, []);

  const accountBySellerId = useMemo(() => {
    const m = new Map<string, SellerAccountRow>();
    for (const a of accounts) {
      if (a.seller_id) m.set(a.seller_id, a);
    }
    return m;
  }, [accounts]);

  const tokenBySellerId = useMemo(() => {
    const m = new Map<string, MlTokenRow>();
    for (const t of tokens) {
      if (t.seller_id) m.set(t.seller_id, t);
    }
    return m;
  }, [tokens]);

  const connectedCount = useMemo(() => {
    let c = 0;
    for (const s of sellers) {
      const tok = tokenBySellerId.get(s.id);
      if (tok && !isExpired(tok.expires_at)) c++;
    }
    return c;
  }, [sellers, tokenBySellerId]);

  const notConnectedCount = useMemo(() => {
    return Math.max(0, (sellers?.length ?? 0) - connectedCount);
  }, [sellers, connectedCount]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();

    return sellers.filter((s) => {
      const acc = accountBySellerId.get(s.id);
      const tok = tokenBySellerId.get(s.id);

      const connected = !!tok && !isExpired(tok.expires_at);

      if (mlFilter === "connected" && !connected) return false;
      if (mlFilter === "not_connected" && connected) return false;

      if (!needle) return true;

      const hay = [
        s.id,
        s.name ?? "",
        s.company_name ?? "",
        s.status ?? "",
        s.ml_user_id ?? "",
        acc?.nickname ?? "",
        acc?.ml_user_id ?? "",
        tok?.expires_at ?? "",
      ]
        .join(" ")
        .toLowerCase();

      return hay.includes(needle);
    });
  }, [sellers, accountBySellerId, tokenBySellerId, q, mlFilter]);

  function openSellerDashboard(sellerId: string) {
    try {
      localStorage.setItem("activeSellerId", sellerId);
    } catch {
      // ignore
    }

    // ✅ DASHBOARD CORRETO DO SELLER (área /app)
    router.push(`/app/sellers/${encodeURIComponent(sellerId)}/dashboard`);
  }

  return (
    <div className="p-0">
      <section
        className={[
          "relative rounded-3xl overflow-hidden",
          "border border-black/10",
          "bg-black/70",
          "shadow-[0_20px_80px_rgba(0,0,0,0.25)]",
        ].join(" ")}
      >
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,rgba(90,255,140,0.12),transparent_55%),radial-gradient(ellipse_at_top_right,rgba(255,220,120,0.10),transparent_55%),radial-gradient(ellipse_at_bottom,rgba(0,0,0,0.55),transparent_65%)]" />
          <div className="absolute inset-0 bg-gradient-to-b from-white/[0.06] to-transparent" />
        </div>

        <div className="relative p-6">
          <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
            <div>
              <h1 className="text-2xl md:text-3xl font-semibold text-white">Sellers</h1>
              <p className="text-sm text-white/60 mt-1">
                Visão Admin — sellers cadastrados + status de conexão Mercado Livre.
              </p>
              <p className="text-[12px] text-white/45 mt-2">
                Obs: Conectado = existe token em <span className="font-mono">ml_tokens</span> (fonte da verdade).
              </p>
            </div>

            <div className="flex gap-2 flex-wrap md:justify-end">
              <span
                className={[
                  pillBase(),
                  "border-emerald-400/25 bg-emerald-400/10 text-emerald-100",
                ].join(" ")}
              >
                <span className="h-2 w-2 rounded-full bg-emerald-400" />
                {connectedCount} conectados
              </span>
              <span
                className={[
                  pillBase(),
                  "border-yellow-400/25 bg-yellow-400/10 text-yellow-100",
                ].join(" ")}
              >
                <span className="h-2 w-2 rounded-full bg-yellow-400" />
                {notConnectedCount} não conectados
              </span>
            </div>
          </div>

          <div className={["mt-5 rounded-2xl p-4", panelSurface()].join(" ")}>
            <div className="grid grid-cols-1 md:grid-cols-[1fr_240px] gap-3 items-end">
              <div>
                <label className="block text-xs text-white/60 mb-1">Buscar seller</label>
                <input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Nome, company, sellerId, nickname ML, ml_user_id…"
                  className="w-full h-11 rounded-xl border border-white/10 bg-black/40 px-4 text-white placeholder:text-white/35 outline-none focus:border-white/20"
                />
                <div className="text-[12px] text-white/40 mt-2">
                  Dica: busque por “BRUDSTORE_”, “e4c677dc…”, “2392809929”, etc.
                </div>
              </div>

              <div>
                <label className="block text-xs text-white/60 mb-1">Conexão ML</label>
                <select
                  value={mlFilter}
                  onChange={(e) => setMlFilter(e.target.value as any)}
                  className="w-full h-11 rounded-xl border border-white/10 bg-black/40 px-3 text-white outline-none focus:border-white/20"
                >
                  <option value="all">Todos</option>
                  <option value="connected">Conectados</option>
                  <option value="not_connected">Não conectados</option>
                </select>
              </div>
            </div>
          </div>

          {loading ? (
            <div className="mt-6 text-white/60">Carregando…</div>
          ) : filtered.length === 0 ? (
            <div className="mt-6 text-white/60">Nenhum seller encontrado.</div>
          ) : (
            <div className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-4">
              {filtered.map((s) => {
                const acc = accountBySellerId.get(s.id);
                const tok = tokenBySellerId.get(s.id);

                const connected = !!tok && !isExpired(tok.expires_at);
                const expired = !!tok && isExpired(tok.expires_at);

                return (
                  <div key={s.id} className={["rounded-2xl p-5", panelSurface()].join(" ")}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-white/90 truncate">
                          {s.name ?? "—"}
                        </div>
                        <div className="text-xs text-white/45 truncate mt-0.5">
                          — <span className="font-mono">{s.id}</span>
                        </div>
                        {s.company_name ? (
                          <div className="text-xs text-white/40 mt-1 truncate">{s.company_name}</div>
                        ) : null}
                      </div>

                      {connected ? (
                        <span
                          className={[
                            pillBase(),
                            "border-emerald-400/25 bg-emerald-400/10 text-emerald-100",
                          ].join(" ")}
                        >
                          <span className="h-2 w-2 rounded-full bg-emerald-400" />
                          Conectado {acc?.nickname ? `(${acc.nickname})` : ""}
                        </span>
                      ) : expired ? (
                        <span
                          className={[
                            pillBase(),
                            "border-orange-400/25 bg-orange-400/10 text-orange-100",
                          ].join(" ")}
                        >
                          <span className="h-2 w-2 rounded-full bg-orange-400" />
                          Token expirado
                        </span>
                      ) : (
                        <span
                          className={[
                            pillBase(),
                            "border-yellow-400/25 bg-yellow-400/10 text-yellow-100",
                          ].join(" ")}
                        >
                          <span className="h-2 w-2 rounded-full bg-yellow-400" />
                          Não conectado
                        </span>
                      )}
                    </div>

                    <div className="mt-4 flex flex-wrap gap-2">
                      <span className="text-[12px] rounded-full border border-white/10 bg-white/5 px-3 py-1 text-white/70">
                        Status: <span className="text-white/85">{s.status ?? "—"}</span>
                      </span>

                      <span className="text-[12px] rounded-full border border-white/10 bg-white/5 px-3 py-1 text-white/70">
                        Criado:{" "}
                        <span className="text-white/85">
                          {s.created_at ? new Date(s.created_at).toLocaleString("pt-BR") : "—"}
                        </span>
                      </span>

                      {s.ml_user_id ? (
                        <span className="text-[12px] rounded-full border border-white/10 bg-white/5 px-3 py-1 text-white/70">
                          ml_user_id: <span className="text-white/85">{s.ml_user_id}</span>
                        </span>
                      ) : null}

                      {tok?.expires_at ? (
                        <span className="text-[12px] rounded-full border border-white/10 bg-white/5 px-3 py-1 text-white/70">
                          expira:{" "}
                          <span className="text-white/85">
                            {new Date(tok.expires_at).toLocaleString("pt-BR")}
                          </span>
                        </span>
                      ) : null}
                    </div>

                    <div className="mt-4 flex gap-2 flex-wrap">
                      <Link
                        href={`/dashboard/cases?sellerId=${encodeURIComponent(s.id)}`}
                        className="inline-flex items-center justify-center rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/85 hover:bg-white/10"
                      >
                        Ver cases →
                      </Link>

                      {/* ✅ AGORA: seta seller ativo e manda pra dashboard REAL do seller */}
                      <button
                        type="button"
                        onClick={() => openSellerDashboard(s.id)}
                        className="inline-flex items-center justify-center rounded-xl border border-emerald-400/20 bg-gradient-to-b from-emerald-400/20 to-emerald-900/20 px-4 py-2 text-sm text-white/90 hover:from-emerald-400/25 hover:to-emerald-900/25"
                      >
                        Abrir dashboard ↗
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
