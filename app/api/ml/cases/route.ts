import { NextRequest, NextResponse } from "next/server";
import { getValidMlAccessToken } from "@/lib/mlToken";

type ImpactType = "reclamacoes" | "atrasos" | "cancelamentos" | "mediacoes";
type CaseStatus = "open" | "closed" | "unknown";
type ReputationImpact = "impacting" | "not_impacting" | "unknown";
type RemovalEligibility = "eligible" | "not_eligible" | "unknown";
type LogisticKey =
  | "flex"
  | "agencia_ml"
  | "correios"
  | "places"
  | "mercado_envios"
  | "outro";

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

function safeNum(v: any, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
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
    raw.includes("mediação") ||
    raw.includes("mediaciones") ||
    raw.includes("mediations") ||
    raw.includes("dispute")
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

function valuesText(value: any, depth = 0): string {
  if (value === null || value === undefined || depth > 4) return "";
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  if (Array.isArray(value)) {
    return value.slice(0, 30).map((item) => valuesText(item, depth + 1)).join(" ");
  }
  if (typeof value === "object") {
    return Object.values(value)
      .slice(0, 80)
      .map((item) => valuesText(item, depth + 1))
      .join(" ");
  }
  return "";
}

function keysAndValuesText(value: any, depth = 0): string {
  if (value === null || value === undefined || depth > 4) return "";
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  if (Array.isArray(value)) {
    return value.slice(0, 30).map((item) => keysAndValuesText(item, depth + 1)).join(" ");
  }
  if (typeof value === "object") {
    return Object.entries(value)
      .slice(0, 80)
      .map(([key, item]) => `${key} ${keysAndValuesText(item, depth + 1)}`)
      .join(" ");
  }
  return "";
}

function hasAny(text: string, needles: string[]) {
  return needles.some((needle) => text.includes(needle));
}

function inferCaseStatus(...sources: any[]): CaseStatus {
  const raw = valuesText(sources).toLowerCase();

  if (
    hasAny(raw, [
      "closed",
      "close",
      "resolved",
      "resolution",
      "finished",
      "finalized",
      "cancelled",
      "canceled",
      "encerr",
      "finaliz",
      "resolvid",
      "fechad",
    ])
  ) {
    return "closed";
  }

  if (
    hasAny(raw, [
      "opened",
      "open",
      "pending",
      "active",
      "in_progress",
      "in progress",
      "claim",
      "dispute",
      "mediation",
      "mediacion",
      "mediacao",
      "mediação",
      "reopened",
      "waiting",
      "aguard",
      "abert",
      "andamento",
    ])
  ) {
    return "open";
  }

  return "unknown";
}

function inferShipmentStatus(shipment: any, order: any): CaseStatus {
  const raw = valuesText([
    shipment?.status,
    shipment?.substatus,
    shipment?.tracking_status,
    shipment?.tracking?.status,
    order?.status,
  ]).toLowerCase();

  if (hasAny(raw, ["delivered", "cancelled", "canceled", "not_delivered", "returned"])) {
    return "closed";
  }

  if (
    hasAny(raw, [
      "ready_to_ship",
      "handling",
      "pending",
      "shipped",
      "delay",
      "late",
      "atras",
      "demora",
    ])
  ) {
    return "open";
  }

  return "unknown";
}

function inferReputationImpact(source: any, fallback: ReputationImpact = "unknown"): ReputationImpact {
  const raw = keysAndValuesText(source).toLowerCase();

  if (
    hasAny(raw, [
      "does_not_impact",
      "not_impact",
      "not impact",
      "not_affect",
      "not affect",
      "not affected",
      "protected",
      "excluded",
      "exclusion",
      "sem impacto",
      "nao impact",
      "não impact",
      "nao afeta",
      "não afeta",
    ])
  ) {
    return "not_impacting";
  }

  if (
    hasAny(raw, [
      "affects_reputation",
      "affected_reputation",
      "reputation_impact",
      "impacting",
      "impact",
      "impacto",
      "reputation",
      "reputacao",
      "reputação",
      "claim_rate",
      "delayed_handling_time",
      "cancellations",
    ])
  ) {
    return "impacting";
  }

  return fallback;
}

function inferRemovalEligibility(
  source: any,
  impact: ReputationImpact,
  fallback: RemovalEligibility = "unknown"
): RemovalEligibility {
  const raw = keysAndValuesText(source).toLowerCase();

  if (
    hasAny(raw, [
      "not_removable",
      "cannot_remove",
      "not_eligible",
      "not eligible",
      "sem remoc",
      "sem remoç",
      "nao remov",
      "não remov",
    ])
  ) {
    return "not_eligible";
  }

  if (
    hasAny(raw, [
      "can_be_removed",
      "removable",
      "removal",
      "remove",
      "remoc",
      "remoç",
      "appeal",
      "challenge",
      "defense",
      "defesa",
    ])
  ) {
    return "eligible";
  }

  if (impact === "not_impacting") return "not_eligible";
  if (impact === "impacting") return "eligible";

  return fallback;
}

function normalizeLogistic(order: any, shipment: any): { key: LogisticKey; label: string } {
  const raw = valuesText([
    shipment?.logistic_type,
    shipment?.shipping_mode,
    shipment?.tracking_method,
    shipment?.tracking?.method,
    shipment?.tracking?.carrier,
    shipment?.carrier_info,
    order?.shipping?.logistic_type,
    order?.shipping?.mode,
    order?.shipping?.tags,
    order?.tags,
  ]).toLowerCase();

  if (hasAny(raw, ["self_service", "self service", "flex"])) {
    return { key: "flex", label: "Flex" };
  }

  if (hasAny(raw, ["places", "mercado envios places", "meli places"])) {
    return { key: "places", label: "Places" };
  }

  if (hasAny(raw, ["correios", "postal", "mail", "me1"])) {
    return { key: "correios", label: "Correios" };
  }

  if (hasAny(raw, ["xd_drop_off", "drop_off", "drop off", "agency", "agencia", "agência"])) {
    return { key: "agencia_ml", label: "Agência Mercado Livre" };
  }

  if (hasAny(raw, ["me2", "mercado envios", "fulfillment", "cross_docking", "cross docking"])) {
    return { key: "mercado_envios", label: "Mercado Envios" };
  }

  return { key: "outro", label: raw ? "Outro" : "Não identificado" };
}

function dedupeById(items: any[]) {
  const seen = new Set<string>();
  const result: any[] = [];

  for (const item of items) {
    const key = String(item?.id ?? item?.resource_id ?? JSON.stringify(item).slice(0, 80));
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(item);
  }

  return result;
}

function countFilterOptions(items: any[]) {
  return {
    status: {
      all: items.length,
      open: items.filter((x) => x.statusGroup === "open").length,
      closed: items.filter((x) => x.statusGroup === "closed").length,
      unknown: items.filter((x) => x.statusGroup === "unknown").length,
    },
    impact: {
      all: items.length,
      impacting: items.filter((x) => x.reputationImpact === "impacting").length,
      not_impacting: items.filter((x) => x.reputationImpact === "not_impacting").length,
      unknown: items.filter((x) => x.reputationImpact === "unknown").length,
    },
    removal: {
      eligible: items.filter((x) => x.removalEligible === "eligible").length,
      not_eligible: items.filter((x) => x.removalEligible === "not_eligible").length,
      unknown: items.filter((x) => x.removalEligible === "unknown").length,
    },
    logistics: {
      all: items.length,
      flex: items.filter((x) => x.logisticKey === "flex").length,
      agencia_ml: items.filter((x) => x.logisticKey === "agencia_ml").length,
      correios: items.filter((x) => x.logisticKey === "correios").length,
      places: items.filter((x) => x.logisticKey === "places").length,
      mercado_envios: items.filter((x) => x.logisticKey === "mercado_envios").length,
      outro: items.filter((x) => x.logisticKey === "outro").length,
    },
  };
}

async function fetchJson(url: string, accessToken: string) {
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });

  const json = await res.json().catch(() => null);
  return { res, json };
}

