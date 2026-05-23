import { NextRequest, NextResponse } from "next/server";
import { getValidMlAccessToken } from "@/lib/mlToken";

type MessageSender = "seller" | "buyer" | "mercadolivre";

type NormalizedMessage = {
  id: string;
  from: MessageSender;
  to: any;
  message: string;
  date_created: string | null;
  stage: any;
  status: any;
  moderation_status: any;
  message_type: any;
  channel: "buyer" | "mediation";
  attachments: any[];
  raw: any;
};

function firstPresent<T>(...values: T[]) {
  return values.find((value) => value !== null && value !== undefined && value !== "") ?? null;
}

function asArray<T = any>(value: any): T[] {
  if (Array.isArray(value)) return value;
  if (Array.isArray(value?.messages)) return value.messages;
  if (Array.isArray(value?.results)) return value.results;
  if (Array.isArray(value?.data)) return value.data;
  if (Array.isArray(value?.items)) return value.items;
  if (Array.isArray(value?.history)) return value.history;
  if (Array.isArray(value?.events)) return value.events;
  if (Array.isArray(value?.timeline)) return value.timeline;
  if (Array.isArray(value?.bricks)) return value.bricks;
  return [];
}

function normalizeClaimId(raw?: string | null) {
  const v = String(raw || "").trim();
  if (!v) return "";
  return v.startsWith("claim-") ? v.replace(/^claim-/, "") : v;
}

function normalizePackId(raw?: string | null) {
  const v = String(raw || "").trim();
  if (!v) return "";
  return v.startsWith("pack-") ? v.replace(/^pack-/, "") : v;
}

function normalizeOrderId(raw?: string | null) {
  const v = String(raw || "").trim();
  if (!v) return "";
  return v.startsWith("order-") ? v.replace(/^order-/, "") : v;
}

function extractPackIdFromPackishValue(value: any): string | null {
  if (!value) return null;
  const raw = String(value).trim();
  const packMatch = raw.match(/packs\/(\d+)/i);
  if (packMatch?.[1]) return packMatch[1];
  if (/^\d+$/.test(raw)) return raw;
  return null;
}

function extractPackIdFromResource(value: any): string | null {
  if (!value) return null;
  const raw = String(value).trim();
  const packMatch = raw.match(/packs\/(\d+)/i);
  return packMatch?.[1] ?? null;
}

function extractOrderIdFromResource(value: any): string | null {
  if (!value) return null;
  const raw = String(value).trim();
  const orderMatch = raw.match(/orders\/(\d+)/i);
  if (orderMatch?.[1]) return orderMatch[1];
  if (/^\d+$/.test(raw)) return raw;
  return null;
}

async function fetchJson(url: string, accessToken: string) {
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });

  const json = await res.json().catch(() => ({}));
  return { res, json };
}

function extractUserId(value: any): string | null {
  if (!value) return null;

  if (typeof value === "string" || typeof value === "number") {
    const raw = String(value).trim();
    return /^\d+$/.test(raw) ? raw : null;
  }

  if (typeof value === "object") {
    return (
      value.user_id?.toString?.() ??
      value.userId?.toString?.() ??
      value.id?.toString?.() ??
      value.user?.id?.toString?.() ??
      null
    );
  }

  return null;
}

