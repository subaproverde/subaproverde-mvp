import { NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

function getBearer(req: NextRequest) {
  const h = req.headers.get("authorization") || "";
  const m = h.match(/^Bearer\s+(.+)$/i);
  return (m?.[1] ?? "").trim() || null;
}

export async function GET(req: NextRequest) {
  try {
    const token = getBearer(req);
    if (!token) {
      return Response.json({ ok: false, error: "Não autenticado" }, { status: 401 });
    }

    // Valida token + checa admin usando contexto do usuário
    const supabaseUser = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { global: { headers: { Authorization: `Bearer ${token}` } } }
    );

    const { data: u, error: uErr } = await supabaseUser.auth.getUser();
    if (uErr || !u?.user) {
      return Response.json({ ok: false, error: "Sessão inválida" }, { status: 401 });
    }

    const { data: isAdmin, error: admErr } = await supabaseUser.rpc("is_admin");
    if (admErr) {
      return Response.json(
        { ok: false, error: "Falha ao verificar admin", details: admErr.message },
        { status: 500 }
      );
    }
    if (!isAdmin) {
      return Response.json({ ok: false, error: "Acesso negado (admin)" }, { status: 403 });
    }

    const { data, error } = await supabaseAdmin
      .from("influencers")
      .select("id, code, name, email, commission_rate, is_active, created_at")
      .order("created_at", { ascending: false });

    if (error) {
      return Response.json({ ok: false, error: error.message }, { status: 500 });
    }

    return Response.json({ ok: true, rows: data ?? [] });
  } catch (e: any) {
    return Response.json({ ok: false, error: e?.message ?? "Erro" }, { status: 500 });
  }
}
