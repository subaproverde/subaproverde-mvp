import { NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

function getBearer(req: NextRequest) {
  const h = req.headers.get("authorization") || "";
  const m = h.match(/^Bearer\s+(.+)$/i);
  return m?.[1]?.trim() || "";
}

export async function GET(req: NextRequest) {
  try {
    const token = getBearer(req);
    if (!token) {
      return Response.json({ ok: false, error: "Não autenticado" }, { status: 401 });
    }

    // valida token + checa admin usando contexto do usuário
    const supabaseAuth = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { global: { headers: { Authorization: `Bearer ${token}` } } }
    );

    const { data: userData, error: userErr } = await supabaseAuth.auth.getUser();
    if (userErr || !userData?.user) {
      return Response.json({ ok: false, error: "Sessão inválida" }, { status: 401 });
    }

    const { data: isAdmin, error: adminErr } = await supabaseAuth.rpc("is_admin");
    if (adminErr) {
      return Response.json({ ok: false, error: "Falha ao verificar admin", details: adminErr.message }, { status: 500 });
    }
    if (!isAdmin) {
      return Response.json({ ok: false, error: "Acesso negado (admin)" }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const influencerId = String(searchParams.get("influencerId") ?? "").trim();
    const limit = Math.min(Math.max(Number(searchParams.get("limit") ?? 50), 1), 200);

    if (!influencerId) {
      return Response.json({ ok: false, error: "influencerId obrigatório" }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from("seller_commission_ledger")
      .select("id, influencer_id, seller_id, kind, qty, unit_price, notes, created_at")
      .eq("influencer_id", influencerId)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) {
      return Response.json({ ok: false, error: error.message }, { status: 500 });
    }

    return Response.json({ ok: true, rows: data ?? [] });
  } catch (e: any) {
    return Response.json({ ok: false, error: e?.message ?? "Erro" }, { status: 500 });
  }
}
