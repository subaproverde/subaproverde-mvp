export const CASE_STATUSES = [
  { key: "novo", label: "Novo" },
  { key: "em_analise", label: "Em análise" },
  { key: "aguardando_cliente", label: "Aguardando cliente" },
  { key: "chamado_aberto", label: "Chamado aberto" },
  { key: "resolvido", label: "Resolvido" },
  { key: "negado", label: "Negado" },
  { key: "arquivado", label: "Arquivado" },
] as const;

export type CaseStatus = (typeof CASE_STATUSES)[number]["key"];

export function statusLabel(status: string) {
  return CASE_STATUSES.find((s) => s.key === status)?.label ?? status;
}
