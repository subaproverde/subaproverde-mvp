// app/api/ml/ml.ts
import { createClient } from "@supabase/supabase-js";

type TokenRow = {
  id?: any;
  seller_id?: string;
  access_token?: string | null;
  refresh_token?: string | null;
  token_type?: string | null;
  scope?: string | null;
  ml_user_id?: number | string | null;
  expires_in?: number | null;
  expires_at?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  [k: string]: any;
};

type Ok<T> = { ok: true } & T;
type Err = { ok: false; error: string; details?: any };

function isErr<T extends { ok: boolean }>(x: T): x is Extract<T, { ok: false }> {
  return x.ok === false;
}

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// =========================
// mlFetch: request com Bearer e erro claro
// =========================
export async function mlFetch<T>(
  url: string,
  opts: { accessToken: string; init?: RequestInit }
): Promise<T>;
export async function mlFetch<T>(url: string, opts: { accessToken: string }): Promise<T>;
export async function mlFetch<T>(
  url: string,
  opts: { accessToken: string; init?: RequestInit }
): Promise<T> {
  const res = await fetch(url, {
    ...(opts.init ?? {}),
    headers: {
      ...(opts.init?.headers ?? {}),
      Authorization: `Bearer ${opts.accessToken}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    cache: "no-store",
  });

  const text = await res.text();
  if (!res.ok) throw new Error(`ML error ${res.status}: ${text}`);

  try {
    return JSON.parse(text) as T;
  } catch {
    return text as any as T;
  }
}

// =========================
// 1) pega tokenRow do seller no Supabase
// =========================
async function pickTokenRow(sellerId: string): Promise<Ok<{ tokenRow: TokenRow }> | Err> {
  const q1 = await supabaseAdmin
    .from("ml_tokens")
    .select("*")
    .eq("seller_id", sellerId)
    .order("updated_at", { ascending: false })
    .limit(10);

  if (!q1.error && q1.data?.length) {
    const best = (q1.data as any[]).find((r) => r?.access_token) ?? (q1.data as any[])[0];
    if (best?.access_token) return { ok: true, tokenRow: best as any };
  }

  const q2 = await supabaseAdmin
    .from("ml_tokens")
    .select("*")
    .eq("seller_id", sellerId)
    .order("created_at", { ascending: false })
    .limit(10);

  if (!q2.error && q2.data?.length) {
    const best = (q2.data as any[]).find((r) => r?.access_token) ?? (q2.data as any[])[0];
    if (best?.access_token) return { ok: true, tokenRow: best as any };
  }

  const q3 = await supabaseAdmin.from("ml_tokens").select("*").eq("seller_id", sellerId).limit(10);

  if (q3.error) return { ok: false, error: "Erro ao consultar ml_tokens", details: q3.error.message };
  if (!q3.data?.length) return { ok: false, error: "Token ML não encontrado em ml_tokens" };

  const best = (q3.data as any[]).find((r) => r?.access_token) ?? (q3.data as any[])[0];
  if (!best?.access_token) return { ok: false, error: "Nenhum access_token válido encontrado em ml_tokens" };

  return { ok: true, tokenRow: best as any };
}

// =========================
// 2) testa token (users/me)
// =========================
async function isAccessTokenValid(accessToken: string): Promise<boolean> {
  if (!accessToken) return false;
  const res = await fetch("https://api.mercadolibre.com/users/me", {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });
  return res.ok;
}

// =========================
// 3) refresh token (oauth/token)
// =========================
async function refreshAccessToken(params: {
  sellerId: string;
  refreshToken: string;
}): Promise<Ok<{ accessToken: string; refreshToken: string }> | Err> {
  const clientId = process.env.ML_CLIENT_ID;
  const clientSecret = process.env.ML_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    return { ok: false, error: "Faltam envs do ML: ML_CLIENT_ID / ML_CLIENT_SECRET" };
  }

  const body = new URLSearchParams({
    grant_type: "refresh_token",
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: params.refreshToken,
  });

  const resp = await fetch("https://api.mercadolibre.com/oauth/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body,
    cache: "no-store",
  });

  const json: any = await resp.json().catch(() => null);

  if (!resp.ok) {
    return {
      ok: false,
      error: "Falha ao dar refresh no token do ML",
      details: { status: resp.status, data: json },
    };
  }

  const newAccess = json?.access_token ? String(json.access_token) : "";
  const newRefresh = json?.refresh_token ? String(json.refresh_token) : params.refreshToken;

  if (!newAccess) return { ok: false, error: "Resposta de refresh sem access_token", details: json };

  // salva no Supabase
  const upd = await supabaseAdmin
    .from("ml_tokens")
    .update({
      access_token: newAccess,
      refresh_token: newRefresh,
      token_type: json?.token_type ?? null,
      scope: json?.scope ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq("seller_id", params.sellerId);

  // se update falhar, ainda devolve token, mas aponta details
  if (upd.error) {
    return {
      ok: true,
      accessToken: newAccess,
      refreshToken: newRefresh,
    };
  }

  return { ok: true, accessToken: newAccess, refreshToken: newRefresh };
}

// =========================
// 4) FUNÇÃO CENTRAL: sempre devolve token VIVO
// =========================
export async function getSellerAccessToken(sellerId: string): Promise<string> {
  const pick = await pickTokenRow(sellerId);

  if (isErr(pick)) {
    throw new Error(`${pick.error}${pick.details ? `: ${String(pick.details)}` : ""}`);
  }

  const tokenRow = pick.tokenRow;
  const accessToken = tokenRow.access_token ?? "";
  const refreshToken = tokenRow.refresh_token ?? "";

  const ok = await isAccessTokenValid(accessToken);
  if (ok) return accessToken;

  if (!refreshToken) {
    throw new Error("Access token expirado e não há refresh_token salvo em ml_tokens.");
  }

  const ref = await refreshAccessToken({ sellerId, refreshToken });
  if (isErr(ref)) {
    throw new Error(`${ref.error}${ref.details ? `: ${JSON.stringify(ref.details)}` : ""}`);
  }

  return ref.accessToken;
}