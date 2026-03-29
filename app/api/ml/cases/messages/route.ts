import { NextRequest, NextResponse } from "next/server";
import { getValidMlAccessToken } from "@/lib/mlToken";

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

    const { accessToken } = await getValidMlAccessToken(sellerId);

    const res = await fetch(
      `https://api.mercadolibre.com/claims/${encodeURIComponent(caseId)}/messages`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
        cache: "no-store",
      }
    );

    const json = await res.json().catch(() => ({}));

    if (!res.ok) {
      return NextResponse.json(
        {
          ok: false,
          error: "Falha ao buscar mensagens da claim",
          status: res.status,
          data: json,
        },
        { status: 502 }
      );
    }

    const messages = (json?.messages ?? []).map((m: any, i: number) => ({
      id: String(m?.id ?? i),
      from: m?.from ?? null,
      to: m?.to ?? null,
      message: m?.message ?? "",
      date_created: m?.date_created ?? null,
      stage: m?.stage ?? null,
      status: m?.status ?? null,
      moderation_status: m?.moderation_status ?? null,
    }));

    return NextResponse.json({
      ok: true,
      messages,
    });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message ?? "Erro inesperado" },
      { status: 500 }
    );
  }
}