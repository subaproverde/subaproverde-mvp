import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { supabaseApiAdmin } from "@/lib/apiAuth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type BridgeMessageEvent = {
  schema: 1;
  eventId: string;
  type: "conversation.message.received" | "conversation.message.sent";
  occurredAt: string;
  workspaceSlug?: string;
  source: "suba-bridge";
  data: {
    externalMessageId: string;
    phone?: string;
    jid?: string;
    alternateJid?: string;
    contactName?: string;
    direction: "inbound" | "outbound";
    senderType?: "contact" | "assistant" | "operator" | "system";
    messageType?: "text" | "audio" | "image" | "document" | "video" | "location" | "other";
    body?: string;
    transcription?: string;
    mediaUrl?: string;
    raw?: Record<string, unknown>;
  };
};

function secureEqual(a: string, b: string) {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}

function validSignature(rawBody: string, received: string, secret: string) {
  const expected = `sha256=${crypto.createHmac("sha256", secret).update(rawBody).digest("hex")}`;
  return secureEqual(received, expected);
}

function digits(value: unknown) {
  return String(value ?? "").replace(/\D/g, "");
}

function cleanIdentifier(value: unknown) {
  return String(value ?? "").trim().slice(0, 240);
}

function schemaUnavailable(error: { code?: string } | null) {
  return error?.code === "42P01" || error?.code === "PGRST205";
}

function validEvent(value: unknown): value is BridgeMessageEvent {
  if (!value || typeof value !== "object") return false;
  const event = value as Partial<BridgeMessageEvent>;
  if (event.schema !== 1 || event.source !== "suba-bridge") return false;
  if (!event.eventId || !/^[A-Za-z0-9._:-]{1,200}$/.test(event.eventId)) return false;
  if (!event.type || !["conversation.message.received", "conversation.message.sent"].includes(event.type)) return false;
  if (!event.occurredAt || Number.isNaN(new Date(event.occurredAt).getTime())) return false;
  if (!event.data || !event.data.externalMessageId) return false;
  if (!event.data.direction || !["inbound", "outbound"].includes(event.data.direction)) return false;
  return true;
}

