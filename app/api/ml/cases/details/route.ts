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

function firstValue(...values: any[]) {
  return values.find((value) => value !== null && value !== undefined && value !== "");
}

function findFirstValueByKey(value: any, keys: string[], depth = 0): any {
  if (value === null || value === undefined || depth > 5) return null;
  if (typeof value !== "object") return null;

  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findFirstValueByKey(item, keys, depth + 1);
      if (found !== null && found !== undefined && found !== "") return found;
    }
    return null;
  }

  for (const [key, item] of Object.entries(value)) {
    if (keys.includes(key.toLowerCase()) && item !== null && item !== undefined && item !== "") {
      return item;
    }
  }

  for (const item of Object.values(value)) {
    const found = findFirstValueByKey(item, keys, depth + 1);
    if (found !== null && found !== undefined && found !== "") return found;
  }

  return null;
}

function normalizeInvoice(invoice: any) {
  const invoices = [
    ...(Array.isArray(invoice?.results) ? invoice.results : []),
    ...(Array.isArray(invoice?.data) ? invoice.data : []),
    ...(Array.isArray(invoice?.items) ? invoice.items : []),
    ...(Array.isArray(invoice?.invoices) ? invoice.invoices : []),
    ...(Array.isArray(invoice) ? invoice : []),
  ].filter(Boolean);

  const primary = invoices[0] ?? invoice ?? null;
  const rawStatus = safeStr(
    firstValue(
      primary?.status,
      primary?.transaction_status,
      primary?.authorization_status,
      findFirstValueByKey(primary, ["status", "transaction_status"])
    )
  );
  const statusText = rawStatus.toLowerCase();
  const number = safeStr(
    firstValue(
      primary?.invoice_number,
      primary?.number,
      primary?.id,
      findFirstValueByKey(primary, ["invoice_number", "number", "id"])
    )
  );
  const issuedAt = toIsoOrDash(
    firstValue(
      primary?.issued_date,
      primary?.emission_date,
      primary?.date_issued,
      primary?.date_authorized,
      primary?.authorization_date,
      primary?.date_created,
      primary?.created_at,
      findFirstValueByKey(primary, [
        "issued_date",
        "emission_date",
        "date_issued",
        "date_authorized",
        "authorization_date",
        "date_created",
        "created_at",
      ])
    )
  );

  const issued =
    statusText.includes("authoriz") ||
    statusText.includes("autoriz") ||
    statusText.includes("issued") ||
    statusText.includes("emit") ||
    (number !== "—" && !statusText.includes("cancel") && !statusText.includes("error"));

  return {
    issued,
    status: rawStatus,
    issuedAt,
    number,
  };
}

function normalizeDispatchDates(shipment: any, leadTime: any, sla?: any) {
  return {
    expectedDispatchDate: toIsoOrDash(
      firstValue(
        sla?.expected_date,
        sla?.deadline,
        sla?.handling?.expected_date,
        sla?.estimated_handling_limit?.date,
        leadTime?.estimated_handling_limit?.date,
        leadTime?.estimated_handling_limit,
        leadTime?.sla?.expected_date,
        shipment?.estimated_handling_limit?.date,
        shipment?.estimated_handling_limit,
        shipment?.lead_time?.estimated_handling_limit?.date,
        shipment?.lead_time?.estimated_handling_limit
      )
    ),
    shippedAt: toIsoOrDash(
      firstValue(
        shipment?.date_shipped,
        shipment?.date_first_printed,
        shipment?.shipping_option?.date_shipped
      )
    ),
  };
}

