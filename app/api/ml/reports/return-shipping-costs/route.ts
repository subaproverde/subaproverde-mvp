import { NextRequest, NextResponse } from "next/server";
import { authErrorResponse, requireSellerAccess } from "@/lib/apiAuth";
import { getValidMlAccessToken } from "@/lib/mlToken";

type BillingCharge = { amount: number; currencyId: string; createdAt: string | null };
type ReturnCost = { amount: number; currencyId: string };
type ImpactClaim = {
  claimId: string;
  saleId: string;
  status: string | null;
  stage: string | null;
  dateCreated: string | null;
  reason: string | null;
};

const CLAIMS_PAGE_SIZE = 100;
const MAX_CLAIMS_PAGES = 4;
const AFFECTS_CONCURRENCY = 2;

function asArray(value: any): any[] {
  if (Array.isArray(value)) return value;
  if (Array.isArray(value?.results)) return value.results;
  if (Array.isArray(value?.data)) return value.data;
  return [];
}

function oneOrMany(value: any): any[] {
  return Array.isArray(value) ? value : value ? [value] : [];
}

function positiveNumber(value: any) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : 0;
}

async function mlFetch(url: string, accessToken: string) {
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });
  return {
    ok: response.ok,
    status: response.status,
    retryAfter: Number(response.headers.get("retry-after") ?? 0),
    json: await response.json().catch(() => null),
  };
}

function wait(milliseconds: number) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function mlFetchWithRateLimit(url: string, accessToken: string) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const result = await mlFetch(url, accessToken);
    if (result.status !== 429 || attempt === 2) return result;
    await wait(Math.max(800, result.retryAfter * 1000));
  }
  throw new Error("Falha inesperada ao consultar o Mercado Livre.");
}

function reputationPeriodDays(value: any) {
  const match = String(value ?? "").match(/(\d+)/);
  const days = match ? Number(match[1]) : 60;
  return Number.isFinite(days) && days > 0 ? Math.min(days, 365) : 60;
}

function isReturnShippingCharge(charge: any) {
  const text = [charge?.transaction_detail, charge?.detail_description, charge?.description, charge?.label]
    .filter(Boolean)
    .join(" ")
    .toLocaleLowerCase("pt-BR");

  return String(charge?.detail_type ?? "").toUpperCase() === "CHARGE" && /(devolu|return)/.test(text);
}

function saleIdFromClaim(claim: any) {
  const resource = String(claim?.resource ?? "").toLowerCase();
  const id = claim?.order_id ?? claim?.order?.id ?? (resource === "order" ? claim?.resource_id : null);
  return id === null || id === undefined || id === "" ? "" : String(id);
}

function returnCostFromResponse(value: any): ReturnCost | null {
  const amount = Math.abs(Number(value?.amount));
  if (!Number.isFinite(amount) || amount <= 0) return null;
  return { amount, currencyId: String(value?.currency_id ?? "BRL") };
}

async function mapWithConcurrency<T, R>(values: T[], fn: (value: T) => Promise<R>) {
  const results: R[] = [];
  let next = 0;
  const workers = Array.from({ length: Math.min(AFFECTS_CONCURRENCY, values.length) }, async () => {
    while (next < values.length) {
      const index = next++;
      results[index] = await fn(values[index]);
    }
  });
  await Promise.all(workers);
  return results;
}

/**
 * A métrica de reputação é agregada e não carrega IDs. Aqui obtemos a relação
 * real claim -> venda diretamente do Mercado Livre antes da conciliação.
 */
