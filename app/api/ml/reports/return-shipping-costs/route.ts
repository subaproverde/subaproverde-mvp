import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
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

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function mlFetch(url: string, accessToken: string, extraHeaders: HeadersInit = {}): Promise<MlFetchResult> {
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}`, ...extraHeaders },
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
 * Parte da mesma fonte que alimenta o contador de reclamações impactando do seller
 * (reputation_issues/impact_claims) e lê a cobrança oficial de cada claim.
 *
 * /charges/return-cost é a fonte primária. Em devoluções que não a exponham,
 * usamos o shipment da devolução e /shipments/{id}/costs, ambos documentados pela ML.
 * Não há estimativa de frete neste endpoint.
 */
export async function GET(req: NextRequest) {
  try {
    const sellerId = req.nextUrl.searchParams.get("sellerId")?.trim();
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

    const { data: impactIssues, error: issuesError } = await supabaseAdmin
      .from("reputation_issues")
      .select("external_ref, resource_id, payload, created_at")
      .eq("seller_id", sellerId)
      .eq("kind", "impact_claims")
      .eq("status", "open")
      .order("created_at", { ascending: false })
      .limit(500);

    if (issuesError) {
      return NextResponse.json(
        { ok: false, error: "Não foi possível consultar as vendas que impactam a reputação." },
        { status: 500 }
      );
    }

    const issues = (impactIssues ?? []).filter((issue: any) => String(issue?.external_ref ?? "").trim());
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

    const inspectImpact = async (issue: any) => {
      const claimId = String(issue.external_ref).trim();
      const payload = issue?.payload ?? {};
      const returnCost = await mlFetch(
        `https://api.mercadolibre.com/post-purchase/v1/claims/${encodeURIComponent(claimId)}/charges/return-cost`,
        accessToken
      );
      const directAmount = Number(returnCost.json?.amount);

      let amount = Number.isFinite(directAmount) && directAmount > 0 ? directAmount : 0;
      let currencyId = String(returnCost.json?.currency_id ?? "BRL");

      // Fallback documentado pela ML para quando a cobrança estiver registrada no
      // shipment da devolução, mas não vier no endpoint primário da claim.
      if (amount <= 0) {
        const returnInfo = await mlFetch(
          `https://api.mercadolibre.com/post-purchase/v2/claims/${encodeURIComponent(claimId)}/returns`,
          accessToken
        );
        const shipmentIds = asArray(returnInfo.json?.shipments)
          .map((shipment: any) => shipment?.shipment_id)
          .filter((shipmentId: any) => shipmentId !== null && shipmentId !== undefined && shipmentId !== "");

        const shipmentCosts = await inBatches(shipmentIds, 4, async (shipmentId) =>
          mlFetch(
            `https://api.mercadolibre.com/shipments/${encodeURIComponent(String(shipmentId))}/costs`,
            accessToken,
            { "x-format-new": "true" }
          )
        );

        const fallbackAmounts = shipmentCosts.map((shipmentCost) => {
          const sender = asArray(shipmentCost.json?.senders).find(
            (entry: any) => String(entry?.user_id ?? "") === String(me.json.id)
          );
          return { amount: Number(sender?.cost), currencyId: String(shipmentCost.json?.currency_id ?? "BRL") };
        }).filter((entry) => Number.isFinite(entry.amount) && entry.amount > 0);

        amount = fallbackAmounts.reduce((total, entry) => total + entry.amount, 0);
        currencyId = fallbackAmounts[0]?.currencyId ?? currencyId;
      }

      if (!Number.isFinite(amount) || amount <= 0) return null;

      return {
        claimId,
        saleId: issue?.resource_id != null ? String(issue.resource_id) : payload?.resource_id != null ? String(payload.resource_id) : null,
        amount,
        currencyId,
        status: payload?.status ? String(payload.status) : null,
        stage: payload?.stage ? String(payload.stage) : null,
        dateCreated: payload?.date_created ? String(payload.date_created) : issue?.created_at ? String(issue.created_at) : null,
        reason: payload?.reason_id ? String(payload.reason_id) : null,
      };
    };

    const candidates = await inBatches(issues, 8, inspectImpact);
    reportItems.push(...candidates.filter(Boolean));

    return NextResponse.json({
      ok: true,
      items: reportItems,
      impactingClaims: issues.length,
      paging: { hasMore: false, nextOffset: null },
    });
  } catch (error: any) {
    return NextResponse.json(
      { ok: false, error: error?.message ?? "Erro inesperado ao consultar custos de devolução." },
      { status: 500 }
    );
  }
}
