import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { authErrorResponse, requireAdminRequest, supabaseApiAdmin } from "@/lib/apiAuth";

export const dynamic = "force-dynamic";

const WORKSPACE_SLUG = "suba-pro-verde";

type FinanceAction = "create_receivable" | "settle_receivable" | "reconcile_receipt" | "cancel_receivable";

type FinanceBody = {
  action?: FinanceAction;
  contactId?: string;
  receivableId?: string;
  receiptId?: string;
  financialAccountId?: string;
  amount?: number;
  dueDate?: string | null;
  paidAt?: string | null;
  description?: string;
  allowDirectPayment?: boolean;
};

function text(value: unknown, maximum = 2_000) {
  return String(value ?? "").trim().slice(0, maximum);
}

function amount(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.round(parsed * 100) / 100 : 0;
}

function sameMoney(left: number, right: number) {
  return Math.abs(left - right) < 0.005;
}

function schemaUnavailable(error: { code?: string } | null) {
  return error?.code === "42P01" || error?.code === "42703" || error?.code === "PGRST205";
}

async function workspaceId() {
  const result = await supabaseApiAdmin.from("crm_workspaces").select("id,name").eq("slug", WORKSPACE_SLUG).maybeSingle();
  return { id: result.data?.id ?? "", name: result.data?.name ?? "", error: result.error };
}

async function audit(input: {
  workspaceId: string;
  action: string;
  entityType: string;
  entityId: string;
  userId: string;
  afterData?: Record<string, unknown>;
  reasoning: string;
}) {
  await supabaseApiAdmin.from("crm_audit_events").insert({
    workspace_id: input.workspaceId,
    event_key: `finance:${input.action}:${input.entityId}:${randomUUID()}`,
    entity_type: input.entityType,
    entity_id: input.entityId,
    action: `crm.finance.${input.action}`,
    actor_type: "admin",
    actor_id: input.userId,
    after_data: input.afterData ?? {},
    reasoning: input.reasoning,
    source_refs: [],
  });
}

