import { NextResponse } from "next/server";
import { authErrorResponse, requireAdminRequest, supabaseApiAdmin } from "@/lib/apiAuth";

export const dynamic = "force-dynamic";
const WORKSPACE_SLUG = "suba-pro-verde";

export async function GET(req: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireAdminRequest(req);
  if (!auth.ok) return authErrorResponse(auth);
  const { id } = await context.params;
  const { data: workspace } = await supabaseApiAdmin.from("crm_workspaces").select("id").eq("slug", WORKSPACE_SLUG).maybeSingle();
  if (!workspace) return NextResponse.json({ ok: false, error: "Workspace não encontrado." }, { status: 404 });

  const { data: conversation, error } = await supabaseApiAdmin
    .from("crm_conversations")
    .select("id,contact_id,lead_id,status,assistant_mode,unread_count,needs_human,last_message_at,last_inbound_at,last_outbound_at")
    .eq("workspace_id", workspace.id).eq("id", id).maybeSingle();
  if (error || !conversation) return NextResponse.json({ ok: false, error: "Conversa não encontrada." }, { status: 404 });

  const [contactResult, identitiesResult, leadResult, messagesResult, runsResult, suggestionsResult, factsResult, ordersResult, tasksResult] = await Promise.all([
    supabaseApiAdmin.from("crm_contacts").select("id,name,company_name,phone,email,lifecycle_stage,tags,notes").eq("id", conversation.contact_id).single(),
    supabaseApiAdmin.from("crm_contact_identities").select("external_id,is_primary").eq("workspace_id", workspace.id).eq("contact_id", conversation.contact_id).eq("channel", "whatsapp"),
    supabaseApiAdmin.from("crm_leads").select("id,stage,status,score,estimated_value,summary,next_follow_up_at").eq("workspace_id", workspace.id).eq("contact_id", conversation.contact_id).order("created_at", { ascending: false }).limit(1).maybeSingle(),
    supabaseApiAdmin.from("crm_messages").select("id,external_message_id,direction,sender_type,message_type,body,transcription,media_url,occurred_at").eq("conversation_id", id).order("occurred_at", { ascending: true }).limit(500),
    supabaseApiAdmin.from("crm_ai_runs").select("id,decision,proposed_reply,reason,risk_tags,confidence,rule_ids,evidence,model,provider,total_cost_usd,created_at").eq("conversation_id", id).order("created_at", { ascending: false }).limit(20),
    supabaseApiAdmin.from("crm_ai_suggestions").select("id,suggestion_type,category,title,description,structured_data,confidence,evidence,status,created_at").eq("conversation_id", id).order("created_at", { ascending: false }).limit(80),
    supabaseApiAdmin.from("crm_extracted_facts").select("id,fact_type,fact_key,fact_value,confidence,status,evidence,observed_at").eq("contact_id", conversation.contact_id).order("observed_at", { ascending: false }).limit(50),
    supabaseApiAdmin.from("crm_orders").select("id,status,payment_timing,total_amount,notes,created_at").eq("contact_id", conversation.contact_id).order("created_at", { ascending: false }).limit(20),
    supabaseApiAdmin.from("crm_tasks").select("id,title,description,status,priority,due_at,created_at").eq("contact_id", conversation.contact_id).order("created_at", { ascending: false }).limit(30),
  ]);
  if (contactResult.error || messagesResult.error) return NextResponse.json({ ok: false, error: "Falha ao carregar o atendimento." }, { status: 500 });

  const identities = identitiesResult.data ?? [];
  const phoneIdentity = identities.find((item) => item.is_primary && item.external_id.startsWith("phone:"));
  const jidIdentity = identities.find((item) => /@(s\.whatsapp\.net|lid)$/i.test(item.external_id));
  const phone = String(contactResult.data.phone || phoneIdentity?.external_id.replace(/^phone:/, "") || "").replace(/\D/g, "");

  return NextResponse.json({
    ok: true,
    conversation,
    contact: { ...contactResult.data, phone, jid: jidIdentity?.external_id ?? "" },
    lead: leadResult.data ?? null,
    messages: messagesResult.data ?? [],
    intelligence: {
      runs: runsResult.error ? [] : runsResult.data ?? [],
      suggestions: suggestionsResult.error ? [] : suggestionsResult.data ?? [],
      facts: factsResult.error ? [] : factsResult.data ?? [],
    },
    orders: ordersResult.error ? [] : ordersResult.data ?? [],
    tasks: tasksResult.error ? [] : tasksResult.data ?? [],
  }, { headers: { "Cache-Control": "no-store" } });
}
