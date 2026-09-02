"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle, ArrowDownToLine, Building2, Check, CheckCircle2,
  CircleDollarSign, FileCheck2, LoaderCircle, Plus, ReceiptText, RefreshCw, Search, WalletCards, X,
} from "lucide-react";
import { authFetch } from "@/lib/authFetch";
import CrmSectionNav from "../components/CrmSectionNav";

type Contact = { id: string; name: string; company_name: string; phone: string; email?: string };
type Account = { id: string; name: string; provider: string; integration_status: string; reconciliation_mode: string };
type Payment = { id: string; amount: number; status: string; paidAt: string | null; account: Account | null };
type Receivable = {
  id: string; contactId: string; contact: Contact | null; status: string; amount: number; paidAmount: number;
  openAmount: number; dueDate: string | null; paymentTiming: string; description: string; source: string;
  settledAt: string | null; createdAt: string; payments: Payment[];
};
type Receipt = {
  id: string; contactId: string; contact: Contact | null; receivableId: string | null; status: string;
  claimedAmount: number; extractedAmount: number; payerName: string; paidAt: string | null; bankReference: string;
  fileUrl: string; confidence: number; financialAccountId: string | null; matchStatus: string; reviewNotes: string; createdAt: string;
};
type FinanceData = {
  ok: boolean; setupRequired?: boolean; error?: string;
  metrics: { openAmount: number; overdueAmount: number; paidThisMonth: number; openCount: number; receiptsToReview: number };
  receivables: Receivable[]; receipts: Receipt[]; accounts: Account[]; contacts: Contact[];
};

const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const dateFormat = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", year: "numeric" });

const statusLabel: Record<string, string> = {
  pending: "Em aberto", partially_paid: "Pagamento parcial", paid: "Pago", overdue: "Vencido", cancelled: "Cancelado",
};
const statusStyle: Record<string, string> = {
  pending: "bg-sky-300/10 text-sky-100", partially_paid: "bg-amber-300/10 text-amber-100",
  paid: "bg-emerald-300/10 text-emerald-100", overdue: "bg-rose-300/10 text-rose-100", cancelled: "bg-white/[0.06] text-white/40",
};

function contactName(contact: Contact | null) {
  return contact?.name || contact?.company_name || contact?.phone || "Cliente sem nome";
}

function shortDate(value: string | null) {
  if (!value) return "Sem vencimento";
  const date = new Date(`${value.slice(0, 10)}T12:00:00`);
  return Number.isNaN(date.getTime()) ? "Sem vencimento" : dateFormat.format(date);
}

function normalizeAmount(value: string) {
  const normalized = value.replace(/\./g, "").replace(",", ".").replace(/[^0-9.-]/g, "");
  return Number(normalized) || 0;
}

