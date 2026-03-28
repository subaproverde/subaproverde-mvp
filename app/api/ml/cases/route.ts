import { NextRequest, NextResponse } from "next/server";
import { getValidMlAccessToken } from "@/lib/mlToken";

function asArray<T = any>(value: any): T[] {
  if (Array.isArray(value)) return value;
  if (Array.isArray(value?.results)) return value.results;
  if (Array.isArray(value?.data)) return value.data;
  if (Array.isArray(value?.items)) return value.items;
  return [];
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

    // 1) mesmo fluxo que já funciona no /app
    const { accessToken } = await getValidMlAccessToken(sellerId);

    const meRes = await fetch("https://api.mercadolibre.com/users/me", {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: "no-store",
    });

    const meJson = await meRes.json().catch(() => null);

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

    // 2) pedidos (oficial)
    const ordersUrl = `https://api.mercadolibre.com/orders/search?seller=${encodeURIComponent(
      mlUserId
    )}&limit=50&sort=date_desc`;

    const ordersRes = await fetch(ordersUrl, {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: "no-store",
    });

    const ordersJson = await ordersRes.json().catch(() => null);

    console.log("[cases] /orders/search status =", ordersRes.status);
    console.log("[cases] /orders/search body =", ordersJson);

    const orders = asArray(ordersJson);

    // 3) claims (tentativa 1)
    const claimsUrl1 = `https://api.mercadolibre.com/post-purchase/v1/claims/search?seller_id=${encodeURIComponent(
      mlUserId
    )}`;

    const claimsRes1 = await fetch(claimsUrl1, {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: "no-store",
    });

    const claimsJson1 = await claimsRes1.json().catch(() => null);

    console.log("[cases] claims attempt 1 status =", claimsRes1.status);
    console.log("[cases] claims attempt 1 body =", claimsJson1);

    const claims1 = asArray(claimsJson1);

    // 4) claims (tentativa 2, caso a API retorne diferente)
    const claimsUrl2 = `https://api.mercadolibre.com/post-purchase/v1/claims/search?stage=claim&limit=50`;

    const claimsRes2 = await fetch(claimsUrl2, {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: "no-store",
    });

    const claimsJson2 = await claimsRes2.json().catch(() => null);

    console.log("[cases] claims attempt 2 status =", claimsRes2.status);
    console.log("[cases] claims attempt 2 body =", claimsJson2);

    const claims2 = asArray(claimsJson2);

    const claims = claims1.length > 0 ? claims1 : claims2;

    // 5) normalização mínima, sem inventar demais
    const normalizedOrders = orders.map((o: any) => ({
      id: `order-${o.id}`,
      type:
        o.status === "cancelled"
          ? "cancelamentos"
          : "atrasos",
      title: o.order_items?.[0]?.item?.title ?? "Pedido",
      reason: `Pedido ${o.status ?? "-"}`,
      createdAt: o.date_created ?? "—",
      updatedAt: o.last_updated ?? "—",
      ageLabel: "pedido",
      buyerName: o.buyer?.nickname ?? "Comprador",
      statusPill: o.status ?? "—",
      chip: `#${o.id}`,
      raw: o,
    }));

    const normalizedClaims = claims.map((c: any) => ({
      id: `claim-${c.id ?? c.resource_id ?? Math.random().toString(36).slice(2)}`,
      type: "reclamacoes",
      title: c.reason ?? c.type ?? "Reclamação",
      reason: c.description ?? c.status ?? "—",
      createdAt: c.date_created ?? "—",
      updatedAt: c.last_updated ?? "—",
      ageLabel: "claim",
      buyerName: c.buyer?.nickname ?? "Comprador",
      statusPill: c.status ?? "—",
      chip: c.id ? `#${c.id}` : undefined,
      raw: c,
    }));

    const items = [...normalizedClaims, ...normalizedOrders];

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
          items: items.length,
        },
        items,
        debug: {
          ordersStatus: ordersRes.status,
          claims1Status: claimsRes1.status,
          claims2Status: claimsRes2.status,
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