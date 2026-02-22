import { NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

type Body = {
  case_id?: string;        // compat antigo
  case_uuid?: string;      // padrão novo
  actor_user_id?: string | null;
  type: string;            // no banco é "type"
  payload?: any;
  seller_id?: string | null; // opcional
};

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as Body;

  const caseUuid = (body.case_uuid || body.case_id || "").trim();
  if (!caseUuid) return Response.json({ error: "case_id/case_uuid obrigatório" }, { status: 400 });
  if (!body?.type) return Response.json({ error: "type obrigatório" }, { status: 400 });

  // seller_id: se não vier, busca pelo case
  let sellerId = (body.seller_id || "").trim();
  if (!sellerId) {
    const { data: c, error: cErr } = await supabaseAdmin
      .from("cases")
      .select("seller_id")
      .eq("id", caseUuid)
      .maybeSingle();

    if (cErr) {
      return Response.json(
        { ok: false, error: "Falha ao buscar seller_id do case", details: cErr.message },
        { status: 500 }
      );
    }
    if (!c?.seller_id) {
      return Response.json(
        { ok: false, error: "Case não encontrado para obter seller_id", caseUuid },
        { status: 400 }
      );
    }
    sellerId = c.seller_id;
  }

  const insertRow: any = {
    seller_id: sellerId,
    case_uuid: caseUuid,                // ✅ padrão certo
    actor_user_id: body.actor_user_id ?? null,
    type: body.type,
    payload: body.payload ?? {},
    created_at: new Date().toISOString(),
  };

  const { error } = await supabaseAdmin.from("case_events").insert(insertRow);

  if (error) {
    return Response.json(
      { ok: false, error: "Falha ao criar evento", details: error.message },
      { status: 500 }
    );
  }

  return Response.json({ ok: true });
}
