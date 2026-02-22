// app/api/referral/apply/route.ts
import { NextRequest } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

type Body = {
  sellerAccountId?: string; // uuid (seller_accounts.id)
  couponCode?: string; // ex: "DUDA10"
  sellerFullName?: string;
  storeName?: string;
};

function normCoupon(v: string) {
  return v.trim().toUpperCase();
}

async function supabaseFromCookies() {
  // ✅ Next 15+: cookies() é async
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        // ✅ em Route Handler não precisamos set/remove pra autenticar leitura
        set() {},
        remove() {},
      },
    }
  );
}

export async function POST(req: NextRequest) {
  try {
    // 1) user logado via cookies
    const supabase = await supabaseFromCookies();
    const { data: userData, error: userErr } = await supabase.auth.getUser();

    if (userErr || !userData?.user) {
      return Response.json({ ok: false, error: "Não autenticado" }, { status: 401 });
    }

    // 2) body
    const body = (await req.json().catch(() => ({}))) as Body;

    const sellerAccountId = String(body?.sellerAccountId ?? "").trim();
    const couponCodeRaw = String(body?.couponCode ?? "").trim();
    const sellerFullName = String(body?.sellerFullName ?? "").trim() || null;
    const storeName = String(body?.storeName ?? "").trim() || null;

    if (!sellerAccountId) {
      return Response.json({ ok: false, error: "sellerAccountId obrigatório" }, { status: 400 });
    }
    if (!couponCodeRaw) {
      return Response.json({ ok: false, error: "couponCode obrigatório" }, { status: 400 });
    }

    const couponCode = normCoupon(couponCodeRaw);

    // 3) valida que esse seller_accounts.id pertence ao user logado
    const { data: sellerAcc, error: sellerErr } = await supabaseAdmin
      .from("seller_accounts")
      .select("id, seller_id, owner_user_id")
      .eq("id", sellerAccountId)
      .maybeSingle();

    if (sellerErr) {
      return Response.json(
        { ok: false, error: "Falha ao consultar seller_accounts", details: sellerErr.message },
        { status: 500 }
      );
    }

    if (!sellerAcc?.id) {
      return Response.json({ ok: false, error: "sellerAccount não encontrado" }, { status: 404 });
    }

    if (sellerAcc.owner_user_id !== userData.user.id) {
      return Response.json({ ok: false, error: "Sem permissão para esse seller" }, { status: 403 });
    }

    // 4) busca influencer (coluna code)
    const { data: influencer, error: infErr } = await supabaseAdmin
      .from("influencers")
      .select("id, code, name, commission_rate, is_active")
      .eq("code", couponCode)
      .maybeSingle();

    if (infErr) {
      return Response.json(
        { ok: false, error: "Falha ao consultar influencers", details: infErr.message },
        { status: 500 }
      );
    }

    if (!influencer?.id) {
      return Response.json(
        { ok: false, error: "Cupom inválido (influencer não encontrado)" },
        { status: 404 }
      );
    }

    if (influencer.is_active === false) {
      return Response.json({ ok: false, error: "Influencer inativo" }, { status: 400 });
    }

    // 5) upsert em seller_referrals (unique por seller_account_id)
    const payload = {
      seller_account_id: sellerAcc.id,
      influencer_id: influencer.id,
      coupon_code: couponCode,
      seller_full_name: sellerFullName,
      store_name: storeName,
      discount_rate: 0.1, // 10% pro seller
      created_at: new Date().toISOString(),
    };

    const { data: referral, error: upErr } = await supabaseAdmin
      .from("seller_referrals")
      .upsert(payload, { onConflict: "seller_account_id" })
      .select("id, seller_account_id, influencer_id, coupon_code")
      .maybeSingle();

    if (upErr) {
      return Response.json(
        { ok: false, error: "Falha ao salvar referral", details: upErr.message },
        { status: 500 }
      );
    }

    return Response.json({
      ok: true,
      referral,
      influencer: {
        id: influencer.id,
        code: influencer.code,
        name: influencer.name,
        commission_rate: influencer.commission_rate,
      },
      seller: {
        seller_account_id: sellerAcc.id,
        seller_id: sellerAcc.seller_id,
      },
    });
  } catch (e: any) {
    return Response.json({ ok: false, error: e?.message ?? "Erro" }, { status: 500 });
  }
}