async function loadImpactingClaims(accessToken: string) {
  const me = await mlFetch("https://api.mercadolibre.com/users/me", accessToken);
  if (!me.ok || !me.json?.id) throw new Error("Não foi possível identificar o seller no Mercado Livre.");

  const reputationMetricCount = positiveNumber(me.json?.seller_reputation?.metrics?.claims?.value);
  const periodDays = reputationPeriodDays(
    me.json?.seller_reputation?.metrics?.claims?.period ?? me.json?.seller_reputation?.metrics?.sales?.period
  );
  const now = new Date();
  const from = new Date(now.getTime() - periodDays * 24 * 60 * 60 * 1000);
  const paramsBase = new URLSearchParams({
    limit: String(CLAIMS_PAGE_SIZE),
    site_id: "MLB",
    "players.role": "respondent",
    "players.user_id": String(me.json.id),
    range: `date_created:after:${from.toISOString()},before:${now.toISOString()}`,
  });

  const affecting: any[] = [];
  const seen = new Set<string>();
  let claimsScanned = 0;
  let effectChecksUnavailable = 0;
  for (let page = 0; page < MAX_CLAIMS_PAGES; page += 1) {
    const params = new URLSearchParams(paramsBase);
    params.set("offset", String(page * CLAIMS_PAGE_SIZE));
    const response = await mlFetch(
      `https://api.mercadolibre.com/post-purchase/v1/claims/search?${params.toString()}`,
      accessToken
    );
    if (!response.ok) throw new Error("O Mercado Livre não disponibilizou a lista de reclamações do seller.");

    const pageClaims = asArray(response.json);
    const uniquePageClaims = pageClaims.filter((claim: any) => {
      const claimId = String(claim?.id ?? "");
      if (!claimId || seen.has(claimId)) return false;
      seen.add(claimId);
      return true;
    });
    claimsScanned += uniquePageClaims.length;

    const effects = await mapWithConcurrency(uniquePageClaims, async (claim) => {
      const claimId = String(claim?.id ?? "");
      const effect = await mlFetchWithRateLimit(
        `https://api.mercadolibre.com/post-purchase/v1/claims/${encodeURIComponent(claimId)}/affects-reputation`,
        accessToken
      );
      return { claim, available: effect.ok, affected: effect.ok && effect.json?.affects_reputation === "affected" };
    });
    effectChecksUnavailable += effects.filter((effect) => !effect.available).length;
    affecting.push(...effects.filter((effect) => effect.affected).map((effect) => effect.claim));

    // A métrica oficial já informa o total que deve ser encontrado. Ao atingir
    // esse número não continuamos a chamar endpoints históricos sem necessidade.
    if (reputationMetricCount > 0 && affecting.length >= reputationMetricCount) break;
    if (pageClaims.length < CLAIMS_PAGE_SIZE) break;
  }
  const claimsWithDetails = await mapWithConcurrency(affecting, async (claim) => {
    const claimId = String(claim?.id ?? "");
    const detail = await mlFetchWithRateLimit(
      `https://api.mercadolibre.com/post-purchase/v1/claims/${encodeURIComponent(claimId)}`,
      accessToken
    );
    return detail.ok ? { ...claim, ...detail.json } : claim;
  });

  const impactingClaims = claimsWithDetails
    .map((claim: any): ImpactClaim | null => {
      const saleId = saleIdFromClaim(claim);
      if (!saleId) return null;
      return {
        claimId: String(claim.id),
        saleId,
        status: claim?.status ? String(claim.status) : null,
        stage: claim?.stage ? String(claim.stage) : null,
        dateCreated: claim?.date_created ? String(claim.date_created) : null,
        reason: claim?.reason_id ? String(claim.reason_id) : null,
      };
    })
    .filter((claim): claim is ImpactClaim => Boolean(claim));

  return {
    reputationMetricCount,
    periodDays,
    claimsScanned,
    effectChecksUnavailable,
    affectedClaimsFound: affecting.length,
    impactingClaims,
  };
}

/**
 * Confirma impacto, obtém o custo específico de devolução da claim e consulta
 * o faturamento por order como trilha de conciliação.
 */
