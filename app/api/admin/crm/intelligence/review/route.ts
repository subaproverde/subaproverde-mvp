import { NextResponse } from "next/server";
import { authErrorResponse, requireAdminRequest, supabaseApiAdmin } from "@/lib/apiAuth";

export const dynamic = "force-dynamic";

const WORKSPACE_SLUG = "suba-pro-verde";
const LEAD_STAGES = new Set(["new", "contacted", "qualified", "proposal", "negotiation", "won", "lost"]);

type ReviewBody = {
  suggestionId?: string;
  action?: "approve" | "reject";
};

type StructuredData = {
  key?: string;
  valueText?: string;
  numericValue?: number;
  unit?: string;
  amount?: number;
  currency?: string;
  dueAt?: string;
  serviceType?: string;
  quantity?: number;
  unitPrice?: number;
  totalAmount?: number;
  leadStage?: string;
};

function cleanText(value: unknown, maximum = 2_000) {
  return String(value ?? "").trim().slice(0, maximum);
}

function positiveNumber(value: unknown, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : fallback;
}

async function auditReview(input: {
  workspaceId: string;
  suggestionId: string;
  action: string;
  userId: string;
  entityType?: string | null;
  entityId?: string | null;
  reasoning: string;
}) {
  await supabaseApiAdmin.from("crm_audit_events").insert({
    workspace_id: input.workspaceId,
    event_key: `crm-ai-review:${input.suggestionId}:${input.action}`,
    entity_type: input.entityType || "ai_suggestion",
    entity_id: input.entityId || input.suggestionId,
    action: `crm.ai_suggestion.${input.action}`,
    actor_type: "admin",
    actor_id: input.userId,
    after_data: { suggestionId: input.suggestionId, appliedEntityType: input.entityType, appliedEntityId: input.entityId },
    reasoning: input.reasoning,
    source_refs: [{ type: "ai_suggestion", id: input.suggestionId }],
  });
}