function normalizeFromForUi(
  fromRaw: any,
  sellerMlUserId: string | null,
  fallback: MessageSender = "buyer"
): MessageSender {
  const userId = extractUserId(fromRaw);

  if (sellerMlUserId && userId && userId === sellerMlUserId) return "seller";
  if (userId && sellerMlUserId && userId !== sellerMlUserId) return "buyer";

  const role = String(
    fromRaw?.role ??
      fromRaw?.type ??
      fromRaw?.name ??
      fromRaw?.nickname ??
      fromRaw?.user?.role ??
      ""
  ).toLowerCase();

  if (
    role.includes("seller") ||
    role.includes("vendedor") ||
    role.includes("vendor") ||
    role.includes("respondent")
  ) {
    return "seller";
  }

  if (
    role.includes("buyer") ||
    role.includes("comprador") ||
    role.includes("customer") ||
    role.includes("claimant")
  ) {
    return "buyer";
  }

  if (
    role.includes("mercado") ||
    role.includes("meli") ||
    role.includes("mediator") ||
    role.includes("mediation") ||
    role.includes("system") ||
    role.includes("operator") ||
    role.includes("agent") ||
    role.includes("internal")
  ) {
    return "mercadolivre";
  }

  return fallback;
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

function stripHtml(value: string) {
  return value
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .trim();
}

function textFromValue(value: any): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string" || typeof value === "number") {
    return stripHtml(String(value));
  }

  if (Array.isArray(value)) {
    return value.map(textFromValue).filter(Boolean).join("\n").trim();
  }

  if (typeof value === "object") {
    return textFromValue(
      value.text ??
        value.plain ??
        value.message ??
        value.content ??
        value.body ??
        value.description ??
        value.title ??
        value.label ??
        value.value ??
        ""
    );
  }

  return "";
}

function getMessageText(m: any) {
  const payload = m?.payload ?? m?.data ?? m?.props ?? m?.content ?? null;
  const direct =
    m?.message ??
    m?.text ??
    m?.text?.plain ??
    m?.body ??
    m?.content ??
    m?.description ??
    m?.detail ??
    m?.title ??
    m?.message_text ??
    m?.messageText ??
    payload?.message ??
    payload?.text ??
    payload?.text?.plain ??
    payload?.body ??
    payload?.content ??
    payload?.description ??
    payload?.title ??
    payload?.label ??
    payload?.value ??
    "";

  return textFromValue(direct);
}

function normalizeDate(value: any): string | null {
  if (value === null || value === undefined || value === "") return null;

  if (typeof value === "number") {
    const ms = value > 9999999999 ? value : value * 1000;
    const date = new Date(ms);
    return Number.isNaN(date.getTime()) ? null : date.toISOString();
  }

  const raw = String(value).trim();
  if (!raw) return null;
  if (/^\d+$/.test(raw)) return normalizeDate(Number(raw));

  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? raw : date.toISOString();
}

function normalizeMessage(
  m: any,
  i: number,
  prefix: "buyer" | "claim" | "mediation" | "timeline",
  sellerMlUserId: string | null,
  defaultChannel: "buyer" | "mediation",
  fallbackSender: MessageSender = defaultChannel === "mediation" ? "mercadolivre" : "buyer"
): NormalizedMessage {
  const payload = m?.payload ?? m?.data ?? m?.props ?? m?.content ?? null;
  const fromRaw =
    m?.from ??
    m?.sender ??
    m?.author ??
    m?.created_by ??
    m?.user ??
    (m?.sender_role ? { role: m.sender_role } : null) ??
    payload?.from ??
    payload?.sender ??
    payload?.author ??
    payload?.created_by ??
    payload?.user ??
    (payload?.sender_role ? { role: payload.sender_role } : null) ??
    null;
  const toRaw = m?.to ?? m?.receiver ?? payload?.to ?? payload?.receiver ?? null;
  const dateCreated = firstPresent(
    m?.date_created,
    m?.created_at,
    m?.date,
    m?.dateCreated,
    m?.last_updated,
    m?.last_update,
    m?.timestamp,
    m?.message_date?.created,
    m?.message_date?.received,
    m?.message_date?.available,
    payload?.date_created,
    payload?.created_at,
    payload?.date,
    payload?.dateCreated,
    payload?.last_updated,
    payload?.last_update,
    payload?.timestamp,
    payload?.message_date?.created,
    payload?.message_date?.received,
    payload?.message_date?.available
  );

  return {
    id: `${prefix}-${String(m?.id ?? m?.hash ?? i)}`,
    from: normalizeFromForUi(fromRaw, sellerMlUserId, fallbackSender),
    to: normalizeToForUi(toRaw),
    message: String(getMessageText(m) || "—"),
    date_created: normalizeDate(dateCreated),
    stage: m?.stage ?? payload?.stage ?? null,
    status: m?.status ?? payload?.status ?? null,
    moderation_status:
      m?.moderation_status ??
      m?.message_moderation?.status ??
      payload?.moderation_status ??
      payload?.message_moderation?.status ??
      null,
    message_type: m?.message_type ?? m?.type ?? payload?.message_type ?? payload?.type ?? null,
    channel: defaultChannel,
    attachments: asArray(
      m?.attachments ?? m?.message_attachments ?? payload?.attachments ?? payload?.message_attachments
    ).map((a: any, idx: number) => ({
      id: String(a?.id ?? idx),
      filename: a?.filename ?? a?.name ?? null,
      type: a?.type ?? a?.mime_type ?? null,
      url: a?.url ?? a?.link ?? null,
      thumbnail: a?.thumbnail ?? null,
    })),
    raw: m,
  };
}

