export type AdminClient = {
  id: string;
  name: string;
  document: string;
  contactName: string;
  phone: string;
  email: string;
  notes: string;
};

export type ImpactType =
  | "reclamacao"
  | "atraso"
  | "cancelamento"
  | "mediacao"
  | "outro";

export type RemovalStatus =
  | "pendente"
  | "em_andamento"
  | "removido"
  | "nao_removido"
  | "aguardando_cliente"
  | "finalizado";

export type AdminRemoval = {
  id: string;
  clientId: string;
  sellerId?: string;
  mlOrderId?: string;
  packId?: string;
  claimId?: string;
  shipmentId?: string;
  impactType: ImpactType;
  status: RemovalStatus;
  title: string;
  description: string;
  chargedAmount: number;
  success: boolean | null;
  serviceDate: string;
  dueDate: string;
  completedAt?: string;
  reportNotes: string;
  internalNotes: string;
  evidenceLinks: string[];
  priority: "alta" | "media" | "baixa";
};

export type AppointmentStatus =
  | "agendado"
  | "confirmado"
  | "em_atendimento"
  | "concluido"
  | "remarcar";

export type AppointmentType =
  | "tarefa"
  | "defesa"
  | "follow_up"
  | "relatorio"
  | "cobranca"
  | "diagnostico";

export type AdminAppointment = {
  id: string;
  clientId: string;
  title: string;
  type: AppointmentType;
  status: AppointmentStatus;
  scheduledDate: string;
  scheduledTime: string;
  durationMinutes: number;
  potentialAmount: number;
  priority: "alta" | "media" | "baixa";
  notes: string;
};

export const impactTypeLabel: Record<ImpactType, string> = {
  reclamacao: "Reclamação",
  atraso: "Atraso",
  cancelamento: "Cancelamento",
  mediacao: "Mediação",
  outro: "Outro",
};

export const statusLabel: Record<RemovalStatus, string> = {
  pendente: "Pendente",
  em_andamento: "Em andamento",
  removido: "Removido",
  nao_removido: "Não removido",
  aguardando_cliente: "Aguardando cliente",
  finalizado: "Finalizado",
};

export const appointmentStatusLabel: Record<AppointmentStatus, string> = {
  agendado: "Agendado",
  confirmado: "Confirmado",
  em_atendimento: "Em atendimento",
  concluido: "Concluído",
  remarcar: "Remarcar",
};

export const appointmentTypeLabel: Record<AppointmentType, string> = {
  tarefa: "Tarefa",
  defesa: "Defesa",
  follow_up: "Follow-up",
  relatorio: "Relatório",
  cobranca: "Cobrança",
  diagnostico: "Diagnóstico",
};

export const mockAdminClients: AdminClient[] = [
  {
    id: "cli-brudstore",
    name: "Brudstore Flex",
    document: "42.981.000/0001-11",
    contactName: "Marcela Lima",
    phone: "(11) 94555-0188",
    email: "operacao@brudstore.com.br",
    notes: "Cliente com alto volume de Flex e recorrencia de atrasos contestaveis.",
  },
  {
    id: "cli-nova-rota",
    name: "Nova Rota Entregas",
    document: "18.734.210/0001-90",
    contactName: "Rafael Souza",
    phone: "(11) 93210-8871",
    email: "rafael@novarota.com.br",
    notes: "Precisa de relatorio semanal com pendencias e valores por rota.",
  },
  {
    id: "cli-verde-market",
    name: "Verde Market",
    document: "09.332.654/0001-77",
    contactName: "Paula Martins",
    phone: "(11) 97620-3010",
    email: "paula@verdemarket.com.br",
    notes: "Operacao seller propria, foco em reclamacoes e mediacoes.",
  },
];

