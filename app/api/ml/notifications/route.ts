import { NextResponse } from "next/server";

export async function POST(req: Request) {
  // Mercado Livre envia notificações aqui
  // Por enquanto só confirmamos recebimento
  return NextResponse.json({ ok: true });
}

export async function GET() {
  // Alguns testes do ML usam GET
  return NextResponse.json({ ok: true });
}
