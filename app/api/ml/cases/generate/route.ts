import { NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(req: NextRequest) {
  const sellerId = req.nextUrl.searchParams.get("sellerId");
  if (!sellerId) {
    return Response.json({ error: "sellerId obrigatório" }, { status: 400 });
  }

  // pega impactos abertos
  const { data: issues, error } = await supabaseAdmin
    .from("reputation_issues")
    .select("id, kind, severity")
    .eq("seller_id", sellerId)
    .eq("status", "open")
    .like("kind", "impact_%");

  if (error) {
    return Response.json(
      { error: "Falha ao buscar issues", details: error.message },
      { status: 500 }
    );
  }

  if (!issues?.length) {
    return Response.json({ ok: true, created: 0 });
  }

  const rows = issues.map((it) => ({
    seller_id: sellerId,
    issue_id: it.id,
    kind: it.kind,
    severity: it.severity ?? null,
    title: it.kind,
    status: "novo",
  }));

  // cria apenas novos
  const { data: inserted, error: insErr } = await supabaseAdmin
    .from("cases")
    .upsert(rows, { onConflict: "seller_id,issue_id" })
    .select("id, kind, status");

  if (insErr) {
    return Response.json(
      { error: "Falha ao gerar cases", details: insErr.message },
      { status: 500 }
    );
  }

  return Response.json({
    ok: true,
    created: inserted?.length ?? 0,
    items: inserted ?? [],
  });
}
