export type MlMetric = {
  value?: number | string | null;
  rate?: number | string | null;
  period?: string | null;
  completed?: number | string | null;
};

export type MlUserMe = {
  id?: string | number | null;
  seller_reputation?: {
    metrics?: Record<string, MlMetric | undefined>;
  };
};

type ClaimItem = {
  id?: string | number | null;
  stage?: string | null;
  date_created?: string | null;
  last_updated?: string | null;
  resource_id?: string | number | null;
};

type ClaimDetail = ClaimItem & {
  resolution?: {
    benefited?: string[] | null;
    closed_by?: string | null;
  } | null;
  players?: Array<{
    role?: string | null;
    type?: string | null;
  }> | null;
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

export function reputationNumber(value: unknown) {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
}

function nullableNumber(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

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

function claimDate(item: ClaimItem) {
  const raw = item.date_created ?? item.last_updated ?? "";
  const timestamp = Date.parse(raw);
  return Number.isNaN(timestamp) ? 0 : timestamp;
}

function isClaimStage(item: ClaimItem) {
  return String(item.stage ?? "").toLowerCase() === "claim";
}

function wasSellerBenefited(detail: ClaimDetail) {
  const benefited = detail.resolution?.benefited ?? [];
  return benefited.some((item) => String(item).toLowerCase() === "respondent");
}

function hasMediatorIntervention(detail: ClaimDetail) {
  const closedBy = String(detail.resolution?.closed_by ?? "").toLowerCase();
  const hasMediatorPlayer = (detail.players ?? []).some((player) => {
    const role = String(player.role ?? "").toLowerCase();
    const type = String(player.type ?? "").toLowerCase();
    return role === "mediator" || type === "internal";
  });

  return closedBy === "mediator" || hasMediatorPlayer;
}

function countsAsMediationImpact(detail: ClaimDetail) {
  return isClaimStage(detail) && hasMediatorIntervention(detail) && !wasSellerBenefited(detail);
}

function inferRateBase(metrics: Record<string, MlMetric | undefined>, fallback: number) {
  const claimsValue = reputationNumber(metrics.claims?.value);
  const claimsRate = nullableNumber(metrics.claims?.rate);

  if (claimsValue > 0 && claimsRate && claimsRate > 0) {
    return claimsValue / claimsRate;
  }

  return fallback;
}

async function fetchMlJson(url: string, accessToken: string) {
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });
  const json = await response.json().catch(() => null);
  return { response, json };
}

export async function getMediationImpactMetric({
  accessToken,
  me,
  siteId = "MLB",
  maxPages = 4,
}: {
  accessToken: string;
  me: MlUserMe;
  siteId?: string;
  maxPages?: number;
}) {
  const metrics = me.seller_reputation?.metrics ?? {};
  const salesMetric = metrics.sales;
  const officialMediation = getMetric(metrics, MEDIATION_METRIC_ALIASES);
  const metric = officialMediation?.metric;
  const period = metric?.period ?? salesMetric?.period ?? "60 days";
  const periodDays = parsePeriodDays(period);
  const salesCompleted = reputationNumber(salesMetric?.completed);
  const rateBase = inferRateBase(metrics, salesCompleted);
  const affectedClaimIds = new Set<string>();
  const affectedSales = new Set<string>();

  if (officialMediation) {
    const value = reputationNumber(metric?.value);
    return {
      value,
      rate: nullableNumber(metric?.rate) ?? (rateBase > 0 ? value / rateBase : 0),
      period,
      periodDays,
      salesCompleted,
      rateBase,
      source: `seller_reputation.metrics.${officialMediation.key}`,
      affectedClaimIds: [] as string[],
      affectedSales: [] as string[],
    };
  }

  if (me.id) {
    const since = Date.now() - periodDays * 24 * 60 * 60 * 1000;
    const seenClaims = new Set<string>();
    const limit = 100;

    for (let page = 0; page < maxPages; page += 1) {
      const params = new URLSearchParams({
        limit: String(limit),
        offset: String(page * limit),
        site_id: siteId,
        player_role: "respondent",
        player_user_id: String(me.id),
      });

      const { response, json } = await fetchMlJson(
        `https://api.mercadolibre.com/post-purchase/v1/claims/search?${params.toString()}`,
        accessToken
      );

      if (!response.ok) break;

      const claims = asArray(json);
      if (claims.length === 0) break;

      const candidates = claims.filter((claim) => {
        const claimId = String(claim.id ?? "");
        if (!claimId || seenClaims.has(claimId)) return false;
        seenClaims.add(claimId);
        return isClaimStage(claim) && claimDate(claim) >= since;
      });

      const details = await Promise.all(
        candidates.map(async (claim) => {
          const { response: detailResponse, json: detailJson } = await fetchMlJson(
            `https://api.mercadolibre.com/post-purchase/v1/claims/${encodeURIComponent(
              String(claim.id)
            )}`,
            accessToken
          );

          return detailResponse.ok ? (detailJson as ClaimDetail) : null;
        })
      );

      for (const detail of details) {
        if (!detail || !countsAsMediationImpact(detail)) continue;

        const claimKey = String(detail.id ?? "");
        const saleKey = String(detail.resource_id ?? detail.id ?? "");

        if (claimKey) affectedClaimIds.add(claimKey);
        if (saleKey) affectedSales.add(saleKey);
      }

      if (claims.length < limit) break;
    }
  }

  const value = affectedSales.size;

  return {
    value,
    rate: rateBase > 0 ? value / rateBase : 0,
    period,
    periodDays,
    salesCompleted,
    rateBase,
    source: "claims_search_claim_mediator_loss",
    affectedClaimIds: Array.from(affectedClaimIds),
    affectedSales: Array.from(affectedSales),
  };
}
