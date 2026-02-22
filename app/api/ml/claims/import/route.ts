import { NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";

type TokenRow = {
  id?: any;
  seller_id?: string;
  access_token?: string | null;
  refresh_token?: string | null;
  ml_user_id?: number | string | null;
  created_at?: string | null;
  updated_at?: string | null;
  [k: string]: any;
};

type PickTokenOk = { ok: true; tokenRow: TokenRow };
type PickTokenErr = { ok: false; error: string; details?: any };
type PickTokenResult = PickTokenOk | PickTokenErr;

// ✅ type-guards (faz o TS "entender" 100% no build)
function isPickErr(p: PickTokenResult): p is PickTokenErr {
  return p.ok === false;
}

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(req: NextRequest) {
  return handler(req);
}

export async function POST(req: NextRequest) {
  return handler(req);
}

async function handler(req: NextRequest) {
  const sp = req.nextUrl.searchParams;

  const sellerId = sp.get("sellerId");
  if (!sellerId) {
    return Response.json({ error: "sellerId obrigatório" }, { status: 400 });
  }

  const limit = sp.get("limit") ?? "20";
  const offset = sp.get("offset") ?? "0";
  const site_id = sp.get("site_id") ?? "MLB";
  const player_role = sp.get("player_role") ?? "respondent";

  const pick = await pickTokenRow(sellerId);

  // ✅ AGORA não tem como o TS reclamar no build
  if (isPickErr(pick)) {
    return Response.json(
      { error: pick.error, details: pick.details },
      { status: 400 }
    );
  }

  const tokenRow = pick.tokenRow;
  const accessToken = tokenRow.access_token;

  if (!accessToken) {
    return Response.json(
      { error: "access_token vazio ou nulo em ml_tokens" },
      { status: 400 }
    );
  }

  const refreshToken = tokenRow.refresh_token ?? null;
  const tokenPreview = previewToken(accessToken);

  let mlUserId = tokenRow.ml_user_id ? String(tokenRow.ml_user_id) : null;

  // Se não tiver ml_user_id, pega via /users/me e salva no ml_tokens
  if (!mlUserId) {
    const meResp = await fetch("https://api.mercadolibre.com/users/me", {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: "no-store",
    });

    const meJson: any = await meResp.json().catch(() => null);

    if (!meResp.ok || !meJson?.id) {
      return Response.json(
        {
          error: "Não foi possível obter ml_user_id via /users/me",
          status: meResp.status,
          data: meJson,
          debug: {
            sellerId,
            tokenPreview,
            hasRefreshToken: Boolean(refreshToken),
          },
        },
        { status: 502 }
      );
    }

    mlUserId = String(meJson.id);

    // tenta gravar no banco (não quebra se falhar)
    try {
      await supabaseAdmin
        .from("ml_tokens")
        .update({
          ml_user_id: Number.isFinite(Number(mlUserId)) ? Number(mlUserId) : mlUserId,
        })
        .eq("seller_id", sellerId);
    } catch {
      // ignore
    }
  }

  // ⚠️ Endpoint que você está usando:
  // /post-purchase/v1/claims/search exige player_user_id
  const mlParams = new URLSearchParams({
    limit,
    offset,
    site_id,
    player_role,
    player_user_id: mlUserId,
  });

  const url = `https://api.mercadolibre.com/post-purchase/v1/claims/search?${mlParams.toString()}`;

  const claimsResp = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });

  const claimsJson: any = await claimsResp.json().catch(() => null);

  if (!claimsResp.ok) {
    return Response.json(
      {
        error: "Erro ao buscar claims no Mercado Livre",
        status: claimsResp.status,
        url,
        data: claimsJson,
        debug: { sellerId, tokenPreview, hasRefreshToken: Boolean(refreshToken) },
      },
      { status: 502 }
    );
  }

  const paging = claimsJson?.paging ?? null;
  const claims: any[] = Array.isArray(claimsJson?.data) ? claimsJson.data : [];

  if (!claims.length) {
    return Response.json({
      ok: true,
      message: "Nenhuma claim retornada nessa página/filtro.",
      url,
      paging,
      fetched: 0,
      saved: 0,
      debug: { sellerId, tokenPreview, mlUserId },
    });
  }

  // ✅ IMPORTANTE: preencher ml_case_id (NOT NULL no seu schema)
  const rows = claims.map((c) => ({
    seller_id: sellerId,
    external_id: String(c.id),
    ml_case_id: String(c.id),
    source: "mercado_livre",
    payload: c,
    type: c.type ?? null,
    stage: c.stage ?? null,
    resource: c.resource ?? null,
    resource_id: c.resource_id != null ? String(c.resource_id) : null,
    reason_id: c.reason_id ?? null,
    date_created_ml: c.date_created ?? null,
    last_updated_ml: c.last_updated ?? null,
  }));

  const { data: savedRows, error: saveErr } = await supabaseAdmin
    .from("complaints")
    .upsert(rows, { onConflict: "seller_id,external_id" })
    .select("external_id");

  if (saveErr) {
    return Response.json(
      { error: "Falha ao salvar complaints", details: saveErr.message },
      { status: 500 }
    );
  }

  return Response.json({
    ok: true,
    url,
    paging,
    fetched: claims.length,
    saved: savedRows?.length ?? 0,
    debug: { sellerId, tokenPreview, mlUserId },
  });
}

/* ---------------- helpers ---------------- */

function previewToken(t: string) {
  if (!t || t.length < 16) return "(token curto)";
  return `${t.slice(0, 6)}...${t.slice(-6)}`;
}

async function pickTokenRow(sellerId: string): Promise<PickTokenResult> {
  const tryUpdated = await supabaseAdmin
    .from("ml_tokens")
    .select("*")
    .eq("seller_id", sellerId)
    .order("updated_at", { ascending: false })
    .limit(10);

  if (!tryUpdated.error && tryUpdated.data?.length) {
    const best = tryUpdated.data.find((r: any) => r?.access_token) ?? tryUpdated.data[0];
    if (best?.access_token) return { ok: true, tokenRow: best as any };
  }

  const tryCreated = await supabaseAdmin
    .from("ml_tokens")
    .select("*")
    .eq("seller_id", sellerId)
    .order("created_at", { ascending: false })
    .limit(10);

  if (!tryCreated.error && tryCreated.data?.length) {
    const best = tryCreated.data.find((r: any) => r?.access_token) ?? tryCreated.data[0];
    if (best?.access_token) return { ok: true, tokenRow: best as any };
  }

  const fallback = await supabaseAdmin
    .from("ml_tokens")
    .select("*")
    .eq("seller_id", sellerId)
    .limit(10);

  if (fallback.error) {
    return {
      ok: false,
      error: "Erro ao consultar ml_tokens",
      details: fallback.error.message,
    };
  }
  if (!fallback.data?.length) {
    return { ok: false, error: "Token ML não encontrado em ml_tokens" };
  }

  const best = fallback.data.find((r: any) => r?.access_token) ?? fallback.data[0];

  if (!best?.access_token) {
    return { ok: false, error: "Nenhum access_token válido encontrado em ml_tokens" };
  }

  return { ok: true, tokenRow: best as any };
}