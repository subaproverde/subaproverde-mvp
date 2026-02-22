// app/api/ml/ml.ts
import { NextResponse } from "next/server";

// mlFetch: faz request com Authorization Bearer e transforma erro em mensagem clara
export async function mlFetch<T>(url: string, opts: { accessToken: string; init?: RequestInit }): Promise<T>;
export async function mlFetch<T>(url: string, opts: { accessToken: string }): Promise<T>;
export async function mlFetch<T>(url: string, opts: { accessToken: string; init?: RequestInit }): Promise<T> {
  const res = await fetch(url, {
    ...(opts.init ?? {}),
    headers: {
      ...(opts.init?.headers ?? {}),
      Authorization: `Bearer ${opts.accessToken}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    cache: "no-store",
  });

  const text = await res.text();
  if (!res.ok) {
    throw new Error(`ML error ${res.status}: ${text}`);
  }

  try {
    return JSON.parse(text) as T;
  } catch {
    // Se vier algo que não é JSON, retorna como string (mas tipado como any)
    return text as any as T;
  }
}

/**
 * ⚠️ IMPORTANTE:
 * Aqui você já deve ter uma função pronta que pega o access_token do seller no seu banco (ml_tokens).
 * Eu NÃO vou inventar a sua regra.
 *
 * Então deixe esse código chamando A SUA fonte de verdade.
 * Se você já tem isso funcionando em outra rota, só copie e cole para cá.
 */
export async function getSellerAccessToken(sellerId: string): Promise<string> {
  // ✅ Coloque AQUI a mesma lógica que você já usa no projeto pra buscar token no Supabase (ml_tokens).
  // Exemplo (pseudocódigo):
  // const token = await db.getTokenForSeller(sellerId)
  // if (!token) throw new Error("no token for seller")
  // return token.access_token

  throw new Error(
    "getSellerAccessToken não está implementado neste arquivo. Cole aqui a função que você já usa para ler o access_token do ml_tokens."
  );
}