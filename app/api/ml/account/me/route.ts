// app/api/ml/account/me/route.ts
import { NextRequest } from "next/server";
import { getValidMlAccessToken } from "@/lib/mlToken"; // ajuste se o caminho for outro

type ReputationLevel = "verde" | "amarelo" | "laranja" | "vermelho";

function clamp(n: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, n));
}

function parseLevel(levelId?: string | null): ReputationLevel {
  const raw = String(levelId ?? "").toLowerCase().trim();
  if (!raw) return "amarelo";

  const num = Number(raw.split("_")[0]);
  if (!Number.isNaN(num) && num > 0) {
    if (num === 1) return "vermelho";
    if (num === 2) return "laranja";
    if (num === 3) return "amarelo";
    if (num === 4) return "verde";
    if (num === 5) return "verde";
  }

  if (raw.includes("red")) return "vermelho";
  if (raw.includes("orange")) return "laranja";
  if (raw.includes("yellow") || raw.includes("amber")) return "amarelo";
  if (raw.includes("green")) return "verde";

  return "amarelo";
}

function scoreFromLevel(levelId?: string | null) {
  // score “base” por reputação (ajustável)
  const lvl = parseLevel(levelId);
  if (lvl === "verde") return 85;
  if (lvl === "amarelo") return 65;
  if (lvl === "laranja") return 35;
  return 15; // vermelho
}

function scoreFromExperience(exp?: string | null) {
  // ML: NEWBIE (você viu), e outros podem existir.
  // Mantém bem simples e estável.
  const v = String(exp ?? "").toUpperCase().trim();
  if (!v) return 50;

  if (v === "NEWBIE") return 60;
  if (v === "INTERMEDIATE") return 75;
  if (v === "ADVANCED") return 88;
  if (v === "EXPERT") return 95;

  return 60; // fallback
}

function scoreFromSales(completed?: number | null) {
  const c = Number(completed ?? 0) || 0;
  // curva suave: cresce rápido e estabiliza
  // 0 => 20, 100 => ~55, 500 => ~75, 2000 => ~90
  const s = 20 + 75 * (1 - Math.exp(-c / 800));
  return clamp(s);
}

function scoreFromRatings(ratings?: any) {
  // ratings: { negative, neutral, positive } (historic)
  const neg = Number(ratings?.negative ?? 0) || 0;
  const neu = Number(ratings?.neutral ?? 0) || 0;
  const pos = Number(ratings?.positive ?? 0) || 0;

  const total = neg + neu + pos;
  if (total <= 0) return 50; // sem dados -> neutro

  // penaliza negativo forte, neutro leve, positivo leve
  const negRate = neg / total;
  const neuRate = neu / total;

  const score = 100 - negRate * 120 - neuRate * 25;
  return clamp(score);
}

function computeSellerScore(data: any) {
  const rep = data?.seller_reputation ?? {};
  const level_id = rep?.level_id ?? null;

  const exp = data?.seller_experience ?? null;

  const tx = rep?.transactions ?? {};
  const completed = Number(tx?.completed ?? 0) || 0;
  const ratings = tx?.ratings ?? null;

  const levelScore = scoreFromLevel(level_id);
  const experienceScore = scoreFromExperience(exp);
  const salesScore = scoreFromSales(completed);
  const ratingScore = scoreFromRatings(ratings);

  // Pesos (ajustável)
  const score =
    levelScore * 0.40 +
    ratingScore * 0.25 +
    salesScore * 0.20 +
    experienceScore * 0.15;

  const level = parseLevel(level_id);

  return {
    score: clamp(Math.round(score)),
    level,
    breakdown: {
      levelScore: Math.round(levelScore),
      ratingScore: Math.round(ratingScore),
      experienceScore: Math.round(experienceScore),
      salesScore: Math.round(salesScore),
      level_id: level_id ?? null,
      seller_experience: exp ?? null,
      completed,
      positive: ratings?.positive ?? 0,
      neutral: ratings?.neutral ?? 0,
      negative: ratings?.negative ?? 0,
    },
  };
}

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const sellerId = sp.get("sellerId");

  if (!sellerId) {
    return Response.json({ ok: false, error: "sellerId obrigatório" }, { status: 400 });
  }

  try {
    const { accessToken } = await getValidMlAccessToken(sellerId);

    const r = await fetch("https://api.mercadolibre.com/users/me", {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: "no-store",
    });

    const data = await r.json().catch(() => null);

    if (!r.ok) {
      return Response.json(
        { ok: false, error: "Erro ao chamar Mercado Livre /users/me", status: r.status, data },
        { status: 502 }
      );
    }

    // ✅ computed score
    const computed = computeSellerScore(data);

    return Response.json({ ok: true, sellerId, data, computed });
  } catch (e: any) {
    const msg = e?.message ?? String(e);

    const action =
      msg.toLowerCase().includes("reconectar") ||
      msg.toLowerCase().includes("refresh token") ||
      msg.toLowerCase().includes("inexistente") ||
      msg.toLowerCase().includes("ausente")
        ? "reconnect_ml"
        : "retry";

    return Response.json(
      { ok: false, error: "Falha interna ao obter /users/me", details: msg, action },
      { status: 400 }
    );
  }
}