export async function GET(req: NextRequest) {
  try {
    const sellerId = req.nextUrl.searchParams.get("sellerId")?.trim();
    if (!sellerId) return NextResponse.json({ ok: false, error: "sellerId é obrigatório" }, { status: 400 });

    const access = await requireSellerAccess(req, sellerId);
    if (!access.ok) return authErrorResponse(access);

    const { accessToken } = await getValidMlAccessToken(sellerId);
    const source = await loadImpactingClaims(accessToken);
    const uniqueOrderIds = Array.from(new Set(source.impactingClaims.map((claim) => claim.saleId)));
    const returnCostChecks = await mapWithConcurrency(source.impactingClaims, async (claim) => {
      const response = await mlFetchWithRateLimit(
        `https://api.mercadolibre.com/post-purchase/v1/claims/${encodeURIComponent(claim.claimId)}/charges/return-cost`,
        accessToken
      );
      // 404 significa que a claim não tem custo de devolução consultável; não
      // deve ser apresentado como falha de rate limit nem como valor estimado.
      return {
        claimId: claim.claimId,
        complete: response.ok || response.status === 404,
        cost: response.ok ? returnCostFromResponse(response.json) : null,
      };
    });
    const returnCostsByClaim = new Map(
      returnCostChecks.filter((check) => check.cost).map((check) => [check.claimId, check.cost as ReturnCost])
    );
    const returnCostChecksUnavailable = returnCostChecks.filter((check) => !check.complete).length;

    if (uniqueOrderIds.length === 0) {
      return NextResponse.json({
        ok: true,
        items: [],
        reputationMetricCount: source.reputationMetricCount,
        periodDays: source.periodDays,
        impactingClaims: source.affectedClaimsFound,
        linkedSales: 0,
        claimsScanned: source.claimsScanned,
        effectChecksUnavailable: source.effectChecksUnavailable,
        returnCostChecksUnavailable,
        source: "claims_return_cost_then_billing_audit",
      });
    }

    const chargesByOrder = new Map<string, BillingCharge[]>();
    const seenDetails = new Set<string>();
    let billingAvailable = false;
    for (let index = 0; index < uniqueOrderIds.length; index += 60) {
      const billing = await mlFetch(
        `https://api.mercadolibre.com/billing/integration/group/ML/order/details?order_ids=${encodeURIComponent(uniqueOrderIds.slice(index, index + 60).join(","))}`,
        accessToken
      );
      if (!billing.ok) continue;
      billingAvailable = true;

      for (const orderReport of asArray(billing.json)) {
        const orderId = String(orderReport?.order_id ?? orderReport?.shipping_info?.order?.order_id ?? "");
        if (!orderId) continue;
        for (const detail of oneOrMany(orderReport?.details)) {
          const charge = detail?.charge_info ?? detail;
          if (!isReturnShippingCharge(charge)) continue;
          const amount = Math.abs(Number(charge?.detail_amount));
          if (!Number.isFinite(amount) || amount <= 0) continue;

          const detailKey = `${orderId}:${charge?.detail_id ?? ""}:${charge?.creation_date_time ?? ""}:${amount}`;
          if (seenDetails.has(detailKey)) continue;
          seenDetails.add(detailKey);
          const charges = chargesByOrder.get(orderId) ?? [];
          charges.push({
            amount,
            currencyId: String(detail?.currency_info?.currency_id ?? orderReport?.currency_info?.currency_id ?? "BRL"),
            createdAt: charge?.creation_date_time ? String(charge.creation_date_time) : null,
          });
          chargesByOrder.set(orderId, charges);
        }
      }
    }

    const items = source.impactingClaims.flatMap((claim) => {
      const returnCost = returnCostsByClaim.get(claim.claimId);
      if (!returnCost) return [];
      const billingCharges = chargesByOrder.get(claim.saleId) ?? [];
      return [{
        ...claim,
        amount: returnCost.amount,
        currencyId: returnCost.currencyId,
        dateCreated: billingCharges[0]?.createdAt ?? claim.dateCreated,
      }];
    });

    return NextResponse.json({
      ok: true,
      items,
      reputationMetricCount: source.reputationMetricCount,
      periodDays: source.periodDays,
      impactingClaims: source.affectedClaimsFound,
      linkedSales: uniqueOrderIds.length,
      claimsScanned: source.claimsScanned,
      effectChecksUnavailable: source.effectChecksUnavailable,
      returnCostChecksUnavailable,
      billingAvailable,
      source: "claims_return_cost_then_billing_audit",
    });
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error?.message ?? "Erro inesperado ao conciliar cobranças de devolução." }, { status: 500 });
  }
}
