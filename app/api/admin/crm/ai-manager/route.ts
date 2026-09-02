import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { authErrorResponse, requireAdminRequest, supabaseApiAdmin } from "@/lib/apiAuth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const WORKSPACE_SLUG = "suba-pro-verde";
const DEFAULT_BRIDGE_COMMAND_URL = "https://painel.68-183-25-12.nip.io/internal/crm/commands";

type BridgeStatus = {
  generatedAt: string;
  system: {
    bridgeOnline: boolean;
    agentOnline: boolean;
    whatsapp: string;
    lastError: string | null;
    lastAgentPoll: string | null;
    autoSend: boolean;
    transcriptionEnabled: boolean;
    crmEventsEnabled: boolean;
    crmEventsPending: number;
  };
  counts: { inbox: number; outbox: number; awaitingApproval: number; failed: number; paused: number; learnedRules: number };
  runtime: { enabled: boolean; shadowMode: boolean; autoSend: boolean; engine: string; model: string; effort: string; messageSettleMs: number; messageMaxWaitMs: number };
};

function bridgeStatusUrl() {
  const commandUrl = process.env.CRM_BRIDGE_COMMAND_URL?.trim() || DEFAULT_BRIDGE_COMMAND_URL;
  const url = new URL(commandUrl);
  url.pathname = "/internal/crm/status";
  url.search = "";
  return url.toString();
}

