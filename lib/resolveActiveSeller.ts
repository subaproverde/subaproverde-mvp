export type ResolvedActiveSeller = {
  sellerId: string;
  source: "localStorage" | "api";
  previousLocalSellerId: string | null;
};

type ResolveActiveSellerOptions = {
  userId: string;
  fetchImpl?: typeof fetch;
  storage?: Pick<Storage, "getItem" | "setItem" | "removeItem">;
};

export async function resolveActiveSellerId({
  userId,
  fetchImpl = fetch,
  storage = typeof window !== "undefined" ? window.localStorage : undefined,
}: ResolveActiveSellerOptions): Promise<ResolvedActiveSeller> {
  if (!userId) {
    throw new Error("userId é obrigatório para resolver o seller ativo.");
  }

  let localSellerId: string | null = null;

  try {
    localSellerId = storage?.getItem("activeSellerId") ?? null;
  } catch {
    localSellerId = null;
  }

  const res = await fetchImpl(`/api/me/seller?userId=${encodeURIComponent(userId)}`, {
    cache: "no-store",
  });

  const json = await res.json().catch(() => ({}));

  if (!res.ok || !json?.sellerId) {
    throw new Error(json?.error ?? "Não foi possível identificar o seller desta conta.");
  }

  const backendSellerId = String(json.sellerId);

  // Corrige cache stale automaticamente
  if (localSellerId !== backendSellerId) {
    try {
      if (backendSellerId) {
        storage?.setItem("activeSellerId", backendSellerId);
      } else {
        storage?.removeItem("activeSellerId");
      }
    } catch {
      // falha de storage não deve quebrar a página
    }

    return {
      sellerId: backendSellerId,
      source: "api",
      previousLocalSellerId: localSellerId,
    };
  }

  return {
    sellerId: backendSellerId,
    source: "localStorage",
    previousLocalSellerId: localSellerId,
  };
}