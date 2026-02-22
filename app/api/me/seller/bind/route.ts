import { NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const userId = body?.userId as string | undefined;
  const sellerId = body?.sellerId as string | undefined;

  if (!userId) return Response.json({ error: "userId obrigatório" }, { status: 400 });
  if (!sellerId) return Response.json({ error: "sellerId obrigatório" }, { status: 400 });

  // (opcional) tenta puxar ml_user_id / nickname do que já existe no seu banco
  let ml_user_id: string | null = null;
  let nickname: string | null = null;

  const { data: tokenRow } = await supabaseAdmin
    .from("ml_tokens")
    .select("ml_user_id, nickname")
    .eq("seller_id", sellerId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (tokenRow) {
    ml_user_id = tokenRow.ml_user_id ? String(tokenRow.ml_user_id) : null;
    nickname = tokenRow.nickname ?? null;
  }

  // Conecta (ou atualiza) esse usuário ao sellerId
  const { data, error } = await supabaseAdmin
    .from("seller_accounts")
    .upsert(
      [
        {
          owner_user_id: userId,
          seller_id: sellerId,
          ml_user_id,
          nickname,
        },
      ],
      { onConflict: "owner_user_id" }
    )
    .select("id, owner_user_id, seller_id, ml_user_id, nickname, created_at")
    .maybeSingle();

  if (error) {
    return Response.json({ error: "Falha ao salvar seller_accounts", details: error.message }, { status: 500 });
  }

  return Response.json({ ok: true, linked: data });
}
