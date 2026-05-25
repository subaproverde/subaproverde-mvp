import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

function parseTargetSellerId(state: string) {
  const [, sellerId] = state.split(":");
  return sellerId?.trim() || null;
}

async function ensureSellerExists({
  sellerId,
  nickname,
  mlUserId,
}: {
  sellerId: string;
  nickname: string;
  mlUserId: string;
}) {
  const { data: existing, error: checkErr } = await supabase
    .from("sellers")
    .select("id")
    .eq("id", sellerId)
    .maybeSingle();

  if (checkErr) {
    throw new Error(`Falha ao validar seller em sellers: ${checkErr.message}`);
  }

  if (existing?.id) return;

  const { error: insertErr } = await supabase.from("sellers").insert({
    id: sellerId,
    name: nickname,
    status: "active",
    ml_user_id: mlUserId,
  });

  if (insertErr) {
    throw new Error(`Falha ao criar seller resolvido: ${insertErr.message}`);
  }
}

async function resolveSellerId({
  userId,
  mlUserId,
  nickname,
  targetSellerId,
}: {
  userId: string;
  mlUserId: string;
  nickname: string;
  targetSellerId: string | null;
}) {
  if (targetSellerId) {
    const { data: targetAccount, error } = await supabase
      .from("seller_accounts")
      .select("id, seller_id, owner_user_id")
      .eq("owner_user_id", userId)
      .eq("seller_id", targetSellerId)
      .maybeSingle();

    if (error) {
      throw new Error(`Falha ao validar seller alvo do OAuth: ${error.message}`);
    }

    if (targetAccount?.seller_id) {
      return String(targetAccount.seller_id);
    }
  }

  const { data: accountsByMlUser, error: accountByMlUserErr } = await supabase
    .from("seller_accounts")
    .select("id, seller_id, owner_user_id, ml_user_id, created_at")
    .eq("ml_user_id", mlUserId)
    .eq("owner_user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1);

  if (accountByMlUserErr) {
    throw new Error(`Falha ao buscar seller_accounts por ml_user_id: ${accountByMlUserErr.message}`);
  }

  if (accountsByMlUser?.[0]?.seller_id) {
    return String(accountsByMlUser[0].seller_id);
  }

  const { data: existingAccounts, error: accGetErr } = await supabase
    .from("seller_accounts")
    .select("id, seller_id, owner_user_id")
    .eq("owner_user_id", userId)
    .order("created_at", { ascending: false })
    .limit(2);

  if (accGetErr) {
    throw new Error(`Falha ao recuperar seller_accounts por owner_user_id: ${accGetErr.message}`);
  }

  if ((existingAccounts?.length ?? 0) === 1 && existingAccounts?.[0]?.seller_id) {
    return String(existingAccounts[0].seller_id);
  }

  const { data: existingSeller, error: sellerFindErr } = await supabase
    .from("sellers")
    .select("id, ml_user_id")
    .eq("ml_user_id", mlUserId)
    .maybeSingle();

  if (sellerFindErr) {
    throw new Error(`Falha ao buscar seller em sellers por ml_user_id: ${sellerFindErr.message}`);
  }

  if (existingSeller?.id) {
    return String(existingSeller.id);
  }

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
    throw new Error(`Falha ao criar seller: ${sellerErr?.message ?? "sem id"}`);
  }

  return String(newSeller.id);
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const code = searchParams.get("code");
    const state = searchParams.get("state");

    if (!code || !state) {
      return NextResponse.json({ error: "code/state ausente" }, { status: 400 });
    }

    const { data: oauthState, error: stateErr } = await supabase
      .from("oauth_states")
      .select("user_id, state")
      .eq("state", state)
      .single();

    if (stateErr || !oauthState?.user_id) {
      return NextResponse.json(
        { error: "oauth_state invalido", details: stateErr?.message },
        { status: 400 }
      );
    }

    const userId = String(oauthState.user_id);
    const targetSellerId = parseTargetSellerId(state);

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

    const meRes = await fetch("https://api.mercadolibre.com/users/me", {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: "no-store",
    });
    const me = await meRes.json().catch(() => ({} as any));
    const nickname = (me?.nickname && String(me.nickname).trim()) || "Conta Mercado Livre";

    const sellerId = await resolveSellerId({
      userId,
      mlUserId,
      nickname,
      targetSellerId,
    });

    await ensureSellerExists({ sellerId, nickname, mlUserId });

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

    const { error: accUpsertErr } = await supabase.from("seller_accounts").upsert(
      {
        owner_user_id: userId,
        seller_id: sellerId,
        ml_user_id: mlUserId,
        nickname,
      },
      { onConflict: "owner_user_id,seller_id" }
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

    await supabase.from("oauth_states").delete().eq("state", state);

    const forwardedHost = req.headers.get("x-forwarded-host");
    const forwardedProto = req.headers.get("x-forwarded-proto") ?? "https";
    const origin = forwardedHost ? `${forwardedProto}://${forwardedHost}` : new URL(req.url).origin;

    return NextResponse.redirect(`${origin}/app?ml_connected=1&sellerId=${encodeURIComponent(sellerId)}`);
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message ?? "Erro callback ML" },
      { status: 500 }
    );
  }
}
