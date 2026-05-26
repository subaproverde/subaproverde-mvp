"use client";

import { useEffect, useMemo, useState } from "react";
import type { ComponentType, ReactNode } from "react";
import Link from "next/link";
import {
  Activity,
  AlertTriangle,
  BellRing,
  Brain,
  CalendarDays,
  CalendarPlus,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CircleDollarSign,
  ClipboardList,
  Gauge,
  Hourglass,
  Layers3,
  MousePointerClick,
  PauseCircle,
  Pencil,
  RadioTower,
  Sparkles,
  Target,
  TimerReset,
  TrendingUp,
  Trash2,
  X,
  Zap,
} from "lucide-react";
import type {
  AdminAppointment,
  AdminClient,
  AdminRemoval,
  AppointmentType,
} from "../admin-data";
import {
  appointmentStatusLabel,
  appointmentTypeLabel,
  formatCurrency,
  formatDate,
  impactTypeLabel,
  isRemovalOpen,
  statusLabel,
} from "../admin-data";
import {
  deleteAdminAppointment,
  loadAdminOperations,
  saveAdminAppointment,
  saveAdminClient,
  syncAdminOperations,
} from "@/lib/adminOperationsClient";
import NotificationCenter from "./NotificationCenter";

type IconType = ComponentType<{ className?: string; "aria-hidden"?: boolean }>;

type DashboardClientProps = {
  initialAppointments: AdminAppointment[];
  clients: AdminClient[];
  removals: AdminRemoval[];
};

type AppointmentForm = {
  clientId: string;
  title: string;
  type: AppointmentType;
  scheduledDate: string;
  scheduledTime: string;
  durationMinutes: number;
  potentialAmount: number;
  priority: "alta" | "media" | "baixa";
  notes: string;
};

type ClientDraft = Pick<
  AdminClient,
  "name" | "document" | "contactName" | "phone" | "email" | "notes"
>;

type StoredAdminRemocoes = {
  clients?: AdminClient[];
  removals?: AdminRemoval[];
  updatedAt?: string;
};

type StoredAdminDashboard = {
  appointments?: AdminAppointment[];
  updatedAt?: string;
};

type CalendarDay = {
  iso: string;
  day: number;
  inMonth: boolean;
};

type FocusMode = "hoje" | "semana" | "risco" | "cobranca";

const DAILY_CAPACITY_MINUTES = 360;
const MS_PER_DAY = 24 * 60 * 60 * 1000;
const WEEK_DAYS = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sab", "Dom"];
const ADMIN_REMOCOES_STORAGE_KEY = "spv:admin-remocoes:v1";
const ADMIN_DASHBOARD_STORAGE_KEY = "spv:admin-dashboard:v1";

const FOCUS_MODES: Array<{
  id: FocusMode;
  label: string;
  detail: string;
  icon: IconType;
}> = [
  {
    id: "hoje",
    label: "Hoje",
    detail: "o que fazer agora",
    icon: MousePointerClick,
  },
  {
    id: "semana",
    label: "Semana",
    detail: "capacidade e agenda",
    icon: CalendarDays,
  },
  {
    id: "risco",
    label: "Risco",
    detail: "prazo, dinheiro e atraso",
    icon: AlertTriangle,
  },
  {
    id: "cobranca",
    label: "Cobrança",
    detail: "ganhos para reportar",
    icon: CircleDollarSign,
  },
];

const SPECTRUM = [
  {
    name: "emerald",
    soft: "border-emerald-300/18 bg-emerald-400/[0.075]",
    text: "text-emerald-50",
    bar: "linear-gradient(90deg, #34d399, #a3e635)",
    solid: "#34d399",
  },
  {
    name: "sky",
    soft: "border-sky-300/18 bg-sky-400/[0.075]",
    text: "text-sky-50",
    bar: "linear-gradient(90deg, #38bdf8, #22d3ee)",
    solid: "#38bdf8",
  },
  {
    name: "amber",
    soft: "border-amber-300/18 bg-amber-400/[0.075]",
    text: "text-amber-50",
    bar: "linear-gradient(90deg, #fbbf24, #fb923c)",
    solid: "#fbbf24",
  },
  {
    name: "rose",
    soft: "border-rose-300/18 bg-rose-400/[0.075]",
    text: "text-rose-50",
    bar: "linear-gradient(90deg, #fb7185, #f43f5e)",
    solid: "#fb7185",
  },
  {
    name: "violet",
    soft: "border-violet-300/18 bg-violet-400/[0.075]",
    text: "text-violet-50",
    bar: "linear-gradient(90deg, #a78bfa, #f0abfc)",
    solid: "#a78bfa",
  },
  {
    name: "lime",
    soft: "border-lime-300/18 bg-lime-400/[0.075]",
    text: "text-lime-50",
    bar: "linear-gradient(90deg, #a3e635, #22c55e)",
    solid: "#a3e635",
  },
];

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function parseIsoDate(iso: string) {
  return new Date(`${iso}T12:00:00`);
}

function toIsoDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function addDays(iso: string, days: number) {
  const date = parseIsoDate(iso);
  date.setDate(date.getDate() + days);
  return toIsoDate(date);
}

function diffDays(start: string, end: string) {
  const startTime = parseIsoDate(start).getTime();
  const endTime = parseIsoDate(end).getTime();

  if (Number.isNaN(startTime) || Number.isNaN(endTime)) return 0;
  return Math.round((endTime - startTime) / MS_PER_DAY);
}

function monthLabel(iso: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    month: "long",
    year: "numeric",
  }).format(parseIsoDate(iso));
}

function monthStart(iso: string) {
  const date = parseIsoDate(iso);
  date.setDate(1);
  return toIsoDate(date);
}

function moveMonth(iso: string, offset: number) {
  const date = parseIsoDate(iso);
  date.setMonth(date.getMonth() + offset);
  date.setDate(1);
  return toIsoDate(date);
}

function buildCalendarDays(monthIso: string): CalendarDay[] {
  const first = parseIsoDate(monthStart(monthIso));
  const month = first.getMonth();
  const mondayOffset = (first.getDay() + 6) % 7;
  const start = new Date(first);
  start.setDate(first.getDate() - mondayOffset);

  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    return {
      iso: toIsoDate(date),
      day: date.getDate(),
      inMonth: date.getMonth() === month,
    };
  });
}

function weekStart(iso: string) {
  const date = parseIsoDate(iso);
  const offset = (date.getDay() + 6) % 7;
  date.setDate(date.getDate() - offset);
  return toIsoDate(date);
}

function sameWeek(iso: string, reference: string) {
  const start = weekStart(reference);
  const end = addDays(start, 6);
  return iso >= start && iso <= end;
}

