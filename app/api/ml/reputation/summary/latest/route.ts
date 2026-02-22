import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const sellerId = searchParams.get("sellerId");

    if (!sellerId) {
      return NextResponse.json({ ok: false, error: "sellerId é obrigatório" }, { status: 400 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceKey) {
      return NextResponse.json(
        { ok: false, error: "Env vars faltando: NEXT_PUBLIC_SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY" },
        { status: 500 }
      );
    }

    const supabase = createClient(supabaseUrl, serviceKey);

    const { data, error } = await supabase
      .from("seller_reputation_summaries")
      .select(
        "seller_id, created_at, level_id, claims_value, claims_rate, delayed_handling_value, delayed_handling_rate, cancellations_value, cancellations_rate, sales_completed"
      )
      .eq("seller_id", sellerId)
      .order("created_at", { ascending: false })
      .limit(1);

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, summary: data?.[0] ?? null });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "Erro inesperado" }, { status: 500 });
  }
}
