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

export async function POST(req: NextRequest) {
  try {
    const token = getBearer(req);
    if (!token) {
      return Response.json({ ok: false, error: "Não autenticado" }, { status: 401 });
    }

    // Valida token + checa admin usando contexto do usuário (ANON + Bearer)
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

    // Payload
    const body = await req.json().catch(() => ({}));

    const code = String(body?.code ?? "")
      .trim()
      .toUpperCase()
      .replace(/\s+/g, "");

    const name = String(body?.name ?? "").trim();
    const email = body?.email ? String(body.email).trim() : null;

    const commission_rate_raw = body?.commission_rate ?? body?.commissionRate ?? 0.1;
    const commission_rate = Number(commission_rate_raw);

    if (!code || code.length < 3) {
      return Response.json({ ok: false, error: "code inválido (mín. 3 chars)" }, { status: 400 });
    }
    if (!name || name.length < 2) {
      return Response.json({ ok: false, error: "name inválido (mín. 2 chars)" }, { status: 400 });
    }
    if (!Number.isFinite(commission_rate) || commission_rate <= 0 || commission_rate > 1) {
      return Response.json(
        { ok: false, error: "commission_rate deve ser entre 0 e 1 (ex: 0.10)" },
        { status: 400 }
      );
    }

    const { data, error } = await supabaseAdmin
      .from("influencers")
      .insert({
        code,
        name,
        email,
        commission_rate,
        is_active: true,
      })
      .select("id, code, name, email, commission_rate, is_active, created_at")
      .single();

    if (error) {
      // Ex: duplicate key no code
      return Response.json({ ok: false, error: error.message }, { status: 500 });
    }

    return Response.json({ ok: true, row: data });
  } catch (e: any) {
    return Response.json({ ok: false, error: e?.message ?? "Erro" }, { status: 500 });
  }
}
