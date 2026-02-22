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

    if (!sellerId) {
      return NextResponse.json({ error: "sellerId obrigatório" }, { status: 400 });
    }

    // pega token
    const { data: tokenRow } = await supabase
      .from("ml_tokens")
      .select("access_token")
      .eq("seller_id", sellerId)
      .maybeSingle();

    if (!tokenRow?.access_token) {
      return NextResponse.json({ error: "Token não encontrado" }, { status: 404 });
    }

    // chamada mediations
    const url = "https://api.mercadolibre.com/mediations/search";

    const mlRes = await fetch(url, {
      headers: {
        Authorization: `Bearer ${tokenRow.access_token}`,
      },
    });

    const data = await mlRes.json();

    return NextResponse.json({
      ok: mlRes.ok,
      status: mlRes.status,
      url,
      data,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message ?? "Erro inesperado" },
      { status: 500 }
    );
  }
}
