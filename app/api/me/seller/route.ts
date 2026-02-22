import { NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const userId = sp.get("userId");

  // ✅ No seu setup (ngrok + auth no browser/localStorage), o jeito correto é mandar userId
  if (!userId) {
    return Response.json(
      { error: "userId obrigatório neste MVP (use /api/me/seller?userId=...)" },
      { status: 400 }
    );
  }

  const { data, error } = await supabaseAdmin
    .from("seller_accounts")
    .select("id, owner_user_id, seller_id, ml_user_id, nickname, created_at")
    .eq("owner_user_id", userId)
    .maybeSingle();

  if (error) {
    return Response.json(
      { error: "Falha ao buscar seller_accounts", details: error.message },
      { status: 500 }
    );
  }

  if (!data) {
    return Response.json(
      { error: "seller_accounts não encontrado para este usuário" },
      { status: 404 }
    );
  }

  if (!data.seller_id) {
    return Response.json(
      { error: "seller_accounts encontrado, mas seller_id está vazio", seller_account_id: data.id },
      { status: 409 }
    );
  }

  return Response.json({
    ok: true,
    userId,
    sellerId: data.seller_id,
    sellerAccountId: data.id,
    ml_user_id: data.ml_user_id,
    nickname: data.nickname,
  });
}
