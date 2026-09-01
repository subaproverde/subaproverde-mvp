import { NextResponse } from "next/server";
import { authErrorResponse, requireAdminRequest, supabaseApiAdmin } from "@/lib/apiAuth";
import { cleanText, getCrmWorkspace } from "@/lib/crm/server";

export const dynamic = "force-dynamic";

const STAGES = ["new", "contacted", "qualified", "proposal", "negotiation", "won", "lost"] as const;

export async function GET(req: Request) {
  const auth = await requireAdminRequest(req);
  if (!auth.ok) return authErrorResponse(auth);
  const { workspace } = await getCrmWorkspace();
  if (!workspace) return NextResponse.json({ ok: false, error: "Workspace do CRM não encontrado." }, { status: 404 });

  const [leadsResult, contactsResult, conversationsResult] = await Promise.all([
    supabaseApiAdmin.from("crm_leads")
      .select("id,contact_id,title,stage,status,source,score,estimated_value,summary,loss_reason,last_contact_at,next_follow_up_at,created_at,updated_at")
      .eq("workspace_id", workspace.id).order("updated_at", { ascending: false }).limit(2000),
    supabaseApiAdmin.from("crm_contacts")
      .select("id,name,company_name,phone,email,lifecycle_stage,tags,last_interaction_at")
      .eq("workspace_id", workspace.id).limit(2000),
    supabaseApiAdmin.from("crm_conversations")
      .select("id,contact_id,status,needs_human,unread_count,last_message_at")
      .eq("workspace_id", workspace.id).order("last_message_at", { ascending: false }).limit(2000),
  ]);
  if (leadsResult.error || contactsResult.error || conversationsResult.error) {
    return NextResponse.json({ ok: false, error: "Falha ao carregar o funil." }, { status: 500 });
  }

  const contacts = new Map((contactsResult.data ?? []).map((contact) => [contact.id, contact]));
  const conversations = new Map<string, (typeof conversationsResult.data)[number]>();
  (conversationsResult.data ?? []).forEach((item) => { if (!conversations.has(item.contact_id)) conversations.set(item.contact_id, item); });

  const leads = (leadsResult.data ?? []).map((lead) => ({
    ...lead,
    contact: contacts.get(lead.contact_id) ?? null,
    conversation: conversations.get(lead.contact_id) ?? null,
  }));
  return NextResponse.json({ ok: true, generatedAt: new Date().toISOString(), leads }, { headers: { "Cache-Control": "no-store" } });
}

export async function PATCH(req: Request) {
  const auth = await requireAdminRequest(req);
  if (!auth.ok) return authErrorResponse(auth);
  const { workspace } = await getCrmWorkspace();
  if (!workspace) return NextResponse.json({ ok: false, error: "Workspace do CRM não encontrado." }, { status: 404 });
  const body = await req.json().catch(() => ({}));
  const leadId = cleanText(body.leadId, 100);
  if (!leadId) return NextResponse.json({ ok: false, error: "Oportunidade não informada." }, { status: 400 });

  const updates: Record<string, unknown> = {};
  if (body.stage !== undefined) {
    const stage = cleanText(body.stage, 40);
    if (!STAGES.includes(stage as (typeof STAGES)[number])) return NextResponse.json({ ok: false, error: "Etapa inválida." }, { status: 400 });
    updates.stage = stage;
    if (stage === "won") Object.assign(updates, { status: "won", won_at: new Date().toISOString(), lost_at: null });
    else if (stage === "lost") Object.assign(updates, { status: "lost", lost_at: new Date().toISOString(), won_at: null });
    else Object.assign(updates, { status: "open", won_at: null, lost_at: null });
  }
  if (body.score !== undefined) updates.score = Math.max(0, Math.min(100, Number(body.score) || 0));
  if (body.estimatedValue !== undefined) updates.estimated_value = Math.max(0, Number(body.estimatedValue) || 0);
  if (body.summary !== undefined) updates.summary = cleanText(body.summary, 3000);
  if (body.lossReason !== undefined) updates.loss_reason = cleanText(body.lossReason, 1000);
  if (body.nextFollowUpAt !== undefined) updates.next_follow_up_at = body.nextFollowUpAt ? new Date(body.nextFollowUpAt).toISOString() : null;
  if (!Object.keys(updates).length) return NextResponse.json({ ok: false, error: "Nenhuma alteração informada." }, { status: 400 });

  const { data: previous } = await supabaseApiAdmin.from("crm_leads").select("id,contact_id,stage").eq("workspace_id", workspace.id).eq("id", leadId).maybeSingle();
  if (!previous) return NextResponse.json({ ok: false, error: "Oportunidade não encontrada." }, { status: 404 });

  const { data: lead, error } = await supabaseApiAdmin.from("crm_leads").update(updates).eq("workspace_id", workspace.id).eq("id", leadId).select("*").single();
  if (error || !lead) return NextResponse.json({ ok: false, error: "Não foi possível atualizar a oportunidade." }, { status: 500 });

  if (updates.stage && updates.stage !== previous.stage) {
    await supabaseApiAdmin.from("crm_activities").insert({
      workspace_id: workspace.id,
      contact_id: previous.contact_id,
      lead_id: leadId,
      activity_type: "lead_stage_changed",
      title: "Etapa do funil alterada",
      description: `${previous.stage} → ${String(updates.stage)}`,
      actor_type: "operator",
      actor_id: auth.user.id,
      metadata: { from: previous.stage, to: updates.stage },
    });
  }
  return NextResponse.json({ ok: true, lead });
}
