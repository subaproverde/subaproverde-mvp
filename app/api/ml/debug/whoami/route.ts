import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const sellerId = String(searchParams.get("sellerId") ?? "").trim();
    if (!sellerId) {
      return NextResponse.json({ ok: false, error: "sellerId ausente" }, { status: 400 });
    }

    const { data: t, error } = await supabase
      .from("ml_tokens")
      .select("access_token, refresh_token, expires_at, ml_user_id")
      .eq("seller_id", sellerId)
      .maybeSingle();

    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    if (!t?.access_token) return NextResponse.json({ ok: false, error: "sem token" }, { status: 401 });

    const r = await fetch("https://api.mercadolibre.com/users/me", {
      headers: { Authorization: `Bearer ${t.access_token}` },
      cache: "no-store",
    });
    const j = await r.json().catch(() => ({}));

    return NextResponse.json({
      ok: r.ok,
      status: r.status,
      ml_error: r.ok ? null : (j?.message ?? j?.error ?? j),
      token_info: { expires_at: t.expires_at, ml_user_id: t.ml_user_id, has_refresh: !!t.refresh_token },
      me: r.ok ? { id: j?.id, nickname: j?.nickname, site_id: j?.site_id } : null,
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "erro" }, { status: 500 });
  }
}
