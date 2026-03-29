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

    // 1) Descobre o user real do ML
    const { res: meRes, json: meJson } = await fetchJson(
      "https://api.mercadolibre.com/users/me",
      accessToken
    );

    if (!meRes.ok || !meJson?.id) {
      return NextResponse.json(
        {
          ok: false,
          error: "Falha ao obter /users/me",
          debug: {
            meStatus: meRes.status,
            me: meJson,
          },
        },
        { status: 502 }
      );
    }

    const mlUserId = String(meJson.id);

    let order: any = null;
    let shipment: any = null;
    let claim: any = null;

    // 2) Claim
    if (claimId) {
      const { res, json } = await fetchJson(
        `https://api.mercadolibre.com/post-purchase/v1/claims/${encodeURIComponent(claimId)}`,
        accessToken
      );

      if (res.ok) {
        claim = json;
      }
    }

    // 3) Resolve orderId
    let resolvedOrderId = orderId;

    if (!resolvedOrderId && claim) {
      resolvedOrderId =
        claim?.resource_id ||
        claim?.order_id ||
        claim?.resource?.id ||
        "";
    }

    // 4) Tenta order detail direto
    if (resolvedOrderId) {
      const { res, json } = await fetchJson(
        `https://api.mercadolibre.com/orders/${encodeURIComponent(resolvedOrderId)}`,
        accessToken
      );

      if (res.ok && json?.id) {
        order = json;
      } else {
        // 5) Fallback correto: search usando ML USER ID, não sellerId interno
        const { res: resSearch, json: jsonSearch } = await fetchJson(
          `https://api.mercadolibre.com/orders/search?seller=${encodeURIComponent(
            mlUserId
          )}&q=${encodeURIComponent(resolvedOrderId)}&limit=10`,
          accessToken
        );

        if (resSearch.ok && Array.isArray(jsonSearch?.results) && jsonSearch.results.length > 0) {
          const exact =
            jsonSearch.results.find((x: any) => String(x?.id) === String(resolvedOrderId)) ??
            jsonSearch.results[0];

          order = exact;
        }
      }
    }

    // 6) Resolve shipment
    const resolvedShipmentId =
      shipmentId ||
      order?.shipping?.id ||
      claim?.resource?.shipment_id ||
      claim?.shipment_id ||
      "";

    if (resolvedShipmentId) {
      const { res, json } = await fetchJson(
        `https://api.mercadolibre.com/shipments/${encodeURIComponent(String(resolvedShipmentId))}`,
        accessToken
      );

      if (res.ok) {
        shipment = json;
      }
    }

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
        players: claim?.players ?? null,
        dateCreated: toIsoOrDash(claim?.date_created),
        lastUpdated: toIsoOrDash(claim?.last_updated),
      },

      order: {
        id: order?.id ? String(order.id) : resolvedOrderId || null,
        packId: order?.pack_id ? String(order.pack_id) : null,
        status: safeStr(order?.status),
        statusDetail: safeStr(order?.status_detail),
        dateCreated: toIsoOrDash(order?.date_created),
        dateClosed: toIsoOrDash(order?.date_closed),
        totalAmount: safeNum(order?.total_amount),
        paidAmount: safeNum(order?.paid_amount),
        currencyId: safeStr(order?.currency_id, "BRL"),
        tags: Array.isArray(order?.tags) ? order.tags : [],
      },

      item: {
        title: safeStr(item?.title),
        itemId: item?.id ? String(item.id) : null,
        variationId: item?.variation_id ? String(item.variation_id) : null,
        categoryId: item?.category_id ? String(item.category_id) : null,
        quantity: safeNum(orderItem?.quantity),
        unitPrice: safeNum(orderItem?.unit_price),
        fullUnitPrice: safeNum(orderItem?.full_unit_price),
        thumbnail: safeStr(item?.thumbnail),
      },

      buyer: {
        id: buyer?.id ? String(buyer.id) : null,
        nickname: safeStr(buyer?.nickname, "Comprador"),
        firstName: safeStr(buyer?.first_name),
        lastName: safeStr(buyer?.last_name),
        email: safeStr(buyer?.email),
        phone: safeStr(phone),
        docType: safeStr(buyer?.billing_info?.doc_type),
        docNumber: safeStr(buyer?.billing_info?.doc_number),
      },

      shipment: {
        id: shipment?.id ? String(shipment.id) : resolvedShipmentId || null,
        status: safeStr(shipment?.status),
        substatus: safeStr(shipment?.substatus),
        shippingMode: safeStr(shipment?.shipping_mode),
        logisticType: safeStr(shipment?.logistic_type),
        trackingNumber: safeStr(
          shipment?.tracking_number ?? shipment?.tracking?.id
        ),
        trackingMethod: safeStr(shipment?.tracking_method),
        lastUpdated: toIsoOrDash(shipment?.last_updated),
        dateCreated: toIsoOrDash(shipment?.date_created),
        dateShipped: toIsoOrDash(shipment?.date_shipped),
        dateDelivered: toIsoOrDash(
          shipment?.date_delivered ?? shipment?.tracking?.date_delivered
        ),
        estimatedDelivery: toIsoOrDash(
          shipment?.estimated_delivery_time?.date ??
            shipment?.estimated_delivery_limit?.date
        ),
        receiverAddress: shipment?.receiver_address ?? null,
        senderAddress: shipment?.sender_address ?? null,
      },
    };

    return NextResponse.json({
      ok: true,
      details,
      debug: {
        sellerId,
        mlUserId,
        resolvedOrderId,
        resolvedShipmentId,
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