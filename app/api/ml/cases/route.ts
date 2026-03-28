import { NextRequest, NextResponse } from "next/server";
import { getValidMlAccessToken } from "@/lib/mlToken";

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

    console.log("[cases] sellerId =", sellerId);

    // 🔑 pega token correto do seller
    const { accessToken } = await getValidMlAccessToken(sellerId);

    // ==============================
    // 🔥 1. BUSCAR RECLAMAÇÕES (CLAIMS)
    // ==============================
    const claimsRes = await fetch(
      "https://api.mercadolibre.com/post-purchase/v1/claims/search",
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    const claimsJson = await claimsRes.json().catch(() => ({}));

    console.log("[cases] claims =", claimsJson);

    const claims = claimsJson?.data ?? [];

    // ==============================
    // 🔥 2. BUSCAR PEDIDOS
    // ==============================
    const ordersRes = await fetch(
      `https://api.mercadolibre.com/orders/search?seller=${sellerId}&limit=50`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    const ordersJson = await ordersRes.json().catch(() => ({}));

    console.log("[cases] orders =", ordersJson);

    const orders = ordersJson?.results ?? [];

    // ==============================
    // 🔥 3. NORMALIZAR TUDO
    // ==============================

    const normalizedClaims = claims.map((c: any) => ({
      id: c.id,
      type: "reclamacoes",
      title: c.reason || "Reclamação",
      reason: c.description || c.reason || "",
      createdAt: c.date_created,
      updatedAt: c.last_updated,
      buyerName: c?.buyer?.nickname ?? "Comprador",
      statusPill: c.status,
      chip: `#${c.id}`,
    }));

    const normalizedOrders = orders.map((o: any) => ({
      id: `order-${o.id}`,
      type: "atrasos", // depois refinamos
      title: o.order_items?.[0]?.item?.title ?? "Pedido",
      reason: `Status: ${o.status}`,
      createdAt: o.date_created,
      updatedAt: o.last_updated,
      buyerName: o.buyer?.nickname ?? "Comprador",
      statusPill: o.status,
      chip: `#${o.id}`,
    }));

    const items = [...normalizedClaims, ...normalizedOrders];

    return NextResponse.json(
      {
        ok: true,
        items,
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