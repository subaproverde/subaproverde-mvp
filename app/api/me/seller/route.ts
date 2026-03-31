import { NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const userId = sp.get("userId");

  if (!userId) {
    return Response.json(
      { error: "userId obrigatório" },
      { status: 400 }
    );
  }

  // =====================================================
  // 1) BUSCA SELLERS DO USUÁRIO
  // =====================================================
  const { data: sellers, error: sellersErr } = await supabaseAdmin
    .from("seller_accounts")
    .select("id, seller_id, ml_user_id, nickname, created_at")
    .eq("owner_user_id", userId)
    .order("created_at", { ascending: false });

  if (sellersErr) {
    return Response.json(
      { error: "Erro ao buscar seller_accounts", details: sellersErr.message },
      { status: 500 }
    );
  }

  if (!sellers || sellers.length === 0) {
    return Response.json(
      { error: "Nenhum seller encontrado para este usuário" },
      { status: 404 }
    );
  }

  // =====================================================
  // 2) BUSCA SELLER ATIVO
  // =====================================================
  const { data: settingsRow } = await supabaseAdmin
    .from("user_settings")
    .select("active_seller_id")
    .eq("user_id", userId)
    .maybeSingle();

  let activeSellerId = settingsRow?.active_seller_id ?? null;

  // =====================================================
  // 3) VALIDA SE O SELLER ATIVO PERTENCE AO USUÁRIO
  // =====================================================
  let activeSeller = sellers.find(s => s.seller_id === activeSellerId);

  // =====================================================
  // 4) FALLBACK (SE NÃO EXISTE OU INVÁLIDO)
  // =====================================================
  if (!activeSeller) {
    activeSeller = sellers[0]; // mais recente

    activeSellerId = activeSeller.seller_id;

    // salva como ativo automaticamente
    await supabaseAdmin
      .from("user_settings")
      .upsert({
        user_id: userId,
        active_seller_id: activeSellerId,
      });
  }

  // =====================================================
  // 5) RETORNO FINAL
  // =====================================================
  return Response.json({
    ok: true,
    userId,
    sellerId: activeSeller.seller_id,
    sellerAccountId: activeSeller.id,
    ml_user_id: activeSeller.ml_user_id,
    nickname: activeSeller.nickname,
    totalSellers: sellers.length,
  });
}