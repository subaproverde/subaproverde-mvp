import { NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * Retorna contagens oficiais de impactos ABERTOS (status=open)
 * Fonte: tabela reputation_issues (gerada pela pipeline)
 */
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const sellerId = sp.get("sellerId")?.trim();

  if (!sellerId) {
    return Response.json({ ok: false, error: "sellerId obrigatório" }, { status: 400 });
  }

  // Puxa só issues abertas do seller
  const { data, error } = await supabaseAdmin
    .from("reputation_issues")
    .select("kind")
    .eq("seller_id", sellerId)
    .eq("status", "open");

  if (error) {
    return Response.json(
      { ok: false, error: "Falha ao buscar reputation_issues", details: error.message },
      { status: 500 }
    );
  }

  const items = data ?? [];

  // Mapeamento por kind (ajuste aqui se seus kinds mudarem)
  const claims = items.filter((x) => x.kind === "impact_claims").length;

  // atrasos podem aparecer como delayed_handling_time OU impact_delayed_handling_metric dependendo do seu builder
  const delayed =
    items.filter((x) => x.kind === "delayed_handling_time").length +
    items.filter((x) => x.kind === "impact_delayed_handling_metric").length;

  const cancellations = items.filter((x) => x.kind === "cancellations").length;

  // placeholder (se você plugar no futuro)
  const mediations = items.filter((x) => x.kind === "mediations").length;

  const total = claims + delayed + cancellations + mediations;

  return Response.json({
    ok: true,
    sellerId,
    counts: { claims, delayed, cancellations, mediations, total },
  });
}
