// app/api/admin/influencers/[id]/detail/route.ts
import { requireAdmin } from "@/lib/requireAdmin";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function GET(_: Request, ctx: { params: Promise<{ id: string }> }) {
  const gate = await requireAdmin();
  if (!gate.ok) {
    return Response.json({ ok: false, error: gate.error }, { status: gate.status });
  }

  const { id } = await ctx.params;
  const influencerId = String(id ?? "").trim();
  if (!influencerId) {
    return Response.json({ ok: false, error: "id obrigatório" }, { status: 400 });
  }

  // dashboard (view)
  const { data: dash, error: dashErr } = await supabaseAdmin
    .from("v_influencer_dashboard")
    .select("*")
    .eq("influencer_id", influencerId)
    .maybeSingle();

  if (dashErr) {
    return Response.json({ ok: false, error: `dashboard: ${dashErr.message}` }, { status: 500 });
  }

  // sellers vinculados
  const { data: refs, error: refsErr } = await supabaseAdmin
    .from("seller_referrals")
    .select("seller_account_id, seller_full_name, store_name, coupon_code")
    .eq("influencer_id", influencerId)
    .order("created_at", { ascending: false });

  if (refsErr) {
    return Response.json({ ok: false, error: `seller_referrals: ${refsErr.message}` }, { status: 500 });
  }

  // precisamos do seller_id (uuid) do seller_accounts pra usar no ledger
  const sellerAccountIds = (refs ?? []).map((r) => r.seller_account_id).filter(Boolean);
  let sellerIdBySellerAccount: Record<string, string> = {};

  if (sellerAccountIds.length > 0) {
    const { data: accs, error: accErr } = await supabaseAdmin
      .from("seller_accounts")
      .select("id, seller_id")
      .in("id", sellerAccountIds);

    if (accErr) {
      return Response.json({ ok: false, error: `seller_accounts: ${accErr.message}` }, { status: 500 });
    }

    for (const a of accs ?? []) {
      if (a?.id && a?.seller_id) sellerIdBySellerAccount[a.id] = a.seller_id;
    }
  }

  const sellers = (refs ?? []).map((r) => ({
    seller_account_id: r.seller_account_id,
    seller_full_name: r.seller_full_name ?? null,
    store_name: r.store_name ?? null,
    coupon_code: r.coupon_code ?? null,
    seller_id: sellerIdBySellerAccount[r.seller_account_id] ?? null,
  }));

  // ledger recente
  const { data: led, error: ledErr } = await supabaseAdmin
    .from("seller_commission_ledger")
    .select("id, seller_id, kind, qty, unit_price, notes, created_at")
    .eq("influencer_id", influencerId)
    .order("created_at", { ascending: false })
    .limit(50);

  if (ledErr) {
    return Response.json({ ok: false, error: `ledger: ${ledErr.message}` }, { status: 500 });
  }

  return Response.json({
    ok: true,
    dashboard: dash ?? null,
    sellers,
    ledger: led ?? [],
  });
}
