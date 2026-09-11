import { NextRequest, NextResponse } from "next/server";
import { authErrorResponse, requireAdminRequest, supabaseApiAdmin } from "@/lib/apiAuth";
import { getValidMlAccessToken } from "@/lib/mlToken";

export const dynamic = "force-dynamic";

const ORDER_PAGE_SIZE = 50;
const DELAY_CONCURRENCY = 3;

type MlResponse = { ok: boolean; status: number; retryAfter: number; json: any };
type DelayRow = {
  orderId: string;
  shipmentId: string;
  service: string;
  serviceKind: "carrier" | "agency" | "collection" | "flex" | "other";
  expectedDispatchAt: string | null;
  shippedAt: string | null;
  impactType: string;
};

function asArray(value: any): any[] {
  if (Array.isArray(value)) return value;
  if (Array.isArray(value?.results)) return value.results;
  if (Array.isArray(value?.data)) return value.data;
  if (Array.isArray(value?.items)) return value.items;
  return [];
}

function delayPeriodDays(value: unknown) {
  const match = String(value ?? "").match(/(\d+)/);
  const days = match ? Number(match[1]) : 60;
  return Number.isFinite(days) && days > 0 ? Math.min(days, 365) : 60;
}

function normalizedDate(value: string | null) {
  if (!value) return "";
  return value.slice(0, 10);
}

function serviceFromShipment(shipment: any): Pick<DelayRow, "service" | "serviceKind"> {
  const logisticType = String(
    shipment?.logistic_type ?? shipment?.logistic?.type ?? shipment?.shipping_option?.logistic_type ?? ""
  ).toLowerCase();
  const shippingMode = String(shipment?.shipping_mode ?? shipment?.mode ?? "").toLowerCase();
  const carrier = String(
    shipment?.carrier_info?.name ?? shipment?.carrier_info?.carrier_name ?? shipment?.tracking?.carrier ?? ""
  ).trim();
  const serviceText = [
    logisticType,
    shipment?.shipping_option?.name,
    shipment?.shipping_option?.shipping_method,
    shipment?.shipping_option?.service_id,
  ].filter(Boolean).join(" ").toLowerCase();

  // A resposta pode identificar a modalidade pelo tipo legado ou pelo nome do
  // serviço. O carrier não é critério: envios ME2 também podem carregá-lo.
  if (/(xd_drop_off|places|agenc|agency|drop_off)/.test(serviceText)) {
    return { service: logisticType === "xd_drop_off" || serviceText.includes("places") ? "Agências Mercado Livre (Places)" : "Agências Mercado Livre", serviceKind: "agency" };
  }
  if (/(cross_docking|coleta|collection|xd_same_day)/.test(serviceText)) {
    return { service: "Coleta Mercado Livre", serviceKind: "collection" };
  }
  if (/(self_service|flex)/.test(serviceText)) return { service: "Flex", serviceKind: "flex" };
  if (shippingMode === "me1" || ["default", "custom"].includes(logisticType)) {
    return { service: carrier ? `Transportadora · ${carrier}` : "Transportadora", serviceKind: "carrier" };
  }
  if (logisticType === "fulfillment") return { service: "Full", serviceKind: "other" };
  return { service: logisticType ? logisticType : "Não identificado", serviceKind: "other" };
}

function impactType(serviceKind: DelayRow["serviceKind"], expectedDispatchAt: string | null, shippedAt: string | null) {
  if (serviceKind === "carrier") return "Sistema Correios";
  const expectedDay = normalizedDate(expectedDispatchAt);
  const shippedDay = normalizedDate(shippedAt);
  if (serviceKind === "agency" && expectedDay && shippedDay && expectedDay === shippedDay) return "Bipagem Tardia";
  if (["agency", "collection", "flex"].includes(serviceKind) && expectedDay && shippedDay && expectedDay !== shippedDay) {
    return "Instabilidade NFe";
  }
  return "Sem regra definida";
}

