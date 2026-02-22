import { NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;

  // o front manda caseId (UUID). Vamos tratar como case_uuid
  const caseId = (sp.get("caseId") || "").trim();
  if (!caseId) return Response.json({ error: "caseId obrigatório" }, { status: 400 });

  const limit = Math.min(parseInt(sp.get("limit") ?? "200", 10) || 200, 500);

  const { data, error } = await supabaseAdmin
    .from("case_events")
    .select("id, case_uuid, created_at, actor_user_id, type, payload")
    .eq("case_uuid", caseId) // ✅ padrão certo
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    return Response.json(
      { ok: false, error: "Falha ao listar eventos", details: error.message },
      { status: 500 }
    );
  }

  // Compat: devolve case_id no payload para não quebrar componentes antigos
  const items = (data ?? []).map((x: any) => ({
    ...x,
    case_id: x.case_uuid,
  }));

  return Response.json({ ok: true, items });
}