export async function POST(req: Request) {
  const auth = await requireAdminRequest(req);
  if (!auth.ok) return authErrorResponse(auth);

  let body: ReviewBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Dados inválidos." }, { status: 400 });
  }

  const suggestionId = cleanText(body.suggestionId, 200);
  if (!suggestionId || !["approve", "reject"].includes(String(body.action))) {
    return NextResponse.json({ ok: false, error: "Revisão inválida." }, { status: 400 });
  }

  const { data: workspace, error: workspaceError } = await supabaseApiAdmin
    .from("crm_workspaces")
    .select("id")
    .eq("slug", WORKSPACE_SLUG)
    .maybeSingle();
  if (workspaceError || !workspace) {
    return NextResponse.json({ ok: false, error: "Workspace do CRM não encontrado." }, { status: 404 });
  }

  const { data: suggestion, error: suggestionError } = await supabaseApiAdmin
    .from("crm_ai_suggestions")
    .select("id,run_id,contact_id,conversation_id,suggestion_type,category,title,description,structured_data,confidence,evidence,status")
    .eq("workspace_id", workspace.id)
    .eq("id", suggestionId)
    .maybeSingle();
  if (suggestionError || !suggestion) {
    return NextResponse.json({ ok: false, error: "Sugestão não encontrada." }, { status: 404 });
  }
  if (suggestion.status !== "pending") {
    return NextResponse.json({ ok: true, duplicate: true, status: suggestion.status });
  }

  const reviewedAt = new Date().toISOString();
  if (body.action === "reject") {
    const { error } = await supabaseApiAdmin.from("crm_ai_suggestions").update({
      status: "rejected",
      reviewed_by: auth.user.id,
      reviewed_at: reviewedAt,
    }).eq("id", suggestion.id).eq("status", "pending");
    if (error) return NextResponse.json({ ok: false, error: "Não foi possível rejeitar a sugestão." }, { status: 500 });
    await auditReview({ workspaceId: workspace.id, suggestionId, action: "rejected", userId: auth.user.id, reasoning: "Sugestão rejeitada pelo administrador." });
    return NextResponse.json({ ok: true, status: "rejected" });
  }

  const data = (suggestion.structured_data ?? {}) as StructuredData;
  const { data: lead } = await supabaseApiAdmin
    .from("crm_leads")
    .select("id")
    .eq("workspace_id", workspace.id)
    .eq("contact_id", suggestion.contact_id)
    .eq("status", "open")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  let entityType = "";
  let entityId = "";
  let applyError: { message?: string } | null = null;

  if (suggestion.suggestion_type === "fact") {
    const result = await supabaseApiAdmin.from("crm_extracted_facts").insert({
      workspace_id: workspace.id,
      contact_id: suggestion.contact_id,
      conversation_id: suggestion.conversation_id,
      fact_type: cleanText(suggestion.category, 120) || "other",
      fact_key: cleanText(data.key || suggestion.title, 160) || "observacao",
      fact_value: data,
      confidence: Number(suggestion.confidence ?? 0),
      status: "confirmed",
      evidence: cleanText(suggestion.evidence),
      confirmed_at: reviewedAt,
    }).select("id").single();
    entityType = "extracted_fact";
    entityId = result.data?.id ?? "";
    applyError = result.error;
  } else if (suggestion.category === "schedule_follow_up") {
    const dueAt = data.dueAt && !Number.isNaN(new Date(data.dueAt).getTime()) ? new Date(data.dueAt).toISOString() : null;
    const result = await supabaseApiAdmin.from("crm_tasks").insert({
      workspace_id: workspace.id,
      contact_id: suggestion.contact_id,
      lead_id: lead?.id ?? null,
      conversation_id: suggestion.conversation_id,
      title: cleanText(suggestion.title, 240) || "Follow-up sugerido pela Bia",
      description: cleanText(suggestion.description),
      task_type: "follow_up",
      status: "pending",
      priority: "medium",
      due_at: dueAt,
      automation_key: `ai:${suggestion.id}`,
    }).select("id").single();
    entityType = "task";
    entityId = result.data?.id ?? "";
    applyError = result.error;
  } else if (suggestion.category === "update_lead_stage" && lead?.id && LEAD_STAGES.has(cleanText(data.leadStage, 40))) {
    const result = await supabaseApiAdmin.from("crm_leads").update({ stage: cleanText(data.leadStage, 40) }).eq("id", lead.id).select("id").single();
    entityType = "lead";
    entityId = result.data?.id ?? "";
    applyError = result.error;
  } else if (suggestion.category === "create_quote_draft") {
    const quantity = positiveNumber(data.quantity, 1);
    const total = positiveNumber(data.totalAmount, positiveNumber(data.unitPrice) * quantity);
    const unitPrice = positiveNumber(data.unitPrice, total / quantity);
    const quote = await supabaseApiAdmin.from("crm_quotes").insert({
      workspace_id: workspace.id,
      contact_id: suggestion.contact_id,
      lead_id: lead?.id ?? null,
      status: "draft",
      subtotal: total,
      total_amount: total,
      source_conversation_id: suggestion.conversation_id,
      notes: cleanText(suggestion.description),
    }).select("id").single();
    applyError = quote.error;
    if (quote.data?.id) {
      const item = await supabaseApiAdmin.from("crm_quote_items").insert({
        quote_id: quote.data.id,
        service_type: cleanText(data.serviceType, 120) || "servico",
        description: cleanText(suggestion.title, 500) || "Serviço identificado na conversa",
        quantity,
        unit_price: unitPrice,
        metadata: { sourceSuggestionId: suggestion.id },
      });
      applyError = applyError || item.error;
      entityType = "quote";
      entityId = quote.data.id;
    }
  } else if (suggestion.category === "create_order_draft") {
    const quantity = positiveNumber(data.quantity, 1);
    const total = positiveNumber(data.totalAmount, positiveNumber(data.unitPrice) * quantity);
    const unitPrice = positiveNumber(data.unitPrice, total / quantity);
    const order = await supabaseApiAdmin.from("crm_orders").insert({
      workspace_id: workspace.id,
      contact_id: suggestion.contact_id,
      lead_id: lead?.id ?? null,
      status: "review",
      payment_timing: "after_service",
      total_amount: total,
      source_conversation_id: suggestion.conversation_id,
      notes: cleanText(suggestion.description),
    }).select("id").single();
    applyError = order.error;
    if (order.data?.id) {
      const item = await supabaseApiAdmin.from("crm_order_items").insert({
        order_id: order.data.id,
        service_type: cleanText(data.serviceType, 120) || "servico",
        description: cleanText(suggestion.title, 500) || "Serviço identificado na conversa",
        quantity,
        unit_price: unitPrice,
        metadata: { sourceSuggestionId: suggestion.id },
      });
      applyError = applyError || item.error;
      entityType = "order";
      entityId = order.data.id;
    }
  } else if (suggestion.category === "create_receivable_draft" && positiveNumber(data.totalAmount || data.amount) > 0) {
    const result = await supabaseApiAdmin.from("crm_receivables").insert({
      workspace_id: workspace.id,
      contact_id: suggestion.contact_id,
      status: "pending",
      amount: positiveNumber(data.totalAmount || data.amount),
      paid_amount: 0,
      payment_timing: "after_service",
      description: cleanText(suggestion.description) || cleanText(suggestion.title, 500),
    }).select("id").single();
    entityType = "receivable";
    entityId = result.data?.id ?? "";
    applyError = result.error;
  } else if (suggestion.category === "review_payment_receipt") {
    const result = await supabaseApiAdmin.from("crm_payment_receipts").insert({
      workspace_id: workspace.id,
      contact_id: suggestion.contact_id,
      conversation_id: suggestion.conversation_id,
      status: "review",
      claimed_amount: positiveNumber(data.totalAmount || data.amount) || null,
      extracted_amount: positiveNumber(data.totalAmount || data.amount) || null,
      extraction: { source: "bia", suggestionId: suggestion.id, data },
      confidence: Number(suggestion.confidence ?? 0),
    }).select("id").single();
    entityType = "payment_receipt";
    entityId = result.data?.id ?? "";
    applyError = result.error;
  } else {
    const result = await supabaseApiAdmin.from("crm_tasks").insert({
      workspace_id: workspace.id,
      contact_id: suggestion.contact_id,
      lead_id: lead?.id ?? null,
      conversation_id: suggestion.conversation_id,
      title: cleanText(suggestion.title, 240) || "Revisar observação da Bia",
      description: `${cleanText(suggestion.description)}\n\nCategoria: ${cleanText(suggestion.category, 120)}`.trim(),
      task_type: "ai_review",
      status: "pending",
      priority: "medium",
      automation_key: `ai:${suggestion.id}`,
    }).select("id").single();
    entityType = "task";
    entityId = result.data?.id ?? "";
    applyError = result.error;
  }

  if (applyError || !entityId) {
    return NextResponse.json({ ok: false, error: "Não foi possível aplicar a sugestão com segurança." }, { status: 500 });
  }

  const { error: reviewError } = await supabaseApiAdmin.from("crm_ai_suggestions").update({
    status: "applied",
    applied_entity_type: entityType,
    applied_entity_id: entityId,
    reviewed_by: auth.user.id,
    reviewed_at: reviewedAt,
  }).eq("id", suggestion.id).eq("status", "pending");
  if (reviewError) {
    return NextResponse.json({ ok: false, error: "A ação foi criada, mas não foi possível concluir a revisão." }, { status: 500 });
  }

  await auditReview({
    workspaceId: workspace.id,
    suggestionId,
    action: "applied",
    userId: auth.user.id,
    entityType,
    entityId,
    reasoning: "Sugestão da Bia aprovada pelo administrador e aplicada em modo seguro.",
  });
  return NextResponse.json({ ok: true, status: "applied", entityType, entityId });
}
