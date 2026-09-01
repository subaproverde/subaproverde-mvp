import { NextResponse } from "next/server";
import { authErrorResponse, requireAdminRequest, supabaseApiAdmin } from "@/lib/apiAuth";

export const dynamic = "force-dynamic";

const WORKSPACE_SLUG = "suba-pro-verde";

export async function GET(req: Request) {
  const auth = await requireAdminRequest(req);
  if (!auth.ok) return authErrorResponse(auth);

  const { data: workspace } = await supabaseApiAdmin.from("crm_workspaces").select("id").eq("slug", WORKSPACE_SLUG).maybeSingle();
  if (!workspace) return NextResponse.json({ ok: false, error: "Workspace não encontrado." }, { status: 404 });

  const { data: conversations, error } = await supabaseApiAdmin
    .from("crm_conversations")
    .select("id,contact_id,lead_id,status,assistant_mode,unread_count,needs_human,last_message_at,last_inbound_at,last_outbound_at")
    .eq("workspace_id", workspace.id)
    .eq("channel", "whatsapp")
    .order("last_message_at", { ascending: false, nullsFirst: false })
    .limit(250);
  if (error) return NextResponse.json({ ok: false, error: "Falha ao carregar conversas." }, { status: 500 });

  const contactIds = [...new Set((conversations ?? []).map((item) => item.contact_id))];
  const conversationIds = (conversations ?? []).map((item) => item.id);
  const [contactsResult, identitiesResult, leadsResult, messagesResult] = await Promise.all([
    contactIds.length ? supabaseApiAdmin.from("crm_contacts").select("id,name,company_name,phone,lifecycle_stage,tags").in("id", contactIds) : Promise.resolve({ data: [], error: null }),
    contactIds.length ? supabaseApiAdmin.from("crm_contact_identities").select("contact_id,external_id,is_primary").eq("workspace_id", workspace.id).eq("channel", "whatsapp").in("contact_id", contactIds) : Promise.resolve({ data: [], error: null }),
    contactIds.length ? supabaseApiAdmin.from("crm_leads").select("id,contact_id,stage,status,estimated_value,next_follow_up_at").eq("workspace_id", workspace.id).in("contact_id", contactIds).order("created_at", { ascending: false }) : Promise.resolve({ data: [], error: null }),
    conversationIds.length ? supabaseApiAdmin.from("crm_messages").select("id,conversation_id,direction,sender_type,message_type,body,transcription,occurred_at").in("conversation_id", conversationIds).order("occurred_at", { ascending: false }).limit(1500) : Promise.resolve({ data: [], error: null }),
  ]);
  if (contactsResult.error || identitiesResult.error || leadsResult.error || messagesResult.error) {
    return NextResponse.json({ ok: false, error: "Falha ao montar a caixa de conversas." }, { status: 500 });
  }

  const contacts = new Map((contactsResult.data ?? []).map((item) => [item.id, item]));
  const identitiesByContact = new Map<string, Array<{ external_id: string; is_primary: boolean }>>();
  for (const identity of identitiesResult.data ?? []) {
    const list = identitiesByContact.get(identity.contact_id) ?? [];
    list.push(identity);
    identitiesByContact.set(identity.contact_id, list);
  }
  type LeadRow = NonNullable<typeof leadsResult.data>[number];
  type MessageRow = NonNullable<typeof messagesResult.data>[number];
  const leadsByContact = new Map<string, LeadRow>();
  for (const lead of leadsResult.data ?? []) if (!leadsByContact.has(lead.contact_id)) leadsByContact.set(lead.contact_id, lead);
  const latestByConversation = new Map<string, MessageRow>();
  for (const message of messagesResult.data ?? []) if (!latestByConversation.has(message.conversation_id)) latestByConversation.set(message.conversation_id, message);

  const items = (conversations ?? []).map((conversation) => {
    const contact = contacts.get(conversation.contact_id);
    const identities = identitiesByContact.get(conversation.contact_id) ?? [];
    const primary = identities.find((item) => item.is_primary && item.external_id.startsWith("phone:"));
    const phone = String(contact?.phone || primary?.external_id.replace(/^phone:/, "") || "").replace(/\D/g, "");
    const latest = latestByConversation.get(conversation.id);
    const lead = leadsByContact.get(conversation.contact_id);
    return {
      ...conversation,
      contactName: contact?.name || contact?.company_name || phone || "Contato sem nome",
      phone,
      lifecycleStage: contact?.lifecycle_stage || "lead",
      tags: contact?.tags ?? [],
      leadStage: lead?.stage ?? "new",
      estimatedValue: Number(lead?.estimated_value ?? 0),
      nextFollowUpAt: lead?.next_follow_up_at ?? null,
      latestMessage: latest ? {
        id: latest.id,
        direction: latest.direction,
        senderType: latest.sender_type,
        messageType: latest.message_type,
        text: latest.transcription || latest.body || `[${latest.message_type}]`,
        occurredAt: latest.occurred_at,
      } : null,
    };
  });

  return NextResponse.json({ ok: true, generatedAt: new Date().toISOString(), items }, { headers: { "Cache-Control": "no-store" } });
}