async function fetchJson(url: string, accessToken: string, extraHeaders?: HeadersInit) {
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...(extraHeaders ?? {}),
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
    let leadTime: any = null;
    let sla: any = null;
    let invoice: ReturnType<typeof normalizeInvoice> | null = null;
    let claim: any = null;

    let orderDirectStatus: number | null = null;
    let orderDirectBody: any = null;

    let orderSearchStatus: number | null = null;
    let orderSearchBody: any = null;

    let shipmentStatus: number | null = null;
    let shipmentBody: any = null;
    let leadTimeStatus: number | null = null;
    let leadTimeBody: any = null;
    let slaStatus: number | null = null;
    let slaBody: any = null;
    let invoiceStatus: number | null = null;
    let invoiceBody: any = null;

    // 1) Claim
    if (claimId) {
      const { res, json } = await fetchJson(
        `https://api.mercadolibre.com/post-purchase/v1/claims/${encodeURIComponent(claimId)}`,
        accessToken
      );

      if (res.ok) {
        claim = json;
      }
    }

    // 2) Resolve orderId
    let resolvedOrderId = orderId;

    if (!resolvedOrderId && claim) {
      resolvedOrderId =
        claim?.resource_id ||
        claim?.order_id ||
        claim?.resource?.id ||
        "";
    }

    // 3) Tenta /orders/{id}
    if (resolvedOrderId) {
      const { res, json } = await fetchJson(
        `https://api.mercadolibre.com/orders/${encodeURIComponent(resolvedOrderId)}`,
        accessToken
      );

      orderDirectStatus = res.status;
      orderDirectBody = json;

      if (res.ok && json?.id) {
        order = json;
      } else {
        // 4) Fallback /orders/search
        const { res: resSearch, json: jsonSearch } = await fetchJson(
          `https://api.mercadolibre.com/orders/search?seller=${encodeURIComponent(
            mlUserId
          )}&q=${encodeURIComponent(resolvedOrderId)}&limit=10`,
          accessToken
        );

        orderSearchStatus = resSearch.status;
        orderSearchBody = jsonSearch;

        if (resSearch.ok && Array.isArray(jsonSearch?.results) && jsonSearch.results.length > 0) {
          const exact =
            jsonSearch.results.find((x: any) => String(x?.id) === String(resolvedOrderId)) ??
            jsonSearch.results[0];

          order = exact;
        }
      }
    }

    // 5) Resolve shipment
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

      shipmentStatus = res.status;
      shipmentBody = json;

      if (res.ok) {
        shipment = json;
      }

      const { res: leadRes, json: leadJson } = await fetchJson(
        `https://api.mercadolibre.com/shipments/${encodeURIComponent(String(resolvedShipmentId))}/lead_time`,
        accessToken,
        { "x-format-new": "true" }
      );

      leadTimeStatus = leadRes.status;
      leadTimeBody = leadJson;

      if (leadRes.ok) {
        leadTime = leadJson;
      }

      const { res: slaRes, json: slaJson } = await fetchJson(
        `https://api.mercadolibre.com/shipments/${encodeURIComponent(String(resolvedShipmentId))}/sla`,
        accessToken
      );

      slaStatus = slaRes.status;
      slaBody = slaJson;

      if (slaRes.ok) {
        sla = slaJson;
      }
    }

    if (order?.id) {
      const { res, json } = await fetchJson(
        `https://api.mercadolibre.com/users/${encodeURIComponent(
          mlUserId
        )}/invoices/orders/${encodeURIComponent(String(order.id))}`,
        accessToken
      );

      invoiceStatus = res.status;
      invoiceBody = json;
      invoice = res.ok ? normalizeInvoice(json) : normalizeInvoice(null);
    }

    const orderItem = order?.order_items?.[0] ?? {};
    const item = orderItem?.item ?? {};
    const buyer = order?.buyer ?? {};
    const phone = buyer?.phone?.number ?? buyer?.phone ?? null;
    const dispatchDates = normalizeDispatchDates(shipment, leadTime, sla);

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
        expectedDispatchDate: dispatchDates.expectedDispatchDate,
        shippedAt: dispatchDates.shippedAt,
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

      invoice: {
        issued: invoice?.issued ?? false,
        status: invoice?.status ?? "—",
        issuedAt: invoice?.issuedAt ?? "—",
        number: invoice?.number ?? "—",
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

        orderDirectStatus,
        orderDirectBody,

        orderSearchStatus,
        orderSearchBody,

        shipmentStatus,
        shipmentBody,
        leadTimeStatus,
        leadTimeBody,
        slaStatus,
        slaBody,
        invoiceStatus,
        invoiceBody,

        orderRaw: order,
        shipmentRaw: shipment,
        leadTimeRaw: leadTime,
        slaRaw: sla,
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
