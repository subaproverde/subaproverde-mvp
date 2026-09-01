"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { CalendarCheck2, Check, ChevronLeft, ChevronRight, Clock3, Plus, RefreshCw, UserRound, X } from "lucide-react";
import { authFetch } from "@/lib/authFetch";
import CrmSectionNav from "../components/CrmSectionNav";

type Contact = { id: string; name: string; company_name: string; phone: string };
type Task = { id: string; contact_id: string | null; title: string; description: string; task_type: string; status: string; priority: string; due_at: string; contact: Contact | null };

function startOfWeek(date: Date) { const result = new Date(date); const day = result.getDay(); result.setDate(result.getDate() - (day === 0 ? 6 : day - 1)); result.setHours(0, 0, 0, 0); return result; }
function addDays(date: Date, days: number) { const result = new Date(date); result.setDate(result.getDate() + days); return result; }
function localInputValue(date: Date) { const offset = date.getTimezoneOffset(); return new Date(date.getTime() - offset * 60_000).toISOString().slice(0, 16); }

export default function AgendaClient() {
  const searchParams = useSearchParams();
  const initialContactId = searchParams.get("contactId") || "";
  const [week, setWeek] = useState(() => startOfWeek(new Date()));
  const [tasks, setTasks] = useState<Task[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(Boolean(initialContactId));
  const [saving, setSaving] = useState(false);

  const weekDays = useMemo(() => Array.from({ length: 7 }, (_, index) => addDays(week, index)), [week]);
  const load = useCallback(async () => {
    setLoading(true); setError("");
    const end = addDays(week, 7);
    try { const response = await authFetch(`/api/admin/crm/agenda?start=${encodeURIComponent(week.toISOString())}&end=${encodeURIComponent(end.toISOString())}`, { cache: "no-store" }); const data = await response.json(); if (!response.ok) throw new Error(data.error || "Falha ao carregar agenda."); setTasks(data.tasks || []); setContacts(data.contacts || []); }
    catch (failure) { setError(failure instanceof Error ? failure.message : "Falha ao carregar agenda."); }
    finally { setLoading(false); }
  }, [week]);
  useEffect(() => { void load(); }, [load]);

  async function createTask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSaving(true); setError("");
    const form = new FormData(event.currentTarget);
    try { const response = await authFetch("/api/admin/crm/agenda", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(Object.fromEntries(form.entries())) }); const data = await response.json(); if (!response.ok) throw new Error(data.error || "Falha ao criar compromisso."); setShowForm(false); await load(); }
    catch (failure) { setError(failure instanceof Error ? failure.message : "Falha ao criar compromisso."); }
    finally { setSaving(false); }
  }
  async function markDone(taskId: string) { const response = await authFetch("/api/admin/crm/agenda", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ taskId, status: "done" }) }); if (response.ok) await load(); }

  const pendingCount = tasks.filter((task) => task.status !== "done" && task.status !== "cancelled").length;
  const overdueCount = tasks.filter((task) => task.status !== "done" && new Date(task.due_at).getTime() < Date.now()).length;

  return <div>
    <CrmSectionNav />
    <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between"><div><div className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-300/75">Organização</div><h1 className="mt-1 text-3xl font-semibold tracking-tight text-white">Agenda comercial</h1><p className="mt-2 text-sm text-white/43">Atendimentos, retornos e tarefas ligados aos clientes.</p></div><div className="flex gap-2"><button type="button" onClick={() => setShowForm(true)} className="inline-flex h-11 items-center gap-2 rounded-xl bg-emerald-400 px-4 text-sm font-semibold text-[#052216] hover:bg-emerald-300"><Plus className="h-4 w-4" /> Novo compromisso</button><button type="button" onClick={() => void load()} className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-white/[0.08] text-white/55 hover:bg-white/[0.05]"><RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /></button></div></header>
    <div className="mt-5 grid gap-3 sm:grid-cols-3"><Stat label="Nesta semana" value={String(tasks.length)} /><Stat label="Pendentes" value={String(pendingCount)} /><Stat label="Atrasados" value={String(overdueCount)} alert={overdueCount > 0} /></div>
    {error ? <div className="mt-4 rounded-xl border border-rose-300/15 bg-rose-300/[0.06] px-4 py-3 text-sm text-rose-100/75">{error}</div> : null}
    <section className="mt-5 overflow-hidden rounded-[24px] border border-white/[0.09] bg-white/[0.025]"><div className="flex items-center justify-between border-b border-white/[0.08] px-4 py-3"><button type="button" onClick={() => setWeek(startOfWeek(addDays(week, -7)))} className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/[0.08] text-white/55 hover:bg-white/[0.05]"><ChevronLeft className="h-4 w-4" /></button><div className="text-center"><div className="text-sm font-semibold text-white/80">{week.toLocaleDateString("pt-BR", { day: "2-digit", month: "long" })} — {addDays(week, 6).toLocaleDateString("pt-BR", { day: "2-digit", month: "long" })}</div><button type="button" onClick={() => setWeek(startOfWeek(new Date()))} className="mt-0.5 text-xs text-emerald-200/70 hover:text-emerald-200">Voltar para esta semana</button></div><button type="button" onClick={() => setWeek(startOfWeek(addDays(week, 7)))} className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/[0.08] text-white/55 hover:bg-white/[0.05]"><ChevronRight className="h-4 w-4" /></button></div>
      <div className="grid min-w-[980px] grid-cols-7 divide-x divide-white/[0.07] overflow-x-auto">{weekDays.map((day) => { const dayTasks = tasks.filter((task) => new Date(task.due_at).toDateString() === day.toDateString()); const today = day.toDateString() === new Date().toDateString(); return <div key={day.toISOString()} className={`min-h-[420px] p-3 ${today ? "bg-emerald-300/[0.035]" : ""}`}><div className="flex items-center justify-between"><div><div className="text-[10px] uppercase tracking-[0.11em] text-white/30">{day.toLocaleDateString("pt-BR", { weekday: "short" })}</div><div className={`mt-1 flex h-8 w-8 items-center justify-center rounded-xl text-sm font-semibold ${today ? "bg-emerald-400 text-[#052216]" : "text-white/65"}`}>{day.getDate()}</div></div><span className="text-xs text-white/25">{dayTasks.length}</span></div><div className="mt-3 space-y-2">{dayTasks.map((task) => <TaskCard key={task.id} task={task} onDone={markDone} />)}{!dayTasks.length ? <div className="rounded-xl border border-dashed border-white/[0.07] px-2 py-5 text-center text-[11px] text-white/18">Livre</div> : null}</div></div>; })}</div>
    </section>

    {showForm ? <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm" onMouseDown={() => setShowForm(false)}><form onSubmit={createTask} onMouseDown={(e) => e.stopPropagation()} className="w-full max-w-xl rounded-[24px] border border-white/12 bg-[#0a100e] p-5 shadow-2xl"><div className="flex items-start justify-between"><div><div className="flex items-center gap-2 font-semibold text-white"><CalendarCheck2 className="h-4 w-4 text-emerald-300" /> Novo compromisso</div><p className="mt-1 text-sm text-white/38">Um atendimento, retorno ou tarefa no seu calendário.</p></div><button type="button" onClick={() => setShowForm(false)} className="rounded-lg p-2 text-white/40 hover:bg-white/[0.06] hover:text-white"><X className="h-4 w-4" /></button></div><div className="mt-5 grid gap-3 sm:grid-cols-2"><label className="sm:col-span-2"><FieldLabel>Título</FieldLabel><input name="title" required placeholder="Ex.: Retornar orçamento" className="field" /></label><label><FieldLabel>Data e horário</FieldLabel><input name="dueAt" type="datetime-local" required defaultValue={localInputValue(new Date(Date.now() + 3_600_000))} className="field" /></label><label><FieldLabel>Tipo</FieldLabel><select name="taskType" className="field"><option value="follow_up">Follow-up</option><option value="appointment">Atendimento</option><option value="anydesk">AnyDesk</option><option value="internal">Tarefa interna</option></select></label><label><FieldLabel>Cliente</FieldLabel><select name="contactId" defaultValue={initialContactId} className="field"><option value="">Sem cliente vinculado</option>{contacts.map((contact) => <option key={contact.id} value={contact.id}>{contact.name || contact.company_name || contact.phone}</option>)}</select></label><label><FieldLabel>Prioridade</FieldLabel><select name="priority" className="field"><option value="medium">Normal</option><option value="high">Alta</option><option value="urgent">Urgente</option><option value="low">Baixa</option></select></label><label className="sm:col-span-2"><FieldLabel>Observação</FieldLabel><textarea name="description" rows={3} placeholder="O que precisa acontecer neste compromisso?" className="field h-auto py-2.5" /></label></div><div className="mt-5 flex justify-end gap-2"><button type="button" onClick={() => setShowForm(false)} className="h-10 rounded-xl px-4 text-sm text-white/55 hover:bg-white/[0.05]">Cancelar</button><button disabled={saving} className="inline-flex h-10 items-center gap-2 rounded-xl bg-emerald-400 px-4 text-sm font-semibold text-[#052216] disabled:opacity-50">{saving ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Salvar</button></div><style jsx>{`.field{height:40px;width:100%;border-radius:12px;border:1px solid rgba(255,255,255,.09);background:rgba(0,0,0,.2);padding-left:12px;padding-right:12px;font-size:14px;color:white;outline:none}.field:focus{border-color:rgba(110,231,183,.3)}`}</style></form></div> : null}
  </div>;
}

function TaskCard({ task, onDone }: { task: Task; onDone: (id: string) => Promise<void> }) { const done = task.status === "done"; const late = !done && new Date(task.due_at).getTime() < Date.now(); return <article className={`rounded-xl border p-2.5 ${late ? "border-amber-300/18 bg-amber-300/[0.06]" : "border-white/[0.08] bg-black/15"}`}><div className="flex items-start gap-2"><div className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${task.task_type === "appointment" || task.task_type === "anydesk" ? "bg-violet-300/10 text-violet-200" : "bg-emerald-300/10 text-emerald-200"}`}>{task.task_type === "appointment" || task.task_type === "anydesk" ? <UserRound className="h-3.5 w-3.5" /> : <Clock3 className="h-3.5 w-3.5" />}</div><div className="min-w-0 flex-1"><div className={`text-xs font-semibold leading-4 ${done ? "text-white/28 line-through" : "text-white/78"}`}>{task.title}</div><div className="mt-1 truncate text-[10px] text-white/30">{task.contact?.name || task.contact?.company_name || "Operação interna"}</div><div className="mt-1 text-[10px] font-medium text-emerald-200/65">{new Date(task.due_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</div></div>{!done ? <button type="button" onClick={() => void onDone(task.id)} title="Concluir" className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-white/[0.08] text-white/35 hover:border-emerald-300/20 hover:text-emerald-200"><Check className="h-3.5 w-3.5" /></button> : null}</div></article>; }
function Stat({ label, value, alert = false }: { label: string; value: string; alert?: boolean }) { return <div className={`rounded-2xl border p-4 ${alert ? "border-amber-300/15 bg-amber-300/[0.055]" : "border-white/[0.08] bg-white/[0.03]"}`}><div className="text-xs uppercase tracking-[0.1em] text-white/30">{label}</div><div className={`mt-2 text-2xl font-semibold ${alert ? "text-amber-200" : "text-white"}`}>{value}</div></div>; }
function FieldLabel({ children }: { children: React.ReactNode }) { return <span className="mb-1.5 block text-xs font-medium text-white/48">{children}</span>; }
