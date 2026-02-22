import { NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const { sellerId, notificationId } = body;

  if (!sellerId) return Response.json({ error: "sellerId obrigatório" }, { status: 400 });
  if (!notificationId) return Response.json({ error: "notificationId obrigatório" }, { status: 400 });

  const { error } = await supabaseAdmin
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("id", notificationId)
    .eq("seller_id", sellerId);

  if (error) return Response.json({ error: "Falha ao marcar como lida", details: error.message }, { status: 500 });

  return Response.json({ ok: true });
}
