import { NextResponse } from "next/server";
import { getValidMlAccessToken } from "@/lib/mlToken";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const sellerId = searchParams.get("sellerId");

    if (!sellerId) {
      return NextResponse.json({ error: "sellerId obrigatorio" }, { status: 400 });
    }

    const { accessToken } = await getValidMlAccessToken(sellerId);
    const url = "https://api.mercadolibre.com/mediations/search";

    const mlRes = await fetch(url, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      cache: "no-store",
    });

    const data = await mlRes.json().catch(() => ({}));

    return NextResponse.json({
      ok: mlRes.ok,
      status: mlRes.status,
      url,
      data,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message ?? "Erro inesperado" },
      { status: 500 }
    );
  }
}
