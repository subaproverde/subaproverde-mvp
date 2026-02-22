import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { sellerId } = body;

    const auth = req.headers.get("authorization") || "";
    const token = auth.replace("Bearer ", "");

    const { data: userRes } = await supabase.auth.getUser(token);
    const user = userRes?.user;

    if (!user) {
      return NextResponse.json({ ok: false }, { status: 401 });
    }

    // salvamos o seller ativo do usuário
    await supabase.from("user_settings").upsert({
      user_id: user.id,
      active_seller_id: sellerId,
    });

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
