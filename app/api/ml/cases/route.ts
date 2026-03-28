import { NextRequest, NextResponse } from "next/server";
import { getValidMlAccessToken } from "@/lib/mlToken";

type ImpactType = "reclamacoes" | "atrasos" | "cancelamentos" | "mediacoes";

function asArray<T = any>(value: any): T[] {
  if (Array.isArray(value)) return value;
  if (Array.isArray(value?.results)) return value.results;
  if (Array.isArray(value?.data)) return value.data;
  if (Array.isArray(value?.items)) return value.items;
  return [];
}

function safeStr(v: any, fallback = "—") {
  if (v === null || v === undefined || v === "") return fallback;
  return String(v);
}

function toIsoOrDash(v: any) {
  if (!v) return "—";
  return String(v);
}

function timeAgo(dateStr?: string | null) {
  if (!dateStr) return "—";
  const t = new Date(dateStr).getTime();
  if (Number.isNaN(t)) return "—";

  const diffMs = Date.now() - t;
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 60) return `${diffMin} min`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `${diffH} h`;
  const diffD = Math.floor(diffH / 24);
  return `${diffD} d`;
}

function claimTypeOf(c: any): ImpactType {
  const raw = [
    c?.type,
    c?.reason,
    c?.stage,
    c?.status,
    c?.resource,
    c?.description,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  if (
    raw.includes("mediation") ||
    raw.includes("mediacion") ||
    raw.includes("mediacao") ||
    raw.includes("mediations")
  ) {
    return "mediacoes";
  }

  if (
    raw.includes("cancel") ||
    raw.includes("cancellation") ||
    raw.includes("cancelamento")
  ) {
    return "cancelamentos";
  }

  return "reclamacoes";
}

function orderIsCancelled(o: any) {
  const raw = [o?.status, o?.tags?.join(" "), o?.status_detail]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return raw.includes("cancel");
}

function shipmentLooksDelayed(sh: any) {
  const status = String(sh?.status ?? "").toLowerCase();
  const substatus = String(sh?.substatus ?? "").toLowerCase();

  const raw = [
    status,
    substatus,
    sh?.substatus_history?.map((x: any) => x?.substatus).join(" "),
    sh?.tracking_status,
    sh?.tracking?.status,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  if (
    raw.includes("delay") ||
    raw.includes("late") ||
    raw.includes("demora") ||
    raw.includes("atras")
  ) {
    return true;
  }

  const created = new Date(sh?.date_created ?? 0).getTime();
  if (!Number.isNaN(created)) {
    const ageDays = (Date.now() - created) / (1000 * 60 * 60 * 24);

    if (
      ageDays >= 2 &&
      ["ready_to_ship", "pending", "handling", "shipped"].includes(status)
    ) {
      return true;
    }
  }

  return false;
}

async function fetchJson(url: string, accessToken: string) {
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
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

    if (!sellerId) {
      return NextResponse.json(
        { ok: false, error: "sellerId é obrigatório" },
        { status: 400 }
      );
    }

    console.log("[cases] sellerId interno =", sellerId);

    const { accessToken } = await getValidMlAccessToken(sellerId);

    // 1) Base confiável: /users/me
    const { res: meRes, json: meJson } = await fetchJson(
      "https://api.mercadolibre.com/users/me",
      accessToken
    );

    console.log("[cases] /users/me status =", meRes.status);
    console.log("[cases] /users/me body =", meJson);

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
    const nickname = meJson?.nickname ?? null;

    // 2) Orders
    const ordersUrl = `https://api.mercadolibre.com/orders/search?seller=${encodeURIComponent(
      mlUserId
    )}&limit=50&sort=date_desc`;

    const { res: ordersRes, json: ordersJson } = await fetchJson(ordersUrl, accessToken);

    console.log("[cases] /orders/search status =", ordersRes.status);
    console.log("[cases] /orders/search body =", ordersJson);

    const orders = asArray(ordersJson);

    // 3) Claims
    const claimsUrl1 = `https://api.mercadolibre.com/post-purchase/v1/claims/search?seller_id=${encodeURIComponent(
      mlUserId
    )}`;

    const { res: claimsRes1, json: claimsJson1 } = await fetchJson(claimsUrl1, accessToken);

    console.log("[cases] claims attempt 1 status =", claimsRes1.status);
    console.log("[cases] claims attempt 1 body =", claimsJson1);

    const claims1 = asArray(claimsJson1);

    const claimsUrl2 =
      "https://api.mercadolibre.com/post-purchase/v1/claims/search?stage=claim&limit=50";

    const { res: claimsRes2, json: claimsJson2 } = await fetchJson(claimsUrl2, accessToken);

    console.log("[cases] claims attempt 2 status =", claimsRes2.status);
    console.log("[cases] claims attempt 2 body =", claimsJson2);

    const claims2 = asArray(claimsJson2);

    const claims = claims1.length > 0 ? claims1 : claims2;

    // 4) Shipments dos orders
    const shipmentIds = Array.from(
      new Set(
        orders
          .map((o: any) => o?.shipping?.id)
          .filter((v: any) => v !== null && v !== undefined && v !== "")
      )
    );

    const shipmentEntries = await Promise.all(
      shipmentIds.slice(0, 50).map(async (shipmentId: any) => {
        const shipmentUrl = `https://api.mercadolibre.com/shipments/${shipmentId}`;
        const { res, json } = await fetchJson(shipmentUrl, accessToken);

        console.log("[cases] shipment status =", shipmentId, res.status);
        return [String(shipmentId), res.ok ? json : null] as const;
      })
    );

    const shipmentMap = new Map<string, any>(shipmentEntries);

    // 5) Normalização de claims
    const normalizedClaims = claims.map((c: any) => {
      const type = claimTypeOf(c);

      return {
        id: `claim-${c.id ?? c.resource_id ?? Math.random().toString(36).slice(2)}`,
        type,
        title: safeStr(c?.reason ?? c?.type ?? "Reclamação"),
        reason: safeStr(c?.description ?? c?.status),
        createdAt: toIsoOrDash(c?.date_created),
        updatedAt: toIsoOrDash(c?.last_updated),
        ageLabel: timeAgo(c?.last_updated ?? c?.date_created),
        buyerName: safeStr(c?.buyer?.nickname, "Comprador"),
        statusPill: safeStr(c?.status),
        chip: c?.id ? `#${c.id}` : undefined,
        source: "claim",
        claimId: c?.id ?? null,
        orderId: c?.resource_id ?? c?.order_id ?? null,
        shipmentId: null,
        raw: c,
      };
    });

    // 6) Normalização de cancelamentos por orders
    const normalizedCancelledOrders = orders
      .filter((o: any) => orderIsCancelled(o))
      .map((o: any) => ({
        id: `order-cancel-${o.id}`,
        type: "cancelamentos" as ImpactType,
        title: safeStr(o?.order_items?.[0]?.item?.title, "Pedido cancelado"),
        reason: `Pedido ${safeStr(o?.status)}`,
        createdAt: toIsoOrDash(o?.date_created),
        updatedAt: toIsoOrDash(o?.last_updated),
        ageLabel: timeAgo(o?.last_updated ?? o?.date_created),
        buyerName: safeStr(o?.buyer?.nickname, "Comprador"),
        statusPill: safeStr(o?.status),
        chip: `#${o.id}`,
        source: "order",
        claimId: null,
        orderId: o?.id ?? null,
        shipmentId: o?.shipping?.id ?? null,
        raw: o,
      }));

    // 7) Normalização de atrasos por shipment
    const normalizedDelayedOrders = orders
      .map((o: any) => {
        const shipmentId = o?.shipping?.id ? String(o.shipping.id) : null;
        const shipment = shipmentId ? shipmentMap.get(shipmentId) : null;

        if (!shipment || !shipmentLooksDelayed(shipment)) return null;

        return {
          id: `order-delay-${o.id}`,
          type: "atrasos" as ImpactType,
          title: safeStr(o?.order_items?.[0]?.item?.title, "Pedido com atraso"),
          reason: `Envio ${safeStr(shipment?.status)}${shipment?.substatus ? ` / ${shipment.substatus}` : ""}`,
          createdAt: toIsoOrDash(o?.date_created),
          updatedAt: toIsoOrDash(shipment?.last_updated ?? o?.last_updated),
          ageLabel: timeAgo(shipment?.last_updated ?? o?.last_updated ?? o?.date_created),
          buyerName: safeStr(o?.buyer?.nickname, "Comprador"),
          statusPill: safeStr(shipment?.status ?? o?.status),
          chip: `#${o.id}`,
          source: "shipment",
          claimId: null,
          orderId: o?.id ?? null,
          shipmentId,
          raw: {
            order: o,
            shipment,
          },
        };
      })
      .filter(Boolean);

    const items = [
      ...normalizedClaims,
      ...normalizedCancelledOrders,
      ...normalizedDelayedOrders,
    ];

    return NextResponse.json(
      {
        ok: true,
        sellerId,
        mlUserId,
        nickname,
        counts: {
          orders: orders.length,
          claimsAttempt1: claims1.length,
          claimsAttempt2: claims2.length,
          reclamacoes: items.filter((x: any) => x.type === "reclamacoes").length,
          mediacoes: items.filter((x: any) => x.type === "mediacoes").length,
          cancelamentos: items.filter((x: any) => x.type === "cancelamentos").length,
          atrasos: items.filter((x: any) => x.type === "atrasos").length,
          items: items.length,
        },
        items,
        debug: {
          ordersStatus: ordersRes.status,
          claims1Status: claimsRes1.status,
          claims2Status: claimsRes2.status,
          shipmentCount: shipmentIds.length,
          ordersUrl,
          claimsUrl1,
          claimsUrl2,
          ordersRaw: ordersJson,
          claimsRaw1: claimsJson1,
          claimsRaw2: claimsJson2,
        },
      },
      { status: 200 }
    );
  } catch (e: any) {
    console.error("[cases] erro =", e);

    return NextResponse.json(
      {
        ok: false,
        error: e?.message ?? "Erro inesperado",
      },
      { status: 500 }
    );
  }
}