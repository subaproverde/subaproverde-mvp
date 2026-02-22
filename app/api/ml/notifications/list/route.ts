import { NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const sellerId = sp.get("sellerId");
  const onlyUnread = sp.get("unread") === "1";

  if (!sellerId) return Response.json({ error: "sellerId obrigatório" }, { status: 400 });

  let q = supabaseAdmin
    .from("notifications")
    .select("id, type, title, body, case_id, read_at, created_at")
    .eq("seller_id", sellerId)
    .order("created_at", { ascending: false })
    .limit(50);

  if (onlyUnread) q = q.is("read_at", null);

  const { data, error } = await q;
  if (error) return Response.json({ error: "Falha ao listar notificações", details: error.message }, { status: 500 });

  return Response.json({ ok: true, count: data?.length ?? 0, items: data ?? [] });
}
