import { NextRequest, NextResponse } from "next/server";
import { getValidMlAccessToken } from "@/lib/mlToken";

function asArray<T = any>(value: any): T[] {
  if (Array.isArray(value)) return value;
  if (Array.isArray(value?.messages)) return value.messages;
  if (Array.isArray(value?.results)) return value.results;
  if (Array.isArray(value?.data)) return value.data;
  if (Array.isArray(value?.items)) return value.items;
  return [];
}

function normalizeClaimId(raw: string) {
  const v = String(raw || "").trim();
  if (!v) return "";
  return v.startsWith("claim-") ? v.replace(/^claim-/, "") : v;
}

function normalizePackId(raw?: string | null) {
  const v = String(raw || "").trim();
  if (!v) return "";
  return v.startsWith("pack-") ? v.replace(/^pack-/, "") : v;
}

function extractPackIdFromAnything(value: any): string | null {
  if (!value) return null;

  const raw = String(value).trim();

  const packMatch = raw.match(/packs\/(\d+)/i);
  if (packMatch?.[1]) return packMatch[1];

  const onlyDigits = raw.match(/^\d+$/);
  if (onlyDigits?.[0]) return onlyDigits[0];

  return null;
}

async function fetchJson(url: string, accessToken: string) {
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    cache: "no-store",
  });

  const json = await res.json().catch(() => ({}));
  return { res, json };
}

function normalizeFromForUi(fromRaw: any, sellerMlUserId: string | null) {
  if (!fromRaw) return "mercadolivre";

  if (typeof fromRaw === "string") {
    const s = fromRaw.toLowerCase();

    if (s.includes("seller")) return "seller";
    if (s.includes("buyer") || s.includes("customer") || s.includes("client")) return "buyer";
    if (s.includes("mercado") || s.includes("meli") || s.includes("mediation")) return "mercadolivre";

    return s;
  }

  if (typeof fromRaw === "object") {
    const userId =
      fromRaw.user_id?.toString?.() ??
      fromRaw.userId?.toString?.() ??
      fromRaw.id?.toString?.() ??
      null;

    const role =
      fromRaw.role?.toString?.().toLowerCase?.() ??
      fromRaw.type?.toString?.().toLowerCase?.() ??
      fromRaw.name?.toString?.().toLowerCase?.() ??
      fromRaw.nickname?.toString?.().toLowerCase?.() ??
      "";

    if (sellerMlUserId && userId && userId === sellerMlUserId) return "seller";
    if (role.includes("seller")) return "seller";
    if (role.includes("buyer") || role.includes("customer") || role.includes("client")) return "buyer";
    if (role.includes("mercado") || role.includes("meli") || role.includes("mediation")) return "mercadolivre";

    if (userId) return userId;
  }

  return "mercadolivre";
}

function normalizeToForUi(toRaw: any) {
  if (!toRaw) return null;

  if (typeof toRaw === "string") return toRaw;

  if (typeof toRaw === "object") {
    return (
      toRaw.role ??
      toRaw.type ??
      toRaw.name ??
      toRaw.nickname ??
      toRaw.user_id?.toString?.() ??
      toRaw.id?.toString?.() ??
      null
    );
  }

  return null;
}

async function getMlUserId(accessToken: string) {
  const { res, json } = await fetchJson("https://api.mercadolibre.com/users/me", accessToken);
  if (!res.ok || !json?.id) return null;
  return String(json.id);
}

async function tryResolvePackIdFromClaim(claimId: string, accessToken: string) {
  const candidates = [
    `https://api.mercadolibre.com/post-purchase/v1/claims/${encodeURIComponent(claimId)}`,
    `https://api.mercadolibre.com/claims/${encodeURIComponent(claimId)}`,
  ];

  for (const endpoint of candidates) {
    const { res, json } = await fetchJson(endpoint, accessToken);
    if (!res.ok) continue;

    const possibleValues = [
      json?.resource,
      json?.resource_id,
      json?.resource?.id,
      json?.pack_id,
      json?.packId,
      json?.pack?.id,
      json?.order?.pack_id,
      json?.order?.packId,
      json?.context?.pack_id,
      json?.context?.packId,
    ];

    for (const value of possibleValues) {
      const packId = extractPackIdFromAnything(value);
      if (packId) return packId;
    }
  }

  return null;
}

