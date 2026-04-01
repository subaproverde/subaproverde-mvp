import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { sellerId } = body;

    if (!sellerId) {
      return NextResponse.json(
        { ok: false, error: "sellerId obrigatório" },
        { status: 400 }
      );
    }

    const auth = req.headers.get("authorization") || "";
    const token = auth.replace("Bearer ", "");

    const { data: userRes, error: userErr } = await supabase.auth.getUser(token);
    const user = userRes?.user;

    if (userErr || !user) {
      return NextResponse.json({ ok: false, error: "Não autenticado" }, { status: 401 });
    }

    // 🔥 VALIDA SE O SELLER PERTENCE AO USUÁRIO
    const { data: sellerAccount, error: sellerErr } = await supabase
      .from("seller_accounts")
      .select("seller_id")
      .eq("owner_user_id", user.id)
      .eq("seller_id", sellerId)
      .maybeSingle();

    if (sellerErr) {
      return NextResponse.json(
        { ok: false, error: "Erro ao validar seller", details: sellerErr.message },
        { status: 500 }
      );
    }

    if (!sellerAccount) {
      return NextResponse.json(
        { ok: false, error: "Seller não pertence ao usuário" },
        { status: 403 }
      );
    }

    // salva seller ativo
    const { error: upsertErr } = await supabase
      .from("user_settings")
      .upsert(
        {
          user_id: user.id,
          active_seller_id: sellerId,
        },
        { onConflict: "user_id" }
      );

    if (upsertErr) {
      return NextResponse.json(
        { ok: false, error: "Erro ao salvar", details: upsertErr.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      sellerId,
      userId: user.id,
    });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e.message },
      { status: 500 }
    );
  }
}