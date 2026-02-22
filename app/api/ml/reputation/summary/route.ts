import { NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const sellerId = sp.get("sellerId");

  if (!sellerId) {
    return Response.json({ error: "sellerId obrigatório" }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from("seller_reputation_summaries")
    .select(
      "id, seller_id, level_id, claims_value, claims_rate, delayed_handling_value, delayed_handling_rate, cancellations_value, cancellations_rate, sales_completed, created_at"
    )
    .eq("seller_id", sellerId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    return Response.json(
      { error: "Falha ao buscar summary", details: error.message },
      { status: 500 }
    );
  }

  return Response.json({ ok: true, summary: data ?? null });
}
