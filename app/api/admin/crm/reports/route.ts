import { NextResponse } from "next/server";
import { authErrorResponse, requireAdminRequest, supabaseApiAdmin } from "@/lib/apiAuth";

export const dynamic = "force-dynamic";

const TYPE_LABELS: Record<string, string> = {
  reclamacao: "Reclamações",
  atraso: "Atrasos",
  cancelamento: "Cancelamentos",
  mediacao: "Mediações",
  outro: "Outros",
};

function number(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function rangeStart(range: string) {
  if (range === "all") return null;
  const days = [30, 90, 180, 365].includes(Number(range)) ? Number(range) : 90;
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() - days + 1);
  return date.toISOString().slice(0, 10);
}

function monthKey(value: string) {
  return String(value || "").slice(0, 7);
}

function monthLabel(key: string) {
  const [year, month] = key.split("-").map(Number);
  return new Intl.DateTimeFormat("pt-BR", { month: "short", year: "2-digit" })
    .format(new Date(year, Math.max(0, month - 1), 1)).replace(" de ", "/");
}

export async function GET(req: Request) {
  const auth = await requireAdminRequest(req);
  if (!auth.ok) return authErrorResponse(auth);

  const range = new URL(req.url).searchParams.get("range") || "90";
  const start = rangeStart(range);
  let removalsQuery = supabaseApiAdmin.from("admin_removals")
    .select("id,client_id,impact_type,status,charged_amount,success,service_date,completed_at,created_at")
    .order("service_date", { ascending: true }).limit(5000);
  let paymentsQuery = supabaseApiAdmin.from("crm_payments")
    .select("id,contact_id,status,amount,paid_at,confirmed_at,created_at")
    .eq("status", "confirmed").order("paid_at", { ascending: true }).limit(5000);
  if (start) {
    removalsQuery = removalsQuery.gte("service_date", start);
    paymentsQuery = paymentsQuery.gte("paid_at", `${start}T00:00:00.000Z`);
  }

  const [removalsResult, clientsResult, paymentsResult, contactsResult] = await Promise.all([
    removalsQuery,
    supabaseApiAdmin.from("admin_clients").select("id,name,contact_name,phone").limit(3000),
    paymentsQuery,
    supabaseApiAdmin.from("crm_contacts").select("id,name,company_name,phone").limit(3000),
  ]);
  const firstError = removalsResult.error || clientsResult.error || paymentsResult.error || contactsResult.error;
  if (firstError) return NextResponse.json({ ok: false, error: "Não foi possível montar os relatórios." }, { status: 500 });

  const clients = new Map((clientsResult.data ?? []).map((row) => [row.id, row]));
  const contacts = new Map((contactsResult.data ?? []).map((row) => [row.id, row]));
  const removals = removalsResult.data ?? [];
  const payments = paymentsResult.data ?? [];
  const completedStatuses = new Set(["removido", "finalizado"]);

  const byType = new Map<string, { key: string; label: string; count: number; success: number; revenue: number }>();
  const byClient = new Map<string, { id: string; name: string; count: number; success: number; revenue: number }>();
  const byMonth = new Map<string, { key: string; removals: number; success: number; billed: number; received: number }>();
  const byStatus = new Map<string, number>();

  for (const row of removals) {
    const type = row.impact_type || "outro";
    const successful = row.success === true || row.status === "removido";
    const completed = completedStatuses.has(row.status);
    const value = number(row.charged_amount);
    const typeRow = byType.get(type) || { key: type, label: TYPE_LABELS[type] || type, count: 0, success: 0, revenue: 0 };
    typeRow.count += 1;
    if (successful) typeRow.success += 1;
    if (completed) typeRow.revenue += value;
    byType.set(type, typeRow);

    const client = clients.get(row.client_id);
    const clientRow = byClient.get(row.client_id) || {
      id: row.client_id,
      name: client?.name || client?.contact_name || "Cliente sem nome",
      count: 0, success: 0, revenue: 0,
    };
    clientRow.count += 1;
    if (successful) clientRow.success += 1;
    if (completed) clientRow.revenue += value;
    byClient.set(row.client_id, clientRow);

    const key = monthKey(row.service_date || row.created_at);
    const month = byMonth.get(key) || { key, removals: 0, success: 0, billed: 0, received: 0 };
    month.removals += 1;
    if (successful) month.success += 1;
    if (completed) month.billed += value;
    byMonth.set(key, month);
    byStatus.set(row.status, (byStatus.get(row.status) || 0) + 1);
  }

  for (const payment of payments) {
    const key = monthKey(payment.paid_at || payment.confirmed_at || payment.created_at);
    const month = byMonth.get(key) || { key, removals: 0, success: 0, billed: 0, received: 0 };
    month.received += number(payment.amount);
    byMonth.set(key, month);
  }

  const totalRevenue = removals.filter((row) => completedStatuses.has(row.status)).reduce((sum, row) => sum + number(row.charged_amount), 0);
  const successCount = removals.filter((row) => row.success === true || row.status === "removido").length;
  const completedCount = removals.filter((row) => completedStatuses.has(row.status)).length;
  const receivedTotal = payments.reduce((sum, row) => sum + number(row.amount), 0);

  return NextResponse.json({
    ok: true,
    generatedAt: new Date().toISOString(),
    range,
    start,
    metrics: {
      removals: removals.length,
      completed: completedCount,
      successRate: removals.length ? successCount / removals.length : 0,
      billed: totalRevenue,
      received: receivedTotal,
      averageTicket: completedCount ? totalRevenue / completedCount : 0,
      activeClients: byClient.size,
    },
    byType: [...byType.values()].sort((a, b) => b.count - a.count),
    byClient: [...byClient.values()].sort((a, b) => b.revenue - a.revenue || b.count - a.count).slice(0, 100),
    byMonth: [...byMonth.values()].filter((row) => row.key).sort((a, b) => a.key.localeCompare(b.key)).map((row) => ({ ...row, label: monthLabel(row.key) })),
    byStatus: [...byStatus.entries()].map(([status, count]) => ({ status, count })).sort((a, b) => b.count - a.count),
    paymentContacts: payments.slice(-20).map((payment) => ({
      contactName: contacts.get(payment.contact_id)?.name || contacts.get(payment.contact_id)?.company_name || "Cliente",
      amount: number(payment.amount),
      paidAt: payment.paid_at || payment.confirmed_at || payment.created_at,
    })).reverse(),
  }, { headers: { "Cache-Control": "no-store" } });
}
