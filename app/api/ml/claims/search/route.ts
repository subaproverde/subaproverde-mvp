import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);

    const sellerId = searchParams.get("sellerId");
    const limit = searchParams.get("limit") ?? "20";
    const offset = searchParams.get("offset") ?? "0";
    const siteId = searchParams.get("site_id") ?? "MLB";

    // ✅ defaults corretos conforme doc: complainant/respondent/mediator/...
    const playerRole = searchParams.get("player_role") ?? "respondent";

    // opcionais
    const status = searchParams.get("status"); // opened | closed
    const stage = searchParams.get("stage");   // claim | dispute | recontact | none | stale
    const type = searchParams.get("type");     // mediations | return | fulfillment | ml_case | ...

    if (!sellerId) {
      return NextResponse.json({ error: "sellerId obrigatório" }, { status: 400 });
    }

    // token + ml_user_id
    const { data: tokenRow, error: tokenErr } = await supabase
      .from("ml_tokens")
      .select("access_token, ml_user_id")
      .eq("seller_id", sellerId)
      .maybeSingle();

    if (tokenErr) {
      return NextResponse.json(
        { error: "Erro ao buscar ml_tokens", detail: tokenErr.message },
        { status: 500 }
      );
    }

    if (!tokenRow?.access_token) {
      return NextResponse.json({ error: "Token não encontrado" }, { status: 404 });
    }

    if (!tokenRow?.ml_user_id) {
      return NextResponse.json(
        { error: "ml_user_id não encontrado. Rode /api/ml/me para preencher." },
        { status: 400 }
      );
    }

    // ✅ claims/search exige pelo menos 1 filtro — aqui já vai player_role + player_user_id
    const qs = new URLSearchParams();
    qs.set("limit", limit);
    qs.set("offset", offset);
    qs.set("site_id", siteId);
    qs.set("player_role", playerRole);
    qs.set("player_user_id", String(tokenRow.ml_user_id));

    if (status) qs.set("status", status);
    if (stage) qs.set("stage", stage);
    if (type) qs.set("type", type);

    const url = `https://api.mercadolibre.com/post-purchase/v1/claims/search?${qs.toString()}`;

    const mlRes = await fetch(url, {
      headers: { Authorization: `Bearer ${tokenRow.access_token}` },
    });

    const data = await mlRes.json();

    if (!mlRes.ok) {
      return NextResponse.json(
        { error: "Erro ao buscar claims", status: mlRes.status, data, url },
        { status: 502 }
      );
    }

    return NextResponse.json({ ok: true, url, data });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message ?? "Erro inesperado" },
      { status: 500 }
    );
  }
}
