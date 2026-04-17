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

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);

    const rawCaseId = url.searchParams.get("caseId");
    const sellerId = url.searchParams.get("sellerId");

    if (!rawCaseId || !sellerId) {
      return NextResponse.json(
        { ok: false, error: "caseId e sellerId obrigatórios" },
        { status: 400 }
      );
    }

    const claimId = normalizeClaimId(rawCaseId);

    if (!claimId) {
      return NextResponse.json(
        { ok: false, error: "claimId inválido" },
        { status: 400 }
      );
    }

    const { accessToken } = await getValidMlAccessToken(sellerId);

    const candidateUrls = [
      `https://api.mercadolibre.com/post-purchase/v1/claims/${encodeURIComponent(claimId)}/messages`,
      `https://api.mercadolibre.com/claims/${encodeURIComponent(claimId)}/messages`,
    ];

    let lastStatus = 0;
    let lastJson: any = null;
    let rawMessages: any[] = [];

    for (const endpoint of candidateUrls) {
      const { res, json } = await fetchJson(endpoint, accessToken);
      lastStatus = res.status;
      lastJson = json;

      if (!res.ok) continue;

      const arr = asArray(json);
      if (arr.length > 0) {
        rawMessages = arr;
        break;
      }

      // às vezes a API responde 200 sem array no campo esperado
      if (res.ok && arr.length === 0) {
        rawMessages = [];
        break;
      }
    }

    if (lastStatus && lastStatus >= 400 && rawMessages.length === 0) {
      return NextResponse.json(
        {
          ok: false,
          error: "Falha ao buscar mensagens da claim",
          status: lastStatus,
          data: lastJson,
          claimId,
        },
        { status: 502 }
      );
    }

    const messages = rawMessages.map((m: any, i: number) => {
      const fromRaw = m?.from ?? m?.sender ?? null;

      let from: string | null = null;

      if (typeof fromRaw === "string") {
        from = fromRaw;
      } else if (fromRaw && typeof fromRaw === "object") {
        from =
          fromRaw.role ??
          fromRaw.type ??
          fromRaw.name ??
          fromRaw.nickname ??
          fromRaw.id?.toString?.() ??
          null;
      }

      const toRaw = m?.to ?? m?.receiver ?? null;

      let to: string | null = null;

      if (typeof toRaw === "string") {
        to = toRaw;
      } else if (toRaw && typeof toRaw === "object") {
        to =
          toRaw.role ??
          toRaw.type ??
          toRaw.name ??
          toRaw.nickname ??
          toRaw.id?.toString?.() ??
          null;
      }

      return {
        id: String(m?.id ?? i),
        from,
        to,
        message: String(m?.message ?? m?.text ?? m?.body ?? ""),
        date_created: m?.date_created ?? m?.created_at ?? null,
        stage: m?.stage ?? null,
        status: m?.status ?? null,
        moderation_status: m?.moderation_status ?? null,
        raw: m,
      };
    });

    return NextResponse.json({
      ok: true,
      claimId,
      messages,
    });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message ?? "Erro inesperado" },
      { status: 500 }
    );
  }
}