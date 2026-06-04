import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { authErrorResponse, requireRequestUser } from "@/lib/apiAuth";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(req: Request) {
  const auth = await requireRequestUser(req);
  if (!auth.ok) return authErrorResponse(auth);

  const { data, error } = await supabaseAdmin
    .from("profiles")
    .select("id, full_name")
    .order("full_name", { ascending: true });

  if (error) {
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 500 }
    );
  }

  return NextResponse.json({
    ok: true,
    items: (data ?? []).map((x) => ({
      id: x.id,
      name: x.full_name ?? "(sem nome)",
    })),
  });
}