function expectedDispatchAt(sla: any) {
  const value = sla?.expected_date ?? sla?.deadline ?? sla?.handling?.expected_date ?? null;
  return value ? String(value) : null;
}

async function mlFetch(url: string, accessToken: string, extraHeaders?: HeadersInit): Promise<MlResponse> {
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}`, "x-format-new": "true", ...(extraHeaders ?? {}) },
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

async function mlFetchWithRetry(url: string, accessToken: string) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const response = await mlFetch(url, accessToken);
    if (response.status !== 429 || attempt === 2) return response;
    await wait(Math.max(750, response.retryAfter * 1000));
  }
  throw new Error("Falha inesperada ao consultar o Mercado Livre.");
}

async function mapWithConcurrency<T, R>(values: T[], fn: (value: T) => Promise<R>) {
  const results: R[] = [];
  let next = 0;
  const workers = Array.from({ length: Math.min(DELAY_CONCURRENCY, values.length) }, async () => {
    while (next < values.length) {
      const index = next++;
      results[index] = await fn(values[index]);
    }
  });
  await Promise.all(workers);
  return results;
}

export async function GET(req: NextRequest) {
  const auth = await requireAdminRequest(req);
  if (!auth.ok) return authErrorResponse(auth);

  try {
    const sellerId = req.nextUrl.searchParams.get("sellerId")?.trim();
    const expectedFrom = req.nextUrl.searchParams.get("expectedFrom")?.trim() ?? "";
    const expectedTo = req.nextUrl.searchParams.get("expectedTo")?.trim() ?? "";
    if (!sellerId) return NextResponse.json({ ok: false, error: "Selecione um seller." }, { status: 400 });

    const { data: account, error: accountError } = await supabaseApiAdmin
      .from("seller_accounts")
      .select("seller_id,nickname,ml_user_id")
      .eq("seller_id", sellerId)
      .maybeSingle();
    if (accountError || !account) return NextResponse.json({ ok: false, error: "Seller não encontrado." }, { status: 404 });

    const { accessToken } = await getValidMlAccessToken(sellerId);
    const me = await mlFetch("https://api.mercadolibre.com/users/me", accessToken);
    if (!me.ok || !me.json?.id) throw new Error("Não foi possível identificar o seller no Mercado Livre.");

    const delayMetric = me.json?.seller_reputation?.metrics?.delayed_handling_time ?? {};
    const expectedImpactCount = Number(delayMetric?.value ?? 0) || 0;
    const periodDays = delayPeriodDays(delayMetric?.period ?? me.json?.seller_reputation?.metrics?.sales?.period);
    if (expectedImpactCount <= 0) {
      return NextResponse.json({
        ok: true, items: [], seller: { id: sellerId, name: account.nickname ?? me.json?.nickname ?? "Seller" },
        expectedImpactCount, periodDays, ordersScanned: 0, shipmentsChecked: 0, complete: true,
      }, { headers: { "Cache-Control": "no-store" } });
    }

    const now = new Date();
    const from = new Date(now.getTime() - periodDays * 24 * 60 * 60 * 1000);
    const paramsBase = new URLSearchParams({
      seller: String(me.json.id),
      limit: String(ORDER_PAGE_SIZE),
      sort: "date_desc",
      "order.date_created.from": from.toISOString(),
      "order.date_created.to": now.toISOString(),
    });

    const orders: any[] = [];
    const delayedShipments = new Map<string, { shipment: any; sla: any }>();
    const checkedShipmentIds = new Set<string>();
    let offset = 0;
    let total = Number.POSITIVE_INFINITY;
    let ordersScanned = 0;
    let shipmentChecksUnavailable = 0;
    let matchedOrderCount = 0;

    while (offset < total && matchedOrderCount < expectedImpactCount) {
      const params = new URLSearchParams(paramsBase);
      params.set("offset", String(offset));
      const page = await mlFetchWithRetry(`https://api.mercadolibre.com/orders/search?${params.toString()}`, accessToken);
      if (!page.ok) throw new Error("O Mercado Livre não disponibilizou os pedidos para conferência dos atrasos.");
      const pageOrders = asArray(page.json);
      total = Number(page.json?.paging?.total ?? 0);
      ordersScanned += pageOrders.length;
      if (!pageOrders.length) break;

      const newShipmentIds = Array.from(new Set(pageOrders
        .map((order: any) => order?.shipping?.id ? String(order.shipping.id) : "")
        .filter((shipmentId: string) => shipmentId && !checkedShipmentIds.has(shipmentId))));
      newShipmentIds.forEach((shipmentId) => checkedShipmentIds.add(shipmentId));

      const checks = await mapWithConcurrency(newShipmentIds, async (shipmentId) => {
        const delays = await mlFetchWithRetry(`https://api.mercadolibre.com/shipments/${encodeURIComponent(shipmentId)}/delays`, accessToken);
        if (delays.status === 404) return { shipmentId, delayed: false, unavailable: false, shipment: null, sla: null };
        if (!delays.ok) return { shipmentId, delayed: false, unavailable: true, shipment: null, sla: null };
        const [shipment, sla] = await Promise.all([
          mlFetchWithRetry(`https://api.mercadolibre.com/shipments/${encodeURIComponent(shipmentId)}`, accessToken),
          mlFetchWithRetry(`https://api.mercadolibre.com/shipments/${encodeURIComponent(shipmentId)}/sla`, accessToken),
        ]);
        return { shipmentId, delayed: true, unavailable: !shipment.ok || !sla.ok, shipment: shipment.ok ? shipment.json : null, sla: sla.ok ? sla.json : null };
      });
      shipmentChecksUnavailable += checks.filter((check) => check.unavailable).length;
      for (const check of checks) if (check.delayed && check.shipment) delayedShipments.set(check.shipmentId, { shipment: check.shipment, sla: check.sla });

      orders.push(...pageOrders);
      matchedOrderCount = orders.filter((order) => delayedShipments.has(String(order?.shipping?.id ?? ""))).length;
      if (matchedOrderCount >= expectedImpactCount || pageOrders.length < ORDER_PAGE_SIZE) break;
      offset += ORDER_PAGE_SIZE;
    }

    const seenOrders = new Set<string>();
    const items: DelayRow[] = orders.flatMap((order) => {
      const orderId = String(order?.id ?? "");
      const shipmentId = String(order?.shipping?.id ?? "");
      if (!orderId || seenOrders.has(orderId)) return [];
      seenOrders.add(orderId);
      const delayed = delayedShipments.get(shipmentId);
      if (!delayed) return [];
      const serviceData = serviceFromShipment(delayed.shipment);
      const expected = expectedDispatchAt(delayed.sla);
      const shipped = delayed.shipment?.date_shipped ? String(delayed.shipment.date_shipped) : null;
      if (expectedFrom && normalizedDate(expected) < expectedFrom) return [];
      if (expectedTo && normalizedDate(expected) > expectedTo) return [];
      return [{ orderId, shipmentId, ...serviceData, expectedDispatchAt: expected, shippedAt: shipped, impactType: impactType(serviceData.serviceKind, expected, shipped) }];
    }).sort((a, b) => (a.expectedDispatchAt ?? "9999").localeCompare(b.expectedDispatchAt ?? "9999") || a.orderId.localeCompare(b.orderId));

    return NextResponse.json({
      ok: true,
      items,
      seller: { id: sellerId, name: account.nickname ?? me.json?.nickname ?? "Seller" },
      expectedImpactCount,
      periodDays,
      ordersScanned,
      shipmentsChecked: checkedShipmentIds.size,
      shipmentChecksUnavailable,
      complete: matchedOrderCount >= expectedImpactCount,
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error?.message ?? "Não foi possível montar o relatório de atrasos." }, { status: 500 });
  }
}
