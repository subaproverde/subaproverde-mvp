import type { CrmOverview } from "./types";

export const crmDemoOverview: CrmOverview = {
  setupRequired: true,
  generatedAt: new Date().toISOString(),
  workspace: { id: "preview", name: "Suba Pro Verde", slug: "suba-pro-verde" },
  metrics: {
    activeLeads: 18,
    waitingTeam: 3,
    overdueFollowUps: 2,
    openReceivables: 1850,
  },
  pipeline: [
    { stage: "new", label: "Novos", count: 5, value: 0 },
    { stage: "contacted", label: "Em conversa", count: 6, value: 2100 },
    { stage: "qualified", label: "Qualificados", count: 3, value: 1450 },
    { stage: "proposal", label: "Proposta", count: 3, value: 2300 },
    { stage: "negotiation", label: "Negociação", count: 1, value: 500 },
  ],
  priorities: [
    {
      id: "preview-1",
      kind: "conversation",
      contactName: "Stéfani Behne Franken",
      title: "Cliente demonstrou interesse",
      detail: "Confirmar escopo de 6 reclamações e avançar para o pedido.",
      occurredAt: new Date(Date.now() - 8 * 60_000).toISOString(),
      urgent: true,
    },
    {
      id: "preview-2",
      kind: "task",
      contactName: "Michel Schmidt",
      title: "Follow-up aguardando cliente",
      detail: "A IA aguarda nova mensagem; não é necessário cobrar agora.",
      occurredAt: new Date(Date.now() - 46 * 60_000).toISOString(),
      urgent: false,
    },
    {
      id: "preview-3",
      kind: "receipt",
      contactName: "Cliente exemplo",
      title: "Comprovante recebido",
      detail: "Valor lido: R$ 500,00. Aguardando conciliação antes de marcar como pago.",
      occurredAt: new Date(Date.now() - 72 * 60_000).toISOString(),
      urgent: true,
    },
  ],
  recentActivities: [
    {
      id: "preview-a1",
      contactName: "Stéfani Behne Franken",
      title: "Pedido preparado pela IA",
      description: "Remoção de 6 impactos por reclamação — R$ 300,00.",
      occurredAt: new Date(Date.now() - 12 * 60_000).toISOString(),
      activityType: "order_draft_created",
    },
    {
      id: "preview-a2",
      contactName: "Deize",
      title: "Atendimento agendado",
      description: "AnyDesk confirmado para 14:30.",
      occurredAt: new Date(Date.now() - 34 * 60_000).toISOString(),
      activityType: "appointment_confirmed",
    },
    {
      id: "preview-a3",
      contactName: "Lead sem cadastro",
      title: "Contato identificado",
      description: "Telefone e LID do WhatsApp vinculados ao mesmo histórico.",
      occurredAt: new Date(Date.now() - 55 * 60_000).toISOString(),
      activityType: "identity_linked",
    },
  ],
  finance: {
    accounts: [
      { id: "preview-inter", name: "Banco Inter", provider: "banco_inter", integrationStatus: "not_configured", reconciliationMode: "manual" },
      { id: "preview-nubank", name: "Nubank", provider: "nubank", integrationStatus: "not_configured", reconciliationMode: "manual" },
    ],
    receiptsToReview: 1,
  },
  fiscal: { enabled: false, environment: "sandbox", provider: null },
};