export async function GET(req: Request) {
  const auth = await requireAdminRequest(req);
  if (!auth.ok) return authErrorResponse(auth);

  const workspace = await workspaceId();
  if (workspace.error || !workspace.id) {
    return NextResponse.json({ ok: false, setupRequired: schemaUnavailable(workspace.error), error: "Financeiro ainda não configurado." }, { status: workspace.error ? 503 : 404 });
  }

  const [receivablesResult, paymentsResult, receiptsResult, accountsResult, contactsResult, ordersResult] = await Promise.all([
    supabaseApiAdmin.from("crm_receivables")
      .select("id,contact_id,order_id,status,amount,paid_amount,open_amount,due_date,payment_timing,description,source,source_conversation_id,settled_at,metadata,created_at,updated_at")
      .eq("workspace_id", workspace.id).order("created_at", { ascending: false }).limit(500),
    supabaseApiAdmin.from("crm_payments")
      .select("id,contact_id,receivable_id,receipt_id,financial_account_id,status,amount,method,paid_at,confirmed_at,external_reference,created_at")
      .eq("workspace_id", workspace.id).order("paid_at", { ascending: false }).limit(1000),
    supabaseApiAdmin.from("crm_payment_receipts")
      .select("id,contact_id,receivable_id,conversation_id,message_id,status,claimed_amount,extracted_amount,payer_name,paid_at,bank_reference,file_url,confidence,financial_account_id,match_status,review_notes,created_at")
      .eq("workspace_id", workspace.id).order("created_at", { ascending: false }).limit(300),
    supabaseApiAdmin.from("crm_financial_accounts")
      .select("id,provider,name,account_type,active,reconciliation_mode,integration_status")
      .eq("workspace_id", workspace.id).eq("active", true).order("name"),
    supabaseApiAdmin.from("crm_contacts")
      .select("id,name,company_name,phone,email,admin_client_id")
      .eq("workspace_id", workspace.id).order("name").limit(1000),
    supabaseApiAdmin.from("crm_orders")
      .select("id,status,total_amount,payment_timing,confirmed_at,completed_at,created_at")
      .eq("workspace_id", workspace.id).order("created_at", { ascending: false }).limit(500),
  ]);

  const firstError = receivablesResult.error || paymentsResult.error || receiptsResult.error || accountsResult.error || contactsResult.error || ordersResult.error;
  if (firstError) {
    return NextResponse.json({ ok: false, setupRequired: schemaUnavailable(firstError), error: schemaUnavailable(firstError) ? "A atualização do financeiro ainda precisa ser aplicada." : "Não foi possível carregar o financeiro." }, { status: schemaUnavailable(firstError) ? 503 : 500 });
  }

  const contacts = contactsResult.data ?? [];
  const contactMap = new Map(contacts.map((contact) => [contact.id, contact]));
  const orderMap = new Map((ordersResult.data ?? []).map((order) => [order.id, order]));
  const accountMap = new Map((accountsResult.data ?? []).map((account) => [account.id, account]));
  const paymentRows = paymentsResult.data ?? [];
  const receiptMap = new Map((receiptsResult.data ?? []).map((receipt) => [receipt.id, receipt]));
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();

  const receivables = (receivablesResult.data ?? []).map((row) => ({
    id: row.id,
    contactId: row.contact_id,
    contact: contactMap.get(row.contact_id) ?? null,
    order: row.order_id ? orderMap.get(row.order_id) ?? null : null,
    status: row.status,
    amount: amount(row.amount),
    paidAmount: amount(row.paid_amount),
    openAmount: amount(row.open_amount),
    dueDate: row.due_date,
    paymentTiming: row.payment_timing,
    description: row.description,
    source: row.source,
    settledAt: row.settled_at,
    createdAt: row.created_at,
    payments: paymentRows.filter((payment) => payment.receivable_id === row.id).map((payment) => ({
      id: payment.id, amount: amount(payment.amount), status: payment.status, paidAt: payment.paid_at,
      account: payment.financial_account_id ? accountMap.get(payment.financial_account_id) ?? null : null,
      receipt: payment.receipt_id ? receiptMap.get(payment.receipt_id) ?? null : null,
    })),
  }));

  const receipts = (receiptsResult.data ?? []).map((row) => ({
    id: row.id,
    contactId: row.contact_id,
    contact: contactMap.get(row.contact_id) ?? null,
    receivableId: row.receivable_id,
    status: row.status,
    claimedAmount: amount(row.claimed_amount),
    extractedAmount: amount(row.extracted_amount),
    payerName: row.payer_name,
    paidAt: row.paid_at,
    bankReference: row.bank_reference,
    fileUrl: row.file_url,
    confidence: Number(row.confidence || 0),
    financialAccountId: row.financial_account_id,
    matchStatus: row.match_status,
    reviewNotes: row.review_notes,
    createdAt: row.created_at,
  }));

  const activeReceivables = receivables.filter((row) => !["paid", "cancelled"].includes(row.status));
  const paidThisMonth = paymentRows.filter((payment) => payment.status === "confirmed" && Date.parse(payment.paid_at || payment.confirmed_at || payment.created_at) >= monthStart)
    .reduce((sum, payment) => sum + amount(payment.amount), 0);

  return NextResponse.json({
    ok: true,
    generatedAt: new Date().toISOString(),
    metrics: {
      openAmount: activeReceivables.reduce((sum, row) => sum + row.openAmount, 0),
      overdueAmount: activeReceivables.filter((row) => row.dueDate && row.dueDate < now.toISOString().slice(0, 10)).reduce((sum, row) => sum + row.openAmount, 0),
      paidThisMonth,
      openCount: activeReceivables.length,
      receiptsToReview: receipts.filter((receipt) => ["received", "review"].includes(receipt.status)).length,
    },
    receivables,
    receipts,
    accounts: accountsResult.data ?? [],
    contacts,
  }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(req: Request) {
  const auth = await requireAdminRequest(req);
  if (!auth.ok) return authErrorResponse(auth);

  let body: FinanceBody;
  try { body = await req.json(); }
  catch { return NextResponse.json({ ok: false, error: "Dados inválidos." }, { status: 400 }); }

  const workspace = await workspaceId();
  if (workspace.error || !workspace.id) return NextResponse.json({ ok: false, error: "Workspace financeiro não encontrado." }, { status: 404 });
  const action = body.action;

  if (action === "create_receivable") {
    const contactId = text(body.contactId, 200);
    const value = amount(body.amount);
    if (!contactId || value <= 0) return NextResponse.json({ ok: false, error: "Informe cliente e valor." }, { status: 400 });
    const { data: contact } = await supabaseApiAdmin.from("crm_contacts").select("id").eq("workspace_id", workspace.id).eq("id", contactId).maybeSingle();
    if (!contact) return NextResponse.json({ ok: false, error: "Cliente não encontrado." }, { status: 404 });
    const result = await supabaseApiAdmin.from("crm_receivables").insert({
      workspace_id: workspace.id, contact_id: contactId, status: "pending", amount: value, paid_amount: 0,
      due_date: body.dueDate || null, payment_timing: "after_service",
      description: text(body.description, 500) || "Serviço Suba Pro Verde", source: "manual",
    }).select("id").single();
    if (result.error || !result.data) return NextResponse.json({ ok: false, error: "Não foi possível criar a conta a receber." }, { status: 500 });
    await audit({ workspaceId: workspace.id, action, entityType: "receivable", entityId: result.data.id, userId: auth.user.id, afterData: { amount: value, contactId }, reasoning: "Conta a receber criada manualmente." });
    return NextResponse.json({ ok: true, receivableId: result.data.id });
  }

  if (action === "cancel_receivable") {
    const receivableId = text(body.receivableId, 200);
    const { data: current } = await supabaseApiAdmin.from("crm_receivables").select("id,paid_amount,status").eq("workspace_id", workspace.id).eq("id", receivableId).maybeSingle();
    if (!current) return NextResponse.json({ ok: false, error: "Conta não encontrada." }, { status: 404 });
    if (amount(current.paid_amount) > 0) return NextResponse.json({ ok: false, error: "Uma conta com pagamento não pode ser cancelada." }, { status: 409 });
    const { error } = await supabaseApiAdmin.from("crm_receivables").update({ status: "cancelled" }).eq("id", receivableId);
    if (error) return NextResponse.json({ ok: false, error: "Não foi possível cancelar." }, { status: 500 });
    await audit({ workspaceId: workspace.id, action, entityType: "receivable", entityId: receivableId, userId: auth.user.id, reasoning: "Conta a receber cancelada pelo administrador." });
    return NextResponse.json({ ok: true });
  }

  if (!["settle_receivable", "reconcile_receipt"].includes(String(action))) {
    return NextResponse.json({ ok: false, error: "Ação financeira inválida." }, { status: 400 });
  }

  const receiptId = text(body.receiptId, 200);
  let receipt: Record<string, unknown> | null = null;
  if (action === "reconcile_receipt") {
    const result = await supabaseApiAdmin.from("crm_payment_receipts")
      .select("id,contact_id,receivable_id,status,claimed_amount,extracted_amount,paid_at,confidence")
      .eq("workspace_id", workspace.id).eq("id", receiptId).maybeSingle();
    if (result.error || !result.data) return NextResponse.json({ ok: false, error: "Comprovante não encontrado." }, { status: 404 });
    receipt = result.data;
    const { data: duplicate } = await supabaseApiAdmin.from("crm_payments").select("id").eq("receipt_id", receiptId).neq("status", "reversed").maybeSingle();
    if (duplicate) return NextResponse.json({ ok: true, duplicate: true, paymentId: duplicate.id });
  }

  let receivableId = text(body.receivableId || receipt?.receivable_id, 200);
  const contactIdFromReceipt = text(receipt?.contact_id, 200);
  let paymentAmount = amount(body.amount || receipt?.extracted_amount || receipt?.claimed_amount);
  if (paymentAmount <= 0) return NextResponse.json({ ok: false, error: "Informe o valor recebido." }, { status: 400 });

  if (!receivableId && action === "reconcile_receipt") {
    const { data: possible } = await supabaseApiAdmin.from("crm_receivables")
      .select("id,open_amount").eq("workspace_id", workspace.id).eq("contact_id", contactIdFromReceipt)
      .in("status", ["pending", "partially_paid", "overdue"]).order("created_at").limit(20);
    const exact = (possible ?? []).filter((row) => sameMoney(amount(row.open_amount), paymentAmount));
    if (exact.length === 1) receivableId = exact[0].id;
  }

  if (!receivableId && action === "reconcile_receipt" && body.allowDirectPayment) {
    const created = await supabaseApiAdmin.from("crm_receivables").insert({
      workspace_id: workspace.id, contact_id: contactIdFromReceipt, status: "pending", amount: paymentAmount,
      paid_amount: 0, due_date: new Date().toISOString().slice(0, 10), payment_timing: "after_service",
      description: text(body.description, 500) || "Pagamento direto identificado por comprovante",
      source: "direct_payment", metadata: { receiptId },
    }).select("id").single();
    if (created.error || !created.data) return NextResponse.json({ ok: false, error: "Não foi possível criar a conta do pagamento direto." }, { status: 500 });
    receivableId = created.data.id;
  }

  if (!receivableId) return NextResponse.json({ ok: false, error: "Selecione a conta que este pagamento está quitando." }, { status: 409 });
  const { data: receivable } = await supabaseApiAdmin.from("crm_receivables")
    .select("id,contact_id,status,amount,paid_amount,open_amount,description")
    .eq("workspace_id", workspace.id).eq("id", receivableId).maybeSingle();
  if (!receivable) return NextResponse.json({ ok: false, error: "Conta a receber não encontrada." }, { status: 404 });
  if (["paid", "cancelled"].includes(receivable.status)) return NextResponse.json({ ok: false, error: "Esta conta já está encerrada." }, { status: 409 });

  const openAmount = amount(receivable.open_amount);
  if (paymentAmount > openAmount && !sameMoney(paymentAmount, openAmount)) {
    if (receiptId) await supabaseApiAdmin.from("crm_payment_receipts").update({ match_status: "overpaid", status: "review", review_notes: `Comprovante de ${paymentAmount.toFixed(2)} excede saldo de ${openAmount.toFixed(2)}.` }).eq("id", receiptId);
    return NextResponse.json({ ok: false, difference: paymentAmount - openAmount, error: "O comprovante é maior que o saldo. Revise a diferença antes da baixa." }, { status: 409 });
  }
  if (sameMoney(paymentAmount, openAmount)) paymentAmount = openAmount;

  const accountId = text(body.financialAccountId, 200) || null;
  if (accountId) {
    const { data: account } = await supabaseApiAdmin.from("crm_financial_accounts").select("id").eq("workspace_id", workspace.id).eq("id", accountId).eq("active", true).maybeSingle();
    if (!account) return NextResponse.json({ ok: false, error: "Conta bancária inválida." }, { status: 400 });
  }
  const paidAt = body.paidAt && !Number.isNaN(new Date(body.paidAt).getTime()) ? new Date(body.paidAt).toISOString() : new Date().toISOString();
  const payment = await supabaseApiAdmin.from("crm_payments").insert({
    workspace_id: workspace.id, contact_id: receivable.contact_id, receivable_id: receivableId,
    receipt_id: receiptId || null, financial_account_id: accountId, status: "confirmed",
    amount: paymentAmount, method: "pix", paid_at: paidAt, confirmed_at: new Date().toISOString(),
    external_reference: receiptId ? `receipt:${receiptId}` : `manual:${randomUUID()}`,
  }).select("id").single();
  if (payment.error || !payment.data) return NextResponse.json({ ok: false, error: "Não foi possível registrar o pagamento." }, { status: 500 });

  const matchStatus = sameMoney(paymentAmount, openAmount) ? "exact" : "partial";
  if (receiptId) {
    await supabaseApiAdmin.from("crm_payment_receipts").update({
      receivable_id: receivableId, status: "approved", match_status: matchStatus,
      financial_account_id: accountId, reviewed_by: auth.user.id, reviewed_at: new Date().toISOString(),
      review_notes: matchStatus === "exact" ? "Valor conciliado com a conta a receber." : "Pagamento parcial conciliado.",
    }).eq("id", receiptId);
  }
  await supabaseApiAdmin.from("crm_financial_entries").insert({
    workspace_id: workspace.id, contact_id: receivable.contact_id, payment_id: payment.data.id,
    entry_type: "income", category: "servicos", status: "settled", amount: paymentAmount,
    competence_date: paidAt.slice(0, 10), settled_at: paidAt,
    description: text(receivable.description, 500) || "Recebimento de serviço",
  });
  await audit({
    workspaceId: workspace.id, action: action || "settle_receivable", entityType: "payment", entityId: payment.data.id,
    userId: auth.user.id, afterData: { receivableId, receiptId: receiptId || null, amount: paymentAmount, matchStatus },
    reasoning: receiptId ? "Comprovante conciliado e conta atualizada." : "Baixa financeira registrada manualmente.",
  });
  return NextResponse.json({ ok: true, paymentId: payment.data.id, receivableId, matchStatus });
}
