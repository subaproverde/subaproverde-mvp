import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { authErrorResponse, requireAdminRequest, supabaseApiAdmin } from "@/lib/apiAuth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
const WORKSPACE_SLUG = "suba-pro-verde";
const DEFAULT_BRIDGE_URL = "https://painel.68-183-25-12.nip.io/internal/crm/commands";

async function sendBridgeCommand(secret: string, command: Record<string, unknown>) {
  const body = JSON.stringify(command);
  const signature = `sha256=${crypto.createHmac("sha256", secret).update(body).digest("hex")}`;
  const response = await fetch(process.env.CRM_BRIDGE_COMMAND_URL?.trim() || DEFAULT_BRIDGE_URL, {
    method: "POST", headers: { "Content-Type": "application/json", "X-SPV-Signature": signature }, body,
    signal: AbortSignal.timeout(20_000), cache: "no-store",
  });
  const result = await response.json().catch(() => ({})) as { error?: string };
  if (!response.ok) throw new Error(result.error || "Bridge indisponível.");
}

export async function POST(req: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireAdminRequest(req);
  if (!auth.ok) return authErrorResponse(auth);
  const { id } = await context.params;
  const input = await req.json().catch(() => ({})) as { action?: string; dueAt?: string };
  const action = String(input.action || "");
  if (!["mark_read", "take_over", "return_to_bia", "follow_up"].includes(action)) {
    return NextResponse.json({ ok: false, error: "Ação inválida." }, { status: 400 });
  }

  const { data: workspace } = await supabaseApiAdmin.from("crm_workspaces").select("id").eq("slug", WORKSPACE_SLUG).maybeSingle();
  const { data: conversation } = workspace ? await supabaseApiAdmin.from("crm_conversations").select("id,contact_id,lead_id").eq("workspace_id", workspace.id).eq("id", id).maybeSingle() : { data: null };
  if (!workspace || !conversation) return NextResponse.json({ ok: false, error: "Conversa não encontrada." }, { status: 404 });

  if (action === "mark_read") {
    await supabaseApiAdmin.from("crm_conversations").update({ unread_count: 0 }).eq("id", id);
  } else if (action === "follow_up") {
    const due = input.dueAt && !Number.isNaN(new Date(input.dueAt).getTime()) ? new Date(input.dueAt).toISOString() : new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    await supabaseApiAdmin.from("crm_tasks").insert({
      workspace_id: workspace.id, contact_id: conversation.contact_id, lead_id: conversation.lead_id,
      conversation_id: id, title: "Retomar conversa no WhatsApp", description: "Follow-up criado pela caixa de conversas.",
      task_type: "follow_up", status: "pending", priority: "medium", due_at: due,
    });
  } else {
    const secret = process.env.CRM_BRIDGE_SECRET?.trim() ?? "";
    if (secret.length < 32) return NextResponse.json({ ok: false, error: "Canal seguro do WhatsApp não configurado." }, { status: 503 });
    const [{ data: contact }, { data: identity }] = await Promise.all([
      supabaseApiAdmin.from("crm_contacts").select("phone").eq("id", conversation.contact_id).single(),
      supabaseApiAdmin.from("crm_contact_identities").select("external_id").eq("workspace_id", workspace.id).eq("contact_id", conversation.contact_id).eq("channel", "whatsapp").like("external_id", "phone:%").limit(1).maybeSingle(),
    ]);
    const phone = String(contact?.phone || identity?.external_id || "").replace(/\D/g, "");
    if (!/^[1-9]\d{7,14}$/.test(phone)) return NextResponse.json({ ok: false, error: "Contato sem número válido." }, { status: 409 });
    const command = { commandId: `crm-${crypto.randomUUID()}`, action: action === "take_over" ? "pause" : "resume", issuedAt: new Date().toISOString(), phone };
    try { await sendBridgeCommand(secret, command); } catch {
      return NextResponse.json({ ok: false, error: "Não foi possível alterar o controle da Bia." }, { status: 503 });
    }
    await supabaseApiAdmin.from("crm_conversations").update({
      assistant_mode: action === "take_over" ? "human" : "autonomous",
      status: action === "take_over" ? "paused" : "open",
      needs_human: action === "take_over",
    }).eq("id", id);
  }

  await supabaseApiAdmin.from("crm_audit_events").insert({
    workspace_id: workspace.id, event_key: `crm-action:${id}:${action}:${Date.now()}`,
    entity_type: "conversation", entity_id: id, action: `crm.conversation.${action}`,
    actor_type: "admin", actor_id: auth.user.id, after_data: { action }, reasoning: "Ação executada pelo operador na caixa de conversas.", source_refs: [],
  });
  return NextResponse.json({ ok: true, action });
}
