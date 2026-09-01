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

type BridgeAnalysisEvent = {
  schema: 1;
  eventId: string;
  type: "conversation.analysis.completed";
  occurredAt: string;
  workspaceSlug?: string;
  source: "suba-agent";
  data: {
    phone?: string;
    jid?: string;
    alternateJid?: string;
    contactName?: string;
    sourceMessageIds: string[];
    analysis: {
      role: "commercial" | "ignore";
      decision: "auto_reply" | "no_reply" | "needs_approval" | "ack" | "escalate";
      proposedReply?: string;
      reason?: string;
      riskTags?: string[];
      confidence: number;
      ruleIds?: string[];
      evidence?: Array<{ source?: string; reference?: string; excerpt?: string }>;
      model?: string;
      provider?: string;
      modelUsage?: Record<string, unknown> | null;
      totalCostUsd?: number | null;
      facts?: Array<{
        category: string;
        key: string;
        valueText?: string;
        numericValue?: number;
        unit?: string;
        amount?: number;
        currency?: string;
        confidence: number;
        evidence?: string;
      }>;
      actions?: Array<{
        category: string;
        title: string;
        description?: string;
        dueAt?: string;
        serviceType?: string;
        quantity?: number;
        unitPrice?: number;
        totalAmount?: number;
        leadStage?: string;
        confidence: number;
        evidence?: string;
      }>;
    };
  };
};

type BridgeEvent = BridgeMessageEvent | BridgeAnalysisEvent;

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

function whatsappPhoneVariants(value: unknown) {
  const phone = digits(value);
  const variants = new Set(phone ? [phone] : []);
  if (/^55\d{2}9\d{8}$/.test(phone)) variants.add(`${phone.slice(0, 4)}${phone.slice(5)}`);
  if (/^55\d{10}$/.test(phone)) variants.add(`${phone.slice(0, 4)}9${phone.slice(4)}`);
  return [...variants];
}

function cleanIdentifier(value: unknown) {
  return String(value ?? "").trim().slice(0, 240);
}

function safeContactName(value: unknown, direction: "inbound" | "outbound") {
  if (direction !== "inbound") return "";
  const name = cleanIdentifier(value).slice(0, 160);
  if (!name || name === "~" || !/[\p{L}\p{N}]/u.test(name) || /^suba\s+pro\s+verde$/i.test(name)) return "";
  return name;
}

function schemaUnavailable(error: { code?: string } | null) {
  return error?.code === "42P01" || error?.code === "PGRST205";
}

function validEvent(value: unknown): value is BridgeEvent {
  if (!value || typeof value !== "object") return false;
  const event = value as Partial<BridgeEvent>;
  if (event.schema !== 1 || !["suba-bridge", "suba-agent"].includes(String(event.source))) return false;
  if (!event.eventId || !/^[A-Za-z0-9._:-]{1,200}$/.test(event.eventId)) return false;
  if (!event.occurredAt || Number.isNaN(new Date(event.occurredAt).getTime())) return false;
  if (!event.data || typeof event.data !== "object") return false;
  if (event.type === "conversation.analysis.completed" && event.source === "suba-agent") {
    const analysisEvent = event as Partial<BridgeAnalysisEvent>;
    return Array.isArray(analysisEvent.data?.sourceMessageIds)
      && Boolean(analysisEvent.data?.analysis)
      && ["auto_reply", "no_reply", "needs_approval", "ack", "escalate"].includes(String(analysisEvent.data?.analysis?.decision))
      && Number.isFinite(Number(analysisEvent.data?.analysis?.confidence));
  }
  if (!["conversation.message.received", "conversation.message.sent"].includes(String(event.type)) || event.source !== "suba-bridge") return false;
  const messageEvent = event as Partial<BridgeMessageEvent>;
  return Boolean(messageEvent.data?.externalMessageId)
    && ["inbound", "outbound"].includes(String(messageEvent.data?.direction));
}

function boundedConfidence(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0, Math.min(1, number)) : 0;
}

