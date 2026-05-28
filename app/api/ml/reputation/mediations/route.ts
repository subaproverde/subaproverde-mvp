import { NextRequest, NextResponse } from "next/server";
import { getValidMlAccessToken } from "@/lib/mlToken";

type MlMetric = {
  value?: number | string | null;
  rate?: number | string | null;
  period?: string | null;
  completed?: number | string | null;
};

type MlUserMe = {
  id?: string | number | null;
  seller_reputation?: {
    metrics?: Record<string, MlMetric | undefined>;
  };
};

const MEDIATION_METRIC_ALIASES = [
  "mediations",
  "mediation",
  "mediaciones",
  "mediacao",
  "mediação",
  "disputes",
  "dispute",
];

function numberValue(value: unknown) {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
}

function nullableNumber(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function parsePeriodDays(period?: string | null) {
  const raw = String(period ?? "").toLowerCase();
  const match = raw.match(/(\d+)/);
  const value = match ? Number(match[1]) : 60;
  if (!Number.isFinite(value) || value <= 0) return 60;
  if (raw.includes("month")) return value * 30;
  return value;
}

function getMetric(metrics: Record<string, MlMetric | undefined>, aliases: string[]) {
  const entries = Object.entries(metrics);
  for (const alias of aliases) {
    const found = entries.find(([key]) => key.toLowerCase() === alias.toLowerCase());
    if (found?.[1]) return { key: found[0], metric: found[1] };
  }
  return null;
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
    const { response, json } = await fetchJson("https://api.mercadolibre.com/users/me", accessToken);

    if (!response.ok) {
      return NextResponse.json(
        { ok: false, error: "Erro ao chamar Mercado Livre /users/me", status: response.status },
        { status: 502 }
      );
    }

    const me = json as MlUserMe;
    const metrics = me.seller_reputation?.metrics ?? {};
    const salesMetric = metrics.sales;
    const officialMediation = getMetric(metrics, MEDIATION_METRIC_ALIASES);
    const metric = officialMediation?.metric;
    const period = metric?.period ?? salesMetric?.period ?? "60 days";
    const periodDays = parsePeriodDays(period);
    const value = metric ? numberValue(metric.value) : 0;
    const rate = metric ? nullableNumber(metric.rate) ?? 0 : 0;

    return NextResponse.json({
      ok: true,
      sellerId,
      metric: {
        value,
        rate,
        period,
        periodDays,
        salesCompleted: numberValue(salesMetric?.completed),
        source: officialMediation ? `seller_reputation.metrics.${officialMediation.key}` : "official_metric_absent",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro inesperado";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
