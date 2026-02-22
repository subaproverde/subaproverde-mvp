import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(req: Request) {
  try {
    const auth = req.headers.get("authorization") || "";
    const token = auth.replace("Bearer ", "");

    if (!token) {
      return NextResponse.json({ ok: false }, { status: 401 });
    }

    const { data: userRes } = await supabase.auth.getUser(token);
    const user = userRes?.user;

    if (!user) {
      return NextResponse.json({ ok: false }, { status: 401 });
    }

    // 🔒 FILTRO IMPORTANTE → só sellers do usuário logado
    const { data, error } = await supabase
      .from("seller_accounts")
      .select("*")
      .eq("owner_user_id", user.id)
      .order("created_at", { ascending: false });

    if (error) throw error;

    return NextResponse.json({ ok: true, items: data ?? [] });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
