import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getValidMlAccessToken } from "@/lib/mlToken";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

function mask(tok?: string | null) {
  if (!tok) return null;
  if (tok.length <= 12) return "***";
  return `${tok.slice(0, 6)}…${tok.slice(-4)}`;
}

function isExpiredOrSoon(expiresAt: string | null, skewSec = 120) {
  if (!expiresAt) return true;
  const t = Date.parse(expiresAt);
  if (Number.isNaN(t)) return true;
  return t - Date.now() <= skewSec * 1000;
}

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const sellerId = sp.get("sellerId");

  if (!sellerId) {
    return NextResponse.json({ ok: false, error: "sellerId obrigatório" }, { status: 400 });
  }

  // 1) lê token bruto no banco
  const { data: row, error } = await supabaseAdmin
    .from("ml_tokens")
    .select("seller_id, access_token, refresh_token, token_type, scope, expires_at, updated_at, created_at")
    .eq("seller_id", sellerId)
    .maybeSingle();

  if (error) {
    return NextResponse.json(
      { ok: false, error: "Falha ao ler ml_tokens", details: error.message },
      { status: 500 }
    );
  }

  if (!row) {
    return NextResponse.json(
      { ok: false, error: "Não existe ml_tokens pra esse sellerId" },
      { status: 404 }
    );
  }

  const before = {
    seller_id: row.seller_id,
    token_type: row.token_type,
    scope: row.scope,
    expires_at: row.expires_at,
    updated_at: row.updated_at,
    created_at: row.created_at,
    access_token_mask: mask(row.access_token),
    refresh_token_mask: mask(row.refresh_token),
    expiring_or_expired: isExpiredOrSoon(row.expires_at),
  };

  // 2) tenta pegar token válido (isso força refresh se precisar)
  let valid: any = null;
  let refreshError: any = null;

  try {
    valid = await getValidMlAccessToken(sellerId);
  } catch (e: any) {
    refreshError = e?.message ?? String(e);
  }

  // 3) lê novamente após tentar refresh
  const { data: row2, error: error2 } = await supabaseAdmin
    .from("ml_tokens")
    .select("seller_id, access_token, refresh_token, token_type, scope, expires_at, updated_at, created_at")
    .eq("seller_id", sellerId)
    .maybeSingle();

  if (error2) {
    return NextResponse.json(
      { ok: false, error: "Falha ao reler ml_tokens", details: error2.message, before, valid, refreshError },
      { status: 500 }
    );
  }

  const after = row2
    ? {
        seller_id: row2.seller_id,
        token_type: row2.token_type,
        scope: row2.scope,
        expires_at: row2.expires_at,
        updated_at: row2.updated_at,
        created_at: row2.created_at,
        access_token_mask: mask(row2.access_token),
        refresh_token_mask: mask(row2.refresh_token),
        expiring_or_expired: isExpiredOrSoon(row2.expires_at),
      }
    : null;

  return NextResponse.json({
    ok: true,
    sellerId,
    before,
    valid: valid
      ? {
          tokenType: valid.tokenType,
          expiresAt: valid.expiresAt,
          refreshed: valid.refreshed,
          accessToken_mask: mask(valid.accessToken),
        }
      : null,
    refreshError,
    after,
  });
}
