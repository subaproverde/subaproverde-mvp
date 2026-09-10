import { NextRequest, NextResponse } from "next/server";
import { supabaseApiAdmin, authErrorResponse, requireAdminRequest } from "@/lib/apiAuth";

export async function DELETE(
  req: NextRequest,
  { params }: { params: { sellerId: string } }
) {
  const auth = await requireAdminRequest(req);
  if (!auth.ok) return authErrorResponse(auth);

  const sellerId = String(params.sellerId ?? "").trim();
  if (!sellerId) {
    return NextResponse.json({ ok: false, error: "sellerId obrigatório." }, { status: 400 });
  }

  // Mantém o histórico operacional referenciado por seller_id, mas tira a
  // operação da lista e invalida as credenciais locais. Uma nova autorização
  // da mesma conta ML a reativa com segurança se for necessário no futuro.
  const { error: archiveErr } = await supabaseApiAdmin
    .from("sellers")
    .update({ status: "archived" })
    .eq("id", sellerId);

  if (archiveErr) {
    return NextResponse.json(
      { ok: false, error: "Falha ao remover seller.", details: archiveErr.message },
      { status: 500 }
    );
  }

  const [tokenResult, accountResult, settingsResult] = await Promise.all([
    supabaseApiAdmin.from("ml_tokens").delete().eq("seller_id", sellerId),
    supabaseApiAdmin.from("seller_accounts").delete().eq("seller_id", sellerId),
    supabaseApiAdmin
      .from("user_settings")
      .update({ active_seller_id: null })
      .eq("active_seller_id", sellerId),
  ]);

  const firstError = tokenResult.error || accountResult.error || settingsResult.error;
  if (firstError) {
    return NextResponse.json(
      {
        ok: false,
        error: "Seller arquivado, mas não foi possível concluir a limpeza.",
        details: firstError.message,
      },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true, sellerId });
}
