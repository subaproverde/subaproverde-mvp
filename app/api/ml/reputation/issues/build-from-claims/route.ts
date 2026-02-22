import { NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

function daysAgoISO(days: number) {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
}

function severityFromStage(stage: any) {
  const st = String(stage ?? "").toLowerCase();
  if (st === "dispute") return "high";
  if (st === "claim") return "medium";
  return "low";
}

function isImpactCandidate(c: any) {
  const type = String(c?.type ?? "").toLowerCase();
  const stage = String(c?.stage ?? "").toLowerCase();
  // MVP: inclui tipos/estágios que tipicamente entram em conta
  if (stage === "claim" || stage === "dispute") return true;
  if (type === "mediations" || type === "returns" || type === "cancel_purchase") return true;
  return false;
}

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const sellerId = sp.get("sellerId");
  if (!sellerId) return Response.json({ error: "sellerId obrigatório" }, { status: 400 });

  const limit = Number(sp.get("limit") ?? "2000");
  const windowDays = Number(sp.get("windowDays") ?? "365");
  const sinceIso = daysAgoISO(windowDays);

  const { data: complaints, error } = await supabaseAdmin
    .from("complaints")
    .select("external_id, payload, type, stage, resource, resource_id, reason_id, date_created_ml, last_updated_ml")
    .eq("seller_id", sellerId)
    .gte("date_created_ml", sinceIso)
    .order("date_created_ml", { ascending: false })
    .limit(limit);

  if (error) {
    return Response.json({ error: "Falha ao ler complaints", details: error.message }, { status: 500 });
  }

  const candidates = (complaints ?? []).filter(isImpactCandidate);

  const rows = candidates.map((c: any) => {
    const p = c.payload ?? {};
    return {
      seller_id: sellerId,
      kind: "impact_claims",
      status: "open", // aqui "open" significa "em observação/contando", não o status do ML
      external_ref: String(c.external_id),
      resource: c.resource ?? p.resource ?? null,
      resource_id: c.resource_id ?? (p.resource_id != null ? String(p.resource_id) : null),
      severity: severityFromStage(c.stage ?? p.stage),
      reason_id: c.reason_id ?? p.reason_id ?? null,
      payload: p,
    };
  });

  const { data: saved, error: upErr } = await supabaseAdmin
    .from("reputation_issues")
    .upsert(rows, { onConflict: "seller_id,kind,external_ref" })
    .select("id");

  if (upErr) {
    return Response.json({ error: "Falha ao salvar reputation_issues", details: upErr.message }, { status: 500 });
  }

  return Response.json({
    ok: true,
    windowDays,
    within_window: complaints?.length ?? 0,
    candidates: candidates.length,
    saved: saved?.length ?? 0,
    note: 'kind="impact_claims" representa casos relevantes na janela, não "status open" do ML.',
  });
}
