"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Ban, BellRing, CalendarCheck2, CalendarDays, Check, ChevronLeft, ChevronRight, Clock3, Columns3, Expand, LayoutGrid, List, Minimize2, Pencil, Plus, RefreshCw, RotateCcw, UserRound, X } from "lucide-react";
import { authFetch } from "@/lib/authFetch";
import CrmSectionNav from "../components/CrmSectionNav";

type Contact = { id: string; name: string; company_name: string; phone: string };
type Task = { id: string; contact_id: string | null; title: string; description: string; task_type: string; status: string; priority: string; due_at: string; contact: Contact | null };
type CalendarView = "day" | "week" | "month";

const viewLabels: Record<CalendarView, string> = { day: "Dia", week: "Semana", month: "Mês" };
const typeLabels: Record<string, string> = { follow_up: "Follow-up", appointment: "Atendimento", anydesk: "Acesso remoto", internal: "Tarefa interna" };
const priorityLabels: Record<string, string> = { low: "Baixa", medium: "Normal", high: "Alta", urgent: "Urgente" };

function startOfDay(date: Date) { const value = new Date(date); value.setHours(0, 0, 0, 0); return value; }
function startOfWeek(date: Date) { const value = startOfDay(date); const day = value.getDay(); value.setDate(value.getDate() - (day === 0 ? 6 : day - 1)); return value; }
function startOfMonth(date: Date) { const value = startOfDay(date); value.setDate(1); return value; }
function addDays(date: Date, days: number) { const value = new Date(date); value.setDate(value.getDate() + days); return value; }
function addMonths(date: Date, months: number) { const value = new Date(date); value.setDate(1); value.setMonth(value.getMonth() + months); return value; }
function sameDay(a: Date, b: Date) { return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate(); }
function localInputValue(date: Date) { const offset = date.getTimezoneOffset(); return new Date(date.getTime() - offset * 60_000).toISOString().slice(0, 16); }
function taskContact(task: Task) { return task.contact?.name || task.contact?.company_name || task.contact?.phone || "Operação interna"; }
function calendarRange(cursor: Date, view: CalendarView) {
  if (view === "day") { const start = startOfDay(cursor); return { start, end: addDays(start, 1) }; }
  if (view === "month") { const start = startOfWeek(startOfMonth(cursor)); return { start, end: addDays(start, 42) }; }
  const start = startOfWeek(cursor); return { start, end: addDays(start, 7) };
}
function readableRange(cursor: Date, view: CalendarView) {
  if (view === "day") return cursor.toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long", year: "numeric" });
  if (view === "month") return cursor.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
  const start = startOfWeek(cursor); const end = addDays(start, 6);
  return `${start.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })} — ${end.toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" })}`;
}
function relativeTiming(task: Task, now: Date) {
  if (task.status === "done") return { state: "done", label: "Concluído" };
  const minutes = Math.round((new Date(task.due_at).getTime() - now.getTime()) / 60_000);
  if (minutes < 0) { const hours = Math.floor(Math.abs(minutes) / 60); return { state: "overdue", label: minutes > -60 ? `atrasado ${Math.abs(minutes)} min` : hours < 24 ? `atrasado ${hours}h` : "atrasado" }; }
  if (minutes <= 30) return { state: "imminent", label: minutes <= 1 ? "começando agora" : `em ${minutes} min` };
  if (minutes <= 120) return { state: "soon", label: `em ${Math.ceil(minutes / 60)}h` };
  return { state: "normal", label: "" };
}

