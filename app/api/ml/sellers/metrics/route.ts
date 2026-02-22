import { NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Ajuste aqui se seus "kinds" forem diferentes
function mapKindToBucket(kind: string) {
  if (kind === "impact_claims" || kind === "impact_claims_metric") return "claims";
  if (kind === "mediations") return "mediations";
  if (kind === "cancellations") return "cancellations";
  if (kind === "delayed_handling_time" || kind === "impact_delayed_handling_metric") return "delays";
  return null;
}

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const sellerId = sp.get("sellerId");

  if (!sellerId) {
    return Response.json({ ok: false, error: "sellerId obrigatório" }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from("cases")
    .select("kind")
    .eq("seller_id", sellerId);

  if (error) {
    return Response.json(
      { ok: false, error: "Falha ao buscar cases", details: error.message },
      { status: 500 }
    );
  }

  const metrics = {
    claims: 0,
    mediations: 0,
    cancellations: 0,
    delays: 0,
  };

  for (const row of data ?? []) {
    const bucket = mapKindToBucket(String((row as any).kind ?? ""));
    if (!bucket) continue;
    metrics[bucket as keyof typeof metrics] += 1;
  }

  return Response.json({ ok: true, sellerId, metrics });
}
