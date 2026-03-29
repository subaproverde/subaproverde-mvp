import { NextRequest, NextResponse } from "next/server";
import { getValidMlAccessToken } from "@/lib/mlToken";

function safeStr(v: any, fallback = "—") {
  if (v === null || v === undefined || v === "") return fallback;
  return String(v);
}

function safeNum(v: any, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function toIsoOrDash(v: any) {
  if (!v) return "—";
  return String(v);
}

async function fetchJson(url: string, accessToken: string) {
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    cache: "no-store",
  });

  const json = await res.json().catch(() => null);
  return { res, json };
}

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);

    const sellerId =
      url.searchParams.get("sellerId") ||
      url.searchParams.get("seller_id") ||
      "";

    const orderId = url.searchParams.get("orderId") || "";
    const shipmentId = url.searchParams.get("shipmentId") || "";
    const claimId = url.searchParams.get("claimId") || "";

    if (!sellerId) {
      return NextResponse.json(
        { ok: false, error: "sellerId é obrigatório" },
        { status: 400 }
      );
    }

    if (!orderId && !shipmentId && !claimId) {
      return NextResponse.json(
        { ok: false, error: "Informe ao menos orderId, shipmentId ou claimId" },
        { status: 400 }
      );
    }

    const { accessToken } = await getValidMlAccessToken(sellerId);

    let order: any = null;
    let shipment: any = null;
    let claim: any = null;

    // =========================
    // 1) CLAIM
    // =========================
    if (claimId) {
      const { res, json } = await fetchJson(
        `https://api.mercadolibre.com/post-purchase/v1/claims/${claimId}`,
        accessToken
      );

      if (res.ok) claim = json;
    }

    // =========================
    // 2) ORDER (principal)
    // =========================
    let resolvedOrderId = orderId;

    if (!resolvedOrderId && claim) {
      resolvedOrderId =
        claim?.resource_id ||
        claim?.order_id ||
        claim?.resource?.id ||
        "";
    }

    if (resolvedOrderId) {
      const { res, json } = await fetchJson(
        `https://api.mercadolibre.com/orders/${resolvedOrderId}`,
        accessToken
      );

      if (res.ok && json?.id) {
        order = json;
      } else {
        // 🔥 FALLBACK CRÍTICO
        const { res: resSearch, json: jsonSearch } = await fetchJson(
          `https://api.mercadolibre.com/orders/search?seller=${sellerId}&q=${resolvedOrderId}`,
          accessToken
        );

        if (resSearch.ok && jsonSearch?.results?.length) {
          order = jsonSearch.results[0];
        }
      }
    }

    // =========================
    // 3) SHIPMENT
    // =========================
    const resolvedShipmentId =
      shipmentId ||
      order?.shipping?.id ||
      claim?.resource?.shipment_id ||
      claim?.shipment_id ||
      "";

    if (resolvedShipmentId) {
      const { res, json } = await fetchJson(
        `https://api.mercadolibre.com/shipments/${resolvedShipmentId}`,
        accessToken
      );

      if (res.ok) shipment = json;
    }

    // =========================
    // NORMALIZAÇÃO
    // =========================
    const orderItem = order?.order_items?.[0] ?? {};
    const item = orderItem?.item ?? {};
    const buyer = order?.buyer ?? {};
    const phone = buyer?.phone?.number ?? buyer?.phone ?? null;

    const details = {
      claim: {
        id: claim?.id ? String(claim.id) : claimId || null,
        type: safeStr(claim?.type),
        stage: safeStr(claim?.stage),
        reason: safeStr(claim?.reason),
        status: safeStr(claim?.status),
        resolution: safeStr(claim?.resolution),
        description: safeStr(claim?.description),
        dateCreated: toIsoOrDash(claim?.date_created),
        lastUpdated: toIsoOrDash(claim?.last_updated),
      },

      order: {
        id: order?.id ? String(order.id) : resolvedOrderId || null,
        packId: order?.pack_id ? String(order.pack_id) : null,
        status: safeStr(order?.status),
        statusDetail: safeStr(order?.status_detail),
        totalAmount: safeNum(order?.total_amount),
        paidAmount: safeNum(order?.paid_amount),
        currencyId: safeStr(order?.currency_id, "BRL"),
      },

      item: {
        title: safeStr(item?.title),
        itemId: item?.id ? String(item.id) : null,
        variationId: item?.variation_id ? String(item.variation_id) : null,
        quantity: safeNum(orderItem?.quantity),
        unitPrice: safeNum(orderItem?.unit_price),
        thumbnail: safeStr(item?.thumbnail),
      },

      buyer: {
        nickname: safeStr(buyer?.nickname, "Comprador"),
        name: `${safeStr(buyer?.first_name, "")} ${safeStr(
          buyer?.last_name,
          ""
        )}`,
        email: safeStr(buyer?.email),
        phone: safeStr(phone),
      },

      shipment: {
        id: shipment?.id ? String(shipment.id) : resolvedShipmentId || null,
        status: safeStr(shipment?.status),
        substatus: safeStr(shipment?.substatus),
        tracking: safeStr(
          shipment?.tracking_number ?? shipment?.tracking?.id
        ),
      },
    };

    return NextResponse.json({
      ok: true,
      details,
      debug: {
        orderRaw: order,
        shipmentRaw: shipment,
        claimRaw: claim,
      },
    });
  } catch (e: any) {
    return NextResponse.json(
      {
        ok: false,
        error: e?.message ?? "Erro inesperado",
      },
      { status: 500 }
    );
  }
}