async function fetchPackMessages(packId: string, sellerMlUserId: string, accessToken: string) {
  const endpoints = [
    `https://api.mercadolibre.com/messages/packs/${encodeURIComponent(packId)}/sellers/${encodeURIComponent(
      sellerMlUserId
    )}/messages`,
    `https://api.mercadolibre.com/messages/packs/${encodeURIComponent(packId)}/sellers/${encodeURIComponent(
      sellerMlUserId
    )}/messages?tag=claim`,
  ];

  let lastStatus = 0;
  let lastJson: any = null;

  for (const endpoint of endpoints) {
    const { res, json } = await fetchJson(endpoint, accessToken);
    lastStatus = res.status;
    lastJson = json;

    if (!res.ok) continue;

    const arr = asArray(json);
    return {
      ok: true,
      source: "pack" as const,
      rawMessages: arr,
      debug: {
        endpoint,
        raw: json,
      },
    };
  }

  return {
    ok: false,
    source: "pack" as const,
    rawMessages: [] as any[],
    debug: {
      status: lastStatus,
      raw: lastJson,
    },
  };
}

async function fetchClaimMessages(claimId: string, accessToken: string) {
  const candidateUrls = [
    `https://api.mercadolibre.com/post-purchase/v1/claims/${encodeURIComponent(claimId)}/messages`,
    `https://api.mercadolibre.com/claims/${encodeURIComponent(claimId)}/messages`,
  ];

  let lastStatus = 0;
  let lastJson: any = null;

  for (const endpoint of candidateUrls) {
    const { res, json } = await fetchJson(endpoint, accessToken);
    lastStatus = res.status;
    lastJson = json;

    if (!res.ok) continue;

    const arr = asArray(json);
    return {
      ok: true,
      source: "claim" as const,
      rawMessages: arr,
      debug: {
        endpoint,
        raw: json,
      },
    };
  }

  return {
    ok: false,
    source: "claim" as const,
    rawMessages: [] as any[],
    debug: {
      status: lastStatus,
      raw: lastJson,
    },
  };
}

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);

    const rawCaseId = url.searchParams.get("caseId");
    const rawPackId = url.searchParams.get("packId");
    const sellerId = url.searchParams.get("sellerId");

    if (!sellerId || (!rawCaseId && !rawPackId)) {
      return NextResponse.json(
        { ok: false, error: "sellerId e (caseId ou packId) obrigatórios" },
        { status: 400 }
      );
    }

    const claimId = rawCaseId ? normalizeClaimId(rawCaseId) : "";
    let packId = normalizePackId(rawPackId);

    const { accessToken } = await getValidMlAccessToken(sellerId);
    const sellerMlUserId = await getMlUserId(accessToken);

    if (!sellerMlUserId) {
      return NextResponse.json(
        { ok: false, error: "Não foi possível identificar o mlUserId do seller" },
        { status: 502 }
      );
    }

    if (!packId && claimId) {
      packId = (await tryResolvePackIdFromClaim(claimId, accessToken)) ?? "";
    }

    let result:
      | {
          ok: boolean;
          source: "pack" | "claim";
          rawMessages: any[];
          debug: any;
        }
      | null = null;

    if (packId) {
      result = await fetchPackMessages(packId, sellerMlUserId, accessToken);
    }

    if ((!result || !result.ok) && claimId) {
      result = await fetchClaimMessages(claimId, accessToken);
    }

    if (!result || !result.ok) {
      return NextResponse.json(
        {
          ok: false,
          error: "Falha ao buscar mensagens",
          claimId: claimId || null,
          packId: packId || null,
          sellerMlUserId,
          debug: result?.debug ?? null,
        },
        { status: 502 }
      );
    }

    const messages = result.rawMessages.map((m: any, i: number) => {
      const text =
        m?.message ??
        m?.text ??
        m?.body ??
        m?.content ??
        m?.message_text ??
        "";

      const fromRaw = m?.from ?? m?.sender ?? m?.author ?? null;
      const toRaw = m?.to ?? m?.receiver ?? null;

      return {
        id: String(m?.id ?? i),
        from: normalizeFromForUi(fromRaw, sellerMlUserId),
        to: normalizeToForUi(toRaw),
        message: String(text),
        date_created: m?.date_created ?? m?.created_at ?? m?.date ?? null,
        stage: m?.stage ?? null,
        status: m?.status ?? null,
        moderation_status: m?.moderation_status ?? null,
        message_type: m?.message_type ?? m?.type ?? null,
        attachments: asArray(m?.attachments).map((a: any, idx: number) => ({
          id: String(a?.id ?? idx),
          filename: a?.filename ?? a?.name ?? null,
          type: a?.type ?? a?.mime_type ?? null,
          url: a?.url ?? a?.link ?? null,
          thumbnail: a?.thumbnail ?? null,
        })),
        raw: m,
      };
    });

    messages.sort((a, b) => {
      const ta = new Date(a.date_created ?? 0).getTime();
      const tb = new Date(b.date_created ?? 0).getTime();
      return ta - tb;
    });

    return NextResponse.json({
      ok: true,
      claimId: claimId || null,
      packId: packId || null,
      source: result.source,
      sellerMlUserId,
      messages,
    });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message ?? "Erro inesperado" },
      { status: 500 }
    );
  }
}