// lib/MlTokens.ts
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

type MlTokenRow = {
  seller_id: string;
  access_token: string;
  refresh_token: string | null;
  token_type: string | null;
  scope: string | null;
  expires_at: string | null; // ISO
  updated_at?: string | null;
  created_at?: string | null;
};

function nowIso() {
  return new Date().toISOString();
}

function isExpiringSoon(expiresAtIso?: string | null, skewSeconds = 120) {
  if (!expiresAtIso) return true;
  const t = Date.parse(expiresAtIso);
  if (Number.isNaN(t)) return true;
  return t - Date.now() <= skewSeconds * 1000;
}

async function loadTokenRow(sellerId: string) {
  const { data, error } = await supabaseAdmin
    .from("ml_tokens")
    .select("seller_id, access_token, refresh_token, token_type, scope, expires_at, updated_at, created_at")
    .eq("seller_id", sellerId)
    .limit(1)
    .maybeSingle<MlTokenRow>();

  if (error) throw new Error(`Falha ao buscar token: ${error.message}`);
  return data ?? null;
}

/**
 * ✅ ÚNICO lugar que salva token no banco.
 * Usa UPSERT com onConflict seller_id para não estourar unique.
 */
async function saveTokenRow(row: MlTokenRow) {
  const { error } = await supabaseAdmin
    .from("ml_tokens")
    .upsert(
      {
        seller_id: row.seller_id,
        access_token: row.access_token,
        refresh_token: row.refresh_token ?? null,
        token_type: row.token_type ?? "Bearer",
        scope: row.scope ?? null,
        expires_at: row.expires_at ?? null,
        updated_at: nowIso(),
      },
      { onConflict: "seller_id" }
    );

  if (error) throw new Error(`Falha ao salvar token refreshed: ${error.message}`);
}

/**
 * Ajuste se seus envs tiverem outros nomes.
 * (Use o que você já usa hoje no projeto.)
 */
function getMlAppCreds() {
  const clientId =
    process.env.ML_CLIENT_ID ||
    process.env.NEXT_PUBLIC_ML_CLIENT_ID ||
    "";
  const clientSecret =
    process.env.ML_CLIENT_SECRET ||
    process.env.ML_SECRET ||
    "";

  if (!clientId || !clientSecret) {
    throw new Error("Credenciais ML ausentes (ML_CLIENT_ID / ML_CLIENT_SECRET).");
  }
  return { clientId, clientSecret };
}

/**
 * Refresh token do Mercado Livre:
 * POST https://api.mercadolibre.com/oauth/token
 */
async function refreshAccessToken(refreshToken: string) {
  const { clientId, clientSecret } = getMlAppCreds();

  const body = new URLSearchParams();
  body.set("grant_type", "refresh_token");
  body.set("client_id", clientId);
  body.set("client_secret", clientSecret);
  body.set("refresh_token", refreshToken);

  const r = await fetch("https://api.mercadolibre.com/oauth/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body,
    cache: "no-store",
  });

  const data = await r.json().catch(() => null);

  if (!r.ok) {
    const msg = data?.message || data?.error || `HTTP ${r.status}`;
    throw new Error(`Refresh ML falhou: ${msg}`);
  }

  // Formato típico do ML:
  // { access_token, refresh_token, expires_in, token_type, scope, user_id }
  return data as {
    access_token: string;
    refresh_token?: string;
    expires_in?: number;
    token_type?: string;
    scope?: string;
  };
}

/**
 * ✅ Função principal usada pelas rotas.
 * - Lê token do banco
 * - Se expirado, dá refresh
 * - Salva com UPSERT
 */
export async function getValidMlAccessToken(sellerId: string) {
  const row = await loadTokenRow(sellerId);

  if (!row?.access_token) {
    throw new Error("Token ML inexistente para esse seller (precisa conectar).");
  }

  // Se ainda está válido, retorna
  if (!isExpiringSoon(row.expires_at)) {
    return {
      accessToken: row.access_token,
      tokenType: row.token_type ?? "Bearer",
      scope: row.scope ?? null,
      expiresAt: row.expires_at ?? null,
      refreshed: false,
    };
  }

  // Precisa refresh
  if (!row.refresh_token) {
    throw new Error("Refresh token ausente (precisa reconectar Mercado Livre).");
  }

  const refreshed = await refreshAccessToken(row.refresh_token);

  const expiresIn = Number(refreshed.expires_in ?? 0) || 0;
  const expiresAt = expiresIn > 0 ? new Date(Date.now() + expiresIn * 1000).toISOString() : null;

  const nextRow: MlTokenRow = {
    seller_id: sellerId,
    access_token: refreshed.access_token,
    refresh_token: refreshed.refresh_token ?? row.refresh_token,
    token_type: refreshed.token_type ?? row.token_type ?? "Bearer",
    scope: refreshed.scope ?? row.scope ?? null,
    expires_at: expiresAt,
  };

  await saveTokenRow(nextRow);

  return {
    accessToken: nextRow.access_token,
    tokenType: nextRow.token_type ?? "Bearer",
    scope: nextRow.scope ?? null,
    expiresAt: nextRow.expires_at ?? null,
    refreshed: true,
  };
}