async function loadBridgeStatus(): Promise<BridgeStatus | null> {
  const secret = process.env.CRM_BRIDGE_SECRET?.trim() ?? "";
  if (secret.length < 32) return null;
  const issuedAt = new Date().toISOString();
  const signature = `sha256=${crypto.createHmac("sha256", secret).update(`GET\n/internal/crm/status\n${issuedAt}`).digest("hex")}`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 6_000);
  try {
    const response = await fetch(bridgeStatusUrl(), {
      headers: { "x-spv-issued-at": issuedAt, "x-spv-signature": signature },
      cache: "no-store",
      signal: controller.signal,
    });
    if (!response.ok) return null;
    return await response.json() as BridgeStatus;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

function ageHours(value: string | null) {
  if (!value) return Number.POSITIVE_INFINITY;
  return Math.max(0, (Date.now() - new Date(value).getTime()) / 3_600_000);
}

export async function GET(req: Request) {
  const auth = await requireAdminRequest(req);
  if (!auth.ok) return authErrorResponse(auth);

  const { data: workspace, error: workspaceError } = await supabaseApiAdmin
    .from("crm_workspaces").select("id,name,slug").eq("slug", WORKSPACE_SLUG).maybeSingle();
  if (workspaceError || !workspace) {
    return NextResponse.json({ ok: false, error: "CRM ainda não está disponível." }, { status: 503 });
  }

  const now = new Date();
  const last24h = new Date(now.getTime() - 86_400_000).toISOString();
  const last7d = new Date(now.getTime() - 7 * 86_400_000).toISOString();
  const [runsResult, suggestionsResult, conversationsResult, tasksResult, leadsResult, contactsResult, bridge] = await Promise.all([
    supabaseApiAdmin.from("crm_ai_runs")
      .select("id,conversation_id,decision,confidence,model,provider,total_cost_usd,created_at")
      .eq("workspace_id", workspace.id).gte("created_at", last7d).order("created_at", { ascending: true }).limit(5000),
    supabaseApiAdmin.from("crm_ai_suggestions")
      .select("id,status,suggestion_type,category,created_at")
      .eq("workspace_id", workspace.id).gte("created_at", last7d).limit(5000),
    supabaseApiAdmin.from("crm_conversations")
      .select("id,contact_id,status,needs_human,unread_count,last_message_at")
      .eq("workspace_id", workspace.id).in("status", ["open", "waiting_team"]).order("last_message_at", { ascending: true }).limit(500),
    supabaseApiAdmin.from("crm_tasks")
      .select("id,contact_id,title,description,status,priority,due_at")
      .eq("workspace_id", workspace.id).in("status", ["pending", "in_progress"]).order("due_at", { ascending: true, nullsFirst: false }).limit(500),
    supabaseApiAdmin.from("crm_leads")
      .select("id,contact_id,title,stage,status,summary,last_contact_at,next_follow_up_at,updated_at")
      .eq("workspace_id", workspace.id).eq("status", "open").limit(1000),
    supabaseApiAdmin.from("crm_contacts").select("id,name,company_name").eq("workspace_id", workspace.id).limit(3000),
    loadBridgeStatus(),
  ]);

  const error = [runsResult.error, suggestionsResult.error, conversationsResult.error, tasksResult.error, leadsResult.error, contactsResult.error].find(Boolean);
  if (error) return NextResponse.json({ ok: false, error: "Falha ao consolidar a gestão da IA." }, { status: 500 });

  const runs = runsResult.data ?? [];
  const runs24h = runs.filter((run) => run.created_at >= last24h);
  const suggestions = suggestionsResult.data ?? [];
  const conversations = conversationsResult.data ?? [];
  const tasks = tasksResult.data ?? [];
  const leads = leadsResult.data ?? [];
  const contacts = new Map((contactsResult.data ?? []).map((contact) => [contact.id, contact.name || contact.company_name || "Contato sem nome"]));
  const autonomous = runs.filter((run) => ["auto_reply", "no_reply", "ack"].includes(run.decision)).length;
  const totalCost7d = runs.reduce((sum, run) => sum + Number(run.total_cost_usd ?? 0), 0);
  const totalCost24h = runs24h.reduce((sum, run) => sum + Number(run.total_cost_usd ?? 0), 0);
  const costByModel = new Map<string, { calls: number; cost: number }>();
  for (const run of runs) {
    const model = run.model || run.provider || "sem modelo";
    const current = costByModel.get(model) ?? { calls: 0, cost: 0 };
    current.calls += 1;
    current.cost += Number(run.total_cost_usd ?? 0);
    costByModel.set(model, current);
  }

  const conversationRuns = new Map<string, string>();
  let closelyRepeatedRuns = 0;
  for (const run of runs) {
    if (!run.conversation_id) continue;
    const previous = conversationRuns.get(run.conversation_id);
    if (previous && new Date(run.created_at).getTime() - new Date(previous).getTime() < 3 * 60_000) closelyRepeatedRuns += 1;
    conversationRuns.set(run.conversation_id, run.created_at);
  }
  const paidNoReplyRuns = runs.filter((run) => run.decision === "no_reply" && Number(run.total_cost_usd ?? 0) > 0).length;

  const attention = [
    ...conversations.filter((item) => item.needs_human || item.status === "waiting_team").map((item) => ({
      id: `conversation:${item.id}`, kind: "conversation", contactName: contacts.get(item.contact_id) ?? "Contato sem nome",
      title: item.needs_human ? "Decisão humana aguardando" : "Cliente aguardando a Suba",
      detail: item.unread_count ? `${item.unread_count} mensagem(ns) ainda não tratada(s).` : `Parada há ${Math.round(ageHours(item.last_message_at))}h.`,
      href: `/admin/crm/conversas?conversation=${item.id}`, priority: item.needs_human ? 100 : 80, occurredAt: item.last_message_at,
    })),
    ...tasks.filter((item) => item.due_at && item.due_at <= now.toISOString()).map((item) => ({
      id: `task:${item.id}`, kind: "follow_up", contactName: item.contact_id ? contacts.get(item.contact_id) ?? "Contato sem nome" : "Operação interna",
      title: item.title, detail: item.description || "Follow-up vencido.", href: "/admin/crm/agenda",
      priority: item.priority === "urgent" ? 95 : item.priority === "high" ? 90 : 70, occurredAt: item.due_at,
    })),
    ...leads.filter((lead) => !lead.next_follow_up_at && ageHours(lead.last_contact_at || lead.updated_at) >= 24).map((lead) => ({
      id: `lead:${lead.id}`, kind: "lead", contactName: contacts.get(lead.contact_id) ?? "Contato sem nome",
      title: "Lead sem próxima ação", detail: `${lead.title || "Oportunidade"} está no estágio ${lead.stage} e não tem retorno agendado.`,
      href: "/admin/crm/funil", priority: 60, occurredAt: lead.last_contact_at || lead.updated_at,
    })),
  ].sort((a, b) => b.priority - a.priority || String(a.occurredAt).localeCompare(String(b.occurredAt))).slice(0, 12);

  const pendingSuggestions = suggestions.filter((item) => item.status === "pending");
  const approvalRuns = runs.filter((run) => ["needs_approval", "escalate"].includes(run.decision)).length;
  const response = {
    ok: true,
    generatedAt: now.toISOString(),
    workspace,
    health: {
      bridgeOnline: bridge?.system.bridgeOnline ?? false,
      agentOnline: bridge?.system.agentOnline ?? false,
      whatsapp: bridge?.system.whatsapp ?? "desconhecido",
      autoSend: bridge?.runtime.autoSend ?? false,
      model: bridge?.runtime.model || "claude-opus-5",
      effort: bridge?.runtime.effort || "high",
      lastPollAt: bridge?.system.lastAgentPoll ?? null,
      lastError: bridge?.system.lastError ?? null,
      transcriptionEnabled: bridge?.system.transcriptionEnabled ?? false,
      crmSyncEnabled: bridge?.system.crmEventsEnabled ?? false,
      messageSettleSeconds: Math.round((bridge?.runtime.messageSettleMs ?? 60_000) / 1000),
      queues: bridge?.counts ?? { inbox: 0, outbox: 0, awaitingApproval: 0, failed: 0, paused: 0, learnedRules: 0 },
    },
    metrics: {
      analyses24h: runs24h.length,
      analyses7d: runs.length,
      autonomyRate: runs.length ? autonomous / runs.length : 0,
      approvalRate: runs.length ? approvalRuns / runs.length : 0,
      averageConfidence: runs.length ? runs.reduce((sum, run) => sum + Number(run.confidence ?? 0), 0) / runs.length : 0,
      cost24h: totalCost24h,
      cost7d: totalCost7d,
      averageCost: runs.length ? totalCost7d / runs.length : 0,
      pendingMemories: pendingSuggestions.filter((item) => item.suggestion_type === "fact").length,
      pendingActions: pendingSuggestions.filter((item) => item.suggestion_type === "action").length,
    },
    attention,
    models: [...costByModel.entries()].map(([model, data]) => ({ model, ...data })).sort((a, b) => b.cost - a.cost),
    savings: {
      paidNoReplyRuns,
      closelyRepeatedRuns,
      estimatedAvoidableCalls: paidNoReplyRuns + closelyRepeatedRuns,
    },
    automations: [
      { id: "context", title: "Histórico antes de responder", detail: "A Bia lê a conversa recente e mantém o assunto em andamento.", status: "active", impact: "qualidade" },
      { id: "batch", title: "Agrupar mensagens picadas", detail: `Aguarda ${Math.round((bridge?.runtime.messageSettleMs ?? 60_000) / 1000)}s de silêncio e produz uma única decisão.`, status: "active", impact: "custo e contexto" },
      { id: "zero-cost", title: "Regras sem gastar Claude", detail: "Saudações, confirmações breves, marketing e canal do Mercado Livre são filtrados antes da IA.", status: "active", impact: "economia" },
      { id: "crm-extraction", title: "Conversa vira dado do CRM", detail: "A mesma análise extrai fatos, pedidos, valores, follow-ups e comprovantes, sem uma segunda chamada.", status: "active", impact: "automação" },
      { id: "payment", title: "Conferência de pagamento", detail: "Comprovante cria revisão; pagamento só é confirmado após conciliação do valor e da conta.", status: "human_review", impact: "segurança" },
      { id: "next-action", title: "Próxima melhor ação", detail: "Central prioriza conversas, follow-ups vencidos e leads sem retorno.", status: "active", impact: "vendas" },
      { id: "model-router", title: "Roteador inteligente de modelos", detail: "Manter Opus nas conversas e usar modelo mais econômico apenas em tarefas internas após avaliação comparativa.", status: "evaluation", impact: "economia sem perda" },
    ],
    guardrails: [
      { title: "Mercado Livre", detail: "Nenhuma mensagem desse canal recebe resposta ou pedido de aprovação.", active: true },
      { title: "Marketing e automações", detail: "Arquivados antes de chamar o modelo.", active: true },
      { title: "Preço, prazo e promessa novos", detail: "Precisam de validação do Bruno; repetições já aprovadas podem seguir.", active: true },
      { title: "Comprovantes", detail: "Nunca confirmar pagamento apenas pela imagem enviada.", active: true },
      { title: "Uma venda por linha", detail: "Validação bloqueia ou corrige IDs agrupados antes do envio.", active: true },
    ],
  };

  return NextResponse.json(response, { headers: { "Cache-Control": "no-store" } });
}
