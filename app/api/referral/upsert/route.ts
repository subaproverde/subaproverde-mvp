import { NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

type Body = {
  userId: string; // auth.users.id
  sellerFullName?: string;
  storeName?: string;
  couponCode?: string; // ex: "INFTESTE10"
};

function norm(v: string) {
  return v.trim().toUpperCase();
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => ({}))) as Body;

    const userId = String(body?.userId ?? "").trim();
    const sellerFullName = String(body?.sellerFullName ?? "").trim();
    const storeName = String(body?.storeName ?? "").trim();
    const couponCodeRaw = String(body?.couponCode ?? "").trim();
    const couponCode = couponCodeRaw ? norm(couponCodeRaw) : null;

    if (!userId) {
      return Response.json({ ok: false, error: "userId obrigatório" }, { status: 400 });
    }

    // (segurança) confirmar que esse user existe no auth
    const { data: authUser, error: authErr } = await supabaseAdmin.auth.admin.getUserById(userId);
    if (authErr || !authUser?.user) {
      return Response.json({ ok: false, error: "userId inválido" }, { status: 400 });
    }

    // achar seller_account do user
    const { data: sellerAcc, error: sellerErr } = await supabaseAdmin
      .from("seller_accounts")
      .select("id, seller_id, owner_user_id")
      .eq("owner_user_id", userId)
      .maybeSingle();

    if (sellerErr) {
      return Response.json(
        { ok: false, error: "Falha ao buscar seller_accounts", details: sellerErr.message },
        { status: 500 }
      );
    }
    if (!sellerAcc?.id) {
      // se por algum motivo não criou ainda, retorna claro pra você ver
      return Response.json(
        { ok: false, error: "seller_accounts não encontrado (chame /api/seller_accounts/ensure antes)" },
        { status: 400 }
      );
    }

    // buscar influencer pelo cupom (se informado)
    let influencerId: string | null = null;

    if (couponCode) {
      const { data: inf, error: infErr } = await supabaseAdmin
        .from("influencers")
        .select("id, code, is_active")
        .eq("code", couponCode)
        .maybeSingle();

      if (infErr) {
        return Response.json(
          { ok: false, error: "Falha ao buscar influencer", details: infErr.message },
          { status: 500 }
        );
      }

      if (!inf?.id || inf?.is_active === false) {
        // cupom inválido/disabled -> grava referral mesmo assim, mas sem influencer
        influencerId = null;
      } else {
        influencerId = inf.id;
      }
    }

    // upsert seller_referrals (1 por seller_account_id)
    const payload = {
      seller_account_id: sellerAcc.id,
      influencer_id: influencerId,
      coupon_code: couponCodeRaw ? couponCode : null,
      seller_full_name: sellerFullName || null,
      store_name: storeName || null,
      discount_rate: 0.10,
      created_at: new Date().toISOString(),
    };

    const { data: up, error: upErr } = await supabaseAdmin
      .from("seller_referrals")
      .upsert(payload, { onConflict: "seller_account_id" })
      .select("id, seller_account_id, influencer_id, coupon_code")
      .maybeSingle();

    if (upErr) {
      return Response.json(
        { ok: false, error: "Falha ao salvar seller_referrals", details: upErr.message },
        { status: 500 }
      );
    }

    return Response.json({
      ok: true,
      sellerAccountId: sellerAcc.id,
      sellerId: sellerAcc.seller_id,
      referral: up,
      couponApplied: !!influencerId,
    });
  } catch (e: any) {
    return Response.json({ ok: false, error: e?.message ?? "Erro" }, { status: 500 });
  }
}
