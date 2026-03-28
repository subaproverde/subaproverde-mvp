import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase-server";

async function getAccessToken(sellerId: string) {
  const supabase = supabaseServer();

  const { data } = await supabase
    .from("ml_accounts")
    .select("access_token")
    .eq("seller_id", sellerId)
    .single();

  return data?.access_token;
}

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);

    const caseId = url.searchParams.get("caseId");
    const sellerId = url.searchParams.get("sellerId");

    if (!caseId || !sellerId) {
      return NextResponse.json(
        { ok: false, error: "caseId e sellerId obrigatórios" },
        { status: 400 }
      );
    }

    const accessToken = await getAccessToken(sellerId);

    if (!accessToken) {
      return NextResponse.json(
        { ok: false, error: "Token não encontrado" },
        { status: 401 }
      );
    }

    // 🔥 ML API - mensagens de reclamação
    const res = await fetch(
      `https://api.mercadolibre.com/claims/${caseId}/messages`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
        cache: "no-store",
      }
    );

    const json = await res.json();

    return NextResponse.json({
      ok: true,
      messages: json?.messages ?? [],
    });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message },
      { status: 500 }
    );
  }
}