function sortMessages<T extends { date_created?: string | null }>(messages: T[]) {
  return [...messages].sort((a, b) => {
    const ta = new Date(a.date_created ?? 0).getTime();
    const tb = new Date(b.date_created ?? 0).getTime();
    return ta - tb;
  });
}

function uniqueMessages(messages: NormalizedMessage[]) {
  const seen = new Set<string>();

  return messages.filter((m) => {
    const key = `${m.from}|${m.channel}|${m.date_created}|${m.message}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function isMediationClaimMessage(message: NormalizedMessage) {
  const raw = message.raw ?? {};
  const text = [
    raw?.sender_role,
    raw?.receiver_role,
    raw?.stage,
    raw?.type,
    raw?.message_type,
    message.stage,
    message.message_type,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return (
    text.includes("mediator") ||
    text.includes("mediation") ||
    text.includes("mediacion") ||
    text.includes("mediacao") ||
    text.includes("dispute")
  );
}

async function getMlUserId(accessToken: string) {
  const { res, json } = await fetchJson("https://api.mercadolibre.com/users/me", accessToken);
  if (!res.ok || !json?.id) return null;
  return String(json.id);
}

async function fetchClaimDetail(claimId: string, accessToken: string) {
  const endpoints = [
    `https://api.mercadolibre.com/post-purchase/v1/claims/${encodeURIComponent(claimId)}`,
    `https://api.mercadolibre.com/claims/${encodeURIComponent(claimId)}`,
  ];

  let lastStatus = 0;
  let lastJson: any = null;

  for (const endpoint of endpoints) {
    const { res, json } = await fetchJson(endpoint, accessToken);
    lastStatus = res.status;
    lastJson = json;
    if (!res.ok) continue;
    return { ok: true, endpoint, raw: json, debug: { endpoint, raw: json } };
  }

  return { ok: false, endpoint: null, raw: null, debug: { status: lastStatus, raw: lastJson } };
}

async function fetchExpectedResolutions(claimId: string, accessToken: string) {
  const endpoint = `https://api.mercadolibre.com/post-purchase/v1/claims/${encodeURIComponent(
    claimId
  )}/expected-resolutions`;

  const { res, json } = await fetchJson(endpoint, accessToken);

  return {
    ok: res.ok,
    endpoint,
    raw: json,
    items: res.ok ? asArray(json) : [],
  };
}

async function fetchOrderDetail(orderId: string, accessToken: string) {
  const endpoint = `https://api.mercadolibre.com/orders/${encodeURIComponent(orderId)}`;
  const { res, json } = await fetchJson(endpoint, accessToken);

  return {
    ok: res.ok,
    endpoint,
    raw: res.ok ? json : null,
    debug: { status: res.status, endpoint, raw: json },
  };
}

async function fetchPackMessages(packId: string, sellerMlUserId: string, accessToken: string) {
  const endpoints = [
    `https://api.mercadolibre.com/messages/packs/${encodeURIComponent(packId)}/sellers/${encodeURIComponent(
      sellerMlUserId
    )}?tag=post_sale&mark_as_read=false&limit=50`,
    `https://api.mercadolibre.com/messages/packs/${encodeURIComponent(packId)}/sellers/${encodeURIComponent(
      sellerMlUserId
    )}?mark_as_read=false&tag=post_sale&limit=50`,
    `https://api.mercadolibre.com/messages/packs/${encodeURIComponent(packId)}/sellers/${encodeURIComponent(
      sellerMlUserId
    )}/messages`,
  ];

  let lastStatus = 0;
  let lastJson: any = null;

  for (const endpoint of endpoints) {
    const { res, json } = await fetchJson(endpoint, accessToken);
    lastStatus = res.status;
    lastJson = json;

    if (!res.ok) continue;

    return {
      ok: true,
      source: "pack" as const,
      rawMessages: asArray(json),
      debug: { endpoint, raw: json },
    };
  }

  return {
    ok: false,
    source: "pack" as const,
    rawMessages: [] as any[],
    debug: { status: lastStatus, raw: lastJson },
  };
}

function visitTimelineNodes(value: any, acc: any[], depth = 0) {
  if (!value || depth > 7) return;

  if (Array.isArray(value)) {
    for (const item of value) visitTimelineNodes(item, acc, depth + 1);
    return;
  }

  if (typeof value !== "object") return;

  const type = String(
    value?.type ?? value?.id ?? value?.name ?? value?.component ?? value?.brick ?? ""
  ).toLowerCase();
  const text = getMessageText(value);
  const looksLikeTimelineItem =
    Boolean(text) ||
    type.includes("message") ||
    type.includes("milestone") ||
    type.includes("event") ||
    type.includes("status");

  if (looksLikeTimelineItem) {
    acc.push(value);
  }

  for (const key of [
    "bricks",
    "children",
    "items",
    "components",
    "messages",
    "events",
    "timeline",
    "content",
    "body",
  ]) {
    const child = value?.[key];
    if (Array.isArray(child) || (child && typeof child === "object" && key !== "content")) {
      visitTimelineNodes(child, acc, depth + 1);
    }
  }
}

function extractTimelineItems(raw: any) {
  const items: any[] = [];
  visitTimelineNodes(raw?.bricks ?? raw?.timeline ?? raw?.messages ?? raw?.events ?? raw, items);

  const seen = new Set<string>();
  return items.filter((item, index) => {
    const text = getMessageText(item);
    if (!text) return false;
    const key = `${item?.id ?? item?.hash ?? index}|${text}|${normalizeDate(
      item?.date_created ?? item?.created_at ?? item?.date ?? item?.timestamp
    )}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

async function fetchPackTimeline(packId: string, sellerMlUserId: string, accessToken: string) {
  const endpoints = [
    `https://www.mercadolivre.com.br/api/messages/packs/${encodeURIComponent(
      packId
    )}/sellers/${encodeURIComponent(sellerMlUserId)}/timeline`,
    `https://api.mercadolibre.com/messages/packs/${encodeURIComponent(
      packId
    )}/sellers/${encodeURIComponent(sellerMlUserId)}/timeline`,
  ];

  let lastStatus = 0;
  let lastJson: any = null;

  for (const endpoint of endpoints) {
    const { res, json } = await fetchJson(endpoint, accessToken);
    lastStatus = res.status;
    lastJson = json;

    if (!res.ok) continue;

    return {
      ok: true,
      source: "timeline" as const,
      rawMessages: extractTimelineItems(json),
      debug: { endpoint, raw: json },
    };
  }

  return {
    ok: false,
    source: "timeline" as const,
    rawMessages: [] as any[],
    debug: { status: lastStatus, raw: lastJson },
  };
}

async function fetchClaimMessages(claimId: string, accessToken: string) {
  const endpoints = [
    `https://api.mercadolibre.com/post-purchase/v1/claims/${encodeURIComponent(claimId)}/messages`,
    `https://api.mercadolibre.com/claims/${encodeURIComponent(claimId)}/messages`,
  ];

  let lastStatus = 0;
  let lastJson: any = null;

  for (const endpoint of endpoints) {
    const { res, json } = await fetchJson(endpoint, accessToken);
    lastStatus = res.status;
    lastJson = json;

    if (!res.ok) continue;

    return {
      ok: true,
      source: "claim" as const,
      rawMessages: asArray(json),
      debug: { endpoint, raw: json },
    };
  }

  return {
    ok: false,
    source: "claim" as const,
    rawMessages: [] as any[],
    debug: { status: lastStatus, raw: lastJson },
  };
}

