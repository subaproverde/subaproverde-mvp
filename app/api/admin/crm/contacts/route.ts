import { NextResponse } from "next/server";
import { authErrorResponse, requireAdminRequest, supabaseApiAdmin } from "@/lib/apiAuth";
import { cleanText, getCrmWorkspace } from "@/lib/crm/server";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const auth = await requireAdminRequest(req);
  if (!auth.ok) return authErrorResponse(auth);

  const { workspace } = await getCrmWorkspace();
  if (!workspace) return NextResponse.json({ ok: false, error: "Workspace do CRM não encontrado." }, { status: 404 });

  const [contactsResult, leadsResult, conversationsResult, tasksResult, ordersResult] = await Promise.all([
    supabaseApiAdmin.from("crm_contacts")
      .select("id,name,company_name,phone,email,lifecycle_stage,source,tags,notes,last_interaction_at,created_at,updated_at")
      .eq("workspace_id", workspace.id).order("last_interaction_at", { ascending: false, nullsFirst: false }).limit(2000),
    supabaseApiAdmin.from("crm_leads")
      .select("id,contact_id,title,stage,status,source,score,estimated_value,summary,loss_reason,last_contact_at,next_follow_up_at,won_at,lost_at,created_at,updated_at")
      .eq("workspace_id", workspace.id).order("created_at", { ascending: false }).limit(2000),
    supabaseApiAdmin.from("crm_conversations")
      .select("id,contact_id,status,assistant_mode,needs_human,unread_count,last_message_at")
      .eq("workspace_id", workspace.id).order("last_message_at", { ascending: false }).limit(2000),
    supabaseApiAdmin.from("crm_tasks")
      .select("id,contact_id,status,priority,due_at")
      .eq("workspace_id", workspace.id).in("status", ["pending", "in_progress"]).limit(2000),
    supabaseApiAdmin.from("crm_orders")
      .select("id,contact_id,status,total_amount,created_at")
      .eq("workspace_id", workspace.id).order("created_at", { ascending: false }).limit(2000),
  ]);

  const firstError = [contactsResult.error, leadsResult.error, conversationsResult.error, tasksResult.error, ordersResult.error].find(Boolean);
  if (firstError) return NextResponse.json({ ok: false, error: "Falha ao carregar clientes do CRM." }, { status: 500 });

  const latestBy = <T extends { contact_id: string }>(items: T[]) => {
    const map = new Map<string, T>();
    items.forEach((item) => { if (!map.has(item.contact_id)) map.set(item.contact_id, item); });
    return map;
  };
  const leads = latestBy(leadsResult.data ?? []);
  const conversations = latestBy(conversationsResult.data ?? []);
  const tasks = tasksResult.data ?? [];
  const orders = ordersResult.data ?? [];

  const contacts = (contactsResult.data ?? []).map((contact) => {
    const lead = leads.get(contact.id) ?? null;
    const conversation = conversations.get(contact.id) ?? null;
    const contactTasks = tasks.filter((task) => task.contact_id === contact.id);
    const contactOrders = orders.filter((order) => order.contact_id === contact.id);
    return {
      ...contact,
      displayName: contact.name || contact.company_name || contact.phone || "Contato sem nome",
      lead,
      conversation,
      openTasks: contactTasks.length,
      nextTaskAt: contactTasks.map((task) => task.due_at).filter(Boolean).sort()[0] ?? null,
      ordersCount: contactOrders.length,
      ordersValue: contactOrders.reduce((sum, order) => sum + Number(order.total_amount ?? 0), 0),
    };
  });

  return NextResponse.json({ ok: true, generatedAt: new Date().toISOString(), contacts }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(req: Request) {
  const auth = await requireAdminRequest(req);
  if (!auth.ok) return authErrorResponse(auth);
  const { workspace } = await getCrmWorkspace();
  if (!workspace) return NextResponse.json({ ok: false, error: "Workspace do CRM não encontrado." }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const name = cleanText(body.name, 160);
  const phone = cleanText(body.phone, 40).replace(/[^\d+]/g, "");
  const companyName = cleanText(body.companyName, 160);
  if (!name && !phone && !companyName) return NextResponse.json({ ok: false, error: "Informe nome, empresa ou telefone." }, { status: 400 });

  const { data: contact, error: contactError } = await supabaseApiAdmin.from("crm_contacts").insert({
    workspace_id: workspace.id,
    name,
    company_name: companyName,
    phone,
    email: cleanText(body.email, 180),
    lifecycle_stage: "lead",
    source: cleanText(body.source, 40) || "manual",
    notes: cleanText(body.notes, 2000),
  }).select("id,name,company_name,phone,email,lifecycle_stage,source,tags,notes,last_interaction_at,created_at,updated_at").single();

  if (contactError || !contact) return NextResponse.json({ ok: false, error: "Não foi possível criar o contato." }, { status: 500 });

  const score = Math.max(0, Math.min(100, Number(body.score) || 0));
  const { data: lead, error: leadError } = await supabaseApiAdmin.from("crm_leads").insert({
    workspace_id: workspace.id,
    contact_id: contact.id,
    title: cleanText(body.title, 180) || `Oportunidade de ${name || companyName || phone}`,
    stage: "new",
    status: "open",
    source: cleanText(body.source, 40) || "manual",
    score,
    estimated_value: Math.max(0, Number(body.estimatedValue) || 0),
    summary: cleanText(body.summary, 2000),
  }).select("*").single();

  if (leadError) return NextResponse.json({ ok: false, error: "Contato criado, mas a oportunidade não pôde ser aberta." }, { status: 500 });
  return NextResponse.json({ ok: true, contact, lead }, { status: 201 });
}