export default function AgendaClient() {
  const initialContactId = useSearchParams().get("contactId") || "";
  const [cursor, setCursor] = useState(() => new Date());
  const [view, setView] = useState<CalendarView>("week");
  const [tasks, setTasks] = useState<Task[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(Boolean(initialContactId));
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [saving, setSaving] = useState(false);
  const [fullScreen, setFullScreen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [now, setNow] = useState(() => new Date());
  const range = useMemo(() => calendarRange(cursor, view), [cursor, view]);
  const periodDays = useMemo(() => Array.from({ length: view === "month" ? 42 : view === "week" ? 7 : 1 }, (_, i) => addDays(range.start, i)), [range.start, view]);

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const response = await authFetch(`/api/admin/crm/agenda?start=${encodeURIComponent(range.start.toISOString())}&end=${encodeURIComponent(range.end.toISOString())}`, { cache: "no-store" });
      const data = await response.json(); if (!response.ok) throw new Error(data.error || "Falha ao carregar agenda.");
      setTasks(data.tasks || []); setContacts(data.contacts || []);
    } catch (failure) { setError(failure instanceof Error ? failure.message : "Falha ao carregar agenda."); }
    finally { setLoading(false); }
  }, [range.end, range.start]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => { const timer = window.setInterval(() => setNow(new Date()), 30_000); return () => window.clearInterval(timer); }, []);
  useEffect(() => {
    const previous = document.body.style.overflow; if (fullScreen) document.body.style.overflow = "hidden";
    const close = (event: KeyboardEvent) => { if (event.key === "Escape") setFullScreen(false); };
    window.addEventListener("keydown", close); return () => { document.body.style.overflow = previous; window.removeEventListener("keydown", close); };
  }, [fullScreen]);

  async function submitTask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSaving(true); setError(""); const form = new FormData(event.currentTarget);
    try {
      const formValues = Object.fromEntries(form.entries());
      const response = await authFetch("/api/admin/crm/agenda", { method: editingTask ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(editingTask ? { ...formValues, taskId: editingTask.id } : formValues) });
      const data = await response.json(); if (!response.ok) throw new Error(data.error || `Falha ao ${editingTask ? "editar" : "criar"} compromisso.`);
      setShowForm(false); setEditingTask(null); setSelectedTask(null); await load();
    } catch (failure) { setError(failure instanceof Error ? failure.message : `Falha ao ${editingTask ? "editar" : "criar"} compromisso.`); }
    finally { setSaving(false); }
  }
  async function updateStatus(taskId: string, status: "pending" | "done" | "cancelled") {
    const response = await authFetch("/api/admin/crm/agenda", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ taskId, status }) });
    if (response.ok) { setSelectedTask(null); await load(); }
  }
  async function markDone(taskId: string) { await updateStatus(taskId, "done"); }
  function changePeriod(direction: number) { setCursor((current) => view === "month" ? addMonths(current, direction) : addDays(current, direction * (view === "week" ? 7 : 1))); }
  function openDay(day: Date) { setCursor(day); setView("day"); }

  const activeTasks = tasks.filter((task) => task.status !== "cancelled");
  const pendingCount = activeTasks.filter((task) => task.status !== "done").length;
  const overdueCount = activeTasks.filter((task) => task.status !== "done" && new Date(task.due_at).getTime() < now.getTime()).length;
  const nextCount = activeTasks.filter((task) => { const diff = new Date(task.due_at).getTime() - now.getTime(); return task.status !== "done" && diff >= 0 && diff <= 7_200_000; }).length;

  return <div className="crm-agenda">
    <CrmSectionNav />
    <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
      <div><div className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-300/80">Organização visual</div><h1 className="agenda-title mt-1 text-3xl font-semibold tracking-tight">Agenda comercial</h1><p className="agenda-muted mt-2 text-sm">Atendimentos, retornos e tarefas em uma visão que ajuda você a antecipar o dia.</p></div>
      <div className="flex flex-wrap gap-2"><button type="button" onClick={() => { setEditingTask(null); setShowForm(true); }} className="inline-flex h-11 items-center gap-2 rounded-xl bg-emerald-400 px-4 text-sm font-semibold text-[#052216] shadow-[0_10px_30px_rgba(52,211,153,.18)] transition hover:-translate-y-0.5 hover:bg-emerald-300"><Plus className="h-4 w-4" /> Novo compromisso</button><button type="button" onClick={() => void load()} className="agenda-control inline-flex h-11 w-11 items-center justify-center" aria-label="Atualizar agenda"><RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /></button></div>
    </header>
    <div className="mt-5 grid gap-3 sm:grid-cols-3"><Stat icon={CalendarDays} label={`Neste ${viewLabels[view].toLowerCase()}`} value={String(activeTasks.length)} detail="compromissos exibidos" /><Stat icon={BellRing} label="Próximas 2 horas" value={String(nextCount)} detail={nextCount ? "merecem sua atenção" : "nenhum compromisso próximo"} accent={nextCount > 0} /><Stat icon={Clock3} label="Atrasados" value={String(overdueCount)} detail={pendingCount ? `${pendingCount} ainda pendentes` : "tudo concluído"} alert={overdueCount > 0} /></div>
    {error ? <div className="mt-4 rounded-xl border border-rose-400/25 bg-rose-400/10 px-4 py-3 text-sm text-rose-300">{error}</div> : null}

    <section className={`agenda-calendar mt-5 ${fullScreen ? "agenda-calendar--fullscreen" : ""}`}>
      <CalendarToolbar cursor={cursor} view={view} fullScreen={fullScreen} loading={loading} onView={setView} onPrevious={() => changePeriod(-1)} onNext={() => changePeriod(1)} onToday={() => setCursor(new Date())} onFullscreen={() => setFullScreen((value) => !value)} onRefresh={() => void load()} />
      <div className={`agenda-calendar-body ${fullScreen ? "flex-1 min-h-0" : ""}`}>
        {view === "day" ? <DayView day={cursor} tasks={activeTasks} now={now} onDone={markDone} onSelect={setSelectedTask} /> : null}
        {view === "week" ? <WeekView days={periodDays} tasks={activeTasks} now={now} onDone={markDone} onSelect={setSelectedTask} onOpenDay={openDay} /> : null}
        {view === "month" ? <MonthView cursor={cursor} days={periodDays} tasks={activeTasks} now={now} onDone={markDone} onSelect={setSelectedTask} onOpenDay={openDay} /> : null}
      </div>
    </section>

    {showForm ? <div className="fixed inset-0 z-[110] flex items-end justify-center bg-black/70 p-0 backdrop-blur-sm sm:items-center sm:p-4" onMouseDown={() => { setShowForm(false); setEditingTask(null); }}><form key={editingTask?.id || "new"} onSubmit={submitTask} onMouseDown={(event) => event.stopPropagation()} className="agenda-dialog max-h-[94vh] w-full overflow-y-auto rounded-t-[26px] p-5 shadow-2xl sm:max-w-xl sm:rounded-[26px] sm:p-6"><div className="flex items-start justify-between gap-4"><div><div className="agenda-title flex items-center gap-2 font-semibold">{editingTask ? <Pencil className="h-4 w-4 text-emerald-400" /> : <CalendarCheck2 className="h-4 w-4 text-emerald-400" />} {editingTask ? "Editar compromisso" : "Novo compromisso"}</div><p className="agenda-muted mt-1 text-sm">{editingTask ? "Altere os dados necessários e salve." : "O calendário avisará visualmente quando o horário estiver próximo."}</p></div><button type="button" onClick={() => { setShowForm(false); setEditingTask(null); }} className="agenda-control flex h-9 w-9 shrink-0 items-center justify-center"><X className="h-4 w-4" /></button></div><div className="mt-5 grid gap-3 sm:grid-cols-2"><label className="sm:col-span-2"><FieldLabel>Título</FieldLabel><input name="title" required defaultValue={editingTask?.title || ""} placeholder="Ex.: Retornar orçamento" className="agenda-input" /></label><label><FieldLabel>Data e horário</FieldLabel><input name="dueAt" type="datetime-local" required defaultValue={localInputValue(editingTask ? new Date(editingTask.due_at) : new Date(Date.now() + 3_600_000))} className="agenda-input" /></label><label><FieldLabel>Tipo</FieldLabel><select name="taskType" defaultValue={editingTask?.task_type || "follow_up"} className="agenda-input"><option value="follow_up">Follow-up</option><option value="appointment">Atendimento</option><option value="anydesk">Acesso remoto</option><option value="internal">Tarefa interna</option></select></label><label><FieldLabel>Cliente</FieldLabel><select name="contactId" defaultValue={editingTask?.contact_id || initialContactId} className="agenda-input"><option value="">Sem cliente vinculado</option>{contacts.map((contact) => <option key={contact.id} value={contact.id}>{contact.name || contact.company_name || contact.phone}</option>)}</select></label><label><FieldLabel>Prioridade</FieldLabel><select name="priority" defaultValue={editingTask?.priority || "medium"} className="agenda-input"><option value="medium">Normal</option><option value="high">Alta</option><option value="urgent">Urgente</option><option value="low">Baixa</option></select></label><label className="sm:col-span-2"><FieldLabel>Observação</FieldLabel><textarea name="description" rows={4} defaultValue={editingTask?.description || ""} placeholder="O que precisa acontecer neste compromisso?" className="agenda-input h-auto py-3" /></label></div><div className="mt-5 flex justify-end gap-2"><button type="button" onClick={() => { setShowForm(false); setEditingTask(null); }} className="agenda-control h-10 px-4 text-sm">Cancelar</button><button disabled={saving} className="inline-flex h-10 items-center gap-2 rounded-xl bg-emerald-400 px-4 text-sm font-semibold text-[#052216] hover:bg-emerald-300 disabled:opacity-50">{saving ? <RefreshCw className="h-4 w-4 animate-spin" /> : editingTask ? <Pencil className="h-4 w-4" /> : <Plus className="h-4 w-4" />} {editingTask ? "Salvar alterações" : "Salvar"}</button></div></form></div> : null}
    {selectedTask ? <TaskDetails task={selectedTask} now={now} onClose={() => setSelectedTask(null)} onEdit={(task) => { setEditingTask(task); setSelectedTask(null); setShowForm(true); }} onStatus={updateStatus} /> : null}
  </div>;
}

