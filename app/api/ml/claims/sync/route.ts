import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

function jsonError(message: string, extra: any = {}, status = 400) {
  return NextResponse.json({ ok: false, error: message, ...extra }, { status });
}

async function refreshToken(sellerId: string, refreshToken: string) {
  const tokenRes = await fetch("https://api.mercadolibre.com/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      client_id: process.env.ML_CLIENT_ID!,
      client_secret: process.env.ML_CLIENT_SECRET!,
      refresh_token: refreshToken,
    }).toString(),
    cache: "no-store",
  });

  const tokenData = await tokenRes.json().catch(() => ({}));

  if (!tokenRes.ok) {
    return { ok: false as const, tokenData };
  }

  const expiresIn = Number(tokenData.expires_in ?? 0);
  const expiresAt = expiresIn ? new Date(Date.now() + expiresIn * 1000).toISOString() : null;

  // salva o novo access_token; refresh_token às vezes vem vazio -> mantém o antigo
  const newRefresh =
    (tokenData.refresh_token as string | undefined) ?? refreshToken ?? null;

  await supabase.from("ml_tokens").upsert(
    {
      seller_id: sellerId,
      access_token: tokenData.access_token,
      refresh_token: newRefresh,
      token_type: tokenData.token_type ?? null,
      scope: tokenData.scope ?? null,
      expires_in: tokenData.expires_in ?? null,
      expires_at: expiresAt,
      ml_user_id: tokenData.user_id ? String(tokenData.user_id) : null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "seller_id" }
  );

  return { ok: true as const, access_token: tokenData.access_token };
}

async function mlFetch(url: string, accessToken: string) {
  const r = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });
  const j = await r.json().catch(() => ({}));
  return { ok: r.ok, status: r.status, json: j };
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);

  const sellerId = String(searchParams.get("sellerId") ?? "").trim();
  const limit = Number(searchParams.get("limit") ?? "50");
  const maxPages = Number(searchParams.get("maxPages") ?? "10");
  const onlyOpened = String(searchParams.get("onlyOpened") ?? "false") === "true";

  if (!sellerId) return jsonError("sellerId ausente");

  // 1) pega tokens do banco
  const { data: t, error: tErr } = await supabase
    .from("ml_tokens")
    .select("access_token, refresh_token, expires_at")
    .eq("seller_id", sellerId)
    .maybeSingle();

  if (tErr) return jsonError("Falha ao consultar ml_tokens", { detail: tErr.message }, 500);
  if (!t?.access_token) return jsonError("Sem access_token para este seller", {}, 401);

  let accessToken = t.access_token as string;

  // 2) tenta uma chamada simples (claims/search) — se der token inválido, tenta refresh
  const baseUrl = "https://api.mercadolibre.com/post-purchase/v1/claims/search";
  const url = `${baseUrl}?limit=${Math.min(Math.max(limit, 1), 100)}&offset=0${
    onlyOpened ? "&status=opened" : ""
  }`;

  let first = await mlFetch(url, accessToken);

  if (!first.ok) {
    const msg = String(first.json?.message ?? first.json?.error ?? "").toLowerCase();

    if (msg.includes("invalid access token") || msg.includes("invalid_token")) {
      // precisa refresh
      if (!t.refresh_token) {
        return jsonError(
          "Access token inválido e não existe refresh_token. Precisa reconectar o Mercado Livre.",
          { ml: first.json },
          401
        );
      }

      const refreshed = await refreshToken(sellerId, t.refresh_token as string);

      if (!refreshed.ok) {
        return jsonError(
          "Falha ao dar refresh no token. Precisa reconectar o Mercado Livre.",
          { refresh_error: refreshed.tokenData },
          401
        );
      }

      accessToken = refreshed.access_token;

      // tenta de novo
      first = await mlFetch(url, accessToken);
      if (!first.ok) {
        return jsonError("Mesmo após refresh, falhou chamar claims/search", { ml: first.json }, 502);
      }
    } else {
      return jsonError("Falha ao chamar claims/search", { ml: first.json }, 502);
    }
  }

  // 3) por enquanto só devolve o primeiro page (pra validar o token e o endpoint)
  // depois a gente faz paginação e salva no banco.
  return NextResponse.json({
    ok: true,
    sellerId,
    onlyOpened,
    limit,
    maxPages,
    paging: first.json?.paging ?? null,
    sample_count: Array.isArray(first.json?.data) ? first.json.data.length : null,
  });
}
