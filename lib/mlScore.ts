// lib/mlScore.ts

type Input = {
  seller_reputation?: any;
  seller_experience?: string | null;
};

type Result = {
  score: number;
  level: "verde" | "amarelo" | "laranja" | "vermelho";
  breakdown: any;
};

function clamp(n: number, a = 0, b = 100) {
  return Math.max(a, Math.min(b, n));
}

function levelScore(levelId?: string): number {
  if (!levelId) return 55;

  if (levelId.startsWith("5")) return 95;
  if (levelId.startsWith("4")) return 85;
  if (levelId.startsWith("3")) return 65;
  if (levelId.startsWith("2")) return 45;
  if (levelId.startsWith("1")) return 25;

  return 55;
}

function experienceScore(exp?: string | null): number {
  switch (exp) {
    case "NEWBIE":
      return 70; // antes 60 → estava punindo demais
    case "INTERMEDIATE":
      return 80;
    case "ADVANCED":
      return 90;
    default:
      return 70;
  }
}

function salesScore(completed?: number): number {
  if (!completed) return 50;

  if (completed > 5000) return 95;
  if (completed > 1000) return 88;
  if (completed > 500) return 80;
  if (completed > 200) return 70;
  if (completed > 50) return 60;

  return 50;
}

function ratingScore(ratings?: any): number {
  if (!ratings) return 75;

  const pos = ratings.positive ?? 0;
  const neu = ratings.neutral ?? 0;
  const neg = ratings.negative ?? 0;

  const total = pos + neu + neg;
  if (total === 0) return 80;

  const positiveRate = pos / total;
  return clamp(positiveRate * 100);
}

function levelFromScore(score: number) {
  if (score >= 80) return "verde";
  if (score >= 60) return "amarelo";
  if (score >= 40) return "laranja";
  return "vermelho";
}

export function computeMlSellerScore(input: Input): Result {
  const rep = input.seller_reputation ?? {};
  const transactions = rep.transactions ?? {};

  const level_id = rep.level_id;
  const ratings = transactions.ratings;
  const completed = transactions.completed;
  const experience = input.seller_experience;

  const lvl = levelScore(level_id);
  const rate = ratingScore(ratings);
  const exp = experienceScore(experience);
  const sales = salesScore(completed);

  // 🎯 NOVOS PESOS MAIS REALISTAS
  const score =
    lvl * 0.40 +
    rate * 0.25 +
    exp * 0.15 +
    sales * 0.20;

  const finalScore = Math.round(score);

  return {
    score: finalScore,
    level: levelFromScore(finalScore),
    breakdown: {
      levelScore: lvl,
      ratingScore: rate,
      experienceScore: exp,
      salesScore: sales,
      level_id,
      seller_experience: experience,
      completed,
      positive: ratings?.positive,
      neutral: ratings?.neutral,
      negative: ratings?.negative,
    },
  };
}
