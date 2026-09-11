import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { authErrorResponse, requireSellerAccess } from "@/lib/apiAuth";
import { getValidMlAccessToken } from "@/lib/mlToken";

type BillingCharge = {
  amount: number;
  currencyId: string;
  createdAt: string | null;
};

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

function asArray(value: any): any[] {
  if (Array.isArray(value)) return value;
  if (Array.isArray(value?.results)) return value.results;
  if (Array.isArray(value?.data)) return value.data;
  return [];
}

function oneOrMany(value: any): any[] {
  if (Array.isArray(value)) return value;
  return value ? [value] : [];
}

async function mlFetch(url: string, accessToken: string) {
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });

  return { ok: response.ok, json: await response.json().catch(() => null) };
}

function isReturnShippingCharge(charge: any) {
  const text = [
    charge?.transaction_detail,
    charge?.detail_description,
    charge?.description,
    charge?.label,
  ]
    .filter(Boolean)
    .join(" ")
    .toLocaleLowerCase("pt-BR");

  const type = String(charge?.detail_type ?? "").toUpperCase();
  return type === "CHARGE" && /(devolu|return)/.test(text);
}

/**
 * Concilia somente as vendas que já impactam a reputação com os lançamentos
 * financeiros vinculados à própria order no Faturamento do Mercado Livre.
 *
 * Fonte: GET /billing/integration/group/ML/order/details?order_ids=...
 * (máximo oficial de 60 orders por consulta).
 */
export async function GET(req: NextRequest) {
  try {
    const sellerId = req.nextUrl.searchParams.get("sellerId")?.trim();
    if (!sellerId) {
      return NextResponse.json({ ok: false, error: "sellerId é obrigatório" }, { status: 400 });
    }

    const access = await requireSellerAccess(req, sellerId);
    if (!access.ok) return authErrorResponse(access);

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

    const issues = (impactIssues ?? []).map((issue: any) => {
      const payload = issue?.payload ?? {};
      return {
        claimId: String(issue?.external_ref ?? "").trim(),
        saleId: issue?.resource_id != null
          ? String(issue.resource_id)
          : payload?.resource_id != null
            ? String(payload.resource_id)
            : "",
        payload,
        createdAt: issue?.created_at ? String(issue.created_at) : null,
      };
    }).filter((issue) => issue.claimId && issue.saleId);

    const uniqueOrderIds = Array.from(new Set(issues.map((issue) => issue.saleId)));
    if (uniqueOrderIds.length === 0) {
      return NextResponse.json({ ok: true, items: [], impactingClaims: issues.length });
    }

    const { accessToken } = await getValidMlAccessToken(sellerId);
    const chargesByOrder = new Map<string, BillingCharge[]>();
    const seenDetails = new Set<string>();
    let billingAvailable = false;

    for (let index = 0; index < uniqueOrderIds.length; index += 60) {
      const orderIds = uniqueOrderIds.slice(index, index + 60);
      const billing = await mlFetch(
        `https://api.mercadolibre.com/billing/integration/group/ML/order/details?order_ids=${encodeURIComponent(orderIds.join(","))}`,
        accessToken
      );

      if (!billing.ok) continue;
      billingAvailable = true;

      for (const orderReport of asArray(billing.json)) {
        const orderId = String(
          orderReport?.order_id ?? orderReport?.sales_info?.order_id ?? orderReport?.shipping_info?.order?.order_id ?? ""
        );
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

    if (!billingAvailable) {
      return NextResponse.json(
        { ok: false, error: "O Mercado Livre não disponibilizou o relatório de faturamento para este seller." },
        { status: 502 }
      );
    }

    const items = issues.flatMap((issue) => {
      const charges = chargesByOrder.get(issue.saleId) ?? [];
      if (charges.length === 0) return [];

      return [{
        claimId: issue.claimId,
        saleId: issue.saleId,
        amount: charges.reduce((total, charge) => total + charge.amount, 0),
        currencyId: charges[0].currencyId,
        status: issue.payload?.status ? String(issue.payload.status) : null,
        stage: issue.payload?.stage ? String(issue.payload.stage) : null,
        dateCreated: charges[0].createdAt ?? (issue.payload?.date_created ? String(issue.payload.date_created) : issue.createdAt),
        reason: issue.payload?.reason_id ? String(issue.payload.reason_id) : null,
      }];
    });

    return NextResponse.json({
      ok: true,
      items,
      impactingClaims: issues.length,
      source: "billing_order_details",
    });
  } catch (error: any) {
    return NextResponse.json(
      { ok: false, error: error?.message ?? "Erro inesperado ao conciliar cobranças de devolução." },
      { status: 500 }
    );
  }
}
