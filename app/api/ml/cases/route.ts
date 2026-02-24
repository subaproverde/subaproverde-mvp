import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase-server"; // ajuste se seu helper tiver outro nome

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);

    // aceita seller_id (antigo) e sellerId (novo)
    const sellerId =
      url.searchParams.get("sellerId") ||
      url.searchParams.get("seller_id") ||
      "";

    if (!sellerId) {
      return NextResponse.json(
        { ok: false, error: "sellerId/seller_id é obrigatório" },
        { status: 400 }
      );
    }

    // Busca cases no seu banco (igual o dashboard faz em "cases")
    const supabase = supabaseServer();

    const { data, error } = await supabase
      .from("cases")
      .select("*")
      .eq("seller_id", sellerId)
      .order("created_at", { ascending: false })
      .limit(200);

    if (error) {
      return NextResponse.json(
        { ok: false, error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true, cases: data ?? [] }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message ?? "Erro inesperado" },
      { status: 500 }
    );
  }
}