function normalizeBuyer(order: any) {
  return {
    buyerNickname: safeStr(order?.buyer?.nickname, "Comprador"),
    buyerFirstName: safeStr(order?.buyer?.first_name, "—"),
    buyerLastName: safeStr(order?.buyer?.last_name, "—"),
    buyerPhone: safeStr(
      order?.buyer?.phone?.number ?? order?.buyer?.billing_info?.doc_number,
      "—"
    ),
    buyerEmail: safeStr(order?.buyer?.email, "—"),
  };
}

function normalizeItem(order: any) {
  const orderItem = order?.order_items?.[0] ?? {};
  const item = orderItem?.item ?? {};

  return {
    itemTitle: safeStr(item?.title, "—"),
    itemId: item?.id ? String(item.id) : null,
    variationId: item?.variation_id ? String(item.variation_id) : null,
    quantity: safeNum(orderItem?.quantity, 0),
    unitPrice: safeNum(orderItem?.unit_price, 0),
    currencyId: safeStr(order?.currency_id, "—"),
    thumbnail: safeStr(item?.thumbnail, "—"),
  };
}

function normalizeShipment(shipment: any) {
  return {
    shippingStatus: safeStr(shipment?.status, "—"),
    shippingSubstatus: safeStr(shipment?.substatus, "—"),
    shippingMode: safeStr(shipment?.shipping_mode, "—"),
    logisticType: safeStr(shipment?.logistic_type, "—"),
    trackingNumber: safeStr(
      shipment?.tracking_number ?? shipment?.tracking?.id,
      "—"
    ),
    dateDelivered: toIsoOrDash(
      shipment?.date_delivered ?? shipment?.tracking?.date_delivered
    ),
    dateEstimatedDelivery: toIsoOrDash(
      shipment?.estimated_delivery_time?.date ??
        shipment?.estimated_delivery_limit?.date
    ),
    dateShipped: toIsoOrDash(shipment?.date_shipped),
  };
}

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const page = Math.max(1, Number(url.searchParams.get("page") ?? 1));
    const limit = Math.max(1, Number(url.searchParams.get("limit") ?? 10));
    const requestedType = url.searchParams.get("type") as ImpactType | null;
    const statusFilter = url.searchParams.get("statusFilter") ?? "all";
    const impactFilter = url.searchParams.get("impactFilter") ?? "all";
    const logisticFilter = url.searchParams.get("logisticFilter") ?? "all";

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
    const nickname = meJson?.nickname ?? null;

    const officialClaimsCount = Number(
      meJson?.seller_reputation?.metrics?.claims?.value ?? 0
    );

    const officialDelayCount = Number(
      meJson?.seller_reputation?.metrics?.delayed_handling_time?.value ?? 0
    );

    const officialCancelCount = Number(
      meJson?.seller_reputation?.metrics?.cancellations?.value ?? 0
    );

    const ordersUrl = `https://api.mercadolibre.com/orders/search?seller=${encodeURIComponent(
      mlUserId
    )}&limit=50&sort=date_desc`;

    const { res: ordersRes, json: ordersJson } = await fetchJson(
      ordersUrl,
      accessToken
    );

    const orders = asArray(ordersJson);

    const claimsParams = new URLSearchParams({
      limit: "50",
      offset: "0",
      site_id: "MLB",
      player_role: "respondent",
      player_user_id: mlUserId,
    });

    const claimsUrl1 = `https://api.mercadolibre.com/post-purchase/v1/claims/search?${claimsParams.toString()}`;

    const { res: claimsRes1, json: claimsJson1 } = await fetchJson(
      claimsUrl1,
      accessToken
    );

    const claims1 = asArray(claimsJson1);

    const mediationParams = new URLSearchParams(claimsParams);
    mediationParams.set("stage", "dispute");

    const claimsUrl2 = `https://api.mercadolibre.com/post-purchase/v1/claims/search?${mediationParams.toString()}`;

    const { res: claimsRes2, json: claimsJson2 } = await fetchJson(
      claimsUrl2,
      accessToken
    );

    const claims2 = asArray(claimsJson2);

    const claims = dedupeById([...claims1, ...claims2]);

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
        return [String(shipmentId), res.ok ? json : null] as const;
      })
    );

    const shipmentMap = new Map<string, any>(shipmentEntries);

    const orderMap = new Map<string, any>(
      orders.map((o: any) => [String(o.id), o])
    );

    const normalizedClaims = claims.map((c: any) => {
      const type = claimTypeOf(c);
      const orderId =
        c?.resource_id ?? c?.order_id ?? c?.resource?.id ?? null;

      const order = orderId ? orderMap.get(String(orderId)) : null;
      const shipmentId = order?.shipping?.id ? String(order.shipping.id) : null;
      const shipment = shipmentId ? shipmentMap.get(shipmentId) : null;

      const buyer = normalizeBuyer(order ?? {});
      const item = normalizeItem(order ?? {});
      const shipping = normalizeShipment(shipment ?? {});
      const logistics = normalizeLogistic(order ?? {}, shipment ?? {});
      const statusGroup = inferCaseStatus(c?.status, c?.stage, c?.resolution, order?.status);
      const reputationImpact = inferReputationImpact({ claim: c, order }, "unknown");
      const removalEligible = inferRemovalEligibility({ claim: c, order }, reputationImpact);

      return {
        id: `claim-${c.id ?? c.resource_id ?? Math.random().toString(36).slice(2)}`,
        type,
        title: safeStr(c?.reason ?? c?.type ?? "Reclamação"),
        reason: safeStr(c?.description ?? c?.status),
        createdAt: toIsoOrDash(c?.date_created),
        updatedAt: toIsoOrDash(c?.last_updated),
        ageLabel: timeAgo(c?.last_updated ?? c?.date_created),
        buyerName: buyer.buyerNickname,
        statusPill: safeStr(c?.status),
        statusGroup,
        reputationImpact,
        removalEligible,
        logisticKey: logistics.key,
        logisticType: logistics.label,
        chip: c?.id ? `#${c.id}` : undefined,
        source: "claim",
        claimId: c?.id ? String(c.id) : null,
        orderId: orderId ? String(orderId) : null,
        shipmentId,
        itemTitle: item.itemTitle,
        itemId: item.itemId,
        variationId: item.variationId,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        currencyId: item.currencyId,
        thumbnail: item.thumbnail,
        buyerNickname: buyer.buyerNickname,
        buyerFirstName: buyer.buyerFirstName,
        buyerLastName: buyer.buyerLastName,
        buyerPhone: buyer.buyerPhone,
        buyerEmail: buyer.buyerEmail,
        orderStatus: safeStr(order?.status, "—"),
        packId: order?.pack_id ? String(order.pack_id) : null,
        shippingMode: shipping.shippingMode,
        shippingLogisticType: shipping.logisticType,
        trackingNumber: shipping.trackingNumber,
        shippingStatus: shipping.shippingStatus,
        shippingSubstatus: shipping.shippingSubstatus,
        dateDelivered: shipping.dateDelivered,
        dateEstimatedDelivery: shipping.dateEstimatedDelivery,
        dateShipped: shipping.dateShipped,
        raw: c,
      };
    });

    const normalizedCancelledOrders = orders
      .filter((o: any) => orderIsCancelled(o))
      .map((o: any, index: number) => {
        const shipmentId = o?.shipping?.id ? String(o.shipping.id) : null;
        const shipment = shipmentId ? shipmentMap.get(shipmentId) : null;

        const buyer = normalizeBuyer(o);
        const item = normalizeItem(o);
        const shipping = normalizeShipment(shipment ?? {});
        const logistics = normalizeLogistic(o, shipment ?? {});
        const reputationImpact = inferReputationImpact(
          { order: o, shipment },
          index < officialCancelCount ? "impacting" : "unknown"
        );
        const removalEligible = inferRemovalEligibility(
          { order: o, shipment },
          reputationImpact
        );

        return {
          id: `order-cancel-${o.id}`,
          type: "cancelamentos" as ImpactType,
          title: item.itemTitle !== "—" ? item.itemTitle : "Pedido cancelado",
          reason: `Pedido ${safeStr(o?.status)}`,
          createdAt: toIsoOrDash(o?.date_created),
          updatedAt: toIsoOrDash(o?.last_updated),
          ageLabel: timeAgo(o?.last_updated ?? o?.date_created),
          buyerName: buyer.buyerNickname,
          statusPill: safeStr(o?.status),
          statusGroup: "closed" as CaseStatus,
          reputationImpact,
          removalEligible,
          logisticKey: logistics.key,
          logisticType: logistics.label,
          chip: `#${o.id}`,
          source: "order",
          claimId: null,
          orderId: String(o?.id ?? ""),
          shipmentId,
          itemTitle: item.itemTitle,
          itemId: item.itemId,
          variationId: item.variationId,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          currencyId: item.currencyId,
          thumbnail: item.thumbnail,
          buyerNickname: buyer.buyerNickname,
          buyerFirstName: buyer.buyerFirstName,
          buyerLastName: buyer.buyerLastName,
          buyerPhone: buyer.buyerPhone,
          buyerEmail: buyer.buyerEmail,
          orderStatus: safeStr(o?.status, "—"),
          packId: o?.pack_id ? String(o.pack_id) : null,
          shippingMode: shipping.shippingMode,
          shippingLogisticType: shipping.logisticType,
          trackingNumber: shipping.trackingNumber,
          shippingStatus: shipping.shippingStatus,
          shippingSubstatus: shipping.shippingSubstatus,
          dateDelivered: shipping.dateDelivered,
          dateEstimatedDelivery: shipping.dateEstimatedDelivery,
          dateShipped: shipping.dateShipped,
          raw: o,
        };
      });

    const normalizedDelayedOrders = orders
      .map((o: any, index: number) => {
        const shipmentId = o?.shipping?.id ? String(o.shipping.id) : null;
        const shipment = shipmentId ? shipmentMap.get(shipmentId) : null;

        if (!shipment || !shipmentLooksDelayed(shipment)) return null;

        const buyer = normalizeBuyer(o);
        const item = normalizeItem(o);
        const shipping = normalizeShipment(shipment);
        const logistics = normalizeLogistic(o, shipment);
        const reputationImpact = inferReputationImpact(
          { order: o, shipment },
          index < officialDelayCount ? "impacting" : "unknown"
        );
        const removalEligible = inferRemovalEligibility(
          { order: o, shipment },
          reputationImpact
        );

        return {
          id: `order-delay-${o.id}`,
          type: "atrasos" as ImpactType,
          title: item.itemTitle !== "—" ? item.itemTitle : "Pedido com atraso",
          reason: `Envio ${safeStr(shipment?.status)}${
            shipment?.substatus ? ` / ${shipment.substatus}` : ""
          }`,
          createdAt: toIsoOrDash(o?.date_created),
          updatedAt: toIsoOrDash(shipment?.last_updated ?? o?.last_updated),
          ageLabel: timeAgo(
            shipment?.last_updated ?? o?.last_updated ?? o?.date_created
          ),
          buyerName: buyer.buyerNickname,
          statusPill: safeStr(shipment?.status ?? o?.status),
          statusGroup: inferShipmentStatus(shipment, o),
          reputationImpact,
          removalEligible,
          logisticKey: logistics.key,
          logisticType: logistics.label,
          chip: `#${o.id}`,
          source: "shipment",
          claimId: null,
          orderId: String(o?.id ?? ""),
          shipmentId,
          itemTitle: item.itemTitle,
          itemId: item.itemId,
          variationId: item.variationId,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          currencyId: item.currencyId,
          thumbnail: item.thumbnail,
          buyerNickname: buyer.buyerNickname,
          buyerFirstName: buyer.buyerFirstName,
          buyerLastName: buyer.buyerLastName,
          buyerPhone: buyer.buyerPhone,
          buyerEmail: buyer.buyerEmail,
          orderStatus: safeStr(o?.status, "—"),
          packId: o?.pack_id ? String(o.pack_id) : null,
          shippingMode: shipping.shippingMode,
          shippingLogisticType: shipping.logisticType,
          trackingNumber: shipping.trackingNumber,
          shippingStatus: shipping.shippingStatus,
          shippingSubstatus: shipping.shippingSubstatus,
          dateDelivered: shipping.dateDelivered,
          dateEstimatedDelivery: shipping.dateEstimatedDelivery,
          dateShipped: shipping.dateShipped,
          raw: {
            order: o,
            shipment,
          },
        };
      })
      .filter(Boolean);

    const missingDelayCount = Math.max(
      0,
      officialDelayCount - normalizedDelayedOrders.length
    );

    const fallbackDelayedItems =
      missingDelayCount > 0
        ? Array.from({ length: missingDelayCount }).map((_, i) => ({
            id: `delay-metric-${i + 1}`,
            type: "atrasos" as ImpactType,
            title: "Atraso impactando reputação",
            reason:
              "Item vindo da métrica oficial do Mercado Livre (delayed_handling_time).",
            createdAt: "—",
            updatedAt: "—",
            ageLabel: "métrica ML",
            buyerName: "Comprador",
            statusPill: "impactando",
            statusGroup: "unknown" as CaseStatus,
            reputationImpact: "impacting" as ReputationImpact,
            removalEligible: "eligible" as RemovalEligibility,
            logisticKey: "outro" as LogisticKey,
            logisticType: "Não identificado",
            chip: `ML-${i + 1}`,
            source: "metric",
            claimId: null,
            orderId: null,
            shipmentId: null,
            itemTitle: "—",
            itemId: null,
            variationId: null,
            quantity: 0,
            unitPrice: 0,
            currencyId: "—",
            thumbnail: "—",
            buyerNickname: "Comprador",
            buyerFirstName: "—",
            buyerLastName: "—",
            buyerPhone: "—",
            buyerEmail: "—",
            orderStatus: "—",
            packId: null,
            shippingMode: "—",
            shippingLogisticType: "—",
            trackingNumber: "—",
            shippingStatus: "impactando",
            shippingSubstatus: "—",
            dateDelivered: "—",
            dateEstimatedDelivery: "—",
            dateShipped: "—",
            raw: {
              metric: "delayed_handling_time",
              officialDelayCount,
            },
          }))
        : [];

    const detectedClaimCount = normalizedClaims.filter(
      (item: any) => item.type === "reclamacoes"
    ).length;
    const missingClaimCount = Math.max(0, officialClaimsCount - detectedClaimCount);
    const fallbackClaimItems =
      missingClaimCount > 0
        ? Array.from({ length: missingClaimCount }).map((_, i) => ({
            id: `claim-metric-${i + 1}`,
            type: "reclamacoes" as ImpactType,
            title: "Reclamação impactando reputação",
            reason: "Item vindo da métrica oficial do Mercado Livre (claims).",
            createdAt: "—",
            updatedAt: "—",
            ageLabel: "métrica ML",
            buyerName: "Comprador",
            statusPill: "impactando",
            statusGroup: "unknown" as CaseStatus,
            reputationImpact: "impacting" as ReputationImpact,
            removalEligible: "eligible" as RemovalEligibility,
            logisticKey: "outro" as LogisticKey,
            logisticType: "Não identificado",
            chip: `ML-C${i + 1}`,
            source: "metric",
            claimId: null,
            orderId: null,
            shipmentId: null,
            itemTitle: "—",
            itemId: null,
            variationId: null,
            quantity: 0,
            unitPrice: 0,
            currencyId: "—",
            thumbnail: "—",
            buyerNickname: "Comprador",
            buyerFirstName: "—",
            buyerLastName: "—",
            buyerPhone: "—",
            buyerEmail: "—",
            orderStatus: "—",
            packId: null,
            shippingMode: "—",
            shippingLogisticType: "—",
            trackingNumber: "—",
            shippingStatus: "impactando",
            shippingSubstatus: "—",
            dateDelivered: "—",
            dateEstimatedDelivery: "—",
            dateShipped: "—",
            raw: {
              metric: "claims",
              officialClaimsCount,
            },
          }))
        : [];

    const missingCancelCount = Math.max(
      0,
      officialCancelCount - normalizedCancelledOrders.length
    );
    const fallbackCancelItems =
      missingCancelCount > 0
        ? Array.from({ length: missingCancelCount }).map((_, i) => ({
            id: `cancel-metric-${i + 1}`,
            type: "cancelamentos" as ImpactType,
            title: "Cancelamento impactando reputação",
            reason: "Item vindo da métrica oficial do Mercado Livre (cancellations).",
            createdAt: "—",
            updatedAt: "—",
            ageLabel: "métrica ML",
            buyerName: "Comprador",
            statusPill: "impactando",
            statusGroup: "unknown" as CaseStatus,
            reputationImpact: "impacting" as ReputationImpact,
            removalEligible: "eligible" as RemovalEligibility,
            logisticKey: "outro" as LogisticKey,
            logisticType: "Não identificado",
            chip: `ML-X${i + 1}`,
            source: "metric",
            claimId: null,
            orderId: null,
            shipmentId: null,
            itemTitle: "—",
            itemId: null,
            variationId: null,
            quantity: 0,
            unitPrice: 0,
            currencyId: "—",
            thumbnail: "—",
            buyerNickname: "Comprador",
            buyerFirstName: "—",
            buyerLastName: "—",
            buyerPhone: "—",
            buyerEmail: "—",
            orderStatus: "—",
            packId: null,
            shippingMode: "—",
            shippingLogisticType: "—",
            trackingNumber: "—",
            shippingStatus: "impactando",
            shippingSubstatus: "—",
            dateDelivered: "—",
            dateEstimatedDelivery: "—",
            dateShipped: "—",
            raw: {
              metric: "cancellations",
              officialCancelCount,
            },
          }))
        : [];

    const items = [
      ...normalizedClaims,
      ...fallbackClaimItems,
      ...normalizedCancelledOrders,
      ...fallbackCancelItems,
      ...normalizedDelayedOrders,
      ...fallbackDelayedItems,
    ].filter(Boolean);

    const typeItems = requestedType
      ? items.filter((item: any) => item.type === requestedType)
      : items;

    const filterCounts = countFilterOptions(typeItems);

    const filteredItems = typeItems.filter((item: any) => {
      if (statusFilter !== "all" && item.statusGroup !== statusFilter) return false;
      if (impactFilter !== "all" && item.reputationImpact !== impactFilter) return false;
      if (
        requestedType === "atrasos" &&
        logisticFilter !== "all" &&
        item.logisticKey !== logisticFilter
      ) {
        return false;
      }
      return true;
    });

    const total = filteredItems.length;
    const totalPages = Math.max(1, Math.ceil(total / limit));

    const start = (page - 1) * limit;
    const end = start + limit;

    const pagedItems = filteredItems.slice(start, end);
    const detectedReclamacoes = items.filter((x: any) => x.type === "reclamacoes").length;
    const detectedMediacoes = items.filter((x: any) => x.type === "mediacoes").length;
    const detectedCancelamentos = items.filter((x: any) => x.type === "cancelamentos").length;
    const detectedAtrasos = items.filter((x: any) => x.type === "atrasos").length;

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
          reclamacoes: Math.max(officialClaimsCount, detectedReclamacoes),
          atrasos: Math.max(officialDelayCount, detectedAtrasos),
          cancelamentos: Math.max(officialCancelCount, detectedCancelamentos),
          mediacoes: detectedMediacoes,
          detectedReclamacoes,
          detectedMediacoes,
          detectedCancelamentos,
          detectedAtrasos,
          items: items.length,
        },
        filterCounts,
        page,
        limit,
        total,
        totalPages,
        items: pagedItems,
        debug: {
          ordersStatus: ordersRes.status,
          claims1Status: claimsRes1.status,
          claims2Status: claimsRes2.status,
          shipmentCount: shipmentIds.length,
          ordersUrl,
          claimsUrl1,
          claimsUrl2,
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
