import { NextResponse } from "next/server";
import { authErrorResponse, requireAdminRequest, supabaseApiAdmin } from "@/lib/apiAuth";
import type { CrmOverview } from "@/lib/crm/types";

export const dynamic = "force-dynamic";

const WORKSPACE_SLUG = "suba-pro-verde";
const ACTIVE_STAGES = ["new", "contacted", "qualified", "proposal", "negotiation"];
const STAGE_LABELS: Record<string, string> = {
  new: "Novos",
  contacted: "Em conversa",
  qualified: "Qualificados",
  proposal: "Proposta",
  negotiation: "Negociação",
};

function isMissingSchema(error: { code?: string; message?: string } | null) {
  if (!error) return false;
  return error.code === "42P01" || error.code === "PGRST205" || error.message?.toLowerCase().includes("crm_workspaces") === true;
}

function emptyOverview(): CrmOverview {
  return {
    setupRequired: true,
    generatedAt: new Date().toISOString(),
    workspace: null,
    metrics: { activeLeads: 0, waitingTeam: 0, overdueFollowUps: 0, openReceivables: 0 },
    pipeline: ACTIVE_STAGES.map((stage) => ({ stage, label: STAGE_LABELS[stage], count: 0, value: 0 })),
    priorities: [],
    recentActivities: [],
    finance: { accounts: [], receiptsToReview: 0 },
    fiscal: { enabled: false, environment: "sandbox", provider: null },
  };
}

