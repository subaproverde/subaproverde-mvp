import { NextResponse } from "next/server";
import { authErrorResponse, requireAdminRequest, supabaseApiAdmin } from "@/lib/apiAuth";
import { cleanText, getCrmWorkspace } from "@/lib/crm/server";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const auth = await requireAdminRequest(req);
  if (!auth.ok) return authErrorResponse(auth);
  const { workspace } = await getCrmWorkspace();
  if (!workspace) return NextResponse.json({ ok: false, error: "Workspace do CRM não encontrado." }, { status: 404 });
  const url = new URL(req.url);
  const start = url.searchParams.get("start") || new Date(Date.now() - 7 * 86_400_000).toISOString();
  const end = url.searchParams.get("end") || new Date(Date.now() + 35 * 86_400_000).toISOString();

  const [tasksResult, contactsResult, leadsResult] = await Promise.all([
    supabaseApiAdmin.from("crm_tasks")
      .select("id,contact_id,lead_id,conversation_id,title,description,task_type,status,priority,due_at,completed_at,created_at")
      .eq("workspace_id", workspace.id).gte("due_at", start).lte("due_at", end).order("due_at").limit(2000),
    supabaseApiAdmin.from("crm_contacts").select("id,name,company_name,phone").eq("workspace_id", workspace.id).order("name").limit(2000),
    supabaseApiAdmin.from("crm_leads").select("id,contact_id,stage,status").eq("workspace_id", workspace.id).limit(2000),
  ]);
  if (tasksResult.error || contactsResult.error || leadsResult.error) return NextResponse.json({ ok: false, error: "Falha ao carregar a agenda." }, { status: 500 });

  const contacts = new Map((contactsResult.data ?? []).map((contact) => [contact.id, contact]));
  const tasks = (tasksResult.data ?? []).map((task) => ({ ...task, contact: task.contact_id ? contacts.get(task.contact_id) ?? null : null }));
  return NextResponse.json({ ok: true, generatedAt: new Date().toISOString(), contacts: contactsResult.data ?? [], leads: leadsResult.data ?? [], tasks }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(req: Request) {
  const auth = await requireAdminRequest(req);
  if (!auth.ok) return authErrorResponse(auth);
  const { workspace } = await getCrmWorkspace();
  if (!workspace) return NextResponse.json({ ok: false, error: "Workspace do CRM não encontrado." }, { status: 404 });
  const body = await req.json().catch(() => ({}));
  const title = cleanText(body.title, 220);
  const dueAt = body.dueAt ? new Date(body.dueAt) : null;
  if (!title || !dueAt || Number.isNaN(dueAt.getTime())) return NextResponse.json({ ok: false, error: "Informe título, data e horário válidos." }, { status: 400 });

  const { data: task, error } = await supabaseApiAdmin.from("crm_tasks").insert({
    workspace_id: workspace.id,
    contact_id: cleanText(body.contactId, 100) || null,
    lead_id: cleanText(body.leadId, 100) || null,
    title,
    description: cleanText(body.description, 2000),
    task_type: cleanText(body.taskType, 40) || "follow_up",
    status: "pending",
    priority: ["low", "medium", "high", "urgent"].includes(body.priority) ? body.priority : "medium",
    due_at: dueAt.toISOString(),
    assigned_to: auth.user.id,
  }).select("*").single();
  if (error || !task) return NextResponse.json({ ok: false, error: "Não foi possível criar o compromisso." }, { status: 500 });
  return NextResponse.json({ ok: true, task }, { status: 201 });
}

export async function PATCH(req: Request) {
  const auth = await requireAdminRequest(req);
  if (!auth.ok) return authErrorResponse(auth);
  const { workspace } = await getCrmWorkspace();
  if (!workspace) return NextResponse.json({ ok: false, error: "Workspace do CRM não encontrado." }, { status: 404 });
  const body = await req.json().catch(() => ({}));
  const taskId = cleanText(body.taskId, 100);
  if (!taskId) return NextResponse.json({ ok: false, error: "Compromisso não informado." }, { status: 400 });
  const updates: Record<string, unknown> = {};
  if (body.status !== undefined) {
    if (!["pending", "in_progress", "done", "cancelled"].includes(body.status)) return NextResponse.json({ ok: false, error: "Status inválido." }, { status: 400 });
    updates.status = body.status;
    updates.completed_at = body.status === "done" ? new Date().toISOString() : null;
  }
  if (body.dueAt !== undefined) updates.due_at = body.dueAt ? new Date(body.dueAt).toISOString() : null;
  if (body.title !== undefined) updates.title = cleanText(body.title, 220);
  const { data: task, error } = await supabaseApiAdmin.from("crm_tasks").update(updates).eq("workspace_id", workspace.id).eq("id", taskId).select("*").single();
  if (error || !task) return NextResponse.json({ ok: false, error: "Não foi possível atualizar o compromisso." }, { status: 500 });
  return NextResponse.json({ ok: true, task });
}
