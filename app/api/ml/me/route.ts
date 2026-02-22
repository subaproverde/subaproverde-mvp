import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const sellerId = searchParams.get("sellerId");

    if (!sellerId) {
      return NextResponse.json(
        { error: "sellerId obrigatório" },
        { status: 400 }
      );
    }

    // 1) pega token salvo para o seller
    const { data: tokenRow, error: tokenErr } = await supabase
      .from("ml_tokens")
      .select("id, access_token, ml_user_id")
      .eq("seller_id", sellerId)
      .maybeSingle();

    if (tokenErr) {
      return NextResponse.json(
        { error: "Erro ao buscar token", detail: tokenErr.message },
        { status: 500 }
      );
    }

    if (!tokenRow?.access_token) {
      return NextResponse.json(
        { error: "Token não encontrado para este sellerId" },
        { status: 404 }
      );
    }

    // 2) chamada real ao Mercado Livre
    const mlRes = await fetch("https://api.mercadolibre.com/users/me", {
      headers: {
        Authorization: `Bearer ${tokenRow.access_token}`,
      },
    });

    const mlData = await mlRes.json();

    if (!mlRes.ok) {
      return NextResponse.json(
        { error: "Erro ao chamar Mercado Livre /users/me", mlData },
        { status: 502 }
      );
    }

    // 3) salva ml_user_id se ainda não tiver
    if (!tokenRow.ml_user_id && mlData?.id) {
      await supabase
        .from("ml_tokens")
        .update({ ml_user_id: mlData.id })
        .eq("id", tokenRow.id);
    }

    return NextResponse.json({
      connected: true,
      ml_user: {
        id: mlData.id,
        nickname: mlData.nickname ?? null,
        email: mlData.email ?? null,
        country: mlData.country_id ?? null,
      },
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message ?? "Erro inesperado" },
      { status: 500 }
    );
  }
}
