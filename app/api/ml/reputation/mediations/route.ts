import { NextRequest, NextResponse } from "next/server";
import { getValidMlAccessToken } from "@/lib/mlToken";
import { authErrorResponse, requireSellerAccess } from "@/lib/apiAuth";
import { getMediationImpactMetric, type MlUserMe } from "@/lib/mlReputation";

async function fetchJson(url: string, accessToken: string) {
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });
  const json = await response.json().catch(() => null);
  return { response, json };
}

export async function GET(req: NextRequest) {
  const sellerId = req.nextUrl.searchParams.get("sellerId")?.trim();

  if (!sellerId) {
    return NextResponse.json({ ok: false, error: "sellerId obrigatorio" }, { status: 400 });
  }

  const access = await requireSellerAccess(req, sellerId);
  if (!access.ok) return authErrorResponse(access);

  try {
    const { accessToken } = await getValidMlAccessToken(sellerId);
    const { response, json } = await fetchJson("https://api.mercadolibre.com/users/me", accessToken);

    if (!response.ok) {
      return NextResponse.json(
        { ok: false, error: "Erro ao chamar Mercado Livre /users/me", status: response.status },
        { status: 502 }
      );
    }

    const metric = await getMediationImpactMetric({
      accessToken,
      me: json as MlUserMe,
    });

    return NextResponse.json({
      ok: true,
      sellerId,
      metric,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro inesperado";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
