import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const ML_API = "https://api.mercadolibre.com";

type SellerAccountRow = {
  id: string;
  owner_user_id: string;
  seller_id: string;          // seu UUID interno
  ml_user_id: string | null;  // id numérico do ML (se tiver)
  nickname: string | null;
  created_at?: string;
};

function norm(s: any) {
  const v = String(s ?? "").trim();
  return v.length ? v : null;
}

async function fetchMe(accessToken: string) {
  const r = await fetch(`${ML_API}/users/me`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });
  const j = await r.json().catch(() => ({}));
  return { ok: r.ok, status: r.status, body: j };
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get("userId") || "";

    if (!userId) {
      return NextResponse.json({ ok: false, error: "Missing userId" }, { status: 400 });
    }

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE, {
      auth: { persistSession: false },
    });

    // 1) pega o seller vinculado (se tiver mais de 1, pega o mais recente)
    const { data: accs, error: accErr } = await supabase
      .from("seller_accounts")
      .select("id, owner_user_id, seller_id, ml_user_id, nickname, created_at")
      .eq("owner_user_id", userId)
      .order("created_at", { ascending: false })
      .limit(1);

    if (accErr) {
      return NextResponse.json(
        { ok: false, error: "DB error seller_accounts", details: accErr.message },
        { status: 500 }
      );
    }

    const acc = (accs?.[0] ?? null) as SellerAccountRow | null;

    if (!acc?.seller_id) {
      return NextResponse.json({ ok: false, error: "No seller linked" }, { status: 404 });
    }

    let nickname = norm(acc.nickname);

    // DEBUG
    const debug: any = {
      sellerAccountFound: true,
      sellerAccountId: acc.id,
      sellerIdInternal: acc.seller_id,
      hadNicknameAlready: !!nickname,
      tokenFound: false,
      tokenMatchField: null as null | string,
      mlUsersMe: null as any,
      savedNickname: false,
    };

    // 2) se nickname vazio -> tenta achar token no ml_tokens
    if (!nickname) {
      // IMPORTANTÍSSIMO:
      // Em muitos projetos, ml_tokens NÃO guarda seller_id interno.
      // Pode guardar seller_account_id OU ml_user_id OU user_id.
      // Abaixo eu tento os 3 jeitos, na ordem.

      let tokenRow: any = null;

      // 2.1) tenta por seller_account_id (se existir essa coluna)
      const t1 = await supabase
        .from("ml_tokens")
        .select("access_token, refresh_token, expires_at, seller_account_id, seller_id, ml_user_id, created_at")
        .eq("seller_account_id", acc.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (t1?.data?.access_token) {
        tokenRow = t1.data;
        debug.tokenFound = true;
        debug.tokenMatchField = "seller_account_id";
      }

      // 2.2) tenta por seller_id (se existir e bater)
      if (!tokenRow) {
        const t2 = await supabase
          .from("ml_tokens")
          .select("access_token, refresh_token, expires_at, seller_account_id, seller_id, ml_user_id, created_at")
          .eq("seller_id", acc.seller_id)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (t2?.data?.access_token) {
          tokenRow = t2.data;
          debug.tokenFound = true;
          debug.tokenMatchField = "seller_id";
        }
      }

      // 2.3) tenta por ml_user_id (se você já tiver salvo)
      if (!tokenRow && acc.ml_user_id) {
        const t3 = await supabase
          .from("ml_tokens")
          .select("access_token, refresh_token, expires_at, seller_account_id, seller_id, ml_user_id, created_at")
          .eq("ml_user_id", acc.ml_user_id)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (t3?.data?.access_token) {
          tokenRow = t3.data;
          debug.tokenFound = true;
          debug.tokenMatchField = "ml_user_id";
        }
      }

      if (tokenRow?.access_token) {
        // 3) chama ML /users/me e pega nickname + id
        const me = await fetchMe(tokenRow.access_token);
        debug.mlUsersMe = { ok: me.ok, status: me.status, sample: { id: me.body?.id, nickname: me.body?.nickname } };

        const mlNick = norm(me.body?.nickname);
        const mlUserId = norm(me.body?.id);

        if (mlNick) {
          nickname = mlNick;

          // 4) salva de volta no seller_accounts (nickname e ml_user_id se vier)
          const upd: any = { nickname: mlNick };
          if (mlUserId) upd.ml_user_id = mlUserId;

          const { error: upErr } = await supabase
            .from("seller_accounts")
            .update(upd)
            .eq("id", acc.id);

          debug.savedNickname = !upErr;
        }
      }
    }

    return NextResponse.json({
      ok: true,
      userId,
      sellerId: acc.seller_id,
      sellerAccountId: acc.id,
      ml_user_id: acc.ml_user_id,
      nickname: nickname ?? null,
      debug,
    });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: "Unhandled error", details: String(e?.message ?? e) },
      { status: 500 }
    );
  }
}
  