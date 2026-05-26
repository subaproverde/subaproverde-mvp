import type { AdminAppointment, AdminClient, AdminRemoval } from "@/app/admin/admin-data";
import {
  appointmentTypeLabel,
  formatCurrency,
  formatDate,
  impactTypeLabel,
  isRemovalOpen,
  statusLabel,
} from "@/app/admin/admin-data";

const MS_PER_MINUTE = 60 * 1000;

export function normalizePhone(value: string) {
  const digits = value.replace(/\D/g, "");
  if (!digits) return "";
  return digits.startsWith("55") ? digits : `55${digits}`;
}

export function todayIso(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function appointmentDateTime(appointment: AdminAppointment) {
  return new Date(`${appointment.scheduledDate}T${appointment.scheduledTime}:00`);
}

export function minutesUntilAppointment(appointment: AdminAppointment, now = new Date()) {
  return Math.round((appointmentDateTime(appointment).getTime() - now.getTime()) / MS_PER_MINUTE);
}

export function getClientName(clients: AdminClient[], clientId: string) {
  return clients.find((client) => client.id === clientId)?.name ?? "Cliente";
}

export function getDayAppointments(appointments: AdminAppointment[], dayIso: string) {
  return appointments
    .filter((appointment) => appointment.scheduledDate === dayIso)
    .sort((a, b) => a.scheduledTime.localeCompare(b.scheduledTime));
}

export function buildDailySummaryMessage({
  appointments,
  clients,
  removals,
  date = new Date(),
}: {
  appointments: AdminAppointment[];
  clients: AdminClient[];
  removals: AdminRemoval[];
  date?: Date;
}) {
  const dayIso = todayIso(date);
  const dayAppointments = getDayAppointments(appointments, dayIso);
  const openRemovals = removals.filter((removal) => isRemovalOpen(removal.status));
  const dueToday = openRemovals.filter((removal) => removal.dueDate === dayIso);
  const overdue = openRemovals.filter((removal) => removal.dueDate < dayIso);
  const awaitingClient = openRemovals.filter((removal) => removal.status === "aguardando_cliente");
  const completedToday = removals.filter(
    (removal) => removal.success === true && removal.completedAt === dayIso
  );
  const dayPotential = dayAppointments.reduce(
    (acc, appointment) => acc + Number(appointment.potentialAmount || 0),
    0
  );
  const receivable = removals
    .filter((removal) => removal.success === true && removal.chargedAmount > 0)
    .reduce((acc, removal) => acc + removal.chargedAmount, 0);

  const appointmentLines =
    dayAppointments.length > 0
      ? dayAppointments
          .map((appointment) => {
            return `- ${appointment.scheduledTime} | ${appointmentTypeLabel[appointment.type]} | ${getClientName(
              clients,
              appointment.clientId
            )}: ${appointment.title}${
              Number(appointment.potentialAmount || 0) > 0
                ? ` | potencial ${formatCurrency(Number(appointment.potentialAmount || 0))}`
                : ""
            }`;
          })
          .join("\n")
      : "- Nenhum agendamento cadastrado para hoje.";

  const dueLines =
    dueToday.length > 0
      ? dueToday
          .map((removal) => {
            return `- ${getClientName(clients, removal.clientId)} | ${impactTypeLabel[removal.impactType]} | ${statusLabel[removal.status]}: ${removal.title}`;
          })
          .join("\n")
      : "- Nenhuma remoção vence hoje.";

  const priorityLine =
    overdue.length > 0
      ? `Comece por ${overdue[0].title} (${getClientName(clients, overdue[0].clientId)}), pois está vencido.`
      : dueToday.length > 0
        ? `Comece por ${dueToday[0].title} (${getClientName(clients, dueToday[0].clientId)}), pois vence hoje.`
        : dayAppointments[0]
          ? `Primeiro compromisso: ${dayAppointments[0].scheduledTime} com ${getClientName(
              clients,
              dayAppointments[0].clientId
            )}.`
          : "Agenda livre: use o primeiro bloco para resolver pendências abertas.";

  return [
    `Bom dia, Bruno. Resumo Suba Pro Verde - ${formatDate(dayIso)}`,
    "",
    "METRICAS DO DIA",
    `- Agendamentos: ${dayAppointments.length}`,
    `- Potencial agendado: ${formatCurrency(dayPotential)}`,
    `- Prazos de hoje: ${dueToday.length}`,
    `- Vencidos: ${overdue.length}`,
    `- Aguardando cliente: ${awaitingClient.length}`,
    `- Remoções concluídas hoje: ${completedToday.length}`,
    `- Valor pronto para reportar: ${formatCurrency(receivable)}`,
    "",
    "AGENDA",
    appointmentLines,
    "",
    "PRAZOS / REMOCOES",
    dueLines,
    "",
    "PRIORIDADE SUGERIDA",
    priorityLine,
  ].join("\n");
}

export function buildAppointmentReminderMessage({
  appointment,
  clients,
  minutesBefore,
}: {
  appointment: AdminAppointment;
  clients: AdminClient[];
  minutesBefore: number;
}) {
  return [
    `Lembrete Suba Pro Verde: faltam ${minutesBefore} min`,
    "",
    `${appointment.scheduledTime} | ${appointmentTypeLabel[appointment.type]}`,
    `${getClientName(clients, appointment.clientId)} - ${appointment.title}`,
    Number(appointment.potentialAmount || 0) > 0
      ? `Potencial a receber: ${formatCurrency(Number(appointment.potentialAmount || 0))}`
      : "Sem valor potencial informado.",
    appointment.notes ? `Notas: ${appointment.notes}` : "Sem notas adicionais.",
  ].join("\n");
}
