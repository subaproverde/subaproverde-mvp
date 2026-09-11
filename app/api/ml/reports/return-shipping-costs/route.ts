import { NextRequest, NextResponse } from "next/server";
import { authErrorResponse, requireSellerAccess } from "@/lib/apiAuth";
import { getValidMlAccessToken } from "@/lib/mlToken";

type MlFetchResult = {
  ok: boolean;
  status: number;
  json: any;
};

function asArray(value: any): any[] {
  if (Array.isArray(value)) return value;
  if (Array.isArray(value?.data)) return value.data;
  if (Array.isArray(value?.results)) return value.results;
  return [];
}

async function mlFetch(url: string, accessToken: string): Promise<MlFetchResult> {
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });

  return {
    ok: response.ok,
    status: response.status,
    json: await response.json().catch(() => null),
  };
}

async function inBatches<T, R>(items: T[], size: number, task: (item: T) => Promise<R>) {
  const results: R[] = [];

  for (let index = 0; index < items.length; index += size) {
    const batch = items.slice(index, index + size);
    results.push(...(await Promise.all(batch.map(task))));
  }

  return results;
}

/**
 * Lista apenas reclamações que simultaneamente:
 * - afetam a reputação segundo /affects-reputation; e
 * - têm valor positivo efetivamente cobrado em /charges/return-cost.
 *
 * Não há cálculo ou estimativa de frete neste endpoint.
 */
export async function GET(req: NextRequest) {
  try {
    const sellerId = req.nextUrl.searchParams.get("sellerId")?.trim();
    const offset = Math.max(0, Number(req.nextUrl.searchParams.get("offset") ?? "0") || 0);
    const limit = Math.min(50, Math.max(1, Number(req.nextUrl.searchParams.get("limit") ?? "30") || 30));

    if (!sellerId) {
      return NextResponse.json({ ok: false, error: "sellerId é obrigatório" }, { status: 400 });
    }

    const access = await requireSellerAccess(req, sellerId);
    if (!access.ok) return authErrorResponse(access);

    const { accessToken } = await getValidMlAccessToken(sellerId);
    const me = await mlFetch("https://api.mercadolibre.com/users/me", accessToken);

    if (!me.ok || !me.json?.id) {
      return NextResponse.json(
        { ok: false, error: "Não foi possível identificar a conta do Mercado Livre conectada." },
        { status: 502 }
      );
    }

    // É comum as reclamações mais recentes não terem devolução cobrada. Portanto,
    // uma página visual do relatório percorre até quatro páginas da API antes de
    // concluir que não há resultados, evitando uma lista vazia enganosa.
    const claimPageSize = 50;
    const maxClaimPagesPerRequest = 4;
    let scanOffset = offset;
    let scannedClaims = 0;
    let pagesScanned = 0;
    let totalClaims: number | null = null;
    let hasMoreClaims = false;
    const reportItems: Array<{
      claimId: string;
      saleId: string | null;
      amount: number;
      currencyId: string;
      status: string | null;
      stage: string | null;
      dateCreated: string | null;
      reason: string | null;
    }> = [];

    const inspectClaim = async (claim: any) => {
      const claimId = String(claim.id);
      const [returnCost, reputation] = await Promise.all([
        mlFetch(
          `https://api.mercadolibre.com/post-purchase/v1/claims/${encodeURIComponent(claimId)}/charges/return-cost`,
          accessToken
        ),
        mlFetch(
          `https://api.mercadolibre.com/post-purchase/v1/claims/${encodeURIComponent(claimId)}/affects-reputation`,
          accessToken
        ),
      ]);

      const amount = Number(returnCost.json?.amount);
      const affectsReputation = String(reputation.json?.affects_reputation ?? "").toLowerCase();

      if (!returnCost.ok || !reputation.ok || !Number.isFinite(amount) || amount <= 0 || affectsReputation !== "affected") {
        return null;
      }

      return {
        claimId,
        saleId: claim?.resource_id != null ? String(claim.resource_id) : null,
        amount,
        currencyId: String(returnCost.json?.currency_id ?? "BRL"),
        status: claim?.status ? String(claim.status) : null,
        stage: claim?.stage ? String(claim.stage) : null,
        dateCreated: claim?.date_created ? String(claim.date_created) : null,
        reason: claim?.reason_id ? String(claim.reason_id) : null,
      };
    };

    while (pagesScanned < maxClaimPagesPerRequest) {
      const params = new URLSearchParams({
        limit: String(claimPageSize),
        offset: String(scanOffset),
        site_id: "MLB",
        player_role: "respondent",
        player_user_id: String(me.json.id),
      });

      const claimsResult = await mlFetch(
        `https://api.mercadolibre.com/post-purchase/v1/claims/search?${params.toString()}`,
        accessToken
      );

      if (!claimsResult.ok) {
        return NextResponse.json(
          { ok: false, error: "Não foi possível consultar as reclamações no Mercado Livre." },
          { status: 502 }
        );
      }

      const claims = asArray(claimsResult.json).filter((claim) => claim?.id != null);
      const candidates = await inBatches(claims, 6, inspectClaim);
      reportItems.push(...candidates.filter(Boolean));

      scannedClaims += claims.length;
      pagesScanned += 1;
      scanOffset += claims.length;

      const pageTotal = Number(claimsResult.json?.paging?.total);
      if (Number.isFinite(pageTotal)) totalClaims = pageTotal;
      hasMoreClaims = Number.isFinite(pageTotal)
        ? scanOffset < pageTotal
        : claims.length === claimPageSize;

      // Pare assim que encontrar resultados. Se a página não trouxe nenhum,
      // continue procurando automaticamente na próxima página histórica.
      if (reportItems.length >= limit || claims.length < claimPageSize || !hasMoreClaims) break;
    }

    return NextResponse.json({
      ok: true,
      items: reportItems,
      scannedClaims,
      paging: {
        offset,
        limit,
        total: totalClaims,
        hasMore: hasMoreClaims,
        nextOffset: hasMoreClaims ? scanOffset : null,
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { ok: false, error: error?.message ?? "Erro inesperado ao consultar custos de devolução." },
      { status: 500 }
    );
  }
}
