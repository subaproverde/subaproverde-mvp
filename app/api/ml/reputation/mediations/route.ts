import { NextRequest, NextResponse } from "next/server";
import { getValidMlAccessToken } from "@/lib/mlToken";

type MlUserMe = {
  id?: string | number | null;
  seller_reputation?: {
    metrics?: {
      sales?: {
        period?: string | null;
        completed?: number | string | null;
      };
    };
  };
};

type ClaimItem = {
  id?: string | number | null;
  stage?: string | null;
  status?: string | null;
  type?: string | null;
  date_created?: string | null;
  last_updated?: string | null;
};

function asObject(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function asArray(value: unknown): ClaimItem[] {
  if (Array.isArray(value)) return value as ClaimItem[];
  const obj = asObject(value);
  if (Array.isArray(obj.data)) return obj.data as ClaimItem[];
  if (Array.isArray(obj.results)) return obj.results as ClaimItem[];
  return [];
}

function numberValue(value: unknown) {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
}

function parsePeriodDays(period?: string | null) {
  const raw = String(period ?? "").toLowerCase();
  const match = raw.match(/(\d+)/);
  const value = match ? Number(match[1]) : 60;
  if (!Number.isFinite(value) || value <= 0) return 60;
  if (raw.includes("month")) return value * 30;
  if (raw.includes("day")) return value;
  return value;
}

function claimDate(item: ClaimItem) {
  const raw = item.date_created ?? item.last_updated ?? "";
  const timestamp = Date.parse(raw);
  return Number.isNaN(timestamp) ? 0 : timestamp;
}

function isMediationClaim(item: ClaimItem) {
  const type = String(item.type ?? "").toLowerCase();
  const stage = String(item.stage ?? "").toLowerCase();
  return type.includes("mediation") || type.includes("mediacao") || stage === "dispute";
}

async function fetchJson(url: string, accessToken: string) {
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });
  const json = await response.json().catch(() => null);
  return { response, json };
}

export async function GET(req: NextRequest) {
  const sellerId = req.nextUrl.searchParams.get("sellerId")?.trim();

  if (!sellerId) {
    return NextResponse.json({ ok: false, error: "sellerId obrigatório" }, { status: 400 });
  }

  try {
    const { accessToken } = await getValidMlAccessToken(sellerId);

    const { response: meResponse, json: meJson } = await fetchJson(
      "https://api.mercadolibre.com/users/me",
      accessToken
    );

    if (!meResponse.ok) {
      return NextResponse.json(
        { ok: false, error: "Erro ao chamar Mercado Livre /users/me", status: meResponse.status },
        { status: 502 }
      );
    }

    const me = meJson as MlUserMe;
    const mlUserId = me.id ? String(me.id) : "";

    if (!mlUserId) {
      return NextResponse.json(
        { ok: false, error: "Não foi possível identificar o mlUserId do seller" },
        { status: 502 }
      );
    }

    const salesMetric = me.seller_reputation?.metrics?.sales;
    const period = salesMetric?.period ?? "60 days";
    const periodDays = parsePeriodDays(period);
    const salesCompleted = numberValue(salesMetric?.completed);
    const since = Date.now() - periodDays * 24 * 60 * 60 * 1000;
    const limit = 50;
    const maxPages = 8;
    const seen = new Set<string>();
    const mediations: ClaimItem[] = [];

    for (let page = 0; page < maxPages; page += 1) {
      const params = new URLSearchParams({
        limit: String(limit),
        offset: String(page * limit),
        site_id: "MLB",
        player_role: "respondent",
        player_user_id: mlUserId,
        stage: "dispute",
      });

      const { response, json } = await fetchJson(
        `https://api.mercadolibre.com/post-purchase/v1/claims/search?${params.toString()}`,
        accessToken
      );

      if (!response.ok) break;

      const items = asArray(json);
      if (items.length === 0) break;

      for (const item of items) {
        const id = String(item.id ?? `${item.type}-${item.date_created}-${item.status}`);
        if (seen.has(id)) continue;
        seen.add(id);

        if (!isMediationClaim(item)) continue;
        if (claimDate(item) < since) continue;
        mediations.push(item);
      }

      if (items.length < limit) break;
    }

    const value = mediations.length;
    const rate = salesCompleted > 0 ? value / salesCompleted : null;

    return NextResponse.json({
      ok: true,
      sellerId,
      metric: {
        value,
        rate,
        period,
        periodDays,
        salesCompleted,
        source: "claims_search_stage_dispute_period",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro inesperado";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