function CalendarToolbar({ cursor, view, fullScreen, loading, onView, onPrevious, onNext, onToday, onFullscreen, onRefresh }: { cursor: Date; view: CalendarView; fullScreen: boolean; loading: boolean; onView: (view: CalendarView) => void; onPrevious: () => void; onNext: () => void; onToday: () => void; onFullscreen: () => void; onRefresh: () => void }) {
  const views: Array<{ id: CalendarView; icon: typeof List }> = [{ id: "day", icon: List }, { id: "week", icon: Columns3 }, { id: "month", icon: LayoutGrid }];
  return <div className="agenda-toolbar"><div className="flex items-center gap-2"><button type="button" onClick={onPrevious} className="agenda-control flex h-10 w-10 items-center justify-center" aria-label="Período anterior"><ChevronLeft className="h-4 w-4" /></button><button type="button" onClick={onToday} className="agenda-control h-10 px-3 text-xs font-semibold sm:text-sm">Hoje</button><button type="button" onClick={onNext} className="agenda-control flex h-10 w-10 items-center justify-center" aria-label="Próximo período"><ChevronRight className="h-4 w-4" /></button></div><div className="min-w-0 flex-1 text-center"><div className="agenda-title truncate text-sm font-semibold capitalize sm:text-base">{readableRange(cursor, view)}</div><div className="agenda-subtle mt-0.5 hidden text-[11px] sm:block">Clique em um compromisso para ver os detalhes</div></div><div className="flex items-center gap-2"><div className="agenda-segmented">{views.map(({ id, icon: Icon }) => <button key={id} type="button" onClick={() => onView(id)} className={view === id ? "is-active" : ""} title={viewLabels[id]}><Icon className="h-3.5 w-3.5" /><span className="hidden lg:inline">{viewLabels[id]}</span></button>)}</div>{fullScreen ? <button type="button" onClick={onRefresh} className="agenda-control hidden h-10 w-10 items-center justify-center sm:flex" aria-label="Atualizar"><RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /></button> : null}<button type="button" onClick={onFullscreen} className="agenda-control flex h-10 w-10 items-center justify-center" aria-label={fullScreen ? "Sair da tela cheia" : "Abrir em tela cheia"}>{fullScreen ? <Minimize2 className="h-4 w-4" /> : <Expand className="h-4 w-4" />}</button></div></div>;
}

