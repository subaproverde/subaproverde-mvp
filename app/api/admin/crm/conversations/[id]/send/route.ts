import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { authErrorResponse, requireAdminRequest, supabaseApiAdmin } from "@/lib/apiAuth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const WORKSPACE_SLUG = "suba-pro-verde";
const DEFAULT_BRIDGE_URL = "https://painel.68-183-25-12.nip.io/internal/crm/commands";

export async function POST(req: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireAdminRequest(req);
  if (!auth.ok) return authErrorResponse(auth);
  const secret = process.env.CRM_BRIDGE_SECRET?.trim() ?? "";
  if (secret.length < 32) return NextResponse.json({ ok: false, error: "Canal seguro do WhatsApp não configurado." }, { status: 503 });

  const { id } = await context.params;
  const input = await req.json().catch(() => ({})) as { text?: string };
  const text = String(input.text ?? "").trim();
  if (!text || text.length > 4_000) return NextResponse.json({ ok: false, error: "Digite uma mensagem de até 4.000 caracteres." }, { status: 400 });

  const { data: workspace } = await supabaseApiAdmin.from("crm_workspaces").select("id").eq("slug", WORKSPACE_SLUG).maybeSingle();
  const { data: conversation } = workspace ? await supabaseApiAdmin.from("crm_conversations").select("id,contact_id").eq("workspace_id", workspace.id).eq("id", id).maybeSingle() : { data: null };
  if (!workspace || !conversation) return NextResponse.json({ ok: false, error: "Conversa não encontrada." }, { status: 404 });

  const [{ data: contact }, { data: identities }] = await Promise.all([
    supabaseApiAdmin.from("crm_contacts").select("phone").eq("id", conversation.contact_id).single(),
    supabaseApiAdmin.from("crm_contact_identities").select("external_id,is_primary").eq("workspace_id", workspace.id).eq("contact_id", conversation.contact_id).eq("channel", "whatsapp"),
  ]);
  const phoneIdentity = (identities ?? []).find((item) => item.external_id.startsWith("phone:"));
  const phoneJid = (identities ?? []).find((item) => /@s\.whatsapp\.net$/i.test(item.external_id));
  const lidJid = (identities ?? []).find((item) => /@lid$/i.test(item.external_id));
  const phone = String(contact?.phone || phoneIdentity?.external_id.replace(/^phone:/, "") || phoneJid?.external_id || "").replace(/\D/g, "");
  const jid = phoneJid?.external_id || lidJid?.external_id || "";
  if (!/^[1-9]\d{7,14}$/.test(phone)) return NextResponse.json({ ok: false, error: "Contato sem número de WhatsApp válido." }, { status: 409 });

  const command = { commandId: `crm-${crypto.randomUUID()}`, action: "send", issuedAt: new Date().toISOString(), phone, jid, text };
  const body = JSON.stringify(command);
  const signature = `sha256=${crypto.createHmac("sha256", secret).update(body).digest("hex")}`;
  const bridgeUrl = process.env.CRM_BRIDGE_COMMAND_URL?.trim() || DEFAULT_BRIDGE_URL;
  let response: Response;
  try {
    response = await fetch(bridgeUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-SPV-Signature": signature },
      body,
      signal: AbortSignal.timeout(20_000),
      cache: "no-store",
    });
  } catch {
    return NextResponse.json({ ok: false, error: "O WhatsApp está temporariamente indisponível. A mensagem não foi enviada." }, { status: 503 });
  }
  const result = await response.json().catch(() => ({})) as { status?: string; messageId?: string; error?: string };
  if (!response.ok) return NextResponse.json({ ok: false, error: result.error || "Falha ao entregar a mensagem ao WhatsApp." }, { status: 502 });

  await supabaseApiAdmin.from("crm_audit_events").insert({
    workspace_id: workspace.id,
    event_key: `crm-command:${command.commandId}`,
    entity_type: "conversation",
    entity_id: conversation.id,
    action: "crm.conversation.message_requested",
    actor_type: "admin",
    actor_id: auth.user.id,
    after_data: { commandId: command.commandId, deliveryStatus: result.status, messageId: result.messageId ?? null },
    reasoning: "Mensagem escrita pelo operador no CRM e enviada pelo bridge oficial.",
    source_refs: [],
  });
  return NextResponse.json({ ok: true, status: result.status || "queued", messageId: result.messageId ?? null });
}