export async function GET(req: Request) {
  const auth = await requireAdminRequest(req);
  if (!auth.ok) return authErrorResponse(auth);

  const { data: workspace, error: workspaceError } = await supabaseApiAdmin
    .from("crm_workspaces")
    .select("id,name,slug")
    .eq("slug", WORKSPACE_SLUG)
    .maybeSingle();

  if (workspaceError || !workspace) {
    if (isMissingSchema(workspaceError) || !workspace) {
      return NextResponse.json(emptyOverview(), { headers: { "Cache-Control": "no-store" } });
    }
    return NextResponse.json({ ok: false, error: "Falha ao carregar o workspace do CRM." }, { status: 500 });
  }

  const nowIso = new Date().toISOString();
  const [contactsResult, leadsResult, conversationsResult, tasksResult, receivablesResult, receiptsResult, activitiesResult, accountsResult, fiscalResult] = await Promise.all([
    supabaseApiAdmin.from("crm_contacts").select("id,name,company_name").eq("workspace_id", workspace.id).limit(2000),
    supabaseApiAdmin.from("crm_leads").select("id,contact_id,title,stage,status,estimated_value,summary,last_contact_at,next_follow_up_at,updated_at").eq("workspace_id", workspace.id).order("updated_at", { ascending: false }).limit(500),
    supabaseApiAdmin.from("crm_conversations").select("id,contact_id,status,needs_human,unread_count,last_message_at").eq("workspace_id", workspace.id).in("status", ["open", "waiting_team"]).order("last_message_at", { ascending: false }).limit(100),
    supabaseApiAdmin.from("crm_tasks").select("id,contact_id,title,description,status,priority,due_at").eq("workspace_id", workspace.id).in("status", ["pending", "in_progress"]).order("due_at", { ascending: true, nullsFirst: false }).limit(100),
    supabaseApiAdmin.from("crm_receivables").select("id,contact_id,status,open_amount,due_date,description").eq("workspace_id", workspace.id).in("status", ["pending", "partially_paid", "overdue"]).limit(500),
    supabaseApiAdmin.from("crm_payment_receipts").select("id,contact_id,status,extracted_amount,created_at").eq("workspace_id", workspace.id).in("status", ["received", "review"]).order("created_at", { ascending: false }).limit(100),
    supabaseApiAdmin.from("crm_activities").select("id,contact_id,activity_type,title,description,occurred_at").eq("workspace_id", workspace.id).order("occurred_at", { ascending: false }).limit(20),
    supabaseApiAdmin.from("crm_financial_accounts").select("id,name,provider,integration_status,reconciliation_mode").eq("workspace_id", workspace.id).order("name"),
    supabaseApiAdmin.from("crm_fiscal_settings").select("enabled,environment,provider").eq("workspace_id", workspace.id).maybeSingle(),
  ]);

  const firstError = [contactsResult.error, leadsResult.error, conversationsResult.error, tasksResult.error, receivablesResult.error, receiptsResult.error, activitiesResult.error, accountsResult.error, fiscalResult.error].find(Boolean);
  if (firstError) {
    return NextResponse.json({ ok: false, error: "Falha ao carregar os dados do CRM." }, { status: 500 });
  }

  const contacts = new Map((contactsResult.data ?? []).map((contact) => [contact.id, contact.name || contact.company_name || "Contato sem nome"]));
  const leads = leadsResult.data ?? [];
  const conversations = conversationsResult.data ?? [];
  const tasks = tasksResult.data ?? [];
  const receivables = receivablesResult.data ?? [];
  const receipts = receiptsResult.data ?? [];
  const activities = activitiesResult.data ?? [];
  const priorities: CrmOverview["priorities"] = [];

  conversations.filter((item) => item.needs_human || item.status === "waiting_team").slice(0, 6).forEach((item) => {
    priorities.push({
      id: item.id,
      kind: "conversation",
      contactName: contacts.get(item.contact_id) ?? "Contato sem nome",
      title: item.needs_human ? "Conversa precisa de decisão" : "Aguardando a Suba",
      detail: item.unread_count > 0 ? `${item.unread_count} mensagem(ns) aguardando análise.` : "Conversa marcada para acompanhamento humano.",
      occurredAt: item.last_message_at,
      urgent: Boolean(item.needs_human),
    });
  });

  tasks.filter((item) => item.due_at && item.due_at <= nowIso).slice(0, 6).forEach((item) => {
    priorities.push({
      id: item.id,
      kind: "task",
      contactName: item.contact_id ? contacts.get(item.contact_id) ?? "Contato sem nome" : "Operação interna",
      title: item.title,
      detail: item.description || "Follow-up vencido.",
      occurredAt: item.due_at,
      urgent: item.priority === "urgent" || item.priority === "high",
    });
  });

  receipts.slice(0, 4).forEach((item) => {
    const amount = Number(item.extracted_amount ?? 0);
    priorities.push({
      id: item.id,
      kind: "receipt",
      contactName: contacts.get(item.contact_id) ?? "Contato sem nome",
      title: "Comprovante aguardando conferência",
      detail: amount > 0 ? `Valor lido: ${amount.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}.` : "O valor ainda precisa ser validado.",
      occurredAt: item.created_at,
      urgent: true,
    });
  });

  const overview: CrmOverview = {
    setupRequired: false,
    generatedAt: new Date().toISOString(),
    workspace,
    metrics: {
      activeLeads: leads.filter((item) => item.status === "open").length,
      waitingTeam: conversations.filter((item) => item.needs_human || item.status === "waiting_team").length,
      overdueFollowUps: tasks.filter((item) => item.due_at && item.due_at <= nowIso).length,
      openReceivables: receivables.reduce((sum, item) => sum + Number(item.open_amount ?? 0), 0),
    },
    pipeline: ACTIVE_STAGES.map((stage) => {
      const stageLeads = leads.filter((item) => item.status === "open" && item.stage === stage);
      return { stage, label: STAGE_LABELS[stage], count: stageLeads.length, value: stageLeads.reduce((sum, item) => sum + Number(item.estimated_value ?? 0), 0) };
    }),
    priorities: priorities.sort((a, b) => Number(b.urgent) - Number(a.urgent) || String(b.occurredAt).localeCompare(String(a.occurredAt))).slice(0, 10),
    recentActivities: activities.map((item) => ({
      id: item.id,
      contactName: item.contact_id ? contacts.get(item.contact_id) ?? "Contato sem nome" : "Operação interna",
      title: item.title,
      description: item.description,
      occurredAt: item.occurred_at,
      activityType: item.activity_type,
    })),
    finance: {
      accounts: (accountsResult.data ?? []).map((item) => ({ id: item.id, name: item.name, provider: item.provider, integrationStatus: item.integration_status, reconciliationMode: item.reconciliation_mode })),
      receiptsToReview: receipts.length,
    },
    fiscal: fiscalResult.data ?? { enabled: false, environment: "sandbox", provider: null },
  };

  return NextResponse.json(overview, { headers: { "Cache-Control": "no-store" } });
}
