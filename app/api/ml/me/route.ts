import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getValidMlAccessToken } from "@/lib/mlToken";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const sellerId = searchParams.get("sellerId");

    if (!sellerId) {
      return NextResponse.json({ error: "sellerId obrigatorio" }, { status: 400 });
    }

    const { accessToken } = await getValidMlAccessToken(sellerId);

    const mlRes = await fetch("https://api.mercadolibre.com/users/me", {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      cache: "no-store",
    });

    const mlData = await mlRes.json().catch(() => ({}));

    if (!mlRes.ok) {
      return NextResponse.json(
        { error: "Erro ao chamar Mercado Livre /users/me", mlData },
        { status: 502 }
      );
    }

    if (mlData?.id) {
      await supabase
        .from("ml_tokens")
        .update({ ml_user_id: String(mlData.id) })
        .eq("seller_id", sellerId);

      await supabase
        .from("seller_accounts")
        .update({
          ml_user_id: String(mlData.id),
          nickname: mlData.nickname ?? null,
        })
        .eq("seller_id", sellerId);
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
