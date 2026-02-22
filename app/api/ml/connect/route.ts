import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(req: NextRequest) {
  try {
    const sp = req.nextUrl.searchParams;
    const userId = sp.get("userId");

    if (!userId) {
      return NextResponse.json(
        { error: "userId é obrigatório. Use /api/ml/connect?userId=SEU_USER_ID" },
        { status: 400 }
      );
    }

    const clientId = process.env.ML_CLIENT_ID;
    if (!clientId) {
      return NextResponse.json(
        { error: "ML_CLIENT_ID não configurado no .env.local" },
        { status: 500 }
      );
    }

    // origin robusto (ngrok/proxy)
    const forwardedHost = req.headers.get("x-forwarded-host");
    const forwardedProto = req.headers.get("x-forwarded-proto") ?? "https";
    const origin = forwardedHost ? `${forwardedProto}://${forwardedHost}` : req.nextUrl.origin;

    const redirectUri = `${origin}/api/ml/callback`;

    // limpa states antigos do usuário
    await supabaseAdmin.from("oauth_states").delete().eq("user_id", userId);

    const state = crypto.randomUUID();

    const { error: insErr } = await supabaseAdmin.from("oauth_states").insert({
      user_id: userId,
      state,
      provider: "mercadolivre",
      created_at: new Date().toISOString(),
    });

    if (insErr) {
      return NextResponse.json(
        { error: "Falha ao salvar oauth_state", details: insErr.message },
        { status: 500 }
      );
    }

    const scope = "offline_access read write";

    const authUrl =
      "https://auth.mercadolivre.com.br/authorization" +
      `?response_type=code` +
      `&client_id=${encodeURIComponent(clientId)}` +
      `&redirect_uri=${encodeURIComponent(redirectUri)}` +
      `&state=${encodeURIComponent(state)}` +
      `&scope=${encodeURIComponent(scope)}`;

    return NextResponse.redirect(authUrl);
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message ?? "Erro ao iniciar OAuth Mercado Livre" },
      { status: 500 }
    );
  }
}