function getMediatorFromClaimDetail(claimDetail: any) {
  const players = asArray(claimDetail?.players);
  return players.find((p: any) => {
    const role = String(p?.role ?? "").toLowerCase();
    const type = String(p?.type ?? "").toLowerCase();
    return role === "mediator" || type === "internal";
  });
}

function getResolutionText(claimDetail: any) {
  const resolution = claimDetail?.resolution;
  const status = String(claimDetail?.status ?? "").toLowerCase();
  const type = String(claimDetail?.type ?? "").toLowerCase();
  const stage = String(claimDetail?.stage ?? "").toLowerCase();
  const resolutionRaw = JSON.stringify(resolution ?? {}).toLowerCase();

  if (status === "closed" || status === "resolved") {
    if (
      resolutionRaw.includes("refund") ||
      resolutionRaw.includes("money") ||
      resolutionRaw.includes("payment") ||
      resolutionRaw.includes("devol") ||
      resolutionRaw.includes("reembolso")
    ) {
      return "Mediação finalizada. O Mercado Livre definiu a resolução financeira da reclamação.";
    }

    return "Mediação finalizada. O Mercado Livre encerrou a reclamação.";
  }

  if (stage === "dispute" || type.includes("mediation")) {
    return "Mediação aberta. O Mercado Livre está acompanhando a resolução desta reclamação.";
  }

  return "";
}

