import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const ML_API = "https://api.mercadolibre.com";

type SellerAccountRow = {
  id: string;
  owner_user_id: string;
  seller_id: string;
  ml_user_id: string | null;
  nickname: string | null;
  created_at?: string | null;
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

    const { data: accs, error: accErr } = await supabase
      .from("seller_accounts")
      .select("id, owner_user_id, seller_id, ml_user_id, nickname, created_at")
      .eq("owner_user_id", userId)
      .order("created_at", { ascending: false });

    if (accErr) {
      return NextResponse.json(
        { ok: false, error: "DB error seller_accounts", details: accErr.message },
        { status: 500 }
      );
    }

    const rows = (accs ?? []) as SellerAccountRow[];

    if (!rows.length) {
      return NextResponse.json({ ok: true, items: [] });
    }

    const items = [];

    for (const acc of rows) {
      let nickname = norm(acc.nickname);
      let mlUserId = norm(acc.ml_user_id);

      if (!nickname) {
        let tokenRow: any = null;

        if (acc.seller_id) {
          const tBySeller = await supabase
            .from("ml_tokens")
            .select("access_token, ml_user_id, created_at")
            .eq("seller_id", acc.seller_id)
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle();

          if (tBySeller?.data?.access_token) {
            tokenRow = tBySeller.data;
          }
        }

        if (!tokenRow && acc.ml_user_id) {
          const tByMlUser = await supabase
            .from("ml_tokens")
            .select("access_token, ml_user_id, created_at")
            .eq("ml_user_id", acc.ml_user_id)
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle();

          if (tByMlUser?.data?.access_token) {
            tokenRow = tByMlUser.data;
          }
        }

        if (tokenRow?.access_token) {
          const me = await fetchMe(tokenRow.access_token);
          const mlNick = norm(me.body?.nickname);
          const mlId = norm(me.body?.id);

          if (mlNick) nickname = mlNick;
          if (mlId) mlUserId = mlId;

          if (mlNick || mlId) {
            const upd: any = {};
            if (mlNick) upd.nickname = mlNick;
            if (mlId) upd.ml_user_id = mlId;

            await supabase.from("seller_accounts").update(upd).eq("id", acc.id);
          }
        }
      }

      items.push({
        sellerId: acc.seller_id,
        sellerAccountId: acc.id,
        ml_user_id: mlUserId,
        nickname,
        created_at: acc.created_at ?? null,
      });
    }

    return NextResponse.json({
      ok: true,
      userId,
      items,
    });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: "Unhandled error", details: String(e?.message ?? e) },
      { status: 500 }
    );
  }
}