import { NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const sellerId = sp.get("sellerId");
  if (!sellerId) return Response.json({ error: "sellerId obrigatório" }, { status: 400 });

  const { data: summary, error } = await supabaseAdmin
    .from("seller_reputation_summaries")
    .select("*")
    .eq("seller_id", sellerId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !summary) {
    return Response.json({ error: "Summary não encontrado", details: error?.message }, { status: 400 });
  }

  const rows: any[] = [];

  const add = (kind: string, value: any, rate: any) => {
    const v = Number(value ?? 0);
    if (!Number.isFinite(v) || v <= 0) return;
    rows.push({
      seller_id: sellerId,
      kind,
      status: "open",
      external_ref: `${kind}:${summary.id}`, // 1 por summary
      severity: v >= 20 ? "high" : v >= 5 ? "medium" : "low",
      payload: { value: v, rate, period: summary.period, level_id: summary.level_id, summary_id: summary.id },
    });
  };

  add("impact_claims_metric", summary.claims_value, summary.claims_rate);
  add("impact_delayed_handling_metric", summary.delayed_handling_value, summary.delayed_handling_rate);
  add("impact_cancellations_metric", summary.cancellations_value, summary.cancellations_rate);

  const { data: saved, error: upErr } = await supabaseAdmin
    .from("reputation_issues")
    .upsert(rows, { onConflict: "seller_id,kind,external_ref" })
    .select("id");

  if (upErr) {
    return Response.json({ error: "Falha ao salvar issues de summary", details: upErr.message }, { status: 500 });
  }

  return Response.json({ ok: true, created: rows.length, saved: saved?.length ?? 0, summary_id: summary.id });
}
