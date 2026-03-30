import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);

    const code = searchParams.get("code");
    const state = searchParams.get("state");

    if (!code || !state) {
      return NextResponse.json({ error: "code/state ausente" }, { status: 400 });
    }

    // =====================================================
    // 1) RECUPERA O USER QUE INICIOU O OAUTH
    // =====================================================
    const { data: oauthState, error: stateErr } = await supabase
      .from("oauth_states")
      .select("user_id, state")
      .eq("state", state)
      .single();

    if (stateErr || !oauthState?.user_id) {
      return NextResponse.json(
        { error: "oauth_state inválido", details: stateErr?.message },
        { status: 400 }
      );
    }

    const userId = String(oauthState.user_id);

    // =====================================================
    // 2) TROCA CODE POR TOKEN NO ML
    // =====================================================
    const tokenRes = await fetch("https://api.mercadolibre.com/oauth/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        client_id: process.env.ML_CLIENT_ID!,
        client_secret: process.env.ML_CLIENT_SECRET!,
        code,
        redirect_uri: process.env.ML_REDIRECT_URI!,
      }),
      cache: "no-store",
    });

    const tokenData = await tokenRes.json().catch(() => ({} as any));

    if (!tokenRes.ok) {
      return NextResponse.json(
        { error: "Erro ao trocar code por token", tokenData },
        { status: 500 }
      );
    }

    const mlUserId = String(tokenData.user_id);
    const accessToken = String(tokenData.access_token);
    const refreshToken = tokenData.refresh_token ? String(tokenData.refresh_token) : null;

    // =====================================================
    // 3) BUSCA DADOS DA CONTA ML
    // =====================================================
    const meRes = await fetch("https://api.mercadolibre.com/users/me", {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: "no-store",
    });

    const me = await meRes.json().catch(() => ({} as any));
    const nickname = (me?.nickname && String(me.nickname).trim()) || "Conta Mercado Livre";

    // =====================================================
    // 4) RESOLVE sellerId COM SEGURANÇA
    // =====================================================
    let sellerId: string | null = null;

    // 4A) Primeiro tenta achar por ml_user_id em seller_accounts
    const { data: accountByMlUser, error: accountByMlUserErr } = await supabase
      .from("seller_accounts")
      .select("id, seller_id, owner_user_id, ml_user_id")
      .eq("ml_user_id", mlUserId)
      .maybeSingle();

    if (accountByMlUserErr) {
      return NextResponse.json(
        {
          error: "Falha ao buscar seller_accounts por ml_user_id",
          details: accountByMlUserErr.message,
        },
        { status: 500 }
      );
    }

    if (accountByMlUser?.seller_id) {
      sellerId = String(accountByMlUser.seller_id);
    }

    // 4B) Se não achou, tenta por owner_user_id
    if (!sellerId) {
      const { data: existingAccount, error: accGetErr } = await supabase
        .from("seller_accounts")
        .select("id, seller_id, owner_user_id")
        .eq("owner_user_id", userId)
        .maybeSingle();

      if (accGetErr) {
        return NextResponse.json(
          {
            error: "Falha ao recuperar seller_accounts por owner_user_id",
            details: accGetErr.message,
          },
          { status: 500 }
        );
      }

      if (existingAccount?.seller_id) {
        sellerId = String(existingAccount.seller_id);
      }
    }

    // 4C) Se ainda não achou, tenta em sellers por ml_user_id
    if (!sellerId) {
      const { data: existingSeller, error: sellerFindErr } = await supabase
        .from("sellers")
        .select("id, ml_user_id")
        .eq("ml_user_id", mlUserId)
        .maybeSingle();

      if (sellerFindErr) {
        return NextResponse.json(
          {
            error: "Falha ao buscar seller em sellers por ml_user_id",
            details: sellerFindErr.message,
          },
          { status: 500 }
        );
      }

      if (existingSeller?.id) {
        sellerId = String(existingSeller.id);
      }
    }

    // 4D) Se não achou nada, cria seller novo
    if (!sellerId) {
      const { data: newSeller, error: sellerErr } = await supabase
        .from("sellers")
        .insert({
          name: nickname,
          status: "active",
          ml_user_id: mlUserId,
        })
        .select("id")
        .single();

      if (sellerErr || !newSeller?.id) {
        return NextResponse.json(
          { error: "Falha ao criar seller", details: sellerErr?.message ?? "sem id" },
          { status: 500 }
        );
      }

      sellerId = String(newSeller.id);
    }

    // 4E) GARANTE que sellerId existe em sellers
    const { data: sellerCheck, error: sellerCheckErr } = await supabase
      .from("sellers")
      .select("id")
      .eq("id", sellerId)
      .maybeSingle();

    if (sellerCheckErr) {
      return NextResponse.json(
        {
          error: "Falha ao validar seller em sellers",
          details: sellerCheckErr.message,
        },
        { status: 500 }
      );
    }

    if (!sellerCheck?.id) {
      return NextResponse.json(
        {
          error: "seller_id resolvido não existe em sellers",
          debug: {
            sellerId,
            userId,
            mlUserId,
            nickname,
          },
        },
        { status: 500 }
      );
    }

    // =====================================================
    // 5) ATUALIZA sellers
    // =====================================================
    const { error: sellerUpdateErr } = await supabase
      .from("sellers")
      .update({
        name: nickname,
        ml_user_id: mlUserId,
        status: "active",
      })
      .eq("id", sellerId);

    if (sellerUpdateErr) {
      return NextResponse.json(
        { error: "Falha ao atualizar seller", details: sellerUpdateErr.message },
        { status: 500 }
      );
    }

    // =====================================================
    // 6) UPSERT seller_accounts
    // =====================================================
    const { error: accUpsertErr } = await supabase.from("seller_accounts").upsert(
      {
        owner_user_id: userId,
        seller_id: sellerId,
        ml_user_id: mlUserId,
        nickname,
      },
      { onConflict: "owner_user_id" }
    );

    if (accUpsertErr) {
      return NextResponse.json(
        {
          error: "Falha ao criar/atualizar seller_account",
          details: accUpsertErr.message,
        },
        { status: 500 }
      );
    }

    // =====================================================
    // 7) SALVA TOKEN ML
    // =====================================================
    const expiresIn = Number(tokenData.expires_in ?? 0);
    const expiresAt = expiresIn ? new Date(Date.now() + expiresIn * 1000).toISOString() : null;

    const { error: tokenErr } = await supabase.from("ml_tokens").upsert(
      {
        seller_id: sellerId,
        access_token: accessToken,
        refresh_token: refreshToken,
        token_type: tokenData.token_type ?? null,
        scope: tokenData.scope ?? null,
        expires_in: tokenData.expires_in ?? null,
        expires_at: expiresAt,
        ml_user_id: mlUserId,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "seller_id" }
    );

    if (tokenErr) {
      return NextResponse.json(
        {
          error: "Falha ao salvar ml_tokens",
          details: tokenErr.message,
          debug: {
            sellerId,
            userId,
            mlUserId,
            nickname,
          },
        },
        { status: 500 }
      );
    }

    // =====================================================
    // 8) LIMPA oauth_state
    // =====================================================
    await supabase.from("oauth_states").delete().eq("state", state);

    // =====================================================
    // 9) REDIRECT FINAL
    // =====================================================
    const forwardedHost = req.headers.get("x-forwarded-host");
    const forwardedProto = req.headers.get("x-forwarded-proto") ?? "https";
    const origin = forwardedHost ? `${forwardedProto}://${forwardedHost}` : new URL(req.url).origin;

    return NextResponse.redirect(`${origin}/app?ml_connected=1`);
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message ?? "Erro callback ML" },
      { status: 500 }
    );
  }
}