export async function POST(req: Request) {
  const secret = process.env.CRM_BRIDGE_SECRET?.trim() ?? "";
  if (secret.length < 32) {
    return NextResponse.json({ ok: false, error: "Integração CRM não configurada." }, { status: 503 });
  }

  const rawBody = await req.text();
  const signature = req.headers.get("x-spv-signature") ?? "";
  if (!validSignature(rawBody, signature, secret)) {
    return NextResponse.json({ ok: false, error: "Assinatura inválida." }, { status: 401 });
  }

  let event: unknown;
  try {
    event = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ ok: false, error: "JSON inválido." }, { status: 400 });
  }
  if (!validEvent(event)) {
    return NextResponse.json({ ok: false, error: "Evento inválido." }, { status: 400 });
  }

  const workspaceSlug = event.workspaceSlug || "suba-pro-verde";
  const { data: workspace, error: workspaceError } = await supabaseApiAdmin
    .from("crm_workspaces")
    .select("id,name")
    .eq("slug", workspaceSlug)
    .maybeSingle();

  if (schemaUnavailable(workspaceError)) {
    return NextResponse.json({ ok: false, error: "Schema do CRM ainda não aplicado." }, { status: 503 });
  }
  if (workspaceError || !workspace) {
    return NextResponse.json({ ok: false, error: "Workspace não encontrado." }, { status: 404 });
  }

  const { data: processedEvent } = await supabaseApiAdmin
    .from("crm_audit_events")
    .select("id")
    .eq("workspace_id", workspace.id)
    .eq("event_key", event.eventId)
    .maybeSingle();
  if (processedEvent) {
    return NextResponse.json({ ok: true, duplicate: true }, { status: 200 });
  }

  const phone = digits(event.data.phone);
  const jid = cleanIdentifier(event.data.jid);
  const alternateJid = cleanIdentifier(event.data.alternateJid);
  const identifiers = Array.from(new Set([jid, alternateJid, phone ? `phone:${phone}` : ""].filter(Boolean)));
  if (!identifiers.length) {
    return NextResponse.json({ ok: false, error: "Evento sem identidade do contato." }, { status: 400 });
  }

  const { data: knownIdentities, error: identitiesError } = await supabaseApiAdmin
    .from("crm_contact_identities")
    .select("contact_id,external_id")
    .eq("workspace_id", workspace.id)
    .eq("channel", "whatsapp")
    .eq("provider", "evolution")
    .in("external_id", identifiers)
    .limit(10);
  if (identitiesError) {
    return NextResponse.json({ ok: false, error: "Falha ao resolver identidade do WhatsApp." }, { status: 500 });
  }

  let contactId = knownIdentities?.[0]?.contact_id ?? "";
  if (!contactId) {
    const { data: contact, error: contactError } = await supabaseApiAdmin
      .from("crm_contacts")
      .insert({
        workspace_id: workspace.id,
        name: cleanIdentifier(event.data.contactName).slice(0, 160),
        phone,
        source: "whatsapp",
        lifecycle_stage: "lead",
        last_interaction_at: event.occurredAt,
      })
      .select("id")
      .single();
    if (contactError || !contact) {
      return NextResponse.json({ ok: false, error: "Falha ao criar contato." }, { status: 500 });
    }
    contactId = contact.id;
  }

  for (const externalId of identifiers) {
    const isPhone = externalId.startsWith("phone:");
    const { error: identityError } = await supabaseApiAdmin
      .from("crm_contact_identities")
      .upsert(
        {
          workspace_id: workspace.id,
          contact_id: contactId,
          channel: "whatsapp",
          provider: "evolution",
          external_id: externalId,
          normalized_value: isPhone ? phone : externalId.toLowerCase(),
          is_primary: isPhone,
        },
        { onConflict: "workspace_id,channel,provider,external_id", ignoreDuplicates: true }
      );
    if (identityError) {
      return NextResponse.json({ ok: false, error: "Falha ao vincular identidade do WhatsApp." }, { status: 500 });
    }
  }

  const contactName = cleanIdentifier(event.data.contactName).slice(0, 160);
  const { error: contactUpdateError } = await supabaseApiAdmin
    .from("crm_contacts")
    .update({
      ...(contactName ? { name: contactName } : {}),
      ...(phone ? { phone } : {}),
      last_interaction_at: event.occurredAt,
    })
    .eq("id", contactId);
  if (contactUpdateError) {
    return NextResponse.json({ ok: false, error: "Falha ao atualizar contato." }, { status: 500 });
  }

  const externalThreadId = phone ? `phone:${phone}` : jid || alternateJid;
  const { data: existingConversation } = await supabaseApiAdmin
    .from("crm_conversations")
    .select("id,unread_count")
    .eq("workspace_id", workspace.id)
    .eq("channel", "whatsapp")
    .eq("provider", "evolution")
    .eq("external_thread_id", externalThreadId)
    .maybeSingle();

  let conversationId = existingConversation?.id ?? "";
  if (!conversationId) {
    const { data: conversation, error: conversationError } = await supabaseApiAdmin
      .from("crm_conversations")
      .insert({
        workspace_id: workspace.id,
        contact_id: contactId,
        channel: "whatsapp",
        provider: "evolution",
        external_thread_id: externalThreadId,
        status: event.data.direction === "inbound" ? "open" : "waiting_customer",
        unread_count: event.data.direction === "inbound" ? 1 : 0,
        last_message_at: event.occurredAt,
        last_inbound_at: event.data.direction === "inbound" ? event.occurredAt : null,
        last_outbound_at: event.data.direction === "outbound" ? event.occurredAt : null,
      })
      .select("id")
      .single();
    if (conversationError || !conversation) {
      return NextResponse.json({ ok: false, error: "Falha ao criar conversa." }, { status: 500 });
    }
    conversationId = conversation.id;
  } else {
    const inbound = event.data.direction === "inbound";
    const { error: conversationError } = await supabaseApiAdmin
      .from("crm_conversations")
      .update({
        contact_id: contactId,
        status: inbound ? "open" : "waiting_customer",
        unread_count: inbound ? Number(existingConversation?.unread_count ?? 0) + 1 : 0,
        last_message_at: event.occurredAt,
        ...(inbound ? { last_inbound_at: event.occurredAt } : { last_outbound_at: event.occurredAt }),
      })
      .eq("id", conversationId);
    if (conversationError) {
      return NextResponse.json({ ok: false, error: "Falha ao atualizar conversa." }, { status: 500 });
    }
  }

  let leadId = "";
  const { data: openLead } = await supabaseApiAdmin
    .from("crm_leads")
    .select("id")
    .eq("workspace_id", workspace.id)
    .eq("contact_id", contactId)
    .eq("status", "open")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  leadId = openLead?.id ?? "";
  if (!leadId && event.data.direction === "inbound") {
    const { data: lead, error: leadError } = await supabaseApiAdmin
      .from("crm_leads")
      .insert({
        workspace_id: workspace.id,
        contact_id: contactId,
        title: contactName ? `Atendimento de ${contactName}` : "Novo atendimento pelo WhatsApp",
        stage: "new",
        status: "open",
        source: "whatsapp",
        last_contact_at: event.occurredAt,
      })
      .select("id")
      .single();
    if (leadError || !lead) {
      return NextResponse.json({ ok: false, error: "Falha ao criar lead." }, { status: 500 });
    }
    leadId = lead.id;
    await supabaseApiAdmin.from("crm_conversations").update({ lead_id: leadId }).eq("id", conversationId);
  } else if (leadId) {
    await supabaseApiAdmin.from("crm_leads").update({ last_contact_at: event.occurredAt }).eq("id", leadId);
    await supabaseApiAdmin.from("crm_conversations").update({ lead_id: leadId }).eq("id", conversationId);
  }

  const senderType = event.data.senderType ?? (event.data.direction === "inbound" ? "contact" : "assistant");
  const { error: messageError } = await supabaseApiAdmin.from("crm_messages").insert({
    workspace_id: workspace.id,
    conversation_id: conversationId,
    contact_id: contactId,
    external_message_id: event.data.externalMessageId,
    direction: event.data.direction,
    sender_type: senderType,
    message_type: event.data.messageType ?? "text",
    body: String(event.data.body ?? "").slice(0, 65_536),
    transcription: String(event.data.transcription ?? "").slice(0, 65_536),
    media_url: String(event.data.mediaUrl ?? "").slice(0, 2_000),
    occurred_at: event.occurredAt,
    raw_payload: event.data.raw ?? {},
  });
  if (messageError && messageError.code !== "23505") {
    return NextResponse.json({ ok: false, error: "Falha ao registrar mensagem." }, { status: 500 });
  }

  const activityTitle = event.data.direction === "inbound" ? "Mensagem recebida" : "Mensagem enviada";
  await supabaseApiAdmin.from("crm_activities").insert({
    workspace_id: workspace.id,
    contact_id: contactId,
    lead_id: leadId || null,
    conversation_id: conversationId,
    activity_type: event.type,
    title: activityTitle,
    description: String(event.data.transcription || event.data.body || event.data.messageType || "").slice(0, 500),
    actor_type: senderType,
    actor_id: event.source,
    source_event_id: event.eventId,
    occurred_at: event.occurredAt,
  });

  const { error: auditError } = await supabaseApiAdmin.from("crm_audit_events").insert({
    workspace_id: workspace.id,
    event_key: event.eventId,
    entity_type: "conversation",
    entity_id: conversationId,
    action: event.type,
    actor_type: "integration",
    actor_id: event.source,
    after_data: { contactId, conversationId, leadId: leadId || null, externalMessageId: event.data.externalMessageId },
    reasoning: "Evento técnico recebido do bridge WhatsApp.",
    source_refs: [{ type: "whatsapp_message", id: event.data.externalMessageId }],
  });
  if (auditError && auditError.code !== "23505") {
    return NextResponse.json({ ok: false, error: "Falha ao auditar evento." }, { status: 500 });
  }

  return NextResponse.json({ ok: true, duplicate: false, contactId, conversationId, leadId: leadId || null }, { status: 202 });
}