function minutesToLabel(minutes: number) {
  if (minutes < 60) return `${minutes}min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest > 0 ? `${hours}h${String(rest).padStart(2, "0")}` : `${hours}h`;
}

function defaultForm(
  selectedDate: string,
  clientId: string,
  type: AppointmentType = "tarefa"
): AppointmentForm {
  return {
    clientId,
    title: "",
    type,
    scheduledDate: selectedDate,
    scheduledTime: "09:00",
    durationMinutes: 30,
    potentialAmount: 0,
    priority: "media",
    notes: "",
  };
}

function emptyClientDraft(): ClientDraft {
  return {
    name: "",
    document: "",
    contactName: "",
    phone: "",
    email: "",
    notes: "",
  };
}

function priorityTone(priority: "alta" | "media" | "baixa") {
  if (priority === "alta") return "border-rose-300/20 bg-rose-400/10 text-rose-50";
  if (priority === "baixa") return "border-white/10 bg-white/[0.04] text-white/55";
  return "border-amber-300/20 bg-amber-400/10 text-amber-50";
}

function statusTone(status: AdminAppointment["status"]) {
  if (status === "confirmado" || status === "concluido") {
    return "border-emerald-300/20 bg-emerald-400/10 text-emerald-50";
  }
  if (status === "remarcar") return "border-rose-300/20 bg-rose-400/10 text-rose-50";
  if (status === "em_atendimento") return "border-sky-300/20 bg-sky-400/10 text-sky-50";
  return "border-white/10 bg-white/[0.05] text-white/65";
}

function readStoredAdminRemocoes(): StoredAdminRemocoes | null {
  if (typeof window === "undefined") return null;

  try {
    const raw = window.localStorage.getItem(ADMIN_REMOCOES_STORAGE_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as StoredAdminRemocoes;

    return {
      clients: Array.isArray(parsed.clients) ? parsed.clients : undefined,
      removals: Array.isArray(parsed.removals) ? parsed.removals : undefined,
      updatedAt: parsed.updatedAt,
    };
  } catch {
    return null;
  }
}

function writeStoredAdminRemocoes(clients: AdminClient[], removals: AdminRemoval[]) {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(
      ADMIN_REMOCOES_STORAGE_KEY,
      JSON.stringify({
        clients,
        removals,
        updatedAt: new Date().toISOString(),
      })
    );
  } catch {
    // Local mock persistence only; Supabase will own this later.
  }
}

function readStoredAdminDashboard(): StoredAdminDashboard | null {
  if (typeof window === "undefined") return null;

  try {
    const raw = window.localStorage.getItem(ADMIN_DASHBOARD_STORAGE_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as StoredAdminDashboard;

    return {
      appointments: Array.isArray(parsed.appointments) ? parsed.appointments : undefined,
      updatedAt: parsed.updatedAt,
    };
  } catch {
    return null;
  }
}

function writeStoredAdminDashboard(appointments: AdminAppointment[]) {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(
      ADMIN_DASHBOARD_STORAGE_KEY,
      JSON.stringify({
        appointments,
        updatedAt: new Date().toISOString(),
      })
    );
  } catch {
    // Local mock persistence only; Supabase will own this later.
  }
}

export default function DashboardClient({
  initialAppointments,
  clients: initialClients,
  removals: initialRemovals,
}: DashboardClientProps) {
  const today = todayIso();
  const [clients, setClients] = useState(initialClients);
  const [removals, setRemovals] = useState(initialRemovals);
  const [appointments, setAppointments] = useState(initialAppointments);
  const [storageReady, setStorageReady] = useState(false);
  const [remoteLoading, setRemoteLoading] = useState(true);
  const [syncError, setSyncError] = useState("");
  const [selectedDate, setSelectedDate] = useState(today);
  const [visibleMonth, setVisibleMonth] = useState(monthStart(today));
  const [showScheduler, setShowScheduler] = useState(false);
  const [editingAppointmentId, setEditingAppointmentId] = useState<string | null>(null);
  const [focusMode, setFocusMode] = useState<FocusMode>("hoje");
  const [clientFormOpen, setClientFormOpen] = useState(false);
  const [clientDraft, setClientDraft] = useState<ClientDraft>(() => emptyClientDraft());
  const [form, setForm] = useState<AppointmentForm>(() =>
    defaultForm(today, initialClients[0]?.id ?? "")
  );

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void (async () => {
        const storedAdmin = readStoredAdminRemocoes();
        const storedDashboard = readStoredAdminDashboard();

        if (storedAdmin?.clients) setClients(storedAdmin.clients);
        if (storedAdmin?.removals) setRemovals(storedAdmin.removals);
        if (storedDashboard?.appointments) setAppointments(storedDashboard.appointments);

        try {
          let remote = await loadAdminOperations();
          const storedClients = storedAdmin?.clients ?? [];
          const storedRemovals = storedAdmin?.removals ?? [];
          const storedAppointments = storedDashboard?.appointments ?? [];
          const shouldSyncLocal =
            (remote.clients.length === 0 && storedClients.length > 0) ||
            (remote.removals.length === 0 && storedRemovals.length > 0) ||
            (remote.appointments.length === 0 && storedAppointments.length > 0);

          if (shouldSyncLocal) {
            remote = await syncAdminOperations({
              clients: storedClients,
              removals: storedRemovals,
              appointments: storedAppointments,
            });
          }

          setClients(remote.clients);
          setRemovals(remote.removals);
          setAppointments(remote.appointments);
          setSyncError("");
        } catch (error: unknown) {
          setSyncError(error instanceof Error ? error.message : "Falha ao carregar dados do Supabase.");
        } finally {
          setStorageReady(true);
          setRemoteLoading(false);
        }
      })();
    }, 0);

    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!storageReady) return;
    writeStoredAdminDashboard(appointments);
  }, [appointments, storageReady]);

  useEffect(() => {
    if (!storageReady) return;
    writeStoredAdminRemocoes(clients, removals);
  }, [clients, removals, storageReady]);

  const clientById = useMemo(() => {
    const map = new Map<string, AdminClient>();
    for (const client of clients) map.set(client.id, client);
    return map;
  }, [clients]);

  function clientNameById(clientId: string) {
    return clientById.get(clientId)?.name ?? "Cliente";
  }

  const openRemovals = useMemo(
    () => removals.filter((removal) => isRemovalOpen(removal.status)),
    [removals]
  );

  const todayAppointments = useMemo(
    () =>
      appointments
        .filter((appointment) => appointment.scheduledDate === today)
        .sort((a, b) => a.scheduledTime.localeCompare(b.scheduledTime)),
    [appointments, today]
  );

  const weekAppointments = useMemo(
    () => appointments.filter((appointment) => sameWeek(appointment.scheduledDate, today)),
    [appointments, today]
  );

  const selectedAppointments = useMemo(
    () =>
      appointments
        .filter((appointment) => appointment.scheduledDate === selectedDate)
        .sort((a, b) => a.scheduledTime.localeCompare(b.scheduledTime)),
    [appointments, selectedDate]
  );

  const selectedDueRemovals = useMemo(
    () =>
      removals
        .filter((removal) => removal.dueDate === selectedDate && isRemovalOpen(removal.status))
        .sort((a, b) => a.priority.localeCompare(b.priority)),
    [removals, selectedDate]
  );

  const nextAppointment = useMemo(() => {
    return appointments
      .filter(
        (appointment) =>
          appointment.status !== "concluido" &&
          `${appointment.scheduledDate} ${appointment.scheduledTime}` >= `${today} 00:00`
      )
      .sort((a, b) =>
        `${a.scheduledDate} ${a.scheduledTime}`.localeCompare(
          `${b.scheduledDate} ${b.scheduledTime}`
        )
      )[0];
  }, [appointments, today]);

  const calendarDays = useMemo(() => buildCalendarDays(visibleMonth), [visibleMonth]);

  const appointmentsByDate = useMemo(() => {
    const map = new Map<string, AdminAppointment[]>();
    for (const appointment of appointments) {
      const list = map.get(appointment.scheduledDate) ?? [];
      list.push(appointment);
      map.set(appointment.scheduledDate, list);
    }
    return map;
  }, [appointments]);

  const dueByDate = useMemo(() => {
    const map = new Map<string, AdminRemoval[]>();
    for (const removal of openRemovals) {
      const list = map.get(removal.dueDate) ?? [];
      list.push(removal);
      map.set(removal.dueDate, list);
    }
    return map;
  }, [openRemovals]);

  const dailyWorkloads = useMemo(() => {
    return calendarDays.map((day) => {
      const scheduledMinutes = (appointmentsByDate.get(day.iso) ?? []).reduce(
        (acc, appointment) => acc + appointment.durationMinutes,
        0
      );
      const dueMinutes = (dueByDate.get(day.iso) ?? []).length * 35;
      return {
        ...day,
        scheduledMinutes,
        dueMinutes,
        totalMinutes: scheduledMinutes + dueMinutes,
      };
    });
  }, [appointmentsByDate, calendarDays, dueByDate]);

  const todayMinutes = todayAppointments.reduce(
    (acc, appointment) => acc + appointment.durationMinutes,
    0
  );
  const todayDueMinutes = (dueByDate.get(today) ?? []).length * 35;
  const todayLoad = Math.min(todayMinutes + todayDueMinutes, DAILY_CAPACITY_MINUTES);
  const capacityPercent = Math.round((todayLoad / DAILY_CAPACITY_MINUTES) * 100);

  const maxDaily = dailyWorkloads.reduce(
    (current, item) => (item.totalMinutes > current.totalMinutes ? item : current),
    dailyWorkloads[0] ?? {
      iso: today,
      day: 0,
      inMonth: true,
      scheduledMinutes: 0,
      dueMinutes: 0,
      totalMinutes: 0,
    }
  );

  const overdueRemovals = openRemovals.filter((removal) => removal.dueDate < today);
  const dueToday = openRemovals.filter((removal) => removal.dueDate === today);
  const awaitingClient = openRemovals.filter((removal) => removal.status === "aguardando_cliente");
  const activeAppointments = appointments.filter((appointment) => appointment.status !== "concluido");
  const appointmentPotential = activeAppointments.reduce(
    (acc, appointment) => acc + Number(appointment.potentialAmount || 0),
    0
  );
  const receivable = removals
    .filter((removal) => removal.success === true && removal.chargedAmount > 0)
    .reduce((acc, removal) => acc + removal.chargedAmount, 0);
  const revenueAtRisk = openRemovals
    .filter((removal) => removal.priority === "alta" || removal.dueDate <= today)
    .reduce((acc, removal) => acc + removal.chargedAmount, 0);
  const closedRows = removals.filter((removal) => removal.success !== null);
  const successRows = removals.filter((removal) => removal.success === true);
  const successRate =
    closedRows.length > 0 ? Math.round((successRows.length / closedRows.length) * 100) : 0;
  const contextSwitches = new Set(todayAppointments.map((appointment) => appointment.clientId)).size;
  const stalledDays = openRemovals.reduce(
    (acc, removal) => acc + Math.max(diffDays(removal.serviceDate, today), 0),
    0
  );

  const clientOpportunities = clients
    .map((client) => {
      const clientRemovals = openRemovals.filter((removal) => removal.clientId === client.id);
      const clientAppointments = activeAppointments.filter(
        (appointment) => appointment.clientId === client.id
      );
      const futureAppointments = clientAppointments
        .filter((appointment) => appointment.scheduledDate >= today)
        .sort((a, b) =>
          `${a.scheduledDate} ${a.scheduledTime}`.localeCompare(`${b.scheduledDate} ${b.scheduledTime}`)
        );
      const pastAppointments = clientAppointments
        .filter((appointment) => appointment.scheduledDate < today)
        .sort((a, b) =>
          `${b.scheduledDate} ${b.scheduledTime}`.localeCompare(`${a.scheduledDate} ${a.scheduledTime}`)
        );
      const openValue = clientRemovals.reduce((acc, removal) => acc + Number(removal.chargedAmount || 0), 0);
      const plannedValue = clientAppointments.reduce(
        (acc, appointment) => acc + Number(appointment.potentialAmount || 0),
        0
      );
      const lastTouchDate =
        pastAppointments[0]?.scheduledDate ??
        clientRemovals.sort((a, b) => b.serviceDate.localeCompare(a.serviceDate))[0]?.serviceDate ??
        "";
      const daysIdle = futureAppointments[0] ? 0 : lastTouchDate ? Math.max(diffDays(lastTouchDate, today), 0) : 0;
      const potential = openValue + plannedValue;
      const pressure = potential > 0 ? Math.min(100, daysIdle * 9 + clientRemovals.length * 12 + potential / 35) : 0;

      return {
        client,
        openCount: clientRemovals.length,
        openValue,
        plannedValue,
        potential,
        nextAppointment: futureAppointments[0],
        daysIdle,
        pressure,
      };
    })
    .filter((item) => item.potential > 0 || item.openCount > 0)
    .sort((a, b) => b.pressure - a.pressure);

  const neglectedClients = clientOpportunities.filter(
    (item) => !item.nextAppointment && (item.daysIdle >= 5 || item.potential >= 300 || item.openCount >= 2)
  );
  const neglectedValue = neglectedClients.reduce((acc, item) => acc + item.potential, 0);
  const focusScore = Math.max(
    25,
    Math.round(
      100 -
        overdueRemovals.length * 14 -
        contextSwitches * 7 -
        neglectedClients.length * 8 -
        Math.min(neglectedValue / 120, 18) -
        Math.max(capacityPercent - 85, 0)
    )
  );

  const bottlenecks = [
    {
      label: "Cliente esquecido",
      value: neglectedClients.length,
      percent: Math.min(neglectedClients.length * 34, 100),
      detail: `${formatCurrency(neglectedValue)} sem proximo encaixe`,
      icon: PauseCircle,
    },
    {
      label: "Prazo vencido",
      value: overdueRemovals.length,
      percent: Math.min(overdueRemovals.length * 38, 100),
      detail: `${overdueRemovals.length} remocao(oes) atrasada(s)`,
      icon: AlertTriangle,
    },
    {
      label: "Troca de contexto",
      value: contextSwitches,
      percent: Math.min(contextSwitches * 25, 100),
      detail: `${contextSwitches} cliente(s) no dia`,
      icon: Layers3,
    },
    {
      label: "Cobrança pronta",
      value: successRows.length,
      percent: Math.min(successRows.length * 28, 100),
      detail: `${formatCurrency(receivable)} ja defendido`,
      icon: CircleDollarSign,
    },
  ];

  const weekHeatmap = Array.from({ length: 7 }, (_, index) => {
    const iso = addDays(weekStart(today), index);
    const scheduled = appointments
      .filter((appointment) => appointment.scheduledDate === iso)
      .reduce((acc, appointment) => acc + appointment.durationMinutes, 0);
    const due = (dueByDate.get(iso) ?? []).length * 35;
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

  const timeLoss = [
    {
      label: "Esperando cliente",
      value: awaitingClient.length * 65,
      detail: `${awaitingClient.length} pendencia(s) travadas por retorno`,
    },
    {
      label: "Cliente rentavel sem agenda",
      value: Math.round(neglectedValue / 8),
      detail: `${formatCurrency(neglectedValue)} parado em clientes sem encaixe`,
    },
    {
      label: "Prazo vencido",
      value: overdueRemovals.length * 55,
      detail: `${overdueRemovals.length} item(ns) exigem replanejamento`,
    },
    {
      label: "Defesa manual",
      value: openRemovals.filter((removal) => removal.priority === "alta").length * 45,
      detail: "Casos de alta prioridade consumindo foco",
    },
    {
      label: "Relatório/cobrança",
      value: successRows.length * 25,
      detail: "Casos ganhos que ainda precisam virar comunicação",
    },
  ].sort((a, b) => b.value - a.value);
  const maxTimeLoss = Math.max(...timeLoss.map((item) => item.value), 1);

  const pipeline = [
    {
      label: "Para agir agora",
      value: overdueRemovals.length + dueToday.length,
      detail: "Vencidos ou vencendo hoje",
      tone: "rose",
    },
    {
      label: "Em defesa",
      value: openRemovals.filter(
        (removal) => removal.status === "pendente" || removal.status === "em_andamento"
      ).length,
      detail: "Precisa de execucao operacional",
      tone: "amber",
    },
    {
      label: "Aguardando cliente",
      value: awaitingClient.length,
      detail: "Sem documento ou resposta",
      tone: "sky",
    },
    {
      label: "Sem próximo encaixe",
      value: neglectedClients.length,
      detail: `${formatCurrency(neglectedValue)} pode esfriar`,
      tone: "rose",
    },
    {
      label: "Ganhos para reportar",
      value: successRows.length,
      detail: "Oportunidade de relatório/cobrança",
      tone: "green",
    },
  ];

  const focusCopy: Record<FocusMode, { title: string; body: string; color: number }> = {
    hoje: {
      title: "Modo Hoje",
      body: `Comece pelo proximo atendimento e mantenha a carga abaixo de 85%. Hoje esta em ${capacityPercent}%.`,
      color: 0,
    },
    semana: {
      title: "Modo Semana",
      body: `${weekAppointments.length} atendimento(s) na semana. O pico atual e ${formatDate(maxDaily.iso)} com ${minutesToLabel(maxDaily.totalMinutes)}.`,
      color: 1,
    },
    risco: {
      title: "Modo Risco",
      body: `${overdueRemovals.length} vencido(s), ${dueToday.length} vencendo hoje, ${formatCurrency(revenueAtRisk)} em jogo e ${formatCurrency(neglectedValue)} sem encaixe.`,
      color: 3,
    },
    cobranca: {
      title: "Modo Cobrança",
      body: `${successRows.length} caso(s) ganhos podem virar relatório e ${formatCurrency(receivable)} em comunicação de valor.`,
      color: 4,
    },
  };

  const liveAlerts = [
    {
      id: "next",
      title: "Comecar por aqui",
      value: nextAppointment ? nextAppointment.scheduledTime : "--",
      detail: nextAppointment
        ? `${clientNameById(nextAppointment.clientId)} - ${nextAppointment.title}`
        : "Sem agenda futura. Use a janela para atacar pendencias.",
      icon: RadioTower,
      color: 0,
      mode: "hoje" as FocusMode,
      date: nextAppointment?.scheduledDate ?? today,
    },
    {
      id: "overdue",
      title: "Prazo queimando",
      value: String(overdueRemovals.length),
      detail:
        overdueRemovals.length > 0
          ? "Existe atraso operacional que pode virar retrabalho."
          : "Nenhum prazo vencido nos dados atuais.",
      icon: BellRing,
      color: overdueRemovals.length > 0 ? 3 : 1,
      mode: "risco" as FocusMode,
      date: overdueRemovals[0]?.dueDate ?? today,
    },
    {
      id: "money",
      title: "Dinheiro parado",
      value: formatCurrency(receivable),
      detail: "Casos ganhos que pedem relatório, cobrança ou mensagem de resultado.",
      icon: CircleDollarSign,
      color: 4,
      mode: "cobranca" as FocusMode,
      date: successRows[0]?.completedAt ?? today,
    },
    {
      id: "load",
      title: "Energia do dia",
      value: `${capacityPercent}%`,
      detail:
        capacityPercent >= 85
          ? "Dia pesado. Evite encaixes sem replanejar."
          : "Ainda existe espaco para uma tarefa de alto impacto.",
      icon: Activity,
      color: capacityPercent >= 85 ? 3 : 5,
      mode: "semana" as FocusMode,
      date: today,
    },
  ];

  function selectDay(iso: string) {
    setSelectedDate(iso);
    setForm((current) => ({ ...current, scheduledDate: iso }));
  }

  function activateAlert(mode: FocusMode, date: string) {
    setFocusMode(mode);
    setSelectedDate(date);
    setVisibleMonth(monthStart(date));
  }

  function openScheduler(iso = selectedDate, type: AppointmentType = "tarefa") {
    setSelectedDate(iso);
    setEditingAppointmentId(null);
    setForm(defaultForm(iso, clients[0]?.id ?? "", type));
    setClientFormOpen(false);
    setClientDraft(emptyClientDraft());
    setShowScheduler(true);
  }

  function openOpportunityScheduler(clientId: string, clientName: string, potential: number, iso = today) {
    setSelectedDate(iso);
    setEditingAppointmentId(null);
    setForm({
      ...defaultForm(iso, clientId, "defesa"),
      title: `Remover impactos - ${clientName}`,
      potentialAmount: potential,
      priority: potential >= 500 ? "alta" : "media",
      notes: "Cliente com carteira de impactos para encaixar ao longo das semanas.",
    });
    setClientFormOpen(false);
    setClientDraft(emptyClientDraft());
    setShowScheduler(true);
  }

  function closeScheduler() {
    setShowScheduler(false);
    setEditingAppointmentId(null);
  }

  function openEditAppointment(appointment: AdminAppointment) {
    setEditingAppointmentId(appointment.id);
    setSelectedDate(appointment.scheduledDate);
    setVisibleMonth(monthStart(appointment.scheduledDate));
    setClientFormOpen(false);
    setClientDraft(emptyClientDraft());
    setForm({
      clientId: appointment.clientId,
      title: appointment.title,
      type: appointment.type,
      scheduledDate: appointment.scheduledDate,
      scheduledTime: appointment.scheduledTime,
      durationMinutes: appointment.durationMinutes,
      potentialAmount: appointment.potentialAmount ?? 0,
      priority: appointment.priority,
      notes: appointment.notes ?? "",
    });
    setShowScheduler(true);
  }

  async function deleteAppointment(appointment: AdminAppointment) {
    const confirmed = window.confirm(
      `Excluir o agendamento "${appointment.title}"? Esta ação remove o registro salvo no Supabase.`
    );

    if (!confirmed) return;

    const previous = appointments;
    setAppointments((current) => current.filter((item) => item.id !== appointment.id));

    if (editingAppointmentId === appointment.id) {
      closeScheduler();
    }

    try {
      await deleteAdminAppointment(appointment.id);
      setSyncError("");
    } catch (error: unknown) {
      setAppointments(previous);
      setSyncError(error instanceof Error ? error.message : "Falha ao excluir agendamento no Supabase.");
    }
  }

  function updateForm<K extends keyof AppointmentForm>(key: K, value: AppointmentForm[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function updateClientDraft<K extends keyof ClientDraft>(key: K, value: ClientDraft[K]) {
    setClientDraft((current) => ({ ...current, [key]: value }));
  }

  function persistClient(client: AdminClient) {
    void saveAdminClient(client).catch((error: unknown) => {
      setSyncError(error instanceof Error ? error.message : "Falha ao salvar cliente no Supabase.");
    });
  }

  function createClientFromDraft() {
    const nextClient: AdminClient = {
      id: `cli-local-${Date.now()}`,
      name: clientDraft.name.trim() || `Cliente ${clients.length + 1}`,
      document: clientDraft.document.trim(),
      contactName: clientDraft.contactName.trim(),
      phone: clientDraft.phone.trim(),
      email: clientDraft.email.trim(),
      notes: clientDraft.notes.trim(),
    };

    setClients((current) => [nextClient, ...current]);
    setForm((current) => ({ ...current, clientId: nextClient.id }));
    setClientDraft(emptyClientDraft());
    setClientFormOpen(false);
    persistClient(nextClient);
  }

  function ensureClient(clientId: string) {
    if (clientId) return { clientId };
    if (clients[0]?.id) return { clientId: clients[0].id };

    const nextClient: AdminClient = {
      id: `cli-local-${Date.now()}`,
      name: "Cliente sem nome",
      document: "",
      contactName: "",
      phone: "",
      email: "",
      notes: "Criado automaticamente para salvar um atendimento parcial.",
    };

    setClients((current) => [nextClient, ...current]);
    return { clientId: nextClient.id, createdClient: nextClient };
  }

  async function saveAppointment() {
    const ensured = ensureClient(form.clientId);
    const clientId = ensured.clientId;
    const existing = editingAppointmentId
      ? appointments.find((appointment) => appointment.id === editingAppointmentId)
      : null;

    const next: AdminAppointment = {
      id: editingAppointmentId ?? `apt-local-${Date.now()}`,
      clientId,
      title: form.title.trim() || (form.type === "tarefa" ? "Tarefa sem título" : "Atendimento sem título"),
      type: form.type,
      status: existing?.status ?? "agendado",
      scheduledDate: form.scheduledDate,
      scheduledTime: form.scheduledTime,
      durationMinutes: Number(form.durationMinutes || 30),
      potentialAmount: Number(form.potentialAmount || 0),
      priority: form.priority,
      notes: form.notes.trim(),
    };

    setAppointments((current) => {
      const rows = editingAppointmentId
        ? current.map((appointment) => (appointment.id === editingAppointmentId ? next : appointment))
        : [...current, next];

      return rows.sort((a, b) => {
        return `${a.scheduledDate} ${a.scheduledTime}`.localeCompare(
          `${b.scheduledDate} ${b.scheduledTime}`
        );
      });
    });
    setSelectedDate(form.scheduledDate);
    setVisibleMonth(monthStart(form.scheduledDate));
    closeScheduler();

    try {
      if (ensured.createdClient) {
        await saveAdminClient(ensured.createdClient);
      }

      const saved = await saveAdminAppointment(next);
      setAppointments((current) =>
        current
          .map((appointment) => (appointment.id === next.id ? saved : appointment))
          .sort((a, b) =>
            `${a.scheduledDate} ${a.scheduledTime}`.localeCompare(`${b.scheduledDate} ${b.scheduledTime}`)
          )
      );
      setSyncError("");
    } catch (error: unknown) {
      setSyncError(error instanceof Error ? error.message : "Falha ao salvar agendamento no Supabase.");
    }
  }

  return (
    <div className="space-y-6">
      <section className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-emerald-300/20 bg-emerald-400/10 px-3 py-1 text-xs font-medium text-emerald-100">
            <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
            Command center
          </div>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-white">
            Dashboard admin
          </h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-white/58">
            Controle visual da rotina: agenda, prazos, gargalos, valor parado e onde
            seu tempo esta escapando. Dados operacionais conectados ao Supabase.
          </p>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row">
          <Link
            href="/admin/dashboard/live"
            className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-sky-300/20 bg-sky-400/12 px-4 text-sm font-semibold text-sky-50 transition hover:bg-sky-400/18"
          >
            <RadioTower className="h-4 w-4" aria-hidden="true" />
            Dashboard ao vivo
          </Link>
          <button
            type="button"
            onClick={() => openScheduler(today, "tarefa")}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-emerald-300/20 bg-emerald-400/14 px-4 text-sm font-semibold text-emerald-50 transition hover:bg-emerald-400/18"
          >
            <CalendarPlus className="h-4 w-4" aria-hidden="true" />
            Agendar no calendário
          </button>
        </div>
      </section>

      {remoteLoading || syncError ? (
        <section
          className={cn(
            "rounded-2xl border p-4 text-sm",
            syncError
              ? "border-amber-300/20 bg-amber-400/[0.08] text-amber-50"
              : "border-emerald-300/16 bg-emerald-400/[0.07] text-emerald-50"
          )}
        >
          {syncError
            ? `Supabase: ${syncError} Os dados locais continuam visíveis como fallback.`
            : "Carregando dados do Supabase..."}
        </section>
      ) : null}

      <NotificationCenter appointments={appointments} clients={clients} removals={removals} />

      <section className="grid gap-4 xl:grid-cols-[1.05fr_.95fr]">
        <div className="rounded-2xl border border-white/10 bg-white/[0.045] p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold text-white">Modo de foco</h2>
              <p className="mt-1 text-xs text-white/45">
                Clique no que você quer enxergar agora
              </p>
            </div>
            <Brain className="h-5 w-5 text-violet-200" aria-hidden="true" />
          </div>

          <div className="mt-4 grid gap-2 sm:grid-cols-4">
            {FOCUS_MODES.map((mode) => {
              const Icon = mode.icon;
              const active = focusMode === mode.id;
              const color = SPECTRUM[focusCopy[mode.id].color];

              return (
                <button
                  key={mode.id}
                  type="button"
                  onClick={() => setFocusMode(mode.id)}
                  className={cn(
                    "rounded-xl border p-3 text-left transition",
                    active ? `${color.soft} ${color.text}` : "border-white/10 bg-black/20 text-white/62 hover:bg-white/[0.05]"
                  )}
                >
                  <Icon className="h-4 w-4" aria-hidden={true} />
                  <div className="mt-2 text-sm font-semibold">{mode.label}</div>
                  <div className="mt-1 text-[11px] leading-4 opacity-70">{mode.detail}</div>
                </button>
              );
            })}
          </div>
        </div>

        <div
          className={cn(
            "relative overflow-hidden rounded-2xl border p-4",
            SPECTRUM[focusCopy[focusMode].color].soft,
            SPECTRUM[focusCopy[focusMode].color].text
          )}
        >
          <div className="pointer-events-none absolute inset-0 opacity-40" style={{ background: SPECTRUM[focusCopy[focusMode].color].bar }} />
          <div className="relative">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-xs font-semibold uppercase tracking-wide text-white/58">
                  Leitura ativa
                </div>
                <h2 className="mt-2 text-xl font-semibold text-white">
                  {focusCopy[focusMode].title}
                </h2>
              </div>
              <Sparkles className="h-5 w-5 text-white/68" aria-hidden="true" />
            </div>
            <p className="mt-3 text-sm leading-6 text-white/76">
              {focusCopy[focusMode].body}
            </p>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-emerald-300/18 bg-[linear-gradient(135deg,rgba(16,185,129,0.13),rgba(255,255,255,0.045))] p-4">
        <div className="grid gap-4 lg:grid-cols-[1.1fr_.8fr_.8fr_.8fr_.9fr]">
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-emerald-300/20 bg-black/22">
              <RadioTower className="h-5 w-5 text-emerald-100" aria-hidden="true" />
            </div>
            <div>
              <div className="text-xs font-medium uppercase tracking-wide text-emerald-100/65">
                Proximo atendimento
              </div>
              <div className="mt-1 text-sm font-semibold text-white">
                {nextAppointment
                  ? `${nextAppointment.scheduledTime} - ${clientNameById(nextAppointment.clientId)}`
                  : "Nenhum atendimento futuro"}
              </div>
              <div className="mt-1 text-xs text-white/48">
                {nextAppointment ? nextAppointment.title : "Agenda livre para priorizar casos abertos"}
              </div>
            </div>
          </div>

          <AlertStat label="Hoje" value={String(todayAppointments.length)} detail={`${minutesToLabel(todayMinutes)} agendados`} />
          <AlertStat label="Semana" value={String(weekAppointments.length)} detail="atendimentos planejados" />
          <AlertStat label="Potencial agenda" value={formatCurrency(appointmentPotential)} detail="a receber previsto" />
          <AlertStat
            label="Carga do dia"
            value={`${capacityPercent}%`}
            detail={`max diario: ${minutesToLabel(maxDaily.totalMinutes)}`}
            danger={capacityPercent >= 85}
          />
        </div>
      </section>

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        <MetricCard
          icon={Gauge}
          label="Score de foco"
          value={`${focusScore}/100`}
          hint="Penaliza atraso, excesso de contexto e dia cheio"
          tone={focusScore >= 75 ? "green" : focusScore >= 55 ? "amber" : "rose"}
        />
        <MetricCard
          icon={Hourglass}
          label="Tempo parado"
          value={`${stalledDays} dia(s)`}
          hint="Soma de dias em pendencias abertas"
          tone={stalledDays > 3 ? "amber" : "default"}
        />
        <MetricCard
          icon={PauseCircle}
          label="Dinheiro esquecido"
          value={formatCurrency(neglectedValue)}
          hint={`${neglectedClients.length} cliente(s) sem proximo encaixe`}
          tone={neglectedValue > 0 ? "amber" : "default"}
        />
        <MetricCard
          icon={CircleDollarSign}
          label="Valor em risco"
          value={formatCurrency(revenueAtRisk)}
          hint="Alta prioridade ou vencendo hoje"
          tone="rose"
        />
        <MetricCard
          icon={TrendingUp}
          label="Taxa de sucesso"
          value={`${successRate}%`}
          hint={`${successRows.length}/${closedRows.length} casos fechados`}
          tone="green"
        />
      </section>

      <section className="rounded-2xl border border-amber-300/16 bg-amber-400/[0.055] p-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-sm font-semibold text-white">Clientes para não deixar esfriar</h2>
            <p className="mt-1 text-xs text-white/45">
              Cruza remoções abertas, potencial dos agendamentos e tempo sem próximo encaixe.
            </p>
          </div>
          <div className="text-sm font-semibold text-amber-50">
            {formatCurrency(neglectedValue)} sem agenda futura clara
          </div>
        </div>

        <div className="mt-4 grid gap-3 lg:grid-cols-4">
          {clientOpportunities.slice(0, 4).map((item) => (
            <button
              key={item.client.id}
              type="button"
              onClick={() =>
                openOpportunityScheduler(
                  item.client.id,
                  item.client.name,
                  item.potential,
                  item.nextAppointment?.scheduledDate ?? today
                )
              }
              className="rounded-xl border border-white/10 bg-black/20 p-3 text-left transition hover:border-amber-300/25 hover:bg-white/[0.06]"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-white">{item.client.name}</div>
                  <div className="mt-1 text-xs text-white/45">
                    {item.openCount} impacto(s) aberto(s)
                  </div>
                </div>
                <div className="rounded-full border border-amber-300/18 bg-amber-400/10 px-2 py-1 text-[11px] font-semibold text-amber-50">
                  {Math.round(item.pressure)}
                </div>
              </div>
              <div className="mt-3 text-lg font-semibold text-white">{formatCurrency(item.potential)}</div>
              <div className="mt-1 text-xs leading-5 text-white/45">
                {item.nextAppointment
                  ? `Próximo encaixe em ${formatDate(item.nextAppointment.scheduledDate)}`
                  : `${item.daysIdle} dia(s) sem próximo encaixe`}
              </div>
            </button>
          ))}
        </div>
      </section>

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {liveAlerts.map((alert) => (
          <LiveAlertCard
            key={alert.id}
            title={alert.title}
            value={alert.value}
            detail={alert.detail}
            icon={alert.icon}
            colorIndex={alert.color}
            active={focusMode === alert.mode}
            onClick={() => activateAlert(alert.mode, alert.date)}
          />
        ))}
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.35fr_.65fr]">
        <div className="rounded-2xl border border-white/10 bg-white/[0.045] p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-sm font-semibold text-white">Calendario operacional</h2>
              <p className="mt-1 text-xs text-white/45">
                Agenda, prazos e carga do dia no mesmo lugar
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setVisibleMonth((current) => moveMonth(current, -1))}
                className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-white/70 hover:bg-white/[0.08]"
                aria-label="Mes anterior"
              >
                <ChevronLeft className="h-4 w-4" aria-hidden="true" />
              </button>
              <div className="min-w-[170px] text-center text-sm font-semibold capitalize text-white">
                {monthLabel(visibleMonth)}
              </div>
              <button
                type="button"
                onClick={() => setVisibleMonth((current) => moveMonth(current, 1))}
                className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-white/70 hover:bg-white/[0.08]"
                aria-label="Proximo mes"
              >
                <ChevronRight className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
          </div>

          <div className="mt-5 grid grid-cols-7 gap-2 text-center text-[11px] font-semibold uppercase tracking-wide text-white/35">
            {WEEK_DAYS.map((day) => (
              <div key={day}>{day}</div>
            ))}
          </div>

          <div className="mt-2 grid grid-cols-7 gap-2">
            {calendarDays.map((day) => {
              const dayAppointments = appointmentsByDate.get(day.iso) ?? [];
              const dayDue = dueByDate.get(day.iso) ?? [];
              const workload = dailyWorkloads.find((item) => item.iso === day.iso);
              const percent = Math.min(((workload?.totalMinutes ?? 0) / DAILY_CAPACITY_MINUTES) * 100, 100);
              const selected = day.iso === selectedDate;
              const isToday = day.iso === today;

              return (
                <button
                  key={day.iso}
                  type="button"
                  onClick={() => selectDay(day.iso)}
                  className={cn(
                    "min-h-[92px] rounded-xl border p-2 text-left transition",
                    selected
                      ? "border-emerald-300/35 bg-emerald-400/12"
                      : "border-white/10 bg-black/20 hover:bg-white/[0.045]",
                    !day.inMonth && "opacity-42"
                  )}
                >
                  <div className="flex items-center justify-between">
                    <span
                      className={cn(
                        "inline-flex h-6 w-6 items-center justify-center rounded-lg text-xs font-semibold",
                        isToday ? "bg-emerald-300 text-black" : "text-white/75"
                      )}
                    >
                      {day.day}
                    </span>
                    {dayDue.length > 0 ? (
                      <span className="rounded-full bg-rose-400/15 px-1.5 py-0.5 text-[10px] text-rose-100">
                        {dayDue.length}
                      </span>
                    ) : null}
                  </div>

                  <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/10">
                    <div
                      className={cn(
                        "h-full rounded-full",
                        percent >= 85 ? "bg-rose-300" : percent >= 55 ? "bg-amber-300" : "bg-emerald-300"
                      )}
                      style={{ width: `${Math.max(percent, dayAppointments.length ? 10 : 0)}%` }}
                    />
                  </div>

                  <div className="mt-2 space-y-1 text-[11px] text-white/45">
                    <div>{dayAppointments.length} agenda(s)</div>
                    <div>{dayDue.length} prazo(s)</div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <aside className="space-y-4">
          <DayAgendaPanel
            selectedDate={selectedDate}
            appointments={selectedAppointments}
            dueRemovals={selectedDueRemovals}
            getClientName={clientNameById}
            onSchedule={() => openScheduler(selectedDate, "tarefa")}
            onEditAppointment={openEditAppointment}
            onDeleteAppointment={deleteAppointment}
          />
          <SchedulerPanel
            open={showScheduler}
            editing={!!editingAppointmentId}
            clients={clients}
            form={form}
            clientDraft={clientDraft}
            clientFormOpen={clientFormOpen}
            onClose={closeScheduler}
            onSave={saveAppointment}
            onChange={updateForm}
            onClientDraftChange={updateClientDraft}
            onClientFormToggle={() => setClientFormOpen((current) => !current)}
            onClientCreate={createClientFromDraft}
          />
        </aside>
      </section>

      <section className="grid gap-4 xl:grid-cols-[.9fr_1.1fr]">
        <div className="rounded-2xl border border-white/10 bg-white/[0.045] p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold text-white">Onde você está perdendo tempo</h2>
              <p className="mt-1 text-xs text-white/45">
                Estimativa operacional para priorizar automacao e follow-up
              </p>
            </div>
            <TimerReset className="h-5 w-5 text-emerald-200" aria-hidden="true" />
          </div>

          <div className="mt-5 space-y-4">
            {timeLoss.map((item, index) => {
              const color = SPECTRUM[index % SPECTRUM.length];
              return (
              <div key={item.label}>
                <div className="mb-1 flex items-center justify-between gap-3 text-xs">
                  <span className="font-medium text-white/80">{item.label}</span>
                  <span className="text-white/45">{minutesToLabel(item.value)}</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-white/10">
                  <div
                    className="h-full rounded-full"
                    style={{
                      background: color.bar,
                      width: `${Math.max((item.value / maxTimeLoss) * 100, 8)}%`,
                    }}
                  />
                </div>
                <div className="mt-1 text-xs text-white/38">{item.detail}</div>
              </div>
              );
            })}
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/[0.045] p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold text-white">Radar de gargalos</h2>
              <p className="mt-1 text-xs text-white/45">
                Leitura rápida do que exige sua atenção agora
              </p>
            </div>
            <Target className="h-5 w-5 text-emerald-200" aria-hidden="true" />
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            {bottlenecks.map((item, index) => (
              <BottleneckGauge
                key={item.label}
                icon={item.icon}
                label={item.label}
                value={item.value}
                percent={item.percent}
                detail={item.detail}
                colorIndex={index}
              />
            ))}
          </div>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.1fr_.9fr]">
        <div className="rounded-2xl border border-white/10 bg-white/[0.045] p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold text-white">Mapa de calor da semana</h2>
              <p className="mt-1 text-xs text-white/45">
                Agenda + prazos convertidos em carga de trabalho
              </p>
            </div>
            <Zap className="h-5 w-5 text-emerald-200" aria-hidden="true" />
          </div>

          <div className="mt-5 grid gap-3 md:grid-cols-7">
            {weekHeatmap.map((day, index) => {
              const color = day.percent >= 85 ? SPECTRUM[3] : day.percent >= 55 ? SPECTRUM[2] : SPECTRUM[index % SPECTRUM.length];
              return (
              <div
                key={day.iso}
                className={cn("rounded-xl border p-3", color.soft)}
              >
                <div className="text-xs font-semibold text-white/75">{day.label}</div>
                <div className="mt-1 text-[11px] text-white/38">{formatDate(day.iso)}</div>
                <div className="mt-4 flex h-24 items-end overflow-hidden rounded-xl bg-black/25">
                  <div
                    className="w-full rounded-xl"
                    style={{
                      height: `${Math.max(day.percent, 8)}%`,
                      background: color.bar,
                    }}
                  />
                </div>
                <div className="mt-3 text-sm font-semibold text-white">{day.percent}%</div>
                <div className="mt-1 text-[11px] text-white/40">
                  {minutesToLabel(day.scheduled)} agenda | {minutesToLabel(day.due)} prazo
                </div>
              </div>
              );
            })}
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/[0.045] p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold text-white">Pipeline de decisao</h2>
              <p className="mt-1 text-xs text-white/45">
                O que precisa virar ação, resposta, defesa ou cobrança
              </p>
            </div>
            <ClipboardList className="h-5 w-5 text-emerald-200" aria-hidden="true" />
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            {pipeline.map((item) => (
              <div
                key={item.label}
                className={cn(
                  "rounded-xl border p-4",
                  item.tone === "rose" && "border-rose-300/18 bg-rose-400/[0.07]",
                  item.tone === "amber" && "border-amber-300/18 bg-amber-400/[0.07]",
                  item.tone === "sky" && "border-sky-300/18 bg-sky-400/[0.07]",
                  item.tone === "green" && "border-emerald-300/18 bg-emerald-400/[0.07]"
                )}
              >
                <div className="text-xs text-white/45">{item.label}</div>
                <div className="mt-2 text-3xl font-semibold text-white">{item.value}</div>
                <div className="mt-1 text-xs leading-5 text-white/52">{item.detail}</div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}

function AlertStat({
  label,
  value,
  detail,
  danger,
}: {
  label: string;
  value: string;
  detail: string;
  danger?: boolean;
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-black/18 px-4 py-3">
      <div className="text-xs text-white/45">{label}</div>
      <div className={cn("mt-1 text-2xl font-semibold", danger ? "text-rose-100" : "text-white")}>
        {value}
      </div>
      <div className="mt-1 text-xs text-white/45">{detail}</div>
    </div>
  );
}

function LiveAlertCard({
  title,
  value,
  detail,
  icon: Icon,
  colorIndex,
  active,
  onClick,
}: {
  title: string;
  value: string;
  detail: string;
  icon: IconType;
  colorIndex: number;
  active: boolean;
  onClick: () => void;
}) {
  const color = SPECTRUM[colorIndex % SPECTRUM.length];

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "group relative overflow-hidden rounded-2xl border p-4 text-left transition hover:-translate-y-0.5",
        active ? `${color.soft} ${color.text}` : "border-white/10 bg-white/[0.045] text-white"
      )}
    >
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-1"
        style={{ background: color.bar }}
      />
      <div
        className="pointer-events-none absolute -right-10 -top-10 h-28 w-28 rounded-full opacity-20 blur-2xl transition group-hover:opacity-35"
        style={{ background: color.solid }}
      />
      <div className="relative flex items-start justify-between gap-3">
        <div>
          <div className="text-xs font-medium uppercase tracking-wide text-white/45">{title}</div>
          <div className="mt-2 text-2xl font-semibold tracking-tight text-white">{value}</div>
        </div>
        <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-black/22">
          <Icon className="h-4 w-4 text-white/80" aria-hidden={true} />
        </div>
      </div>
      <div className="relative mt-3 text-xs leading-5 text-white/52">{detail}</div>
    </button>
  );
}

function MetricCard({
  icon: Icon,
  label,
  value,
  hint,
  tone = "default",
}: {
  icon: IconType;
  label: string;
  value: string;
  hint: string;
  tone?: "default" | "green" | "amber" | "rose";
}) {
  const toneClass = {
    default: "border-white/10 bg-white/[0.045] text-white",
    green: "border-emerald-300/18 bg-emerald-400/[0.075] text-emerald-50",
    amber: "border-amber-300/18 bg-amber-400/[0.075] text-amber-50",
    rose: "border-rose-300/18 bg-rose-400/[0.075] text-rose-50",
  }[tone];

  return (
    <div className={cn("rounded-2xl border p-4", toneClass)}>
      <div className="flex items-start justify-between gap-3">
        <div className="text-xs font-medium text-white/48">{label}</div>
        <Icon className="h-4 w-4 text-white/48" aria-hidden={true} />
      </div>
      <div className="mt-3 text-2xl font-semibold tracking-tight">{value}</div>
      <div className="mt-1 text-xs leading-5 text-white/42">{hint}</div>
    </div>
  );
}

function DayAgendaPanel({
  selectedDate,
  appointments,
  dueRemovals,
  getClientName,
  onSchedule,
  onEditAppointment,
  onDeleteAppointment,
}: {
  selectedDate: string;
  appointments: AdminAppointment[];
  dueRemovals: AdminRemoval[];
  getClientName: (clientId: string) => string;
  onSchedule: () => void;
  onEditAppointment: (appointment: AdminAppointment) => void;
  onDeleteAppointment: (appointment: AdminAppointment) => void;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.045] p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-white">Dia selecionado</h2>
          <p className="mt-1 text-xs text-white/45">{formatDate(selectedDate)}</p>
        </div>
        <button
          type="button"
          onClick={onSchedule}
          className="inline-flex h-9 items-center gap-2 rounded-xl border border-emerald-300/20 bg-emerald-400/12 px-3 text-xs font-semibold text-emerald-50 hover:bg-emerald-400/18"
        >
          <CalendarPlus className="h-3.5 w-3.5" aria-hidden="true" />
          Agendar
        </button>
      </div>

      <div className="mt-4 space-y-3">
        {appointments.map((appointment) => (
          <div key={appointment.id} className="border-t border-white/10 pt-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-sm font-medium text-white">{appointment.title}</div>
                <div className="mt-1 text-xs text-white/45">
                  {appointment.scheduledTime} | {getClientName(appointment.clientId)}
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <span className={cn("rounded-full border px-2 py-1 text-[11px]", statusTone(appointment.status))}>
                  {appointmentStatusLabel[appointment.status]}
                </span>
                <button
                  type="button"
                  onClick={() => onEditAppointment(appointment)}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 bg-white/[0.04] text-white/55 transition hover:bg-white/[0.08] hover:text-white"
                  title="Editar agendamento"
                  aria-label="Editar agendamento"
                >
                  <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
                <button
                  type="button"
                  onClick={() => onDeleteAppointment(appointment)}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-rose-300/15 bg-rose-400/[0.08] text-rose-100/75 transition hover:bg-rose-400/[0.14] hover:text-rose-50"
                  title="Excluir agendamento"
                  aria-label="Excluir agendamento"
                >
                  <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
              </div>
            </div>
            <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-white/50">
              <span>{appointmentTypeLabel[appointment.type]}</span>
              <span>{minutesToLabel(appointment.durationMinutes)}</span>
              {Number(appointment.potentialAmount || 0) > 0 ? (
                <span>{formatCurrency(Number(appointment.potentialAmount || 0))}</span>
              ) : null}
              <span className={cn("rounded-full border px-2 py-0.5", priorityTone(appointment.priority))}>
                {appointment.priority}
              </span>
            </div>
          </div>
        ))}

        {dueRemovals.map((removal) => (
          <div key={removal.id} className="border-t border-rose-300/14 pt-3">
            <div className="text-xs font-semibold uppercase tracking-wide text-rose-100/70">
              Prazo de remoção
            </div>
            <div className="mt-1 text-sm font-medium text-white">{removal.title}</div>
            <div className="mt-1 text-xs text-white/45">
              {getClientName(removal.clientId)} | {impactTypeLabel[removal.impactType]} | {statusLabel[removal.status]}
            </div>
          </div>
        ))}

        {appointments.length === 0 && dueRemovals.length === 0 ? (
          <div className="border-t border-white/10 pt-4 text-sm text-white/45">
            Nenhum compromisso ou prazo neste dia.
          </div>
        ) : null}
      </div>
    </div>
  );
}

function SchedulerPanel({
  open,
  editing,
  clients,
  form,
  clientDraft,
  clientFormOpen,
  onClose,
  onSave,
  onChange,
  onClientDraftChange,
  onClientFormToggle,
  onClientCreate,
}: {
  open: boolean;
  editing: boolean;
  clients: AdminClient[];
  form: AppointmentForm;
  clientDraft: ClientDraft;
  clientFormOpen: boolean;
  onClose: () => void;
  onSave: () => void;
  onChange: <K extends keyof AppointmentForm>(key: K, value: AppointmentForm[K]) => void;
  onClientDraftChange: (key: keyof ClientDraft, value: string) => void;
  onClientFormToggle: () => void;
  onClientCreate: () => void;
}) {
  if (!open) {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
        <div className="flex items-center gap-2 text-sm font-semibold text-white/80">
          <CalendarDays className="h-4 w-4 text-emerald-200" aria-hidden="true" />
          Agenda rapida
        </div>
        <p className="mt-2 text-sm leading-6 text-white/45">
          Selecione um dia no calendário e clique em Agendar para criar uma tarefa ou atendimento.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-emerald-300/18 bg-emerald-400/[0.055] p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-white">
            {editing ? "Editar agendamento" : "Novo agendamento"}
          </h2>
          <p className="mt-1 text-xs text-white/45">
            {editing
              ? "Ajuste data, horário, cliente, prioridade e notas do compromisso."
              : "Crie uma tarefa, follow-up, cobrança ou atendimento com valor potencial."}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-white/65 hover:bg-white/[0.08]"
          aria-label="Fechar agenda"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>

      <div className="mt-4 space-y-3">
        <ClientPicker
          clients={clients}
          value={form.clientId}
          draft={clientDraft}
          open={clientFormOpen}
          onChange={(value) => onChange("clientId", value)}
          onDraftChange={onClientDraftChange}
          onToggle={onClientFormToggle}
          onCreate={onClientCreate}
        />

          <Field label="Título">
          <input
            value={form.title}
            onChange={(event) => onChange("title", event.target.value)}
            placeholder="Ex: ligar para cobrar evidência"
            className="h-10 w-full rounded-xl border border-white/10 bg-black/30 px-3 text-sm text-white outline-none placeholder:text-white/30"
          />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Data">
            <input
              type="date"
              value={form.scheduledDate}
              onChange={(event) => onChange("scheduledDate", event.target.value)}
              className="h-10 w-full rounded-xl border border-white/10 bg-black/30 px-3 text-sm text-white outline-none"
            />
          </Field>
          <Field label="Horario">
            <input
              type="time"
              value={form.scheduledTime}
              onChange={(event) => onChange("scheduledTime", event.target.value)}
              className="h-10 w-full rounded-xl border border-white/10 bg-black/30 px-3 text-sm text-white outline-none"
            />
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Tipo de agenda">
            <select
              value={form.type}
              onChange={(event) => onChange("type", event.target.value as AppointmentType)}
              className="h-10 w-full rounded-xl border border-white/10 bg-black/30 px-3 text-sm text-white outline-none"
            >
              {Object.entries(appointmentTypeLabel).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Duração">
            <input
              type="number"
              min="10"
              step="5"
              value={form.durationMinutes}
              onChange={(event) => onChange("durationMinutes", Number(event.target.value))}
              className="h-10 w-full rounded-xl border border-white/10 bg-black/30 px-3 text-sm text-white outline-none"
            />
          </Field>
        </div>

        <Field label="Valor potencial a receber">
          <input
            type="number"
            min="0"
            step="10"
            value={form.potentialAmount}
            onChange={(event) => onChange("potentialAmount", Number(event.target.value))}
            placeholder="Ex: 500"
            className="h-10 w-full rounded-xl border border-white/10 bg-black/30 px-3 text-sm text-white outline-none placeholder:text-white/30"
          />
        </Field>

        <Field label="Prioridade">
          <select
            value={form.priority}
            onChange={(event) => onChange("priority", event.target.value as AppointmentForm["priority"])}
            className="h-10 w-full rounded-xl border border-white/10 bg-black/30 px-3 text-sm text-white outline-none"
          >
            <option value="alta">Alta</option>
            <option value="media">Media</option>
            <option value="baixa">Baixa</option>
          </select>
        </Field>

        <Field label="Notas">
          <textarea
            value={form.notes}
            onChange={(event) => onChange("notes", event.target.value)}
            rows={3}
            className="w-full resize-none rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none placeholder:text-white/30"
          />
        </Field>

        <button
          type="button"
          onClick={onSave}
          className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-emerald-300/20 bg-emerald-400/14 px-4 text-sm font-semibold text-emerald-50 transition hover:bg-emerald-400/18"
        >
          <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
          {editing ? "Salvar alterações" : "Salvar na agenda"}
        </button>
      </div>
    </div>
  );
}

function ClientPicker({
  clients,
  value,
  draft,
  open,
  onChange,
  onDraftChange,
  onToggle,
  onCreate,
}: {
  clients: AdminClient[];
  value: string;
  draft: ClientDraft;
  open: boolean;
  onChange: (value: string) => void;
  onDraftChange: (key: keyof ClientDraft, value: string) => void;
  onToggle: () => void;
  onCreate: () => void;
}) {
  return (
    <div>
      <div className="flex items-end gap-2">
        <div className="min-w-0 flex-1">
          <Field label="Cliente">
            <select
              value={value}
              onChange={(event) => onChange(event.target.value)}
              className="h-10 w-full rounded-xl border border-white/10 bg-black/30 px-3 text-sm text-white outline-none"
            >
              {clients.length === 0 ? <option value="">Sem clientes cadastrados</option> : null}
              {clients.map((client) => (
                <option key={client.id} value={client.id}>
                  {client.name}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <button
          type="button"
          onClick={onToggle}
          className="mb-0 inline-flex h-10 shrink-0 items-center justify-center rounded-xl border border-sky-300/20 bg-sky-400/12 px-3 text-xs font-semibold text-sky-50 transition hover:bg-sky-400/18"
        >
          {open ? "Fechar" : "Novo cliente"}
        </button>
      </div>

      {open ? (
        <div className="mt-3 rounded-2xl border border-sky-300/16 bg-sky-400/[0.055] p-4">
          <div className="text-sm font-semibold text-white">Cadastrar cliente rápido</div>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <ClientDraftField
              label="Nome"
              value={draft.name}
              onChange={(nextValue) => onDraftChange("name", nextValue)}
            />
            <ClientDraftField
              label="Documento"
              value={draft.document}
              onChange={(nextValue) => onDraftChange("document", nextValue)}
            />
            <ClientDraftField
              label="Contato"
              value={draft.contactName}
              onChange={(nextValue) => onDraftChange("contactName", nextValue)}
            />
            <ClientDraftField
              label="Telefone"
              value={draft.phone}
              onChange={(nextValue) => onDraftChange("phone", nextValue)}
            />
            <ClientDraftField
              label="E-mail"
              value={draft.email}
              onChange={(nextValue) => onDraftChange("email", nextValue)}
            />
            <ClientDraftField
              label="Notas"
              value={draft.notes}
              onChange={(nextValue) => onDraftChange("notes", nextValue)}
            />
          </div>
          <button
            type="button"
            onClick={onCreate}
            className="mt-3 inline-flex h-10 items-center justify-center rounded-xl border border-emerald-300/20 bg-emerald-400/14 px-4 text-xs font-semibold text-emerald-50 transition hover:bg-emerald-400/18"
          >
            Adicionar e selecionar
          </button>
        </div>
      ) : null}
    </div>
  );
}

function ClientDraftField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-white/50">{label}</span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-10 w-full rounded-xl border border-white/10 bg-black/30 px-3 text-sm text-white outline-none placeholder:text-white/30"
      />
    </label>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-white/50">{label}</span>
      {children}
    </label>
  );
}

function BottleneckGauge({
  icon: Icon,
  label,
  value,
  percent,
  detail,
  colorIndex,
}: {
  icon: IconType;
  label: string;
  value: number;
  percent: number;
  detail: string;
  colorIndex: number;
}) {
  const color = SPECTRUM[colorIndex % SPECTRUM.length];

  return (
    <div className={cn("flex items-center gap-4 rounded-xl border p-4", color.soft)}>
      <div
        className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full"
        style={{
          background: `conic-gradient(${color.solid} ${percent}%, rgba(255,255,255,.09) 0)`,
        }}
      >
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#07100d]">
          <Icon className="h-5 w-5 text-white/85" aria-hidden={true} />
        </div>
      </div>

      <div className="min-w-0">
        <div className="flex items-baseline gap-2">
          <div className="text-2xl font-semibold text-white">{value}</div>
          <div className="truncate text-sm font-medium text-white/72">{label}</div>
        </div>
        <div className="mt-1 text-xs leading-5 text-white/45">{detail}</div>
      </div>
    </div>
  );
}
