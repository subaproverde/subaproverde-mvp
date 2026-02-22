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
      return Response.json({ ok: false, error: "Sem token (Authorization: Bearer ...)" }, { status: 401 });
    }

    // Valida usuário com token usando ANON KEY
    const supabaseAuth = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { global: { headers: { Authorization: `Bearer ${token}` } } }
    );

    const { data: userData, error: userErr } = await supabaseAuth.auth.getUser();
    if (userErr || !userData?.user) {
      return Response.json({ ok: false, error: "Token inválido / não autenticado" }, { status: 401 });
    }

    // Verifica admin (RPC)
    const { data: isAdmin, error: adminErr } = await supabaseAuth.rpc("is_admin");
    if (adminErr) {
      return Response.json(
        { ok: false, error: "Falha ao verificar admin", details: adminErr.message },
        { status: 500 }
      );
    }
    if (!isAdmin) {
      return Response.json({ ok: false, error: "Sem permissão" }, { status: 403 });
    }

    // Payload
    const body = await req.json().catch(() => ({}));

    const influencerId = String(body?.influencerId ?? body?.influencer_id ?? "").trim();
    const sellerId = String(body?.sellerId ?? body?.seller_id ?? "").trim();

    const kind = String(body?.kind ?? "").trim();
    const qty = Number(body?.qty ?? 1);

    const unitPriceRaw = body?.unitPrice ?? body?.unit_price ?? 0;
    const unitPrice = Number(unitPriceRaw);

    const notes = body?.notes ? String(body.notes) : null;

    if (!influencerId || !sellerId || !kind) {
      return Response.json(
        { ok: false, error: "Campos obrigatórios: influencerId, sellerId, kind" },
        { status: 400 }
      );
    }
    if (!Number.isFinite(qty) || qty < 1) {
      return Response.json({ ok: false, error: "qty inválido (>= 1)" }, { status: 400 });
    }
    if (!Number.isFinite(unitPrice) || unitPrice < 0) {
      return Response.json({ ok: false, error: "unitPrice inválido (>= 0)" }, { status: 400 });
    }

    // Insere (service role)
    const { data: row, error: insErr } = await supabaseAdmin
      .from("seller_commission_ledger")
      .insert({
        influencer_id: influencerId,
        seller_id: sellerId,
        kind,
        qty,
        unit_price: unitPrice,
        notes,
      })
      .select("id, influencer_id, seller_id, kind, qty, unit_price, notes, created_at")
      .single();

    if (insErr) {
      return Response.json(
        { ok: false, error: "Falha ao inserir ledger", details: insErr.message },
        { status: 500 }
      );
    }

    return Response.json({ ok: true, row });
  } catch (e: any) {
    return Response.json({ ok: false, error: e?.message ?? "Erro" }, { status: 500 });
  }
}
