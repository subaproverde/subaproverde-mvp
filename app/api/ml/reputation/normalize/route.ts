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

  // pega último snapshot
  const { data: snap, error } = await supabaseAdmin
    .from("seller_reputation_snapshots")
    .select("id, ml_user_id, payload, created_at")
    .eq("seller_id", sellerId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !snap) {
    return Response.json({ error: "Nenhum snapshot encontrado", details: error?.message }, { status: 400 });
  }

  const sr = (snap.payload as any)?.seller_reputation ?? null;
  if (!sr?.metrics) {
    return Response.json(
      { error: "Snapshot sem seller_reputation.metrics", snapshot_id: snap.id },
      { status: 400 }
    );
  }

  const period =
    sr?.metrics?.claims?.period ??
    sr?.metrics?.sales?.period ??
    sr?.metrics?.cancellations?.period ??
    sr?.metrics?.delayed_handling_time?.period ??
    null;

  const row = {
    seller_id: sellerId,
    ml_user_id: String(snap.ml_user_id),
    snapshot_id: snap.id,
    level_id: sr?.level_id ?? null,
    period: period ?? null,
    sales_completed: sr?.metrics?.sales?.completed ?? null,
    claims_value: sr?.metrics?.claims?.value ?? null,
    claims_rate: sr?.metrics?.claims?.rate ?? null,
    cancellations_value: sr?.metrics?.cancellations?.value ?? null,
    cancellations_rate: sr?.metrics?.cancellations?.rate ?? null,
    delayed_handling_value: sr?.metrics?.delayed_handling_time?.value ?? null,
    delayed_handling_rate: sr?.metrics?.delayed_handling_time?.rate ?? null,
  };

  const { data: inserted, error: insErr } = await supabaseAdmin
    .from("seller_reputation_summaries")
    .insert([row])
    .select("*")
    .maybeSingle();

  if (insErr) {
    return Response.json({ error: "Falha ao salvar summary", details: insErr.message }, { status: 500 });
  }

  return Response.json({ ok: true, summary: inserted });
}
