import { NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

function normalizeCoupon(v: unknown) {
  return String(v ?? "").trim().toUpperCase();
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));

    const userId = String(body?.userId ?? "").trim();
    const fullName = String(body?.fullName ?? "").trim();
    const storeName = String(body?.storeName ?? "").trim();
    const couponCode = normalizeCoupon(body?.couponCode);

    if (!userId) {
      return Response.json({ ok: false, error: "userId obrigatório" }, { status: 400 });
    }

    // ✅ resolve cupom -> influencer_id (se existir e ativo)
    let influencerId: string | null = null;
    if (couponCode) {
      const { data: inf, error: infErr } = await supabaseAdmin
        .from("influencers")
        .select("id, is_active")
        .eq("coupon_code", couponCode)
        .maybeSingle();

      // se cupom não existe ou não ativo, apenas ignora (não bloqueia signup)
      if (!infErr && inf?.id && inf?.is_active) {
        influencerId = inf.id;
      }
    }

    // 1) se já existe seller_accounts pra esse owner_user_id, não cria de novo
    const { data: existing, error: selErr } = await supabaseAdmin
      .from("seller_accounts")
      .select("id, seller_id")
      .eq("owner_user_id", userId)
      .maybeSingle();

    if (selErr) {
      return Response.json(
        { ok: false, error: "Falha ao consultar seller_accounts", details: selErr.message },
        { status: 500 }
      );
    }

    // Se já existe: ✅ atualiza os novos campos (sem apagar nada existente)
    if (existing?.id) {
      const patch: Record<string, any> = {};

      // Só atualiza se veio preenchido
      if (fullName) patch.full_name = fullName;
      if (storeName) patch.store_name = storeName;

      // Cupom: se veio, grava. Se não veio, não mexe.
      if (couponCode) patch.coupon_code = couponCode;

      // influencer_id: só grava se achou influencer válido
      if (influencerId) patch.influencer_id = influencerId;

      if (Object.keys(patch).length > 0) {
        const { error: upErr } = await supabaseAdmin
          .from("seller_accounts")
          .update(patch)
          .eq("id", existing.id);

        if (upErr) {
          return Response.json(
            { ok: false, error: "Falha ao atualizar seller_accounts", details: upErr.message },
            { status: 500 }
          );
        }
      }

      return Response.json({
        ok: true,
        created: false,
        sellerAccountId: existing.id,
        sellerId: existing.seller_id,
      });
    }

    // 2) cria seller_id novo (uuid)
    const sellerId = crypto.randomUUID();

    const { data: created, error: insErr } = await supabaseAdmin
      .from("seller_accounts")
      .insert({
        owner_user_id: userId,
        seller_id: sellerId,
        nickname: null,
        ml_user_id: null,

        // ✅ novos campos do cadastro
        full_name: fullName || null,
        store_name: storeName || null,
        coupon_code: couponCode || null,
        influencer_id: influencerId,

        created_at: new Date().toISOString(),
      })
      .select("id, seller_id")
      .maybeSingle();

    if (insErr) {
      return Response.json(
        { ok: false, error: "Falha ao criar seller_accounts", details: insErr.message },
        { status: 500 }
      );
    }

    return Response.json({
      ok: true,
      created: true,
      sellerAccountId: created?.id,
      sellerId: created?.seller_id,
    });
  } catch (e: any) {
    return Response.json({ ok: false, error: e?.message ?? "Erro" }, { status: 500 });
  }
}
