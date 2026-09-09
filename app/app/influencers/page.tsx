"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

type InfluencerRow = {
  id: string;
  code: string;
  name: string;
  email: string | null;
  commission_rate: number; // 0..1
  is_active: boolean;
  created_at: string;
};

type LedgerRow = {
  id: string;
  influencer_id: string;
  seller_id: string;
  kind: string;
  qty: number;
  unit_price: number;
  notes: string | null;
  created_at: string;
};

function brl(v: number) {
  try {
    return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  } catch {
    return `R$ ${v.toFixed(2)}`;
  }
}

function fmtDate(iso: string) {
  try {
    const d = new Date(iso);
    return d.toLocaleString("pt-BR");
  } catch {
    return iso;
  }
}

function normCoupon(v: string) {
  return v.trim().toUpperCase();
}

export default function InfluencersAdminPage() {
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  // data
  const [influencers, setInfluencers] = useState<InfluencerRow[]>([]);
  const [ledgerRows, setLedgerRows] = useState<LedgerRow[]>([]);
  const [ledgerLoading, setLedgerLoading] = useState(false);

  // selected influencer for dashboard (filter)
  const [selectedInfluencerId, setSelectedInfluencerId] = useState<string>("");

  // create influencer form
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [commissionRate, setCommissionRate] = useState("0.1");
  const [creating, setCreating] = useState(false);

  // add ledger form
  const [ledgerInfluencerId, setLedgerInfluencerId] = useState<string>("");
  const [sellerId, setSellerId] = useState("");
  const [kind, setKind] = useState("impact_claims");
  const [qty, setQty] = useState("1");
  const [unitPrice, setUnitPrice] = useState("0");
  const [notes, setNotes] = useState("");
  const [addingLedger, setAddingLedger] = useState(false);

  // computed
  const selectedInfluencer = useMemo(
    () => influencers.find((i) => i.id === selectedInfluencerId) ?? null,
    [influencers, selectedInfluencerId]
  );

  const totals = useMemo(() => {
    const totalSpend = ledgerRows.reduce((acc, r) => acc + (Number(r.qty) || 0) * (Number(r.unit_price) || 0), 0);
    const rate = selectedInfluencer?.commission_rate ?? 0;
    const commission = totalSpend * rate;
    return { totalSpend, commission };
  }, [ledgerRows, selectedInfluencer]);

  async function getAccessTokenOrThrow() {
    const { data } = await supabase.auth.getSession();
    const token = data?.session?.access_token;
    if (!token) throw new Error("Não autenticado");
    return token;
  }

  async function ensureAdmin() {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData?.user) return false;

    const { data: ok, error } = await supabase.rpc("is_admin");
    if (error) return false;
    return !!ok;
  }

  async function fetchInfluencers() {
    const token = await getAccessTokenOrThrow();
    const r = await fetch("/api/admin/influencers/list", {
      method: "GET",
      headers: { Authorization: `Bearer ${token}` },
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok || !j?.ok) throw new Error(j?.error ?? "Falha ao listar influencers");
    const rows: InfluencerRow[] = j.rows ?? [];
    setInfluencers(rows);

    // define defaults
    if (rows.length > 0) {
      setSelectedInfluencerId((prev) => prev || rows[0].id);
      setLedgerInfluencerId((prev) => prev || rows[0].id);
    }
  }

  /**
   * ✅ IMPORTANTE: essa função DEVE filtrar no backend por influencer_id
   * Rota esperada: GET /api/admin/ledger/list?influencerId=...
   */
  async function fetchLedger(influencerId: string) {
    if (!influencerId) return;

    setLedgerLoading(true);
    try {
      // ✅ limpa antes de buscar (evita “mistura visual”)
      setLedgerRows([]);

      const token = await getAccessTokenOrThrow();
      const qs = new URLSearchParams({ influencerId });
      const r = await fetch(`/api/admin/ledger/list?${qs.toString()}`, {
        method: "GET",
        headers: { Authorization: `Bearer ${token}` },
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok || !j?.ok) throw new Error(j?.error ?? "Falha ao listar lançamentos");

      const rows: LedgerRow[] = j.rows ?? [];
      setLedgerRows(rows);
    } finally {
      setLedgerLoading(false);
    }
  }

  async function onCreateInfluencer() {
    setCreating(true);
    try {
      const token = await getAccessTokenOrThrow();
      const payload = {
        code: normCoupon(code),
        name: name.trim(),
        email: email.trim() ? email.trim() : null,
        commission_rate: Number(commissionRate),
      };

      const r = await fetch("/api/admin/influencers/create", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok || !j?.ok) throw new Error(j?.error ?? "Erro ao criar influencer");

      // reset
      setCode("");
      setName("");
      setEmail("");
      setCommissionRate("0.1");

      await fetchInfluencers();
    } catch (e: any) {
      alert(e?.message ?? "Erro");
    } finally {
      setCreating(false);
    }
  }

  async function onAddLedger() {
    setAddingLedger(true);
    try {
      const token = await getAccessTokenOrThrow();

      const payload = {
        influencerId: ledgerInfluencerId,
        sellerId: sellerId.trim(),
        kind: kind.trim(),
        qty: Number(qty),
        unitPrice: Number(unitPrice),
        notes: notes.trim() ? notes.trim() : null,
      };

      const r = await fetch("/api/admin/ledger/add", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok || !j?.ok) throw new Error(j?.error ?? j?.details ?? "Erro ao adicionar lançamento");

      // limpa parte do form (mantém influencer)
      setSellerId("");
      setKind("impact_claims");
      setQty("1");
      setUnitPrice("0");
      setNotes("");

      // ✅ recarrega a lista do influencer selecionado no painel
      if (selectedInfluencerId) {
        await fetchLedger(selectedInfluencerId);
      }
    } catch (e: any) {
      alert(e?.message ?? "Erro");
    } finally {
      setAddingLedger(false);
    }
  }

  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        setLoading(true);
        const ok = await ensureAdmin();
        if (!alive) return;

        setIsAdmin(ok);
        if (!ok) return;

        await fetchInfluencers();
      } catch (e: any) {
        // se não estiver logado, ou erro geral
        console.error(e);
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, []);

  // ✅ sempre que trocar o influencer selecionado, atualiza os lançamentos filtrados
  useEffect(() => {
    if (!isAdmin) return;
    if (!selectedInfluencerId) return;
    fetchLedger(selectedInfluencerId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedInfluencerId, isAdmin]);

  if (loading) {
    return <div className="text-spv-ink">Carregando…</div>;
  }

  if (!isAdmin) {
    return (
      <div className="rounded-xl border border-spv-line bg-spv-surface p-6 text-spv-ink">
        Acesso restrito (admin).
        <div className="mt-3">
          <Link className="underline" href="/app">
            Voltar
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* HEADER */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-spv-ink">Influencers</h1>
          <p className="text-sm text-spv-muted">
            Crie influencers e lance os valores para comissão (manual).
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/dashboard/sellers"
            className="rounded-xl border border-spv-line px-3 py-2 text-sm text-spv-ink hover:bg-spv-raised"
          >
            Ver Sellers
          </Link>

          <button
            onClick={() => fetchInfluencers().catch((e) => alert(e?.message ?? "Erro"))}
            className="rounded-xl border border-spv-line px-3 py-2 text-sm text-spv-ink hover:bg-spv-raised"
          >
            Atualizar
          </button>
        </div>
      </div>

      {/* GRID */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* LEFT */}
        <div className="lg:col-span-2 space-y-6">
          {/* Influencers cadastrados */}
          <div className="rounded-xl border border-spv-line bg-spv-surface p-5">
            <div className="flex items-center justify-between">
              <div className="text-sm font-semibold text-spv-ink">Influencers cadastrados</div>
              <div className="text-xs text-spv-muted">{influencers.length} itens</div>
            </div>

            <div className="mt-4 overflow-hidden rounded-xl border border-spv-line">
              <table className="w-full text-sm">
                <thead className="bg-spv-surface text-spv-muted">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium">Código</th>
                    <th className="px-3 py-2 text-left font-medium">Nome</th>
                    <th className="px-3 py-2 text-left font-medium">E-mail</th>
                    <th className="px-3 py-2 text-right font-medium">Comissão</th>
                  </tr>
                </thead>
                <tbody className="text-spv-ink">
                  {influencers.length === 0 ? (
                    <tr>
                      <td className="px-3 py-3 text-spv-muted" colSpan={4}>
                        Nenhum influencer cadastrado.
                      </td>
                    </tr>
                  ) : (
                    influencers.map((i) => (
                      <tr
                        key={i.id}
                        className={[
                          "border-t border-spv-line hover:bg-spv-raised cursor-pointer",
                          selectedInfluencerId === i.id ? "bg-spv-surface" : "",
                        ].join(" ")}
                        onClick={() => setSelectedInfluencerId(i.id)}
                        title="Clique para filtrar os lançamentos por este influencer"
                      >
                        <td className="px-3 py-2 font-semibold">{i.code}</td>
                        <td className="px-3 py-2">{i.name}</td>
                        <td className="px-3 py-2 text-spv-muted">{i.email ?? "—"}</td>
                        <td className="px-3 py-2 text-right">{Math.round(i.commission_rate * 100)}%</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Últimos lançamentos */}
          <div className="rounded-xl border border-spv-line bg-spv-surface p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-sm font-semibold text-spv-ink">Últimos lançamentos</div>
                <div className="text-xs text-spv-muted">
                  Mostra o que foi adicionado no ledger{" "}
                  <span className="text-spv-ink font-medium">
                    (filtrado pelo influencer selecionado)
                  </span>
                  .
                </div>
              </div>

              <button
                onClick={() => fetchLedger(selectedInfluencerId).catch((e) => alert(e?.message ?? "Erro"))}
                className="rounded-xl border border-spv-line px-3 py-2 text-xs text-spv-ink hover:bg-spv-raised"
                disabled={!selectedInfluencerId || ledgerLoading}
              >
                {ledgerLoading ? "Atualizando…" : "Atualizar lançamentos"}
              </button>
            </div>

            {/* Cards de total */}
            <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
              <div className="rounded-xl border border-spv-line bg-spv-surface p-4">
                <div className="text-xs text-spv-muted">Total lançado (influencer)</div>
                <div className="mt-1 text-sm text-spv-ink">{brl(totals.totalSpend)}</div>
              </div>

              <div className="rounded-xl border border-spv-line bg-spv-surface p-4">
                <div className="text-xs text-spv-muted">Comissão estimada</div>
                <div className="mt-1 text-sm text-spv-ink">{brl(totals.commission)}</div>
              </div>

              <div className="rounded-xl border border-spv-line bg-spv-surface p-4">
                <div className="text-xs text-spv-muted">Influencer selecionado</div>
                <div className="mt-1 text-sm text-spv-ink">
                  {selectedInfluencer ? (
                    <>
                      <span className="font-semibold">{selectedInfluencer.code}</span>
                      <span className="text-spv-muted"> — </span>
                      {selectedInfluencer.name}
                    </>
                  ) : (
                    "—"
                  )}
                </div>
              </div>
            </div>

            {/* table */}
            <div className="mt-4 overflow-hidden rounded-xl border border-spv-line">
              <table className="w-full text-sm">
                <thead className="bg-spv-surface text-spv-muted">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium">Data</th>
                    <th className="px-3 py-2 text-left font-medium">Seller ID</th>
                    <th className="px-3 py-2 text-left font-medium">Tipo</th>
                    <th className="px-3 py-2 text-right font-medium">Qtd</th>
                    <th className="px-3 py-2 text-right font-medium">Unit</th>
                    <th className="px-3 py-2 text-right font-medium">Total</th>
                  </tr>
                </thead>
                <tbody className="text-spv-ink">
                  {ledgerRows.length === 0 ? (
                    <tr>
                      <td className="px-3 py-3 text-spv-muted" colSpan={6}>
                        {ledgerLoading ? "Carregando lançamentos…" : "Nenhum lançamento para este influencer."}
                      </td>
                    </tr>
                  ) : (
                    ledgerRows.map((r) => {
                      const total = (Number(r.qty) || 0) * (Number(r.unit_price) || 0);
                      return (
                        <tr
                          key={r.id}
                          className="border-t border-spv-line hover:bg-spv-raised"
                          title={r.notes ? `Obs: ${r.notes}` : ""}
                        >
                          <td className="px-3 py-2">{fmtDate(r.created_at)}</td>
                          <td className="px-3 py-2 text-spv-ink">{r.seller_id}</td>
                          <td className="px-3 py-2">{r.kind}</td>
                          <td className="px-3 py-2 text-right">{r.qty}</td>
                          <td className="px-3 py-2 text-right">{brl(Number(r.unit_price) || 0)}</td>
                          <td className="px-3 py-2 text-right font-semibold">{brl(total)}</td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            <div className="mt-2 text-xs text-spv-muted">
              Dica: passe o mouse em cima de um lançamento para ver a observação (notes), se tiver.
            </div>
          </div>
        </div>

        {/* RIGHT */}
        <div className="space-y-6">
          {/* Criar influencer */}
          <div className="rounded-xl border border-spv-line bg-spv-surface p-5">
            <div className="text-sm font-semibold text-spv-ink">Criar influencer</div>

            <div className="mt-4 space-y-3">
              <div>
                <div className="text-xs text-spv-muted">Código (cupom)</div>
                <input
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="EX: DUDA10"
                  className="mt-1 w-full rounded-xl border border-spv-line bg-spv-page px-3 py-2 text-sm text-spv-ink outline-none focus:border-emerald-500/50"
                />
              </div>

              <div>
                <div className="text-xs text-spv-muted">Nome</div>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Nome do influencer"
                  className="mt-1 w-full rounded-xl border border-spv-line bg-spv-page px-3 py-2 text-sm text-spv-ink outline-none focus:border-emerald-500/50"
                />
              </div>

              <div>
                <div className="text-xs text-spv-muted">E-mail (opcional)</div>
                <input
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="email@exemplo.com"
                  className="mt-1 w-full rounded-xl border border-spv-line bg-spv-page px-3 py-2 text-sm text-spv-ink outline-none focus:border-emerald-500/50"
                />
              </div>

              <div>
                <div className="text-xs text-spv-muted">Comissão (0 a 1)</div>
                <input
                  value={commissionRate}
                  onChange={(e) => setCommissionRate(e.target.value)}
                  placeholder="0.1"
                  className="mt-1 w-full rounded-xl border border-spv-line bg-spv-page px-3 py-2 text-sm text-spv-ink outline-none focus:border-emerald-500/50"
                />
                <div className="mt-1 text-[11px] text-spv-muted">Ex: 0.1 = 10% (atual: {Math.round((Number(commissionRate) || 0) * 100)}%)</div>
              </div>

              <button
                onClick={onCreateInfluencer}
                disabled={creating}
                className="w-full rounded-xl border border-emerald-400/20 bg-gradient-to-b from-emerald-400/20 to-emerald-900/20 px-4 py-2 text-sm font-semibold text-spv-ink hover:from-emerald-400/25 hover:to-emerald-900/25 disabled:opacity-60"
              >
                {creating ? "Criando…" : "Criar influencer"}
              </button>
            </div>
          </div>

          {/* Adicionar lançamento */}
          <div className="rounded-xl border border-spv-line bg-spv-surface p-5">
            <div className="text-sm font-semibold text-spv-ink">Adicionar lançamento (ledger)</div>

            <div className="mt-4 space-y-3">
              <div>
                <div className="text-xs text-spv-muted">Influencer</div>
                <select
                  value={ledgerInfluencerId}
                  onChange={(e) => setLedgerInfluencerId(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-spv-line bg-spv-page px-3 py-2 text-sm text-spv-ink outline-none focus:border-emerald-500/50"
                >
                  {influencers.map((i) => (
                    <option key={i.id} value={i.id}>
                      {i.code} — {i.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <div className="text-xs text-spv-muted">SellerId (UUID)</div>
                <input
                  value={sellerId}
                  onChange={(e) => setSellerId(e.target.value)}
                  placeholder="Cole o seller_accounts.seller_id aqui"
                  className="mt-1 w-full rounded-xl border border-spv-line bg-spv-page px-3 py-2 text-sm text-spv-ink outline-none focus:border-emerald-500/50"
                />
                <div className="mt-1 text-[11px] text-spv-muted">Dica: abra Sellers e copie o seller_id.</div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="text-xs text-spv-muted">Tipo (kind)</div>
                  <select
                    value={kind}
                    onChange={(e) => setKind(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-spv-line bg-spv-page px-3 py-2 text-sm text-spv-ink outline-none focus:border-emerald-500/50"
                  >
                    <option value="impact_claims">impact_claims</option>
                    <option value="impact_delays">impact_delays</option>
                    <option value="impact_cancellations">impact_cancellations</option>
                    <option value="other">other</option>
                  </select>
                </div>

                <div>
                  <div className="text-xs text-spv-muted">Qtd</div>
                  <input
                    value={qty}
                    onChange={(e) => setQty(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-spv-line bg-spv-page px-3 py-2 text-sm text-spv-ink outline-none focus:border-emerald-500/50"
                  />
                </div>
              </div>

              <div>
                <div className="text-xs text-spv-muted">Valor unitário (R$)</div>
                <input
                  value={unitPrice}
                  onChange={(e) => setUnitPrice(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-spv-line bg-spv-page px-3 py-2 text-sm text-spv-ink outline-none focus:border-emerald-500/50"
                />
              </div>

              <div>
                <div className="text-xs text-spv-muted">Obs (opcional)</div>
                <input
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Ex: referente ao mês 02/2026"
                  className="mt-1 w-full rounded-xl border border-spv-line bg-spv-page px-3 py-2 text-sm text-spv-ink outline-none focus:border-emerald-500/50"
                />
              </div>

              <button
                onClick={onAddLedger}
                disabled={addingLedger}
                className="w-full rounded-xl border border-spv-line bg-spv-surface px-4 py-2 text-sm font-semibold text-spv-ink hover:bg-spv-raised disabled:opacity-60"
              >
                {addingLedger ? "Adicionando…" : "Adicionar lançamento"}
              </button>

              <div className="text-[11px] text-spv-muted">
                Total deste lançamento:{" "}
                <span className="text-spv-ink">
                  {brl((Number(qty) || 0) * (Number(unitPrice) || 0))}
                </span>
              </div>
            </div>
          </div>

          {/* Filtro rápido do painel */}
          <div className="rounded-xl border border-spv-line bg-spv-surface p-5">
            <div className="text-sm font-semibold text-spv-ink">Filtro de lançamentos</div>
            <div className="mt-3">
              <div className="text-xs text-spv-muted">Mostrando lançamentos de:</div>
              <select
                value={selectedInfluencerId}
                onChange={(e) => setSelectedInfluencerId(e.target.value)}
                className="mt-1 w-full rounded-xl border border-spv-line bg-spv-page px-3 py-2 text-sm text-spv-ink outline-none focus:border-emerald-500/50"
              >
                {influencers.map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.code} — {i.name}
                  </option>
                ))}
              </select>
              <div className="mt-2 text-[11px] text-spv-muted">
                A tabela “Últimos lançamentos” sempre fica filtrada nesse influencer.
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
