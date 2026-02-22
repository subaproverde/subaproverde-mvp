import { NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const sellerId = sp.get("sellerId");
  if (!sellerId) return Response.json({ error: "sellerId obrigatório" }, { status: 400 });

  const ttlSeconds = Number(sp.get("ttlSeconds") ?? "180"); // 3 min
  const force = sp.get("force") === "1";

  // 1) Cache: snapshot recente
  if (!force) {
    const sinceIso = new Date(Date.now() - ttlSeconds * 1000).toISOString();

    const { data: cached, error: cacheErr } = await supabaseAdmin
      .from("seller_reputation_snapshots")
      .select("id, payload, created_at, ml_user_id")
      .eq("seller_id", sellerId)
      .gte("created_at", sinceIso)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!cacheErr && cached) {
      return Response.json({
        ok: true,
        source: "cache",
        created_at: cached.created_at,
        ml_user_id: cached.ml_user_id,
        payload: cached.payload,
      });
    }
  }

  // 2) Token + ml_user_id
  const { data: tokenRow, error: tokenErr } = await supabaseAdmin
    .from("ml_tokens")
    .select("access_token, ml_user_id")
    .eq("seller_id", sellerId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (tokenErr || !tokenRow?.access_token) {
    return Response.json({ error: "Token ML não encontrado", details: tokenErr?.message }, { status: 400 });
  }
  if (!tokenRow?.ml_user_id) {
    return Response.json({ error: "ml_user_id vazio no ml_tokens" }, { status: 400 });
  }

  const accessToken = tokenRow.access_token as string;
  const mlUserId = String(tokenRow.ml_user_id);

  // 3) Chama reputação via users/{id}
  const url = `https://api.mercadolibre.com/users/${mlUserId}`;
  const r = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });
  const data = await r.json().catch(() => null);

  if (!r.ok) {
    return Response.json(
      { error: "Falha ao buscar reputação (users/{id})", status: r.status, url, data },
      { status: 502 }
    );
  }

  // ✅ PATCH: Atualiza seller_accounts com ml_user_id e nickname
  // Isso funciona para qualquer cliente/sellerId, desde que exista seller_accounts com seller_id = sellerId.
  try {
    await supabaseAdmin
      .from("seller_accounts")
      .update({
        ml_user_id: String(data?.id ?? mlUserId),
        nickname: data?.nickname ?? null,
      })
      .eq("seller_id", sellerId);
  } catch {
    // Não vamos quebrar o sync se falhar esse update (é “nice to have”)
  }

  // 4) Salva snapshot
  const { error: insErr } = await supabaseAdmin
    .from("seller_reputation_snapshots")
    .insert([{ seller_id: sellerId, ml_user_id: mlUserId, payload: data }]);

  if (insErr) {
    return Response.json({ error: "Falha ao salvar snapshot", details: insErr.message }, { status: 500 });
  }

  return Response.json({
    ok: true,
    source: "fresh",
    created_at: new Date().toISOString(),
    ml_user_id: mlUserId,
    payload: data,
  });
}
