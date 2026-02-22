"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabase";

type Dashboard = {
  influencer_id: string;
  influencer_code: string;
  influencer_name: string;
  influencer_email: string | null;
  commission_rate: number;
  total_spend: number;
  total_commission: number;
};

type SellerReferralItem = {
  seller_account_id: string;
  seller_full_name: string | null;
  store_name: string | null;
  coupon_code: string | null;
  seller_id: string | null;
};

type LedgerItem = {
  id: string;
  seller_id: string;
  kind: string;
  qty: number;
  unit_price: number;
  notes: string | null;
  created_at: string;
};

export default function InfluencerDetailPage() {
  const params = useParams<{ id: string }>();
  const influencerId = params?.id;

  const [isAdmin, setIsAdmin] = useState(false);
  const [loadingGate, setLoadingGate] = useState(true);

  const [dash, setDash] = useState<Dashboard | null>(null);
  const [sellers, setSellers] = useState<SellerReferralItem[]>([]);
  const [ledger, setLedger] = useState<LedgerItem[]>([]);
  const [err, setErr] = useState<string | null>(null);

  // form ledger
  const [sellerId, setSellerId] = useState("");
  const [kind, setKind] = useState("impact_claims");
  const [qty, setQty] = useState("1");
  const [unitPrice, setUnitPrice] = useState("0");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData?.user) {
        if (alive) {
          setIsAdmin(false);
          setLoadingGate(false);
        }
        return;
      }
      const { data, error } = await supabase.rpc("is_admin");
      if (!alive) return;
      setIsAdmin(!error && !!data);
      setLoadingGate(false);
    })();
    return () => {
      alive = false;
    };
  }, []);

  async function loadAll() {
    setErr(null);

    const r = await fetch(`/api/admin/influencers/${encodeURIComponent(influencerId)}/detail`);
    const j = await r.json().catch(() => ({}));

    if (!r.ok || !j?.ok) {
      setErr(j?.error ?? "Falha ao carregar detalhes");
      setDash(null);
      setSellers([]);
      setLedger([]);
      return;
    }

    setDash(j.dashboard ?? null);
    setSellers(j.sellers ?? []);
    setLedger(j.ledger ?? []);
  }

  useEffect(() => {
    if (!loadingGate && isAdmin && influencerId) loadAll();
  }, [loadingGate, isAdmin, influencerId]);

  const sellerOptions = useMemo(() => {
    return sellers
      .map((s) => ({
        seller_id: s.seller_id,
        label:
          (s.store_name ? `${s.store_name} — ` : "") +
          (s.seller_full_name ? s.seller_full_name : "seller") +
          (s.coupon_code ? ` (${s.coupon_code})` : ""),
      }))
      .filter((x) => !!x.seller_id) as { seller_id: string; label: string }[];
  }, [sellers]);

  const canSave = useMemo(() => {
    const q = Number(qty);
    const p = Number(unitPrice);
    return !!sellerId && kind.trim().length > 0 && Number.isFinite(q) && q > 0 && Number.isFinite(p) && p >= 0;
  }, [sellerId, kind, qty, unitPrice]);

  async function onAddLedger() {
    if (!canSave) return;
    setSaving(true);
    setErr(null);
    try {
      const r = await fetch("/api/admin/ledger/add", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          influencerId,
          sellerId,
          kind,
          qty: Number(qty),
          unitPrice: Number(unitPrice),
          notes: notes.trim() || null,
        }),
      });

      const j = await r.json().catch(() => ({}));
      if (!r.ok || !j?.ok) {
        setErr(j?.error ?? "Falha ao lançar");
        return;
      }

      setQty("1");
      setUnitPrice("0");
      setNotes("");
      await loadAll();
    } finally {
      setSaving(false);
    }
  }

  if (loadingGate) return <div className="text-white/70">Carregando...</div>;
  if (!isAdmin) return <div className="text-white/70">Acesso restrito.</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-2xl font-semibold">{dash?.influencer_name ?? "Influencer"}</div>
          <div className="text-sm text-white/60">
            {dash?.influencer_code ? `Cupom: ${dash.influencer_code}` : ""}{" "}
            {dash?.influencer_email ? `• ${dash.influencer_email}` : ""}
          </div>
        </div>

        <button
          onClick={loadAll}
          className="rounded-xl border border-white/10 px-3 py-2 text-xs text-white/80 hover:bg-white/5"
        >
          Atualizar
        </button>
      </div>

      {err ? (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          {err}
        </div>
      ) : null}

      {/* Resumo */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <div className="text-xs text-white/60">Total gasto (sellers)</div>
          <div className="text-2xl font-semibold">
            R$ {(dash?.total_spend ?? 0).toFixed(2)}
          </div>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <div className="text-xs text-white/60">Comissão</div>
          <div className="text-2xl font-semibold">
            R$ {(dash?.total_commission ?? 0).toFixed(2)}
          </div>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <div className="text-xs text-white/60">Taxa</div>
          <div className="text-2xl font-semibold">
            {(((dash?.commission_rate ?? 0) * 100) || 0).toFixed(0)}%
          </div>
        </div>
      </div>

      {/* Sellers vinculados */}
      <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
        <div className="text-sm font-semibold mb-3">Sellers indicados</div>

        {sellers.length === 0 ? (
          <div className="text-sm text-white/60">Nenhum seller vinculado ainda.</div>
        ) : (
          <div className="divide-y divide-white/10">
            {sellers.map((s) => (
              <div key={s.seller_account_id} className="py-3">
                <div className="text-sm font-semibold">
                  {s.store_name ?? "Loja"} <span className="text-white/40">•</span>{" "}
                  {s.seller_full_name ?? "Sem nome"}
                </div>
                <div className="text-xs text-white/50">
                  cupom: {s.coupon_code ?? "-"} • seller_id: {s.seller_id ?? "-"}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Lançar ledger */}
      <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
        <div className="text-sm font-semibold mb-3">Lançar serviço (manual)</div>

        <div className="grid grid-cols-1 md:grid-cols-6 gap-3">
          <div className="md:col-span-2 space-y-1">
            <div className="text-xs text-white/60">Seller</div>
            <select
              className="w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm outline-none"
              value={sellerId}
              onChange={(e) => setSellerId(e.target.value)}
            >
              <option value="">Selecione...</option>
              {sellerOptions.map((o) => (
                <option key={o.seller_id} value={o.seller_id}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <div className="text-xs text-white/60">Tipo</div>
            <select
              className="w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm outline-none"
              value={kind}
              onChange={(e) => setKind(e.target.value)}
            >
              <option value="impact_claims">Reclamações</option>
              <option value="impact_delays">Atrasos</option>
              <option value="impact_cancellations">Cancelamentos</option>
              <option value="other">Outro</option>
            </select>
          </div>

          <div className="space-y-1">
            <div className="text-xs text-white/60">Qtd</div>
            <input
              className="w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm outline-none"
              value={qty}
              onChange={(e) => setQty(e.target.value)}
              placeholder="1"
            />
          </div>

          <div className="space-y-1">
            <div className="text-xs text-white/60">Valor unit (R$)</div>
            <input
              className="w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm outline-none"
              value={unitPrice}
              onChange={(e) => setUnitPrice(e.target.value)}
              placeholder="0"
            />
          </div>

          <div className="flex items-end">
            <button
              onClick={onAddLedger}
              disabled={!canSave || saving}
              className="w-full rounded-xl border border-emerald-400/20 bg-emerald-500/15 px-4 py-2 text-sm font-semibold text-white/90 hover:bg-emerald-500/20 disabled:opacity-50"
            >
              {saving ? "Salvando..." : "Lançar"}
            </button>
          </div>

          <div className="md:col-span-6 space-y-1">
            <div className="text-xs text-white/60">Observação (opcional)</div>
            <input
              className="w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm outline-none"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Ex: protocolo ML, descrição do caso, etc"
            />
          </div>
        </div>
      </div>

      {/* Histórico ledger */}
      <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
        <div className="text-sm font-semibold mb-3">Histórico de lançamentos</div>

        {ledger.length === 0 ? (
          <div className="text-sm text-white/60">Nenhum lançamento ainda.</div>
        ) : (
          <div className="divide-y divide-white/10">
            {ledger.map((l) => (
              <div key={l.id} className="py-3 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <div className="font-semibold">
                    {l.kind} • {l.qty} x R$ {Number(l.unit_price).toFixed(2)}
                  </div>
                  <div className="text-xs text-white/50">
                    {new Date(l.created_at).toLocaleString()}
                  </div>
                </div>
                <div className="text-xs text-white/60">
                  seller: {l.seller_id} {l.notes ? `• ${l.notes}` : ""}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
