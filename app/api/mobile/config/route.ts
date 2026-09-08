import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export function GET() {
  // Only the same public credentials already distributed in the web client.
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return NextResponse.json({ error: "Configuração indisponível." }, { status: 503 });
  return NextResponse.json({ url, anonKey }, { headers: { "Cache-Control": "no-store" } });
}