function buildMediationEventsFromClaimDetail(claimDetail: any): any[] {
  if (!claimDetail) return [];

  const events: any[] = [];

  const explicitEvents = [
    ...asArray(claimDetail?.history),
    ...asArray(claimDetail?.events),
    ...asArray(claimDetail?.timeline),
  ];

  for (const e of explicitEvents) {
    const text = getMessageText(e);
    if (!text || text === "—") continue;

    events.push({
      id: e?.id ?? e?.hash ?? `event-${events.length}`,
      message: text,
      date_created:
        e?.date_created ??
        e?.created_at ??
        e?.date ??
        e?.last_updated ??
        e?.last_update ??
        claimDetail?.last_updated ??
        claimDetail?.date_created ??
        null,
      type: e?.type ?? "claim_event",
      raw: e,
    });
  }

  const mediator = getMediatorFromClaimDetail(claimDetail);
  const resolutionText = getResolutionText(claimDetail);

  if (mediator) {
    events.push({
      id: "mediator-player",
      message: "Mediação iniciada com acompanhamento do Mercado Livre.",
      date_created: claimDetail?.date_created ?? claimDetail?.last_updated ?? null,
      type: "mediator",
      raw: mediator,
    });
  }

  if (resolutionText) {
    events.push({
      id: "claim-resolution",
      message: resolutionText,
      date_created:
        claimDetail?.last_updated ??
        claimDetail?.date_closed ??
        claimDetail?.date_created ??
        null,
      type: "resolution",
      raw: claimDetail?.resolution ?? claimDetail,
    });
  }

  const expectedResolutions = asArray(claimDetail?.expected_resolutions);
  for (const r of expectedResolutions) {
    const expected = String(r?.expected_resolution ?? "").replaceAll("_", " ");
    const status = String(r?.status ?? "");
    const role = String(r?.player_role ?? "");

    if (!expected && !status) continue;

    events.push({
      id: `expected-${events.length}`,
      message: `Resolução esperada: ${expected || "não informada"}${status ? ` (${status})` : ""}${role ? ` — ${role}` : ""}.`,
      date_created:
        r?.date_created ??
        r?.last_updated ??
        r?.last_update ??
        claimDetail?.last_updated ??
        null,
      type: "expected_resolution",
      raw: r,
    });
  }

  return events;
}

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);

    const rawCaseId = url.searchParams.get("caseId");
    const rawPackId = url.searchParams.get("packId");
    const rawOrderId = url.searchParams.get("orderId");
    const sellerId = url.searchParams.get("sellerId");

    if (!sellerId || (!rawCaseId && !rawPackId && !rawOrderId)) {
      return NextResponse.json(
        { ok: false, error: "sellerId e (caseId, packId ou orderId) obrigatórios" },
        { status: 400 }
      );
    }

    const claimId = rawCaseId ? normalizeClaimId(rawCaseId) : "";
    let packId = normalizePackId(rawPackId);
    let orderId = normalizeOrderId(rawOrderId);

    const { accessToken } = await getValidMlAccessToken(sellerId);
    const sellerMlUserId = await getMlUserId(accessToken);

    if (!sellerMlUserId) {
      return NextResponse.json(
        { ok: false, error: "Não foi possível identificar o mlUserId do seller" },
        { status: 502 }
      );
    }

    const claimDetail = claimId ? await fetchClaimDetail(claimId, accessToken) : null;
    const expectedResolutions = claimId ? await fetchExpectedResolutions(claimId, accessToken) : null;
    const claimDetailRaw = claimDetail?.ok ? claimDetail.raw : null;

    if (!packId && claimDetailRaw) {
      const possibleValues = [
        claimDetailRaw?.pack_id,
        claimDetailRaw?.packId,
        claimDetailRaw?.pack?.id,
        claimDetailRaw?.order?.pack_id,
        claimDetailRaw?.order?.packId,
        claimDetailRaw?.context?.pack_id,
        claimDetailRaw?.context?.packId,
      ];

      for (const value of possibleValues) {
        const foundPackId = extractPackIdFromPackishValue(value);
        if (foundPackId) {
          packId = foundPackId;
          break;
        }
      }

      packId = packId || extractPackIdFromResource(claimDetailRaw?.resource) || "";
    }

    if (!orderId && claimDetailRaw) {
      orderId =
        extractOrderIdFromResource(claimDetailRaw?.resource) ??
        extractOrderIdFromResource(claimDetailRaw?.resource_id) ??
        extractOrderIdFromResource(claimDetailRaw?.order_id) ??
        extractOrderIdFromResource(claimDetailRaw?.resource?.id) ??
        "";
    }

    const orderDetail = orderId ? await fetchOrderDetail(orderId, accessToken) : null;

    if (!packId && orderDetail?.ok) {
      packId =
        extractPackIdFromPackishValue(orderDetail.raw?.pack_id) ??
        extractPackIdFromPackishValue(orderDetail.raw?.packId) ??
        extractPackIdFromPackishValue(orderDetail.raw?.pack?.id) ??
        "";
    }

    if (!packId && orderId) {
      packId = orderId;
    }

    const packResult = packId
      ? await fetchPackMessages(packId, sellerMlUserId, accessToken)
      : null;

    const timelineResult = packId
      ? await fetchPackTimeline(packId, sellerMlUserId, accessToken)
      : null;

    const claimResult = claimId
      ? await fetchClaimMessages(claimId, accessToken)
      : null;

    if (
      (!packResult || !packResult.ok) &&
      (!timelineResult || !timelineResult.ok) &&
      (!claimResult || !claimResult.ok) &&
      (!claimDetail || !claimDetail.ok)
    ) {
      return NextResponse.json(
        {
          ok: false,
          error: "Falha ao buscar mensagens",
          claimId: claimId || null,
          packId: packId || null,
          orderId: orderId || null,
          sellerMlUserId,
          debug: {
            pack: packResult?.debug ?? null,
            timeline: timelineResult?.debug ?? null,
            claim: claimResult?.debug ?? null,
            claimDetail: claimDetail?.debug ?? null,
            order: orderDetail?.debug ?? null,
          },
        },
        { status: 502 }
      );
    }

    const packMessages = (packResult?.ok ? packResult.rawMessages : []).map((m: any, i: number) =>
      normalizeMessage(m, i, "buyer", sellerMlUserId, "buyer")
    );

    const claimMessages = (claimResult?.ok ? claimResult.rawMessages : []).map((m: any, i: number) =>
      normalizeMessage(m, i, "claim", sellerMlUserId, "buyer")
    );

    const timelineMessages = (timelineResult?.ok ? timelineResult.rawMessages : []).map(
      (m: any, i: number) =>
        normalizeMessage(m, i, "timeline", sellerMlUserId, "mediation", "mercadolivre")
    );

    if (claimDetailRaw && expectedResolutions?.ok) {
      claimDetailRaw.expected_resolutions = expectedResolutions.items;
    }

    const mediationEvents = buildMediationEventsFromClaimDetail(claimDetailRaw);

    const mediationFromDetail = mediationEvents.map((m: any, i: number) =>
      normalizeMessage(m, i, "mediation", sellerMlUserId, "mediation")
    );

    const claimMediationMessages = claimMessages.filter(
      (m) => m.from === "mercadolivre" || isMediationClaimMessage(m)
    );
    const claimBuyerMessages =
      packMessages.length > 0
        ? []
        : claimMessages.filter((m) => m.from !== "mercadolivre" && !isMediationClaimMessage(m));

    const buyerMessages = sortMessages(uniqueMessages([...packMessages, ...claimBuyerMessages]));

    const mediationMessages = sortMessages(
      uniqueMessages([
        ...timelineMessages,
        ...claimMediationMessages,
        ...mediationFromDetail,
      ])
    );

    const messages = sortMessages(uniqueMessages([...buyerMessages, ...mediationMessages]));

    return NextResponse.json({
      ok: true,
      claimId: claimId || null,
      packId: packId || null,
      orderId: orderId || null,
      sellerMlUserId,
      source: {
        pack: !!packResult?.ok,
        timeline: !!timelineResult?.ok,
        claim: !!claimResult?.ok,
        claimDetail: !!claimDetail?.ok,
        order: !!orderDetail?.ok,
        expectedResolutions: !!expectedResolutions?.ok,
      },
      buyerMessages,
      mediationMessages,
      messages,
      claimSummary: claimDetailRaw
        ? {
            id: claimDetailRaw?.id ?? null,
            status: claimDetailRaw?.status ?? null,
            stage: claimDetailRaw?.stage ?? null,
            type: claimDetailRaw?.type ?? null,
            reason_id: claimDetailRaw?.reason_id ?? null,
            resolution: claimDetailRaw?.resolution ?? null,
            players: claimDetailRaw?.players ?? null,
            available_actions:
              claimDetailRaw?.players?.flatMap?.((p: any) => p?.available_actions ?? []) ?? [],
          }
        : null,
      debug: {
        pack: {
          ok: !!packResult?.ok,
          count: packMessages.length,
          endpoint: packResult?.debug?.endpoint ?? null,
        },
        timeline: {
          ok: !!timelineResult?.ok,
          count: timelineMessages.length,
          endpoint: timelineResult?.debug?.endpoint ?? null,
        },
        claim: {
          ok: !!claimResult?.ok,
          count: claimMessages.length,
          endpoint: claimResult?.debug?.endpoint ?? null,
        },
        order: {
          ok: !!orderDetail?.ok,
          endpoint: orderDetail?.endpoint ?? null,
        },
        claimDetail: {
          ok: !!claimDetail?.ok,
          endpoint: claimDetail?.endpoint ?? null,
          hasMediator: !!getMediatorFromClaimDetail(claimDetailRaw),
          eventCount: mediationEvents.length,
        },
        expectedResolutions: {
          ok: !!expectedResolutions?.ok,
          endpoint: expectedResolutions?.endpoint ?? null,
          count: expectedResolutions?.items?.length ?? 0,
        },
      },
    });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message ?? "Erro inesperado" },
      { status: 500 }
    );
  }
}
