import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { authErrorResponse, requireRequestUser } from "@/lib/apiAuth";

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

    const auth = await requireRequestUser(req);
    if (!auth.ok) return authErrorResponse(auth);
    const user = auth.user;

    // 🔥 VALIDA SE O SELLER PERTENCE AO USUÁRIO
    let sellerQuery = supabase
      .from("seller_accounts")
      .select("seller_id")
      .eq("seller_id", sellerId);

    if (!auth.isAdmin) {
      sellerQuery = sellerQuery.eq("owner_user_id", user.id);
    }

    const { data: sellerAccount, error: sellerErr } = await sellerQuery.limit(1).maybeSingle();

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
