"use client";

import { useEffect, useMemo, useState } from "react";
import { supabaseBrowser } from "@/lib/supabaseClient";
import Link from "next/link";

type Influencer = {
  id: string;
  name: string;
  coupon_code: string;
  commission_rate: number;
  seller_discount_rate: number;
};

type SellerAccount = {
  id: string;
  full_name: string | null;
  store_name: string | null;
  coupon_code: string | null;
  influencer_id: string | null;
};

type Charge = {
  id: string;
  seller_id: string;
  amount: number;
};

export default function InfluencerPage() {
  const [loading, setLoading] = useState(true);
  const [authUserId, setAuthUserId] = useState<string | null>(null);

  const [influencer, setInfluencer] = useState<Influencer | null>(null);
  const [sellers, setSellers] = useState<SellerAccount[]>([]);
  const [charges, setCharges] = useState<Charge[]>([]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const { data: s } = await supabaseBrowser.auth.getSession();
        const uid = s?.session?.user?.id ?? null;
        setAuthUserId(uid);

        if (!uid) {
          window.location.href = "/login";
          return;
        }

        // 1) checa se esse user é influencer
        const { data: linkRow, error: linkErr } = await supabaseBrowser
          .from("influencer_users")
          .select("influencer_id")
          .eq("auth_user_id", uid)
          .maybeSingle();

        if (linkErr) {
          alert(linkErr.message);
          return;
        }

        if (!linkRow?.influencer_id) {
          // não é influencer
          window.location.href = "/dashboard";
          return;
        }

        const influencerId = linkRow.influencer_id;

        // 2) busca influencer
        const { data: inf, error: infErr } = await supabaseBrowser
          .from("influencers")
          .select("id,name,coupon_code,commission_rate,seller_discount_rate")
          .eq("id", influencerId)
          .single();

        if (infErr) {
          alert(infErr.message);
          return;
        }

        setInfluencer(inf as Influencer);

        // 3) sellers atribuídos ao influencer
        const { data: sel, error: selErr } = await supabaseBrowser
          .from("seller_accounts")
          .select("id,full_name,store_name,coupon_code,influencer_id")
          .eq("influencer_id", influencerId)
          .order("store_name", { ascending: true });

        if (selErr) {
          alert(selErr.message);
          return;
        }

        const sellersList = (sel ?? []) as SellerAccount[];
        setSellers(sellersList);

        // 4) charges desses sellers (manual)
        const sellerIds = sellersList.map((x) => x.id);
        if (sellerIds.length > 0) {
          const { data: ch, error: chErr } = await supabaseBrowser
            .from("seller_charges")
            .select("id,seller_id,amount")
            .in("seller_id", sellerIds);

          if (chErr) {
            alert(chErr.message);
            return;
          }

          setCharges((ch ?? []) as Charge[]);
        } else {
          setCharges([]);
        }
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const totals = useMemo(() => {
    const bySeller: Record<string, number> = {};
    for (const c of charges) {
      bySeller[c.seller_id] = (bySeller[c.seller_id] ?? 0) + Number(c.amount ?? 0);
    }

    const totalRevenue = Object.values(bySeller).reduce((a, b) => a + b, 0);
    const rate = influencer?.commission_rate ?? 0;
    const commission = totalRevenue * rate;

    return { bySeller, totalRevenue, commission };
  }, [charges, influencer]);

  if (loading) {
    return <div className="p-8 text-slate-600">Carregando…</div>;
  }

  if (!authUserId) return null;

  return (
    <div className="min-h-screen px-6 py-10">
      <div className="mx-auto max-w-6xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-xs text-slate-500">Painel do Influencer</div>
            <h1 className="text-3xl font-semibold text-slate-900">
              Comissões e Sellers indicados
            </h1>
            <p className="mt-2 text-slate-600">
              Acompanhe o faturamento total dos sellers que usaram seu cupom e sua comissão vitalícia.
            </p>
          </div>

          <Link
            href="/dashboard"
            className="rounded-xl border bg-white/70 backdrop-blur px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-white"
          >
            Voltar ao sistema
          </Link>
        </div>

        {/* Cards topo */}
        <div className="mt-8 grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="rounded-2xl border bg-white/80 backdrop-blur p-5">
            <div className="text-xs text-slate-500">Seu cupom</div>
            <div className="mt-1 text-xl font-semibold text-slate-900">
              {influencer?.coupon_code ?? "-"}
            </div>
            <div className="mt-1 text-xs text-slate-500">
              Desconto seller: {(Number(influencer?.seller_discount_rate ?? 0) * 100).toFixed(0)}%
            </div>
          </div>

          <div className="rounded-2xl border bg-white/80 backdrop-blur p-5">
            <div className="text-xs text-slate-500">Sellers indicados</div>
            <div className="mt-1 text-xl font-semibold text-slate-900">
              {sellers.length}
            </div>
          </div>

          <div className="rounded-2xl border bg-white/80 backdrop-blur p-5">
            <div className="text-xs text-slate-500">Faturamento (base comissão)</div>
            <div className="mt-1 text-xl font-semibold text-slate-900">
              R$ {totals.totalRevenue.toFixed(2)}
            </div>
          </div>

          <div className="rounded-2xl border bg-white/80 backdrop-blur p-5">
            <div className="text-xs text-slate-500">Sua comissão vitalícia</div>
            <div className="mt-1 text-xl font-semibold text-emerald-800">
              R$ {totals.commission.toFixed(2)}
            </div>
            <div className="mt-1 text-xs text-slate-500">
              Taxa: {(Number(influencer?.commission_rate ?? 0) * 100).toFixed(0)}%
            </div>
          </div>
        </div>

        {/* Lista sellers */}
        <div className="mt-8 rounded-3xl border bg-white/80 backdrop-blur p-6">
          <div className="text-base font-semibold text-slate-900">Sellers</div>
          <div className="mt-1 text-sm text-slate-600">
            Aqui você vê cada seller indicado e o total gasto (lançado manualmente por enquanto).
          </div>

          <div className="mt-5 divide-y">
            {sellers.length === 0 ? (
              <div className="py-10 text-center text-slate-600">
                Nenhum seller indicado ainda.
              </div>
            ) : (
              sellers.map((s) => {
                const spent = totals.bySeller[s.id] ?? 0;
                const rate = influencer?.commission_rate ?? 0;
                const earned = spent * rate;

                return (
                  <div key={s.id} className="py-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                    <div>
                      <div className="font-semibold text-slate-900">
                        {s.store_name ?? "(Sem nome de loja)"}
                      </div>
                      <div className="text-sm text-slate-600">
                        {s.full_name ?? ""}{" "}
                        {s.coupon_code ? (
                          <span className="text-xs text-slate-500">
                            • Cupom: {s.coupon_code}
                          </span>
                        ) : null}
                      </div>
                    </div>

                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <div className="text-xs text-slate-500">Gasto total</div>
                        <div className="font-semibold text-slate-900">
                          R$ {spent.toFixed(2)}
                        </div>
                      </div>

                      <div className="text-right">
                        <div className="text-xs text-slate-500">Comissão</div>
                        <div className="font-semibold text-emerald-800">
                          R$ {earned.toFixed(2)}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <div className="mt-6 text-xs text-slate-500">
            Observação: os valores vêm de lançamentos em <code>seller_charges</code>. Depois, quando o sistema estiver 100%,
            a gente automatiza com base nas tratativas do seller.
          </div>
        </div>
      </div>
    </div>
  );
}
