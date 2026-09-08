import { NextResponse } from "next/server";
import { authErrorResponse, requireAdminRequest, supabaseApiAdmin } from "@/lib/apiAuth";
import { getCrmWorkspace } from "@/lib/crm/server";

export const dynamic = "force-dynamic";
const APP_URL = "https://www.subaproverde.com";
const HEADERS = { "Cache-Control": "private, no-store", Vary: "Authorization" };
const TASK_FIELDS = "id,contact_id,title,task_type,status,priority,due_at";

export async function GET(req: Request) {
  const auth = await requireAdminRequest(req);
  if (!auth.ok) return authErrorResponse(auth);
  const { workspace } = await getCrmWorkspace();
  if (!workspace) return NextResponse.json({ ok: false, error: "Workspace do CRM não encontrado." }, { status: 404, headers: HEADERS });

  const now = new Date();
  const nowIso = now.toISOString();
  const day = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
  const start = new Date(day + "T00:00:00-03:00").toISOString();
  const end = new Date(new Date(start).getTime() + 86_400_000).toISOString();
  const future = new Date(now.getTime() + 7 * 86_400_000).toISOString();
  const taskCount = () => supabaseApiAdmin.from("crm_tasks").select("id", { count: "exact", head: true }).eq("workspace_id", workspace.id).in("status", ["pending", "in_progress"]);
  const taskRows = () => supabaseApiAdmin.from("crm_tasks").select(TASK_FIELDS).eq("workspace_id", workspace.id).in("status", ["pending", "in_progress"]);

  const [today, overdue, waiting, leads, nextTasks, lateTasks] = await Promise.all([
    taskCount().gte("due_at", start).lt("due_at", end),
    taskCount().lt("due_at", nowIso),
    supabaseApiAdmin.from("crm_conversations").select("id", { count: "exact", head: true }).eq("workspace_id", workspace.id).in("status", ["open", "waiting_team"]).or("needs_human.eq.true,status.eq.waiting_team"),
    supabaseApiAdmin.from("crm_leads").select("id", { count: "exact", head: true }).eq("workspace_id", workspace.id).eq("status", "open").in("stage", ["new", "contacted", "qualified", "proposal", "negotiation"]),
    taskRows().gte("due_at", nowIso).lte("due_at", future).order("due_at").limit(4),
    taskRows().lt("due_at", nowIso).order("due_at").limit(4),
  ]);
  if ([today, overdue, waiting, leads, nextTasks, lateTasks].some((result) => result.error)) {
    return NextResponse.json({ ok: false, error: "Não foi possível atualizar o Radar SPV." }, { status: 500, headers: HEADERS });
  }
  const tasks = [...(nextTasks.data ?? []), ...(lateTasks.data ?? [])];
  const ids = [...new Set(tasks.map((task) => task.contact_id).filter(Boolean))];
  const contactResult = ids.length
    ? await supabaseApiAdmin.from("crm_contacts").select("id,name,company_name,phone").eq("workspace_id", workspace.id).in("id", ids)
    : { data: [], error: null };
  if (contactResult.error) return NextResponse.json({ ok: false, error: "Falha ao carregar os contatos." }, { status: 500, headers: HEADERS });
  const contacts = new Map((contactResult.data ?? []).map((contact) => [contact.id, contact.name || contact.company_name || contact.phone || "Contato sem nome"]));
  return NextResponse.json({
    ok: true, generatedAt: nowIso, timezone: "America/Sao_Paulo",
    metrics: { today: today.count ?? 0, overdue: overdue.count ?? 0, waitingTeam: waiting.count ?? 0, activeLeads: leads.count ?? 0 },
    tasks: tasks.map((task) => ({
      id: task.id, title: task.title, contactName: task.contact_id ? contacts.get(task.contact_id) ?? "Contato sem nome" : "Operação interna",
      dueAt: task.due_at, priority: task.priority, type: task.task_type, status: task.status, overdue: task.due_at < nowIso,
      deepLink: APP_URL + "/admin/crm/agenda?taskId=" + encodeURIComponent(task.id) + "&date=" + encodeURIComponent(task.due_at),
    })),
    links: { crm: APP_URL + "/admin/crm", agenda: APP_URL + "/admin/crm/agenda", conversations: APP_URL + "/admin/crm/conversas", finance: APP_URL + "/admin/crm/financeiro" },
  }, { headers: HEADERS });
}