export const mockAdminRemovals: AdminRemoval[] = [
  {
    id: "rem-1001",
    clientId: "cli-brudstore",
    sellerId: "seller_8a21",
    mlOrderId: "2000007981123490",
    packId: "5149901456",
    claimId: "5291044209",
    shipmentId: "44291099812",
    impactType: "reclamacao",
    status: "removido",
    title: "Reclamacao por atraso removida",
    description: "Comprador abriu reclamacao apos entrega em atraso operacional de coleta.",
    chargedAmount: 180,
    success: true,
    serviceDate: "2026-05-19",
    dueDate: "2026-05-19",
    completedAt: "2026-05-19",
    reportNotes: "Impacto removido apos envio de evidencias e timeline de despacho.",
    internalNotes: "Usar este caso como modelo para atrasos Flex similares.",
    evidenceLinks: ["https://mercadolivre.com.br/claims/5291044209"],
    priority: "alta",
  },
  {
    id: "rem-1002",
    clientId: "cli-brudstore",
    sellerId: "seller_8a21",
    mlOrderId: "2000007981131192",
    packId: "5149902010",
    claimId: "5291049910",
    impactType: "atraso",
    status: "em_andamento",
    title: "Atraso Flex em contestacao",
    description: "Atraso atribuido ao seller, mas pacote foi coletado dentro da janela combinada.",
    chargedAmount: 120,
    success: null,
    serviceDate: "2026-05-19",
    dueDate: "2026-05-20",
    reportNotes: "Aguardando resposta do Mercado Livre sobre a coleta.",
    internalNotes: "Checar se ha comprovante do motorista ate 16h.",
    evidenceLinks: ["https://drive.google.com/mock/coleta-5149902010"],
    priority: "alta",
  },
  {
    id: "rem-1003",
    clientId: "cli-nova-rota",
    sellerId: "seller_4d88",
    mlOrderId: "2000007980999011",
    packId: "5149800022",
    shipmentId: "44291077123",
    impactType: "cancelamento",
    status: "aguardando_cliente",
    title: "Cancelamento automatico aguardando comprovante",
    description: "Venda cancelada por divergencia de rota; cliente precisa enviar comprovante.",
    chargedAmount: 90,
    success: null,
    serviceDate: "2026-05-18",
    dueDate: "2026-05-19",
    reportNotes: "Pendente de documento do cliente.",
    internalNotes: "Cobrar Rafael no WhatsApp.",
    evidenceLinks: [],
    priority: "media",
  },
  {
    id: "rem-1004",
    clientId: "cli-verde-market",
    sellerId: "seller_91ef",
    mlOrderId: "2000007980881200",
    packId: "5149703331",
    claimId: "5290084401",
    impactType: "mediacao",
    status: "pendente",
    title: "Mediacao aberta com risco de impacto",
    description: "Mediacao em fase inicial, precisa organizar evidencias antes da resposta.",
    chargedAmount: 240,
    success: null,
    serviceDate: "2026-05-20",
    dueDate: "2026-05-21",
    reportNotes: "Abertura preventiva de defesa.",
    internalNotes: "Montar narrativa com timeline e comprovante de atendimento.",
    evidenceLinks: ["https://mercadolivre.com.br/packs/5149703331"],
    priority: "alta",
  },
  {
    id: "rem-1005",
    clientId: "cli-nova-rota",
    sellerId: "seller_4d88",
    mlOrderId: "2000007980701120",
    impactType: "outro",
    status: "nao_removido",
    title: "Impacto mantido por falta de evidencia",
    description: "Solicitacao encerrada pelo ML por ausencia de documento conclusivo.",
    chargedAmount: 0,
    success: false,
    serviceDate: "2026-05-17",
    dueDate: "2026-05-18",
    completedAt: "2026-05-18",
    reportNotes: "Nao houve remocao porque o comprovante nao foi aceito.",
    internalNotes: "Explicar ao cliente que proximos casos precisam do comprovante original.",
    evidenceLinks: [],
    priority: "baixa",
  },
  {
    id: "rem-1006",
    clientId: "cli-verde-market",
    sellerId: "seller_91ef",
    mlOrderId: "2000007981211122",
    packId: "5150004010",
    claimId: "5291123402",
    impactType: "reclamacao",
    status: "finalizado",
    title: "Reclamacao finalizada com defesa aceita",
    description: "O ML aceitou a defesa e marcou atendimento como finalizado.",
    chargedAmount: 160,
    success: true,
    serviceDate: "2026-05-16",
    dueDate: "2026-05-17",
    completedAt: "2026-05-17",
    reportNotes: "Defesa aceita e sem pendencia atual.",
    internalNotes: "Adicionar no relatorio mensal da Verde Market.",
    evidenceLinks: ["https://mercadolivre.com.br/claims/5291123402"],
    priority: "media",
  },
];

export const mockAdminAppointments: AdminAppointment[] = [
  {
    id: "apt-1001",
    clientId: "cli-brudstore",
    title: "Checar coleta e enviar defesa do atraso",
    type: "defesa",
    status: "confirmado",
    scheduledDate: "2026-05-20",
    scheduledTime: "10:30",
    durationMinutes: 45,
    potentialAmount: 360,
    priority: "alta",
    notes: "Separar comprovante de coleta e print da janela Flex.",
  },
  {
    id: "apt-1002",
    clientId: "cli-nova-rota",
    title: "Cobrar comprovante pendente",
    type: "follow_up",
    status: "agendado",
    scheduledDate: "2026-05-20",
    scheduledTime: "14:00",
    durationMinutes: 25,
    potentialAmount: 90,
    priority: "media",
    notes: "Enviar mensagem curta pedindo documento original.",
  },
  {
    id: "apt-1003",
    clientId: "cli-verde-market",
    title: "Montar relatorio parcial da mediacao",
    type: "relatorio",
    status: "agendado",
    scheduledDate: "2026-05-21",
    scheduledTime: "09:15",
    durationMinutes: 50,
    potentialAmount: 240,
    priority: "alta",
    notes: "Incluir timeline e resumo do risco.",
  },
  {
    id: "apt-1004",
    clientId: "cli-brudstore",
    title: "Revisar cobranca de casos removidos",
    type: "cobranca",
    status: "agendado",
    scheduledDate: "2026-05-22",
    scheduledTime: "16:30",
    durationMinutes: 35,
    potentialAmount: 420,
    priority: "media",
    notes: "Gerar lista de casos com sucesso e valor.",
  },
  {
    id: "apt-1005",
    clientId: "cli-verde-market",
    title: "Diagnostico de pendencias acumuladas",
    type: "diagnostico",
    status: "remarcar",
    scheduledDate: "2026-05-25",
    scheduledTime: "11:00",
    durationMinutes: 60,
    potentialAmount: 180,
    priority: "baixa",
    notes: "Revisar se o cliente ainda precisa deste atendimento.",
  },
];

export function getClientName(clientId: string) {
  return mockAdminClients.find((client) => client.id === clientId)?.name ?? "Cliente";
}

export function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

export function formatDate(value?: string) {
  if (!value) return "-";

  const [year, month, day] = value.split("-");
  if (!year || !month || !day) return value;

  return `${day}/${month}/${year}`;
}

export function isRemovalOpen(status: RemovalStatus) {
  return ["pendente", "em_andamento", "aguardando_cliente"].includes(status);
}
