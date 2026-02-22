import { NextResponse } from "next/server";
import { z } from "zod";
import { supabaseAdmin } from "@/lib/supabase-admin"; // ajuste se o seu nome for outro

// ✅ lista única de status aceitos no backend
const CASE_STATUS_ENUM = z.enum([
  "novo",
  "em_analise",
  "aguardando_cliente",
  "chamado_aberto",
  "resolvido",
  "negado",
  "arquivado",
]);

const BodySchema = z.object({
  sellerId: z.string().min(1),
  caseId: z.string().min(1),

  status: CASE_STATUS_ENUM.optional(),

  protocol: z.string().optional(),
  notes: z.string().optional(),

  priority: z.string().optional(),
  assigned_to: z.string().nullable().optional(),
  due_date: z.string().nullable().optional(), // ISO
});

export async function POST(req: Request) {
  try {
    const body = BodySchema.parse(await req.json());

    const update: Record<string, any> = {};
    if (body.status) update.status = body.status;

    if (typeof body.protocol === "string") update.protocol = body.protocol;
    if (typeof body.notes === "string") update.notes = body.notes;

    if (typeof body.priority === "string") update.priority = body.priority;

    if ("assigned_to" in body) update.assigned_to = body.assigned_to ?? null;
    if ("due_date" in body) update.due_date = body.due_date ?? null;

    // 🔒 sellerId + caseId (garante que não atualiza case de outro seller)
    const { error } = await supabaseAdmin
      .from("cases")
      .update(update)
      .eq("id", body.caseId)
      .eq("seller_id", body.sellerId);

    if (error) {
      return NextResponse.json(
        { ok: false, error: "Falha ao atualizar case", details: error.message },
        { status: 400 }
      );
    }

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message ?? "Erro desconhecido" },
      { status: 400 }
    );
  }
}