function DayView({ day, tasks, now, onDone, onSelect }: { day: Date; tasks: Task[]; now: Date; onDone: (id: string) => Promise<void>; onSelect: (task: Task) => void }) {
  const dayTasks = tasks.filter((task) => sameDay(new Date(task.due_at), day)); const taskHours = dayTasks.map((task) => new Date(task.due_at).getHours());
  const firstHour = Math.min(8, ...taskHours); const lastHour = Math.max(19, ...taskHours.map((hour) => hour + 1)); const hours = Array.from({ length: lastHour - firstHour + 1 }, (_, i) => firstHour + i); const isToday = sameDay(day, now);
  return <div className="agenda-scroll h-full overflow-y-auto"><div className="min-w-[680px]">{hours.map((hour) => { const hourTasks = dayTasks.filter((task) => new Date(task.due_at).getHours() === hour); const showNow = isToday && now.getHours() === hour; return <div key={hour} className="agenda-hour-row"><div className="agenda-subtle w-16 shrink-0 pt-1 text-right text-xs font-semibold tabular-nums">{String(hour).padStart(2, "0")}:00</div><div className="relative min-h-[88px] flex-1 border-t border-[var(--agenda-border-soft)] px-4 pb-3 pt-2">{showNow ? <div className="agenda-now-line" style={{ top: `${Math.max(8, (now.getMinutes() / 60) * 100)}%` }}><span>{now.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</span></div> : null}<div className="relative z-[1] grid gap-2 xl:grid-cols-2">{hourTasks.map((task) => <TaskCard key={task.id} task={task} now={now} onDone={onDone} onSelect={onSelect} />)}</div></div></div>; })}{!dayTasks.length ? <EmptyState title="Dia livre" detail="Nenhum compromisso marcado. Aproveite ou crie um novo." /> : null}</div></div>;
}

function WeekView({ days, tasks, now, onDone, onSelect, onOpenDay }: { days: Date[]; tasks: Task[]; now: Date; onDone: (id: string) => Promise<void>; onSelect: (task: Task) => void; onOpenDay: (day: Date) => void }) {
  return <div className="agenda-scroll h-full max-w-full overflow-auto overscroll-contain"><div className="grid min-h-[500px] min-w-[1050px] grid-cols-7 divide-x divide-[var(--agenda-border-soft)]">{days.map((day) => { const dayTasks = tasks.filter((task) => sameDay(new Date(task.due_at), day)); const today = sameDay(day, now); return <div key={day.toISOString()} className={`p-3 ${today ? "agenda-today" : ""}`}><button type="button" onClick={() => onOpenDay(day)} className="group flex w-full items-center justify-between rounded-xl p-1 text-left transition hover:bg-[var(--agenda-hover)]"><div><div className="agenda-subtle text-[10px] font-semibold uppercase tracking-[0.12em]">{day.toLocaleDateString("pt-BR", { weekday: "short" })}</div><div className={`mt-1 flex h-9 w-9 items-center justify-center rounded-xl text-sm font-semibold ${today ? "bg-emerald-400 text-[#052216] shadow-[0_7px_18px_rgba(52,211,153,.25)]" : "agenda-title"}`}>{day.getDate()}</div></div><span className="agenda-subtle rounded-full px-2 py-1 text-[10px] font-semibold">{dayTasks.length}</span></button><div className="mt-3 space-y-2">{dayTasks.map((task) => <TaskCard key={task.id} task={task} now={now} onDone={onDone} onSelect={onSelect} />)}{!dayTasks.length ? <div className="agenda-empty-slot">Livre</div> : null}</div></div>; })}</div></div>;
}

function MonthView({ cursor, days, tasks, now, onDone, onSelect, onOpenDay }: { cursor: Date; days: Date[]; tasks: Task[]; now: Date; onDone: (id: string) => Promise<void>; onSelect: (task: Task) => void; onOpenDay: (day: Date) => void }) {
  return <div className="agenda-scroll h-full max-w-full overflow-auto overscroll-contain"><div className="min-w-[920px]"><div className="grid grid-cols-7 border-b border-[var(--agenda-border-soft)]">{["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"].map((label) => <div key={label} className="agenda-subtle px-3 py-2 text-center text-[10px] font-semibold uppercase tracking-[0.14em]">{label}</div>)}</div><div className="grid grid-cols-7">{days.map((day) => { const dayTasks = tasks.filter((task) => sameDay(new Date(task.due_at), day)); const today = sameDay(day, now); const outside = day.getMonth() !== cursor.getMonth(); return <div key={day.toISOString()} className={`min-h-[142px] border-b border-r border-[var(--agenda-border-soft)] p-2.5 ${today ? "agenda-today" : ""} ${outside ? "opacity-45" : ""}`}><button type="button" onClick={() => onOpenDay(day)} className={`mb-2 flex h-7 w-7 items-center justify-center rounded-lg text-xs font-semibold hover:bg-[var(--agenda-hover)] ${today ? "bg-emerald-400 text-[#052216]" : "agenda-title"}`}>{day.getDate()}</button><div className="space-y-1.5">{dayTasks.slice(0, 3).map((task) => <TaskCard key={task.id} task={task} now={now} onDone={onDone} onSelect={onSelect} compact />)}{dayTasks.length > 3 ? <button type="button" onClick={() => onOpenDay(day)} className="w-full rounded-lg px-2 py-1 text-left text-[10px] font-semibold text-emerald-400 hover:bg-[var(--agenda-hover)]">+ {dayTasks.length - 3} compromissos</button> : null}</div></div>; })}</div></div></div>;
}

function TaskCard({ task, now, onDone, onSelect, compact = false }: { task: Task; now: Date; onDone: (id: string) => Promise<void>; onSelect: (task: Task) => void; compact?: boolean }) {
  const timing = relativeTiming(task, now); const done = task.status === "done"; const appointment = task.task_type === "appointment" || task.task_type === "anydesk";
  return <article className={`agenda-task group ${compact ? "agenda-task--compact" : ""} agenda-task--${timing.state}`} onClick={() => onSelect(task)}><div className="flex items-start gap-2"><div className={`mt-0.5 flex shrink-0 items-center justify-center rounded-lg ${compact ? "h-6 w-6" : "h-8 w-8"} ${appointment ? "bg-violet-400/12 text-violet-300" : "bg-emerald-400/12 text-emerald-300"}`}>{appointment ? <UserRound className="h-3.5 w-3.5" /> : <Clock3 className="h-3.5 w-3.5" />}</div><div className="min-w-0 flex-1"><div className={`agenda-title font-semibold ${compact ? "truncate text-[10px] leading-4" : "text-xs leading-4"} ${done ? "line-through opacity-45" : ""}`}>{task.title}</div>{!compact ? <div className="agenda-subtle mt-1 truncate text-[10px]">{taskContact(task)}</div> : null}<div className={`mt-1 flex flex-wrap items-center gap-1.5 text-[10px] font-semibold ${timing.state === "overdue" ? "text-amber-400" : timing.state === "imminent" ? "text-rose-400" : "text-emerald-400"}`}><span>{new Date(task.due_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</span>{timing.label && !compact ? <span className="agenda-timing-chip">{timing.state === "imminent" ? <BellRing className="h-3 w-3" /> : null}{timing.label}</span> : null}</div></div>{!done && !compact ? <button type="button" onClick={(event) => { event.stopPropagation(); void onDone(task.id); }} title="Concluir" className="agenda-check flex h-7 w-7 shrink-0 items-center justify-center"><Check className="h-3.5 w-3.5" /></button> : null}</div></article>;
}

function TaskDetails({ task, now, onClose, onEdit, onStatus }: { task: Task; now: Date; onClose: () => void; onEdit: (task: Task) => void; onStatus: (id: string, status: "pending" | "done" | "cancelled") => Promise<void> }) {
  const timing = relativeTiming(task, now);
  return <div className="fixed inset-0 z-[120] flex items-end justify-center bg-black/70 p-0 backdrop-blur-sm sm:items-center sm:p-4" onMouseDown={onClose}><article className="agenda-dialog w-full rounded-t-[26px] p-5 shadow-2xl sm:max-w-lg sm:rounded-[26px] sm:p-6" onMouseDown={(event) => event.stopPropagation()}><div className="flex items-start justify-between gap-4"><div><div className="agenda-subtle text-xs font-semibold uppercase tracking-[0.14em]">{typeLabels[task.task_type] || "Compromisso"}</div><h2 className="agenda-title mt-1 text-xl font-semibold">{task.title}</h2></div><button type="button" onClick={onClose} className="agenda-control flex h-9 w-9 shrink-0 items-center justify-center"><X className="h-4 w-4" /></button></div><div className="mt-5 grid gap-3 sm:grid-cols-2"><Detail label="Cliente" value={taskContact(task)} /><Detail label="Prioridade" value={priorityLabels[task.priority] || task.priority} /><Detail label="Data" value={new Date(task.due_at).toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" })} /><Detail label="Horário" value={new Date(task.due_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })} /></div>{task.description ? <div className="agenda-detail mt-3"><div className="agenda-subtle text-[10px] font-semibold uppercase tracking-[0.12em]">Observação</div><p className="agenda-title mt-1.5 whitespace-pre-wrap text-sm leading-6">{task.description}</p></div> : null}{timing.label ? <div className={`mt-4 inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold ${timing.state === "imminent" ? "bg-rose-400/12 text-rose-400" : timing.state === "overdue" ? "bg-amber-400/12 text-amber-400" : "bg-emerald-400/12 text-emerald-400"}`}><Clock3 className="h-3.5 w-3.5" />{timing.label}</div> : null}<div className="mt-6 flex flex-wrap justify-end gap-2"><button type="button" onClick={() => onEdit(task)} className="agenda-control inline-flex h-10 items-center gap-2 px-4 text-sm font-semibold"><Pencil className="h-4 w-4" /> Editar</button>{task.status === "done" || task.status === "cancelled" ? <button type="button" onClick={() => void onStatus(task.id, "pending")} className="agenda-control inline-flex h-10 items-center gap-2 px-4 text-sm"><RotateCcw className="h-4 w-4" /> Reabrir</button> : <><button type="button" onClick={() => void onStatus(task.id, "cancelled")} className="agenda-control inline-flex h-10 items-center gap-2 px-4 text-sm"><Ban className="h-4 w-4" /> Cancelar</button><button type="button" onClick={() => void onStatus(task.id, "done")} className="inline-flex h-10 items-center gap-2 rounded-xl bg-emerald-400 px-4 text-sm font-semibold text-[#052216]"><Check className="h-4 w-4" /> Concluir</button></>}</div></article></div>;
}

function Stat({ icon: Icon, label, value, detail, alert = false, accent = false }: { icon: typeof CalendarDays; label: string; value: string; detail: string; alert?: boolean; accent?: boolean }) { return <div className={`agenda-stat ${alert ? "agenda-stat--alert" : accent ? "agenda-stat--accent" : ""}`}><div className="flex items-center justify-between gap-3"><div className="agenda-subtle text-xs font-semibold uppercase tracking-[0.11em]">{label}</div><Icon className="h-4 w-4" /></div><div className={`mt-2 text-2xl font-semibold ${alert ? "text-amber-400" : "agenda-title"}`}>{value}</div><div className="agenda-muted mt-1 text-xs">{detail}</div></div>; }
function Detail({ label, value }: { label: string; value: string }) { return <div className="agenda-detail"><div className="agenda-subtle text-[10px] font-semibold uppercase tracking-[0.12em]">{label}</div><div className="agenda-title mt-1 text-sm font-medium capitalize">{value}</div></div>; }
function EmptyState({ title, detail }: { title: string; detail: string }) { return <div className="mx-auto my-10 max-w-md rounded-2xl border border-dashed border-[var(--agenda-border)] px-6 py-10 text-center"><CalendarCheck2 className="mx-auto h-7 w-7 text-emerald-400" /><div className="agenda-title mt-3 text-sm font-semibold">{title}</div><div className="agenda-muted mt-1 text-xs">{detail}</div></div>; }
function FieldLabel({ children }: { children: React.ReactNode }) { return <span className="agenda-muted mb-1.5 block text-xs font-semibold">{children}</span>; }
