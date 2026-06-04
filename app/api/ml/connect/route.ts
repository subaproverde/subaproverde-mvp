import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";
import { authErrorResponse, requireRequestUser } from "@/lib/apiAuth";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(req: NextRequest) {
  try {
    const auth = await requireRequestUser(req);
    if (!auth.ok) return authErrorResponse(auth);

    const sp = req.nextUrl.searchParams;
    const userId = auth.user.id;
    const sellerId = sp.get("sellerId")?.trim() || "";
    const wantsJson = sp.get("json") === "1";

    if (!userId) {
      return NextResponse.json(
        { error: "userId é obrigatório. Use /api/ml/connect?userId=SEU_USER_ID" },
        { status: 400 }
      );
    }

    const clientId = process.env.ML_CLIENT_ID;
    if (!clientId) {
      return NextResponse.json(
        { error: "ML_CLIENT_ID não configurado no .env.local" },
        { status: 500 }
      );
    }

    const redirectUri = process.env.ML_REDIRECT_URI;

    if (!redirectUri) {
      return NextResponse.json(
        { error: "ML_REDIRECT_URI não configurado no ambiente" },
        { status: 500 }
      );
    }

    if (sellerId) {
      const { data: sellerAccount, error: sellerAccountErr } = await supabaseAdmin
        .from("seller_accounts")
        .select("seller_id")
        .eq("owner_user_id", userId)
        .eq("seller_id", sellerId)
        .maybeSingle();

      if (sellerAccountErr) {
        return NextResponse.json(
          { error: "Falha ao validar seller antes do OAuth", details: sellerAccountErr.message },
          { status: 500 }
        );
      }

      if (!sellerAccount?.seller_id) {
        return NextResponse.json(
          { error: "sellerId nÃ£o pertence ao usuÃ¡rio logado" },
          { status: 403 }
        );
      }
    }

    await supabaseAdmin.from("oauth_states").delete().eq("user_id", userId);

    const nonce = crypto.randomUUID();
    const state = sellerId ? `${nonce}:${sellerId}` : nonce;

    const { error: insErr } = await supabaseAdmin.from("oauth_states").insert({
      user_id: userId,
      state,
      provider: "mercadolivre",
      created_at: new Date().toISOString(),
    });

    if (insErr) {
      return NextResponse.json(
        { error: "Falha ao salvar oauth_state", details: insErr.message },
        { status: 500 }
      );
    }

    const scope = "offline_access read write";

    const authUrl =
      "https://auth.mercadolivre.com.br/authorization" +
      `?response_type=code` +
      `&client_id=${encodeURIComponent(clientId)}` +
      `&redirect_uri=${encodeURIComponent(redirectUri)}` +
      `&state=${encodeURIComponent(state)}` +
      `&scope=${encodeURIComponent(scope)}`;

    if (wantsJson) {
      return NextResponse.json({ ok: true, authUrl }, { headers: { "Cache-Control": "no-store" } });
    }

    return NextResponse.redirect(authUrl);
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message ?? "Erro ao iniciar OAuth Mercado Livre" },
      { status: 500 }
    );
  }
}
