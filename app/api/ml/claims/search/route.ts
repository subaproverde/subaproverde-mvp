import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getValidMlAccessToken } from "@/lib/mlToken";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);

    const sellerId = searchParams.get("sellerId");
    const limit = searchParams.get("limit") ?? "20";
    const offset = searchParams.get("offset") ?? "0";
    const siteId = searchParams.get("site_id") ?? "MLB";
    const playerRole = searchParams.get("player_role") ?? "respondent";

    const status = searchParams.get("status");
    const stage = searchParams.get("stage");
    const type = searchParams.get("type");

    if (!sellerId) {
      return NextResponse.json({ error: "sellerId obrigatorio" }, { status: 400 });
    }

    const { accessToken } = await getValidMlAccessToken(sellerId);

    const { data: tokenRow, error: tokenErr } = await supabase
      .from("ml_tokens")
      .select("ml_user_id")
      .eq("seller_id", sellerId)
      .maybeSingle();

    if (tokenErr) {
      return NextResponse.json(
        { error: "Erro ao buscar ml_tokens", detail: tokenErr.message },
        { status: 500 }
      );
    }

    if (!tokenRow?.ml_user_id) {
      return NextResponse.json(
        { error: "ml_user_id nao encontrado. Rode /api/ml/me para preencher." },
        { status: 400 }
      );
    }

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
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: "no-store",
    });

    const data = await mlRes.json().catch(() => ({}));

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
