"use client";

import { useEffect, useState } from "react";
import type { ComponentType } from "react";
import Link from "next/link";
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  BellRing,
  CalendarClock,
  CheckCircle2,
  CircleDollarSign,
  Clock3,
  Expand,
  Gauge,
  RadioTower,
  TimerReset,
  TrendingUp,
  Users,
  Zap,
} from "lucide-react";
import type { AdminAppointment, AdminClient, AdminRemoval } from "../../admin-data";
import {
  appointmentStatusLabel,
  appointmentTypeLabel,
  formatCurrency,
  formatDate,
  impactTypeLabel,
  isRemovalOpen,
  statusLabel,
} from "../../admin-data";
import { loadAdminOperations } from "@/lib/adminOperationsClient";

type IconType = ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
type Tone = "emerald" | "sky" | "amber" | "rose" | "violet" | "lime";

type LiveDashboardClientProps = {
  appointments: AdminAppointment[];
  clients: AdminClient[];
  removals: AdminRemoval[];
};

const DAILY_CAPACITY_MINUTES = 360;
const MS_PER_DAY = 24 * 60 * 60 * 1000;
const WEEK_DAYS = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sab", "Dom"];

const TONES: Record<
  Tone,
  {
    card: string;
    text: string;
    dim: string;
    border: string;
    bar: string;
    solid: string;
  }