function boundedNumber(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

async function handleAnalysisEvent(event: BridgeAnalysisEvent, workspaceId: string) {
  const phone = digits(event.data.phone);
  const jid = cleanIdentifier(event.data.jid);
  const alternateJid = cleanIdentifier(event.data.alternateJid);
  const identifiers = Array.from(new Set([
    jid,
    alternateJid,
    ...whatsappPhoneVariants(phone).map((number) => `phone:${number}`),
  ].filter(Boolean)));
  if (!identifiers.length) {
    return NextResponse.json({ ok: false, error: "Análise sem identidade do contato." }, { status: 400 });
  }

  const { data: identities, error: identitiesError } = await supabaseApiAdmin
    .from("crm_contact_identities")
    .select("contact_id")
    .eq("workspace_id", workspaceId)
    .eq("channel", "whatsapp")
    .eq("provider", "evolution")
    .in("external_id", identifiers)
    .limit(10);
  if (identitiesError) {
    return NextResponse.json({ ok: false, error: "Falha ao resolver o contato da análise." }, { status: 500 });
  }
  const contactId = identities?.[0]?.contact_id ?? "";
  if (!contactId) {
    return NextResponse.json({ ok: false, error: "Contato da análise ainda não foi registrado." }, { status: 409 });
  }

  const { data: conversation } = await supabaseApiAdmin
    .from("crm_conversations")
    .select("id")
    .eq("workspace_id", workspaceId)
    .eq("contact_id", contactId)
    .order("last_message_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const analysis = event.data.analysis;
  const runPayload = {
    workspace_id: workspaceId,
    contact_id: contactId,
    conversation_id: conversation?.id ?? null,
    source_event_id: event.eventId,
    source_message_ids: event.data.sourceMessageIds.map(cleanIdentifier).filter(Boolean).slice(0, 50),
    role: analysis.role === "ignore" ? "ignore" : "commercial",
    decision: analysis.decision,
    proposed_reply: String(analysis.proposedReply ?? "").slice(0, 65_536),
    reason: String(analysis.reason ?? "").slice(0, 2_000),
    risk_tags: (analysis.riskTags ?? []).map(cleanIdentifier).filter(Boolean).slice(0, 30),
    confidence: boundedConfidence(analysis.confidence),
    rule_ids: (analysis.ruleIds ?? []).map(cleanIdentifier).filter(Boolean).slice(0, 30),
    evidence: (analysis.evidence ?? []).slice(0, 20),
    model: cleanIdentifier(analysis.model),
    provider: cleanIdentifier(analysis.provider),
    model_usage: analysis.modelUsage ?? null,
    total_cost_usd: analysis.totalCostUsd == null ? null : Math.max(0, boundedNumber(analysis.totalCostUsd)),
  };

  const { data: existingRun } = await supabaseApiAdmin
    .from("crm_ai_runs")
    .select("id")
    .eq("workspace_id", workspaceId)
    .eq("source_event_id", event.eventId)
    .maybeSingle();
  let runId = existingRun?.id ?? "";
  if (!runId) {
    const { data: createdRun, error: runError } = await supabaseApiAdmin
      .from("crm_ai_runs")
      .insert(runPayload)
      .select("id")
      .single();
    if (runError || !createdRun) {
      if (schemaUnavailable(runError)) {
        return NextResponse.json({ ok: false, error: "Schema do observador ainda não aplicado." }, { status: 503 });
      }
      return NextResponse.json({ ok: false, error: "Falha ao registrar a análise da IA." }, { status: 500 });
    }
    runId = createdRun.id;
  }

  const factRows = (analysis.facts ?? []).slice(0, 20).map((fact, index) => ({
    workspace_id: workspaceId,
    run_id: runId,
    contact_id: contactId,
    conversation_id: conversation?.id ?? null,
    suggestion_key: `fact:${index}:${cleanIdentifier(fact.category)}:${cleanIdentifier(fact.key)}`.slice(0, 240),
    suggestion_type: "fact",
    category: cleanIdentifier(fact.category) || "other",
    title: cleanIdentifier(fact.key) || "Fato observado",
    description: String(fact.valueText ?? "").slice(0, 2_000),
    structured_data: {
      key: cleanIdentifier(fact.key), valueText: String(fact.valueText ?? "").slice(0, 4_000),
      numericValue: boundedNumber(fact.numericValue), unit: cleanIdentifier(fact.unit),
      amount: Math.max(0, boundedNumber(fact.amount)), currency: cleanIdentifier(fact.currency) || "BRL",
    },
    confidence: boundedConfidence(fact.confidence),
    evidence: String(fact.evidence ?? "").slice(0, 2_000),
  }));
  const actionRows = (analysis.actions ?? []).slice(0, 20).map((action, index) => ({
    workspace_id: workspaceId,
    run_id: runId,
    contact_id: contactId,
    conversation_id: conversation?.id ?? null,
    suggestion_key: `action:${index}:${cleanIdentifier(action.category)}`.slice(0, 240),
    suggestion_type: "action",
    category: cleanIdentifier(action.category) || "other",
    title: cleanIdentifier(action.title) || "Ação sugerida",
    description: String(action.description ?? "").slice(0, 2_000),
    structured_data: {
      dueAt: cleanIdentifier(action.dueAt), serviceType: cleanIdentifier(action.serviceType),
      quantity: Math.max(0, boundedNumber(action.quantity)), unitPrice: Math.max(0, boundedNumber(action.unitPrice)),
      totalAmount: Math.max(0, boundedNumber(action.totalAmount)), leadStage: cleanIdentifier(action.leadStage),
    },
    confidence: boundedConfidence(action.confidence),
    evidence: String(action.evidence ?? "").slice(0, 2_000),
  }));
  const suggestionRows = [...factRows, ...actionRows];
  if (suggestionRows.length) {
    const { error: suggestionsError } = await supabaseApiAdmin
      .from("crm_ai_suggestions")
      .upsert(suggestionRows, { onConflict: "run_id,suggestion_key", ignoreDuplicates: true });
    if (suggestionsError) {
      return NextResponse.json({ ok: false, error: "Falha ao registrar sugestões da IA." }, { status: 500 });
    }
  }

  const { error: auditError } = await supabaseApiAdmin.from("crm_audit_events").upsert({
    workspace_id: workspaceId,
    event_key: event.eventId,
    entity_type: "ai_run",
    entity_id: runId,
    action: event.type,
    actor_type: "agent",
    actor_id: "bia",
    after_data: { runId, decision: analysis.decision, suggestions: suggestionRows.length },
    reasoning: String(analysis.reason ?? "").slice(0, 2_000),
    source_refs: event.data.sourceMessageIds.slice(0, 50).map((id) => ({ type: "whatsapp_message", id })),
  }, { onConflict: "workspace_id,event_key", ignoreDuplicates: true });
  if (auditError) {
    return NextResponse.json({ ok: false, error: "Falha ao auditar a análise da IA." }, { status: 500 });
  }
  return NextResponse.json({ ok: true, duplicate: Boolean(existingRun), runId, suggestions: suggestionRows.length }, { status: 202 });
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

  if (event.type === "conversation.analysis.completed") {
    return handleAnalysisEvent(event, workspace.id);
  }

  const phone = digits(event.data.phone);
  const jid = cleanIdentifier(event.data.jid);
  const alternateJid = cleanIdentifier(event.data.alternateJid);
  const identifiers = Array.from(new Set([
    jid,
    alternateJid,
    ...whatsappPhoneVariants(phone).map((number) => `phone:${number}`),
  ].filter(Boolean)));
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
        name: safeContactName(event.data.contactName, event.data.direction),
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
          is_primary: externalId === `phone:${phone}`,
        },
        { onConflict: "workspace_id,channel,provider,external_id", ignoreDuplicates: true }
      );
    if (identityError) {
      return NextResponse.json({ ok: false, error: "Falha ao vincular identidade do WhatsApp." }, { status: 500 });
    }
  }

  // Em mensagens enviadas pelo próprio WhatsApp, a Evolution normalmente devolve
  // o pushName da empresa ("Suba Pro Verde"), não o nome do cliente. Nunca use
  // esse valor para sobrescrever a identidade do contato.
  const contactName = safeContactName(event.data.contactName, event.data.direction);
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
    .eq("contact_id", contactId)
    .order("last_message_at", { ascending: false })
    .limit(1)
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
