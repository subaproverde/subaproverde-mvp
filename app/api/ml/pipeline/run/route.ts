import { NextRequest } from "next/server";

type StepResult = {
  ok: boolean;
  status: number;
  url: string;
  data: any;
};

function firstHeaderValue(v: string | null) {
  if (!v) return "";
  return v.split(",")[0]?.trim() || "";
}

function getBaseUrl(req: NextRequest) {
  // Preferir forwarded headers (ngrok / proxy)
  const rawProto =
    firstHeaderValue(req.headers.get("x-forwarded-proto")) ||
    firstHeaderValue(req.headers.get("x-forwarded-protocol")) ||
    "";

  const rawHost =
    firstHeaderValue(req.headers.get("x-forwarded-host")) ||
    firstHeaderValue(req.headers.get("host")) ||
    "localhost:3000";

  // Default seguro
  let proto = rawProto || "http";
  const host = rawHost;

  // ✅ Se for localhost, nunca usar https (Next dev geralmente é http)
  if (host.includes("localhost") || host.startsWith("127.0.0.1")) {
    proto = "http";
  }

  return `${proto}://${host}`;
}

async function hit(url: string): Promise<StepResult> {
  try {
    const r = await fetch(url, { cache: "no-store" });

    let data: any = null;
    const ct = r.headers.get("content-type") || "";

    if (ct.includes("application/json")) {
      data = await r.json().catch(() => ({}));
    } else {
      // fallback se a rota devolveu HTML/texto
      const txt = await r.text().catch(() => "");
      data = { non_json: true, text: txt?.slice(0, 1200) };
    }

    return { ok: r.ok, status: r.status, url, data };
  } catch (e: any) {
    return {
      ok: false,
      status: 0,
      url,
      data: {
        error: "fetch_failed",
        details: e?.message ?? String(e),
      },
    };
  }
}

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const sellerId = sp.get("sellerId");

  if (!sellerId) {
    return Response.json({ error: "sellerId obrigatório" }, { status: 400 });
  }

  const base = getBaseUrl(req);

  const s1 = await hit(`${base}/api/ml/reputation/sync?sellerId=${sellerId}&force=1`);
  if (!s1.ok) return Response.json({ ok: false, failed_at: "reputation_sync", step: s1 }, { status: 500 });

  const s2 = await hit(`${base}/api/ml/reputation/normalize?sellerId=${sellerId}`);
  if (!s2.ok) return Response.json({ ok: false, failed_at: "normalize", step: s2 }, { status: 500 });

  const s3 = await hit(`${base}/api/ml/reputation/issues/build-from-claims?sellerId=${sellerId}&windowDays=365`);
  if (!s3.ok) return Response.json({ ok: false, failed_at: "issues_claims", step: s3 }, { status: 500 });

  const s4 = await hit(`${base}/api/ml/reputation/issues/build-from-summary?sellerId=${sellerId}`);
  if (!s4.ok) return Response.json({ ok: false, failed_at: "issues_summary", step: s4 }, { status: 500 });

  const s5 = await hit(`${base}/api/ml/cases/generate?sellerId=${sellerId}`);
  if (!s5.ok) return Response.json({ ok: false, failed_at: "cases_generate", step: s5 }, { status: 500 });

  const s6 = await hit(`${base}/api/ml/cases/reconcile?sellerId=${sellerId}`);
  if (!s6.ok) return Response.json({ ok: false, failed_at: "cases_reconcile", step: s6 }, { status: 500 });

  return Response.json({
    ok: true,
    sellerId,
    base,
    steps: {
      reputation_sync: s1,
      normalize: s2,
      issues_claims: s3,
      issues_summary: s4,
      cases_generate: s5,
      cases_reconcile: s6,
    },
  });
}