> = {
  emerald: {
    card: "border-emerald-300/20 bg-emerald-400/[0.085]",
    text: "text-emerald-50",
    dim: "text-emerald-100/62",
    border: "border-emerald-300/22",
    bar: "linear-gradient(90deg, #34d399, #a3e635)",
    solid: "#34d399",
  },
  sky: {
    card: "border-sky-300/20 bg-sky-400/[0.085]",
    text: "text-sky-50",
    dim: "text-sky-100/62",
    border: "border-sky-300/22",
    bar: "linear-gradient(90deg, #38bdf8, #22d3ee)",
    solid: "#38bdf8",
  },
  amber: {
    card: "border-amber-300/20 bg-amber-400/[0.085]",
    text: "text-amber-50",
    dim: "text-amber-100/62",
    border: "border-amber-300/22",
    bar: "linear-gradient(90deg, #fbbf24, #fb923c)",
    solid: "#fbbf24",
  },
  rose: {
    card: "border-rose-300/20 bg-rose-400/[0.085]",
    text: "text-rose-50",
    dim: "text-rose-100/62",
    border: "border-rose-300/22",
    bar: "linear-gradient(90deg, #fb7185, #f43f5e)",
    solid: "#fb7185",
  },
  violet: {
    card: "border-violet-300/20 bg-violet-400/[0.085]",
    text: "text-violet-50",
    dim: "text-violet-100/62",
    border: "border-violet-300/22",
    bar: "linear-gradient(90deg, #a78bfa, #f0abfc)",
    solid: "#a78bfa",
  },
  lime: {
    card: "border-lime-300/20 bg-lime-400/[0.085]",
    text: "text-lime-50",
    dim: "text-lime-100/62",
    border: "border-lime-300/22",
    bar: "linear-gradient(90deg, #a3e635, #22c55e)",
    solid: "#a3e635",
  },
};

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function localIsoDate(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseIsoDate(iso: string) {
  return new Date(`${iso}T12:00:00`);
}

function toIsoDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function addDays(iso: string, days: number) {
  const date = parseIsoDate(iso);
  date.setDate(date.getDate() + days);
  return toIsoDate(date);
}

function weekStart(iso: string) {
  const date = parseIsoDate(iso);
  const offset = (date.getDay() + 6) % 7;
  date.setDate(date.getDate() - offset);
  return toIsoDate(date);
}

function diffDays(start: string, end: string) {
  const startTime = parseIsoDate(start).getTime();
  const endTime = parseIsoDate(end).getTime();

  if (Number.isNaN(startTime) || Number.isNaN(endTime)) return 0;
  return Math.round((endTime - startTime) / MS_PER_DAY);
}

function appointmentDateTime(appointment: AdminAppointment) {
  return new Date(`${appointment.scheduledDate}T${appointment.scheduledTime}:00`);
}

function minutesUntil(target: Date, now: Date) {
  return Math.round((target.getTime() - now.getTime()) / 60000);
}

function minutesToLabel(minutes: number) {
  if (minutes < 60) return `${minutes}min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest > 0 ? `${hours}h${String(rest).padStart(2, "0")}` : `${hours}h`;
}

function clockLabel(date?: Date | null) {
  if (!date) return "--:--:--";
  return new Intl.DateTimeFormat("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(date);
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function getClient(clients: AdminClient[], clientId: string) {
  return clients.find((client) => client.id === clientId);
}

function toneForPercent(percent: number): Tone {
  if (percent >= 90) return "rose";
  if (percent >= 70) return "amber";
  if (percent >= 45) return "sky";
  return "emerald";
}

export default function LiveDashboardClient({
  appointments: initialAppointments,
  clients: initialClients,
  removals: initialRemovals,
}: LiveDashboardClientProps) {
  const [now, setNow] = useState(() => new Date());
  const [appointments, setAppointments] = useState(initialAppointments);
  const [clients, setClients] = useState(initialClients);
  const [removals, setRemovals] = useState(initialRemovals);
  const [syncError, setSyncError] = useState("");

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    let alive = true;

    async function refresh() {
      try {
        const remote = await loadAdminOperations();
        if (!alive) return;
        setAppointments(remote.appointments);
        setClients(remote.clients);
        setRemovals(remote.removals);
        setSyncError("");
      } catch (error: unknown) {
        if (!alive) return;
        setSyncError(error instanceof Error ? error.message : "Falha ao carregar Supabase.");
      }
    }

    void refresh();
    const timer = window.setInterval(() => {
      void refresh();
    }, 30000);

    return () => {
      alive = false;
      window.clearInterval(timer);
    };
  }, []);

  const referenceDate = now;
  const today = localIsoDate(referenceDate);
  const currentTime = `${String(referenceDate.getHours()).padStart(2, "0")}:${String(
    referenceDate.getMinutes()
  ).padStart(2, "0")}`;
  const weekStartIso = weekStart(today);
  const weekEndIso = addDays(weekStartIso, 6);

  const openRemovals = removals.filter((removal) => isRemovalOpen(removal.status));
  const todayAppointments = appointments
    .filter((appointment) => appointment.scheduledDate === today)
    .sort((a, b) => a.scheduledTime.localeCompare(b.scheduledTime));
  const weekAppointments = appointments.filter(
    (appointment) =>
      appointment.scheduledDate >= weekStartIso && appointment.scheduledDate <= weekEndIso
  );

  const overdueRemovals = openRemovals.filter((removal) => removal.dueDate < today);
  const dueToday = openRemovals.filter((removal) => removal.dueDate === today);
  const dueSoon = openRemovals.filter(
    (removal) => removal.dueDate > today && diffDays(today, removal.dueDate) <= 2
  );
  const awaitingClient = openRemovals.filter((removal) => removal.status === "aguardando_cliente");
  const completedToday = removals.filter(
    (removal) => removal.success === true && removal.completedAt === today
  );
  const successRows = removals.filter((removal) => removal.success === true);
  const closedRows = removals.filter((removal) => removal.success !== null);
  const receivable = successRows.reduce((acc, removal) => acc + removal.chargedAmount, 0);
  const successRate =
    closedRows.length > 0 ? Math.round((successRows.length / closedRows.length) * 100) : 0;

  const appointmentsAhead = appointments
    .filter((appointment) => {
      if (appointment.status === "concluido") return false;
      if (appointment.scheduledDate > today) return true;
      if (appointment.scheduledDate < today) return false;
      return appointment.scheduledTime >= currentTime;
    })
    .sort((a, b) =>
      `${a.scheduledDate} ${a.scheduledTime}`.localeCompare(`${b.scheduledDate} ${b.scheduledTime}`)
    );

  const nextAppointment = appointmentsAhead[0];
  const nextAppointmentMinutes = nextAppointment
    ? minutesUntil(appointmentDateTime(nextAppointment), referenceDate)
    : null;
  const nearAppointment =
    nextAppointment &&
    nextAppointment.scheduledDate === today &&
    nextAppointmentMinutes !== null &&
    nextAppointmentMinutes >= 0 &&
    nextAppointmentMinutes <= 90;

  const todayMinutes = todayAppointments.reduce(
    (acc, appointment) => acc + appointment.durationMinutes,
    0
  );
  const appointmentPotential = appointments
    .filter((appointment) => appointment.status !== "concluido")
    .reduce((acc, appointment) => acc + Number(appointment.potentialAmount || 0), 0);
  const todayDueMinutes = dueToday.length * 35;
  const capacityPercent = Math.round(
    (Math.min(todayMinutes + todayDueMinutes, DAILY_CAPACITY_MINUTES) / DAILY_CAPACITY_MINUTES) *
      100
  );
  const contextSwitches = new Set(todayAppointments.map((appointment) => appointment.clientId)).size;
  const focusScore = clamp(
    100 -
      overdueRemovals.length * 18 -
      awaitingClient.length * 8 -
      Math.max(capacityPercent - 82, 0) -
      Math.max(contextSwitches - 2, 0) * 8,
    18,
    98
  );

  const weekLoad = Array.from({ length: 7 }, (_, index) => {
    const iso = addDays(weekStartIso, index);
    const scheduled = appointments
      .filter((appointment) => appointment.scheduledDate === iso)
      .reduce((acc, appointment) => acc + appointment.durationMinutes, 0);
    const due = openRemovals.filter((removal) => removal.dueDate === iso).length * 35;
    const total = scheduled + due;
    return {
      iso,
      label: WEEK_DAYS[index],
      scheduled,
      due,
      total,
      percent: Math.round(Math.min(total / DAILY_CAPACITY_MINUTES, 1) * 100),
    };
  });

  const maxDaily = weekLoad.reduce(
    (current, item) => (item.total > current.total ? item : current),
    weekLoad[0]
  );

  const clientPressure = clients
    .map((client) => {
      const clientOpen = openRemovals.filter((removal) => removal.clientId === client.id);
      const clientAppointmentsToday = todayAppointments.filter(
        (appointment) => appointment.clientId === client.id
      );
      const waiting = clientOpen.filter((removal) => removal.status === "aguardando_cliente").length;
      const high = clientOpen.filter((removal) => removal.priority === "alta").length;
      const value = clientOpen.reduce((acc, removal) => acc + removal.chargedAmount, 0);
      const score = clientOpen.length * 28 + waiting * 18 + high * 16 + clientAppointmentsToday.length * 12;

      return {
        client,
        open: clientOpen.length,
        waiting,
        high,
        value,
        score,
      };
    })
    .sort((a, b) => b.score - a.score);

  const topClient = clientPressure[0];
  const heroTone: Tone =
    overdueRemovals.length > 0 ? "rose" : nearAppointment ? "sky" : dueToday.length > 0 ? "amber" : "emerald";
  const heroTitle =
    overdueRemovals.length > 0
      ? "Prazo vencido agora"
      : nearAppointment
        ? "Atendimento chegando"
        : dueToday.length > 0
          ? "Prazo de hoje"
          : "Operação sob controle";
  const heroAction =
    overdueRemovals[0]?.title ??
    nextAppointment?.title ??
    dueToday[0]?.title ??
    "Use a janela livre para remover gargalos";
  const heroDetail =
    overdueRemovals.length > 0
      ? `${overdueRemovals.length} caso(s) vencido(s). Comece pelo mais antigo.`
      : nearAppointment && nextAppointmentMinutes !== null
        ? `${getClient(clients, nextAppointment.clientId)?.name ?? "Cliente"} em ${nextAppointmentMinutes}min.`
        : dueToday.length > 0
          ? `${dueToday.length} remocao(oes) vence(m) hoje.`
          : `${focusScore}/100 de score de foco com ${todayAppointments.length} atendimento(s) hoje.`;

  const smartAlerts = [
    {
      id: "near-appointment",
      title: "Atendimento proximo",
      value: nearAppointment && nextAppointmentMinutes !== null ? `${nextAppointmentMinutes}min` : "--",
      detail: nextAppointment
        ? `${getClient(clients, nextAppointment.clientId)?.name ?? "Cliente"} - ${nextAppointment.title}`
        : "Nenhum atendimento futuro cadastrado.",
      icon: CalendarClock,
      tone: nearAppointment ? "sky" : "emerald",
      active: Boolean(nearAppointment),
    },
    {
      id: "overdue",
      title: "Prazo vencido",
      value: String(overdueRemovals.length),
      detail:
        overdueRemovals.length > 0
          ? "Risco de retrabalho e perda de narrativa."
          : "Nenhum prazo vencido nos mocks atuais.",
      icon: AlertTriangle,
      tone: overdueRemovals.length > 0 ? "rose" : "emerald",
      active: overdueRemovals.length > 0,
    },
    {
      id: "stalled-client",
      title: "Cliente travado",
      value: String(awaitingClient.length),
      detail: "Itens aguardando documento, resposta ou comprovante.",
      icon: TimerReset,
      tone: awaitingClient.length > 0 ? "amber" : "emerald",
      active: awaitingClient.length > 0,
    },
    {
      id: "billing",
      title: "Valor para reportar",
      value: formatCurrency(receivable),
      detail: "Casos ganhos que podem virar relatório e cobrança.",
      icon: CircleDollarSign,
      tone: receivable > 0 ? "violet" : "emerald",
      active: receivable > 0,
    },
    {
      id: "overload",
      title: "Carga do dia",
      value: `${capacityPercent}%`,
      detail:
        capacityPercent >= 85
          ? "Dia pesado. Melhor evitar encaixe sem reagendar algo."
          : "Ainda existe espaco para tarefa de alto impacto.",
      icon: Gauge,
      tone: capacityPercent >= 85 ? "rose" : capacityPercent >= 65 ? "amber" : "lime",
      active: capacityPercent >= 85,
    },
    {
      id: "client-pressure",
      title: "Cliente puxando foco",
      value: topClient ? String(topClient.open) : "0",
      detail: topClient
        ? `${topClient.client.name} concentra ${topClient.open} pendencia(s).`
        : "Sem pressao relevante por cliente.",
      icon: Users,
      tone: topClient && topClient.score > 55 ? "sky" : "emerald",
      active: Boolean(topClient && topClient.score > 55),
    },
  ] satisfies Array<{
    id: string;
    title: string;
    value: string;
    detail: string;
    icon: IconType;
    tone: Tone;
    active: boolean;
  }>;

  const queueItems = [
    ...overdueRemovals.map((removal) => ({
      id: `overdue-${removal.id}`,
      title: removal.title,
      client: getClient(clients, removal.clientId)?.name ?? "Cliente",
      meta: `Venceu em ${formatDate(removal.dueDate)} | ${impactTypeLabel[removal.impactType]}`,
      tone: "rose" as Tone,
      icon: AlertTriangle,
    })),
    ...dueToday.map((removal) => ({
      id: `due-${removal.id}`,
      title: removal.title,
      client: getClient(clients, removal.clientId)?.name ?? "Cliente",
      meta: `Vence hoje | ${statusLabel[removal.status]}`,
      tone: "amber" as Tone,
      icon: BellRing,
    })),
    ...todayAppointments
      .filter((appointment) => appointment.status !== "concluido")
      .map((appointment) => ({
        id: `appointment-${appointment.id}`,
        title: appointment.title,
        client: getClient(clients, appointment.clientId)?.name ?? "Cliente",
        meta: `${appointment.scheduledTime} | ${appointmentTypeLabel[appointment.type]} | ${appointmentStatusLabel[appointment.status]}`,
        tone: appointment.priority === "alta" ? ("sky" as Tone) : ("emerald" as Tone),
        icon: Clock3,
      })),
    ...dueSoon.slice(0, 2).map((removal) => ({
      id: `soon-${removal.id}`,
      title: removal.title,
      client: getClient(clients, removal.clientId)?.name ?? "Cliente",
      meta: `Vence em ${diffDays(today, removal.dueDate)} dia(s) | ${statusLabel[removal.status]}`,
      tone: "violet" as Tone,
      icon: TrendingUp,
    })),
  ].slice(0, 7);

  function requestFullscreen() {
    if (document.fullscreenElement) {
      void document.exitFullscreen?.();
      return;
    }

    void document.documentElement.requestFullscreen?.();
  }

  return (
    <main className="min-h-screen bg-[#030605] px-4 py-4 text-white sm:px-6 lg:px-8">
      <header className="flex flex-col gap-3 border-b border-white/10 pb-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-emerald-300/20 bg-emerald-400/10">
            <RadioTower className="h-5 w-5 text-emerald-100" aria-hidden={true} />
          </div>
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.22em] text-emerald-100/72">
              <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-300" />
              Suba Pro Verde Live
            </div>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">
              Sala de comando operacional
            </h1>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="rounded-2xl border border-white/10 bg-white/[0.045] px-4 py-2 text-right">
            <div className="text-xs text-white/42">{formatDate(today)}</div>
            <div className="font-mono text-2xl font-semibold tabular-nums text-white">
              {clockLabel(now)}
            </div>
          </div>
          <button
            type="button"
            onClick={requestFullscreen}
            className="inline-flex h-11 items-center gap-2 rounded-xl border border-sky-300/20 bg-sky-400/12 px-4 text-sm font-semibold text-sky-50 transition hover:bg-sky-400/18"
          >
            <Expand className="h-4 w-4" aria-hidden={true} />
            Tela cheia
          </button>
          <Link
            href="/admin/dashboard"
            className="inline-flex h-11 items-center gap-2 rounded-xl border border-white/10 bg-white/[0.045] px-4 text-sm font-semibold text-white/72 transition hover:bg-white/[0.08]"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden={true} />
            Voltar
          </Link>
        </div>
      </header>

      {syncError ? (
        <div className="mt-4 rounded-2xl border border-amber-300/20 bg-amber-400/[0.08] p-4 text-sm text-amber-50">
          Supabase: {syncError} Mantendo os últimos dados carregados na tela ao vivo.
        </div>
      ) : null}

      <section className="mt-4 grid gap-4 xl:grid-cols-[1.08fr_.92fr]">
        <div className={cn("relative overflow-hidden rounded-2xl border p-5", TONES[heroTone].card)}>
          <div className="absolute inset-x-0 top-0 h-1" style={{ background: TONES[heroTone].bar }} />
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <div className={cn("inline-flex rounded-full border px-3 py-1 text-xs font-semibold", TONES[heroTone].border, TONES[heroTone].text)}>
                Alerta principal
              </div>
              <h2 className="mt-4 text-4xl font-semibold tracking-tight sm:text-5xl">
                {heroTitle}
              </h2>
              <p className="mt-4 text-xl font-medium text-white/86">{heroAction}</p>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-white/55">{heroDetail}</p>
            </div>

            <div className="grid min-w-[260px] grid-cols-2 gap-3">
              <HeroMini label="Hoje" value={String(todayAppointments.length)} hint="atendimentos" />
              <HeroMini label="Concluidas" value={String(completedToday.length)} hint="no dia" />
              <HeroMini label="Semana" value={String(weekAppointments.length)} hint="agenda" />
              <HeroMini label="Sucesso" value={`${successRate}%`} hint="historico" />
            </div>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <LiveMetric
            icon={CalendarClock}
            label="Agenda hoje"
            value={String(todayAppointments.length)}
            hint={`${minutesToLabel(todayMinutes)} reservados`}
            tone="sky"
          />
          <LiveMetric
            icon={BellRing}
            label="Prazos hoje"
            value={String(dueToday.length)}
            hint={`${dueSoon.length} vencem em ate 48h`}
            tone={dueToday.length > 0 ? "amber" : "emerald"}
          />
          <LiveMetric
            icon={AlertTriangle}
            label="Vencidos"
            value={String(overdueRemovals.length)}
            hint="risco operacional"
            tone={overdueRemovals.length > 0 ? "rose" : "emerald"}
          />
          <LiveMetric
            icon={CircleDollarSign}
            label="A receber"
            value={formatCurrency(receivable)}
            hint="valor pronto para relatório"
            tone="violet"
          />
          <LiveMetric
            icon={TimerReset}
            label="Potencial agenda"
            value={formatCurrency(appointmentPotential)}
            hint="valor previsto nos encaixes"
            tone="amber"
          />
          <LiveMetric
            icon={Gauge}
            label="Carga do dia"
            value={`${capacityPercent}%`}
            hint={`${minutesToLabel(todayMinutes + todayDueMinutes)} de ${minutesToLabel(DAILY_CAPACITY_MINUTES)}`}
            tone={toneForPercent(capacityPercent)}
          />
          <LiveMetric
            icon={Activity}
            label="Score de foco"
            value={`${focusScore}/100`}
            hint={`${contextSwitches} cliente(s) hoje`}
            tone={focusScore < 60 ? "rose" : focusScore < 78 ? "amber" : "lime"}
          />
        </div>
      </section>

      <section className="mt-4 grid gap-4 xl:grid-cols-[1fr_.95fr_.95fr]">
        <div className="rounded-2xl border border-white/10 bg-white/[0.045] p-4">
          <SectionHead icon={Zap} title="Alertas inteligentes" detail="Sinais que eu deixaria disparando na sua operacao" />
          <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
            {smartAlerts.map((alert) => (
              <AlertTile key={alert.id} {...alert} />
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/[0.045] p-4">
          <SectionHead icon={Clock3} title="Fila de agora" detail="O que a tela mandaria resolver primeiro" />
          <div className="mt-4 space-y-3">
            {queueItems.map((item, index) => (
              <QueueRow key={item.id} index={index + 1} {...item} />
            ))}
            {queueItems.length === 0 ? (
              <div className="rounded-xl border border-white/10 bg-black/20 p-4 text-sm text-white/52">
                Nenhuma acao urgente nos dados atuais.
              </div>
            ) : null}
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/[0.045] p-4">
          <SectionHead
            icon={Users}
            title="Clientes puxando atenção"
            detail="Onde seu tempo tende a sumir primeiro"
          />
          <div className="mt-4 space-y-3">
            {clientPressure.map((item, index) => {
              const percent = clamp(item.score, 6, 100);
              const tone = index === 0 ? "sky" : item.high > 0 ? "amber" : "emerald";
              return (
                <div key={item.client.id} className="rounded-xl border border-white/10 bg-black/18 p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold text-white">{item.client.name}</div>
                      <div className="mt-1 text-xs text-white/42">
                        {item.open} abertas | {item.waiting} aguardando | {formatCurrency(item.value)}
                      </div>
                    </div>
                    <div className={cn("rounded-full border px-2 py-1 text-xs", TONES[tone].border, TONES[tone].text)}>
                      {index + 1}
                    </div>
                  </div>
                  <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10">
                    <div
                      className="h-full rounded-full"
                      style={{ width: `${percent}%`, background: TONES[tone].bar }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section className="mt-4 grid gap-4 xl:grid-cols-[1.2fr_.8fr]">
        <div className="rounded-2xl border border-white/10 bg-white/[0.045] p-4">
          <SectionHead
            icon={TrendingUp}
            title="Mapa live da semana"
            detail={`Pico atual: ${formatDate(maxDaily.iso)} com ${minutesToLabel(maxDaily.total)}`}
          />
          <div className="mt-5 grid gap-3 md:grid-cols-7">
            {weekLoad.map((day) => {
              const tone = toneForPercent(day.percent);
              return (
                <div key={day.iso} className={cn("rounded-xl border p-3", TONES[tone].card)}>
                  <div className="text-xs font-semibold text-white/76">{day.label}</div>
                  <div className="mt-1 text-[11px] text-white/40">{formatDate(day.iso)}</div>
                  <div className="mt-4 flex h-24 items-end overflow-hidden rounded-xl bg-black/25">
                    <div
                      className="w-full rounded-xl"
                      style={{ height: `${Math.max(day.percent, 8)}%`, background: TONES[tone].bar }}
                    />
                  </div>
                  <div className="mt-3 text-sm font-semibold text-white">{day.percent}%</div>
                  <div className="mt-1 text-[11px] text-white/42">
                    {minutesToLabel(day.scheduled)} agenda | {minutesToLabel(day.due)} prazo
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/[0.045] p-4">
          <SectionHead icon={CheckCircle2} title="Sugestões do dia" detail="Automações e gatilhos que fazem sentido" />
          <div className="mt-4 space-y-3">
            <Suggestion tone="rose" title="Escalar prazo vencido" detail="Quando passar da data prevista, subir para topo da fila e marcar como risco." />
            <Suggestion tone="amber" title="Cobrar cliente travado" detail="Se aguardar cliente por mais de 24h, gerar tarefa de WhatsApp e destacar no live." />
            <Suggestion tone="violet" title="Relatório pronto" detail="Caso removido com valor deve virar alerta de relatório/cobrança." />
            <Suggestion tone="sky" title="Atendimento em 30min" detail="Mostrar aviso visual persistente para preparar evidencias antes da chamada." />
          </div>
        </div>
      </section>
    </main>
  );
}

function SectionHead({
  icon: Icon,
  title,
  detail,
}: {
  icon: IconType;
  title: string;
  detail: string;
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div>
        <h2 className="text-sm font-semibold text-white">{title}</h2>
        <p className="mt-1 text-xs leading-5 text-white/45">{detail}</p>
      </div>
      <Icon className="h-5 w-5 text-emerald-200" aria-hidden={true} />
    </div>
  );
}

function HeroMini({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-black/22 px-4 py-3">
      <div className="text-xs text-white/45">{label}</div>
      <div className="mt-1 text-2xl font-semibold text-white">{value}</div>
      <div className="mt-1 text-xs text-white/38">{hint}</div>
    </div>
  );
}

function LiveMetric({
  icon: Icon,
  label,
  value,
  hint,
  tone,
}: {
  icon: IconType;
  label: string;
  value: string;
  hint: string;
  tone: Tone;
}) {
  return (
    <div className={cn("relative overflow-hidden rounded-2xl border p-4", TONES[tone].card)}>
      <div className="absolute inset-x-0 top-0 h-1" style={{ background: TONES[tone].bar }} />
      <div className="flex items-start justify-between gap-3">
        <div className="text-xs font-medium text-white/48">{label}</div>
        <Icon className="h-4 w-4 text-white/55" aria-hidden={true} />
      </div>
      <div className="mt-3 text-2xl font-semibold tracking-tight text-white">{value}</div>
      <div className="mt-1 text-xs leading-5 text-white/44">{hint}</div>
    </div>
  );
}

function AlertTile({
  title,
  value,
  detail,
  icon: Icon,
  tone,
  active,
}: {
  title: string;
  value: string;
  detail: string;
  icon: IconType;
  tone: Tone;
  active: boolean;
}) {
  return (
    <div className={cn("rounded-xl border p-3", active ? TONES[tone].card : "border-white/10 bg-black/18")}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-xs font-medium text-white/45">{title}</div>
          <div className="mt-1 text-xl font-semibold text-white">{value}</div>
        </div>
        <div className={cn("flex h-9 w-9 items-center justify-center rounded-xl border bg-black/22", TONES[tone].border)}>
          <Icon className="h-4 w-4 text-white/78" aria-hidden={true} />
        </div>
      </div>
      <p className="mt-2 text-xs leading-5 text-white/48">{detail}</p>
    </div>
  );
}

function QueueRow({
  index,
  title,
  client,
  meta,
  tone,
  icon: Icon,
}: {
  index: number;
  title: string;
  client: string;
  meta: string;
  tone: Tone;
  icon: IconType;
}) {
  return (
    <div className={cn("rounded-xl border p-3", TONES[tone].card)}>
      <div className="flex items-start gap-3">
        <div className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border bg-black/22 text-sm font-semibold", TONES[tone].border)}>
          {index}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold text-white">{title}</div>
              <div className="mt-1 truncate text-xs text-white/48">{client}</div>
            </div>
            <Icon className="h-4 w-4 shrink-0 text-white/58" aria-hidden={true} />
          </div>
          <div className="mt-2 text-xs leading-5 text-white/45">{meta}</div>
        </div>
      </div>
    </div>
  );
}

function Suggestion({ tone, title, detail }: { tone: Tone; title: string; detail: string }) {
  return (
    <div className={cn("rounded-xl border p-3", TONES[tone].card)}>
      <div className="flex items-start gap-3">
        <div className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: TONES[tone].solid }} />
        <div>
          <div className="text-sm font-semibold text-white">{title}</div>
          <div className="mt-1 text-xs leading-5 text-white/48">{detail}</div>
        </div>
      </div>
    </div>
  );
}