export default function FinanceClient() {
  const [data, setData] = useState<FinanceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"open" | "overdue" | "paid" | "all">("open");
  const [settling, setSettling] = useState<Receivable | null>(null);
  const [reviewing, setReviewing] = useState<Receipt | null>(null);
  const [creating, setCreating] = useState(false);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setError("");
    try {
      const response = await authFetch("/api/admin/crm/finance", { cache: "no-store" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Não foi possível carregar o financeiro.");
      setData(result);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Falha ao carregar o financeiro.");
    } finally { if (!silent) setLoading(false); }
  }, []);

  useEffect(() => {
    void load();
    const timer = window.setInterval(() => void load(true), 30_000);
    return () => window.clearInterval(timer);
  }, [load]);

  const filtered = useMemo(() => (data?.receivables ?? []).filter((row) => {
    if (filter === "open" && !["pending", "partially_paid", "overdue"].includes(row.status)) return false;
    if (filter === "overdue" && row.status !== "overdue") return false;
    if (filter === "paid" && row.status !== "paid") return false;
    const haystack = `${contactName(row.contact)} ${row.contact?.phone || ""} ${row.description}`.toLowerCase();
    return haystack.includes(query.trim().toLowerCase());
  }), [data?.receivables, filter, query]);
  const pendingReceipts = (data?.receipts ?? []).filter((receipt) => ["received", "review"].includes(receipt.status));

  async function run(body: Record<string, unknown>) {
    const response = await authFetch("/api/admin/crm/finance", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.error || "Não foi possível concluir a operação.");
    await load(true);
    return result;
  }

  return <div className="min-w-0">
    <CrmSectionNav />
    <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
      <div>
        <div className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-300/75">Financeiro integrado ao atendimento</div>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight text-white">Contas a receber</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-white/45">Pedido confirmado gera cobrança. Pagamento parcial reduz o saldo e comprovante conciliado baixa a conta — com divergências sempre visíveis.</p>
      </div>
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => setCreating(true)} className="inline-flex h-10 items-center gap-2 rounded-xl bg-emerald-400 px-3.5 text-sm font-semibold text-[#052216] hover:bg-emerald-300"><Plus className="h-4 w-4" /> Nova conta</button>
        <button type="button" onClick={() => void load()} className="inline-flex h-10 items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-3 text-sm text-white/65 hover:bg-white/[0.08]"><RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /> Atualizar</button>
      </div>
    </header>

    {error ? <div className="mt-4 rounded-xl border border-rose-300/20 bg-rose-300/[0.07] px-4 py-3 text-sm text-rose-100">{error}</div> : null}
    <section className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
      <Metric icon={CircleDollarSign} label="Total em aberto" value={money.format(data?.metrics.openAmount || 0)} detail={`${data?.metrics.openCount || 0} contas`} tone="emerald" />
      <Metric icon={AlertTriangle} label="Vencido" value={money.format(data?.metrics.overdueAmount || 0)} detail="precisa de cobrança" tone="rose" />
      <Metric icon={CheckCircle2} label="Recebido no mês" value={money.format(data?.metrics.paidThisMonth || 0)} detail="pagamentos confirmados" tone="sky" />
      <Metric icon={ReceiptText} label="Comprovantes" value={String(data?.metrics.receiptsToReview || 0)} detail="aguardando conciliação" tone="amber" />
      <Metric icon={Building2} label="Contas bancárias" value={String(data?.accounts.length || 0)} detail="Inter e Nubank preparados" tone="violet" />
    </section>

    {pendingReceipts.length ? <section className="mt-5 rounded-[24px] border border-amber-300/15 bg-amber-300/[0.035] p-4 sm:p-5">
      <div className="flex items-start justify-between gap-4"><div><h2 className="flex items-center gap-2 text-sm font-semibold text-white"><FileCheck2 className="h-4 w-4 text-amber-200" /> Comprovantes para conciliar</h2><p className="mt-1 text-xs text-white/40">A baixa só acontece quando o valor bate ou você confirma uma parcial.</p></div><span className="rounded-full bg-amber-300/10 px-2.5 py-1 text-xs font-semibold text-amber-100">{pendingReceipts.length}</span></div>
      <div className="mt-4 grid gap-3 lg:grid-cols-2">{pendingReceipts.map((receipt) => <article key={receipt.id} className="rounded-2xl border border-white/[0.08] bg-black/15 p-4">
        <div className="flex items-start justify-between gap-3"><div><div className="font-semibold text-white">{contactName(receipt.contact)}</div><div className="mt-1 text-xs text-white/38">Recebido em {shortDate(receipt.createdAt)}</div></div><div className="text-right"><div className="text-lg font-semibold text-amber-100">{receipt.extractedAmount || receipt.claimedAmount ? money.format(receipt.extractedAmount || receipt.claimedAmount) : "Valor não lido"}</div><div className="text-[10px] text-white/30">confiança {Math.round(receipt.confidence * 100)}%</div></div></div>
        {receipt.reviewNotes ? <p className="mt-3 rounded-xl bg-rose-300/[0.06] px-3 py-2 text-xs text-rose-100/75">{receipt.reviewNotes}</p> : null}
        <button type="button" onClick={() => setReviewing(receipt)} className="mt-3 inline-flex h-9 w-full items-center justify-center gap-2 rounded-xl border border-amber-300/15 bg-amber-300/[0.08] text-xs font-semibold text-amber-100 hover:bg-amber-300/[0.12]"><ArrowDownToLine className="h-3.5 w-3.5" /> Conferir e dar baixa</button>
      </article>)}</div>
    </section> : null}

    <section className="mt-5 overflow-hidden rounded-[24px] border border-white/10 bg-white/[0.03]">
      <div className="border-b border-white/[0.08] p-4 sm:p-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between"><div className="flex flex-wrap gap-2">{(["open", "overdue", "paid", "all"] as const).map((item) => <button key={item} type="button" onClick={() => setFilter(item)} className={`h-9 rounded-xl px-3 text-xs font-semibold ${filter === item ? "bg-emerald-300/12 text-emerald-100" : "bg-white/[0.04] text-white/45 hover:text-white/70"}`}>{item === "open" ? "Em aberto" : item === "overdue" ? "Vencidas" : item === "paid" ? "Pagas" : "Todas"}</button>)}</div><label className="relative block lg:w-80"><Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-white/25" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar cliente ou serviço" className="h-10 w-full rounded-xl border border-white/10 bg-black/15 pl-9 pr-3 text-sm text-white outline-none placeholder:text-white/25 focus:border-emerald-300/25" /></label></div>
      </div>
      <div className="hidden overflow-x-auto md:block"><table className="w-full min-w-[880px] text-left"><thead><tr className="border-b border-white/[0.07] text-[10px] uppercase tracking-[0.1em] text-white/28"><th className="px-5 py-3 font-semibold">Cliente / serviço</th><th className="px-4 py-3 font-semibold">Vencimento</th><th className="px-4 py-3 text-right font-semibold">Total</th><th className="px-4 py-3 text-right font-semibold">Recebido</th><th className="px-4 py-3 text-right font-semibold">Saldo</th><th className="px-4 py-3 font-semibold">Situação</th><th className="px-5 py-3 text-right font-semibold">Ação</th></tr></thead><tbody>{filtered.map((row) => <tr key={row.id} className="border-b border-white/[0.055] last:border-0 hover:bg-white/[0.02]"><td className="px-5 py-4"><div className="font-medium text-white">{contactName(row.contact)}</div><div className="mt-1 max-w-sm truncate text-xs text-white/36">{row.description || "Serviço Suba Pro Verde"}{row.source === "order" ? " · gerada pelo pedido" : row.source === "direct_payment" ? " · pagamento direto" : ""}</div></td><td className="px-4 py-4 text-sm text-white/52">{shortDate(row.dueDate)}</td><td className="px-4 py-4 text-right text-sm text-white/58">{money.format(row.amount)}</td><td className="px-4 py-4 text-right text-sm text-emerald-200/70">{money.format(row.paidAmount)}</td><td className="px-4 py-4 text-right font-semibold text-white">{money.format(row.openAmount)}</td><td className="px-4 py-4"><Status status={row.status} /></td><td className="px-5 py-4 text-right">{!["paid", "cancelled"].includes(row.status) ? <button type="button" onClick={() => setSettling(row)} className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-emerald-400 px-3 text-xs font-semibold text-[#052216]"><Check className="h-3.5 w-3.5" /> Dar baixa</button> : <span className="text-xs text-white/25">Concluída</span>}</td></tr>)}</tbody></table></div>
      <div className="divide-y divide-white/[0.07] md:hidden">{filtered.map((row) => <article key={row.id} className="p-4"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><div className="truncate font-semibold text-white">{contactName(row.contact)}</div><div className="mt-1 line-clamp-2 text-xs leading-5 text-white/38">{row.description || "Serviço Suba Pro Verde"}</div></div><Status status={row.status} /></div><div className="mt-4 grid grid-cols-3 gap-2"><SmallValue label="Total" value={money.format(row.amount)} /><SmallValue label="Recebido" value={money.format(row.paidAmount)} /><SmallValue label="Saldo" value={money.format(row.openAmount)} strong /></div><div className="mt-3 flex items-center justify-between text-xs text-white/38"><span>{shortDate(row.dueDate)}</span>{!["paid", "cancelled"].includes(row.status) ? <button type="button" onClick={() => setSettling(row)} className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-emerald-400 px-3 font-semibold text-[#052216]"><Check className="h-3.5 w-3.5" /> Dar baixa</button> : null}</div></article>)}</div>
      {!loading && !filtered.length ? <div className="px-6 py-16 text-center"><WalletCards className="mx-auto h-8 w-8 text-white/18" /><div className="mt-3 text-sm font-medium text-white/55">Nenhuma conta neste filtro</div><div className="mt-1 text-xs text-white/28">Pedidos confirmados e cobranças manuais aparecerão aqui.</div></div> : null}
    </section>

    {settling ? <SettlementDialog receivable={settling} accounts={data?.accounts || []} onClose={() => setSettling(null)} onSubmit={async (value) => { await run({ action: "settle_receivable", receivableId: settling.id, ...value }); setSettling(null); }} /> : null}
    {reviewing ? <ReceiptDialog receipt={reviewing} receivables={(data?.receivables || []).filter((row) => row.contactId === reviewing.contactId && !["paid", "cancelled"].includes(row.status))} accounts={data?.accounts || []} onClose={() => setReviewing(null)} onSubmit={async (value) => { await run({ action: "reconcile_receipt", receiptId: reviewing.id, ...value }); setReviewing(null); }} /> : null}
    {creating ? <CreateDialog contacts={data?.contacts || []} onClose={() => setCreating(false)} onSubmit={async (value) => { await run({ action: "create_receivable", ...value }); setCreating(false); }} /> : null}
  </div>;
}

function Metric({ icon: Icon, label, value, detail, tone }: { icon: typeof CircleDollarSign; label: string; value: string; detail: string; tone: string }) {
  const tones: Record<string, string> = { emerald: "text-emerald-200 bg-emerald-300/[0.08]", rose: "text-rose-200 bg-rose-300/[0.08]", sky: "text-sky-200 bg-sky-300/[0.08]", amber: "text-amber-200 bg-amber-300/[0.08]", violet: "text-violet-200 bg-violet-300/[0.08]" };
  return <article className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-4"><div className="flex items-center justify-between"><span className="text-[10px] font-semibold uppercase tracking-[0.1em] text-white/30">{label}</span><span className={`flex h-8 w-8 items-center justify-center rounded-lg ${tones[tone]}`}><Icon className="h-4 w-4" /></span></div><div className="mt-3 truncate text-xl font-semibold text-white">{value}</div><div className="mt-1 text-xs text-white/32">{detail}</div></article>;
}

function Status({ status }: { status: string }) { return <span className={`inline-flex whitespace-nowrap rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] ${statusStyle[status] || statusStyle.pending}`}>{statusLabel[status] || status}</span>; }
function SmallValue({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) { return <div className="rounded-xl bg-black/15 p-2"><div className="text-[9px] uppercase tracking-wide text-white/25">{label}</div><div className={`mt-1 truncate text-xs ${strong ? "font-semibold text-white" : "text-white/55"}`}>{value}</div></div>; }

function DialogShell({ title, subtitle, children, onClose }: { title: string; subtitle: string; children: React.ReactNode; onClose: () => void }) { return <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/70 p-0 backdrop-blur-sm sm:items-center sm:p-4"><div className="max-h-[92vh] w-full overflow-y-auto rounded-t-[26px] border border-white/12 bg-[#09100e] p-5 shadow-2xl sm:max-w-lg sm:rounded-[26px]"><div className="flex items-start justify-between gap-4"><div><h2 className="text-lg font-semibold text-white">{title}</h2><p className="mt-1 text-sm text-white/40">{subtitle}</p></div><button type="button" onClick={onClose} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/[0.05] text-white/55"><X className="h-4 w-4" /></button></div>{children}</div></div>; }

function SettlementDialog({ receivable, accounts, onClose, onSubmit }: { receivable: Receivable; accounts: Account[]; onClose: () => void; onSubmit: (value: Record<string, unknown>) => Promise<void> }) {
  const [value, setValue] = useState(receivable.openAmount.toFixed(2).replace(".", ",")); const [account, setAccount] = useState(accounts[0]?.id || ""); const [saving, setSaving] = useState(false); const [error, setError] = useState("");
  async function submit(event: FormEvent) { event.preventDefault(); setSaving(true); setError(""); try { await onSubmit({ amount: normalizeAmount(value), financialAccountId: account || null, paidAt: new Date().toISOString() }); } catch (failure) { setError(failure instanceof Error ? failure.message : "Falha na baixa."); } finally { setSaving(false); } }
  return <DialogShell title="Registrar recebimento" subtitle={`${contactName(receivable.contact)} · saldo ${money.format(receivable.openAmount)}`} onClose={onClose}><form onSubmit={submit} className="mt-5 space-y-4"><Field label="Valor recebido"><input autoFocus value={value} onChange={(event) => setValue(event.target.value)} className="input-finance" inputMode="decimal" /></Field><Field label="Conta de entrada"><select value={account} onChange={(event) => setAccount(event.target.value)} className="input-finance"><option value="">Não informada</option>{accounts.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></Field>{normalizeAmount(value) < receivable.openAmount ? <div className="rounded-xl border border-amber-300/15 bg-amber-300/[0.06] px-3 py-2 text-xs text-amber-100/75">Será registrada uma baixa parcial. O restante continuará em aberto.</div> : null}{error ? <div className="text-sm text-rose-200">{error}</div> : null}<SubmitButton saving={saving} label="Confirmar baixa" /></form></DialogShell>;
}

function ReceiptDialog({ receipt, receivables, accounts, onClose, onSubmit }: { receipt: Receipt; receivables: Receivable[]; accounts: Account[]; onClose: () => void; onSubmit: (value: Record<string, unknown>) => Promise<void> }) {
  const suggested = receipt.extractedAmount || receipt.claimedAmount; const exact = receivables.find((row) => suggested > 0 && Math.abs(row.openAmount - suggested) < 0.005);
  const [receivableId, setReceivableId] = useState(exact?.id || receipt.receivableId || receivables[0]?.id || ""); const [value, setValue] = useState(suggested ? suggested.toFixed(2).replace(".", ",") : ""); const [account, setAccount] = useState(receipt.financialAccountId || accounts[0]?.id || ""); const [direct, setDirect] = useState(!receivableId); const [saving, setSaving] = useState(false); const [error, setError] = useState("");
  async function submit(event: FormEvent) { event.preventDefault(); setSaving(true); setError(""); try { await onSubmit({ receivableId: direct ? null : receivableId, amount: normalizeAmount(value), financialAccountId: account || null, paidAt: receipt.paidAt || new Date().toISOString(), allowDirectPayment: direct, description: "Pagamento direto identificado por comprovante" }); } catch (failure) { setError(failure instanceof Error ? failure.message : "Falha na conciliação."); } finally { setSaving(false); } }
  return <DialogShell title="Conciliar comprovante" subtitle={contactName(receipt.contact)} onClose={onClose}><form onSubmit={submit} className="mt-5 space-y-4"><Field label="Valor comprovado"><input autoFocus value={value} onChange={(event) => setValue(event.target.value)} className="input-finance" inputMode="decimal" placeholder="0,00" /></Field><Field label="Conta de entrada"><select value={account} onChange={(event) => setAccount(event.target.value)} className="input-finance"><option value="">Não informada</option>{accounts.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></Field>{receivables.length ? <Field label="Conta a receber correspondente"><select value={receivableId} disabled={direct} onChange={(event) => setReceivableId(event.target.value)} className="input-finance disabled:opacity-40">{receivables.map((row) => <option key={row.id} value={row.id}>{row.description || "Serviço"} — saldo {money.format(row.openAmount)}</option>)}</select></Field> : null}<label className="flex cursor-pointer items-start gap-3 rounded-xl border border-white/[0.08] bg-white/[0.03] p-3"><input type="checkbox" checked={direct} onChange={(event) => setDirect(event.target.checked)} className="mt-0.5 h-4 w-4 accent-emerald-400" /><span><span className="block text-sm font-medium text-white/75">Pagamento direto, sem conta anterior</span><span className="mt-1 block text-xs leading-5 text-white/35">O sistema cria a conta e já a baixa como paga.</span></span></label>{error ? <div className="text-sm text-rose-200">{error}</div> : null}<SubmitButton saving={saving} label="Conciliar e baixar" /></form></DialogShell>;
}

function CreateDialog({ contacts, onClose, onSubmit }: { contacts: Contact[]; onClose: () => void; onSubmit: (value: Record<string, unknown>) => Promise<void> }) {
  const [contactId, setContactId] = useState(contacts[0]?.id || ""); const [value, setValue] = useState(""); const [description, setDescription] = useState(""); const [dueDate, setDueDate] = useState(""); const [saving, setSaving] = useState(false); const [error, setError] = useState("");
  async function submit(event: FormEvent) { event.preventDefault(); setSaving(true); setError(""); try { await onSubmit({ contactId, amount: normalizeAmount(value), description, dueDate: dueDate || null }); } catch (failure) { setError(failure instanceof Error ? failure.message : "Falha ao criar."); } finally { setSaving(false); } }
  return <DialogShell title="Nova conta a receber" subtitle="Use para cobranças que não nasceram automaticamente de um pedido." onClose={onClose}><form onSubmit={submit} className="mt-5 space-y-4"><Field label="Cliente"><select value={contactId} onChange={(event) => setContactId(event.target.value)} className="input-finance" required><option value="">Selecione</option>{contacts.map((contact) => <option key={contact.id} value={contact.id}>{contactName(contact)}</option>)}</select></Field><Field label="Serviço"><input value={description} onChange={(event) => setDescription(event.target.value)} className="input-finance" placeholder="Ex.: remoção de 5 reclamações" required /></Field><div className="grid grid-cols-2 gap-3"><Field label="Valor"><input value={value} onChange={(event) => setValue(event.target.value)} className="input-finance" inputMode="decimal" placeholder="0,00" required /></Field><Field label="Vencimento"><input type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} className="input-finance" /></Field></div>{error ? <div className="text-sm text-rose-200">{error}</div> : null}<SubmitButton saving={saving} label="Criar conta" /></form></DialogShell>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label className="block"><span className="mb-1.5 block text-xs font-semibold text-white/45">{label}</span>{children}</label>; }
function SubmitButton({ saving, label }: { saving: boolean; label: string }) { return <button type="submit" disabled={saving} className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-emerald-400 text-sm font-semibold text-[#052216] disabled:opacity-50">{saving ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}{label}</button>; }
