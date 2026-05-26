"use client";

import { useEffect, useMemo, useState } from "react";
import {
  CalendarDays,
  CheckCircle2,
  Download,
  FileText,
  Filter,
  Pencil,
  Plus,
  Search,
  Trash2,
  X,
} from "lucide-react";
import type {
  AdminClient,
  AdminRemoval,
  ImpactType,
  RemovalStatus,
} from "../admin-data";
import {
  formatCurrency,
  formatDate,
  impactTypeLabel,
  isRemovalOpen,
  statusLabel,
} from "../admin-data";

type RemovalForm = Omit<AdminRemoval, "id" | "success" | "evidenceLinks"> & {
  evidenceText: string;
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

const ADMIN_REMOCOES_STORAGE_KEY = "spv:admin-remocoes:v1";

const impactOptions: ImpactType[] = [
  "reclamacao",
  "atraso",
  "cancelamento",
  "mediacao",
  "outro",
];

const statusOptions: RemovalStatus[] = [
  "pendente",
  "em_andamento",
  "removido",
  "nao_removido",
  "aguardando_cliente",
  "finalizado",
];

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function defaultForm(clientId: string): RemovalForm {
  return {
    clientId,
    sellerId: "",
    mlOrderId: "",
    packId: "",
    claimId: "",
    shipmentId: "",
    impactType: "reclamacao",
    status: "pendente",
    title: "",
    description: "",
    chargedAmount: 0,
    serviceDate: todayIso(),
    dueDate: todayIso(),
    completedAt: "",
    reportNotes: "",
    internalNotes: "",
    evidenceText: "",
    priority: "media",
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

function successFromStatus(status: RemovalStatus) {
  if (status === "removido" || status === "finalizado") return true;
  if (status === "nao_removido") return false;
  return null;
}

function statusTone(status: RemovalStatus) {
  if (status === "removido" || status === "finalizado") {
    return "border-emerald-300/20 bg-emerald-400/10 text-emerald-100";
  }
  if (status === "nao_removido") {
    return "border-rose-300/20 bg-rose-400/10 text-rose-100";
  }
  if (status === "aguardando_cliente") {
    return "border-sky-300/20 bg-sky-400/10 text-sky-100";
  }
  if (status === "em_andamento") {
    return "border-amber-300/20 bg-amber-400/10 text-amber-100";
  }
  return "border-white/10 bg-white/[0.06] text-white/70";
}

function priorityTone(priority: AdminRemoval["priority"]) {
  if (priority === "alta") return "bg-rose-400/12 text-rose-100 border-rose-300/20";
  if (priority === "baixa") return "bg-white/[0.05] text-white/55 border-white/10";
  return "bg-amber-400/10 text-amber-100 border-amber-300/20";
}

function isWithinDateRange(item: AdminRemoval, startDate: string, endDate: string) {
  const value = item.serviceDate;
  if (startDate && value < startDate) return false;
  if (endDate && value > endDate) return false;
  return true;
}

function safeText(value: string) {
  return value.replace(/[&<>"']/g, (char) => {
    const map: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;",
    };
    return map[char] ?? char;
  });
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

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <label className="mb-1 block text-xs font-medium text-white/55">{children}</label>;
}

export default function RemocoesClient({
  initialClients,
  initialRemovals,
}: {
  initialClients: AdminClient[];
  initialRemovals: AdminRemoval[];
}) {
  const [clients, setClients] = useState(initialClients);
  const [removals, setRemovals] = useState(initialRemovals);
  const [storageReady, setStorageReady] = useState(false);
  const [query, setQuery] = useState("");
  const [clientFilter, setClientFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState<RemovalStatus | "all">("all");
  const [typeFilter, setTypeFilter] = useState<ImpactType | "all">("all");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [clientFormOpen, setClientFormOpen] = useState(false);
  const [clientDraft, setClientDraft] = useState<ClientDraft>(() => emptyClientDraft());
  const [form, setForm] = useState<RemovalForm>(() => defaultForm(initialClients[0]?.id ?? ""));

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const stored = readStoredAdminRemocoes();

      if (stored?.clients) setClients(stored.clients);
      if (stored?.removals) setRemovals(stored.removals);

      setStorageReady(true);
    }, 0);

    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!storageReady) return;
    writeStoredAdminRemocoes(clients, removals);
  }, [clients, removals, storageReady]);

  const clientById = useMemo(() => {
    const map = new Map<string, AdminClient>();
    for (const client of clients) map.set(client.id, client);
    return map;
  }, [clients]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();

    return removals.filter((item) => {
      if (clientFilter !== "all" && item.clientId !== clientFilter) return false;
      if (statusFilter !== "all" && item.status !== statusFilter) return false;
      if (typeFilter !== "all" && item.impactType !== typeFilter) return false;
      if (!isWithinDateRange(item, startDate, endDate)) return false;

      if (!needle) return true;

      const client = clientById.get(item.clientId);
      const haystack = [
        item.title,
        item.description,
        item.mlOrderId ?? "",
        item.packId ?? "",
        item.claimId ?? "",
        item.shipmentId ?? "",
        item.sellerId ?? "",
        client?.name ?? "",
        client?.contactName ?? "",
      ]
        .join(" ")
        .toLowerCase();

      return haystack.includes(needle);
    });
  }, [
    clientById,
    clientFilter,
    endDate,
    query,
    removals,
    startDate,
    statusFilter,
    typeFilter,
  ]);

  const summary = useMemo(() => {
    const total = filtered.length;
    const removed = filtered.filter((item) => item.success === true).length;
    const pending = filtered.filter((item) => isRemovalOpen(item.status)).length;
    const value = filtered.reduce((acc, item) => acc + Number(item.chargedAmount || 0), 0);
    const closed = filtered.filter((item) => item.success !== null).length;
    const successRate = closed > 0 ? Math.round((removed / closed) * 100) : 0;

    return { total, removed, pending, value, successRate };
  }, [filtered]);

  const clientSummaries = useMemo(() => {
    return clients.map((client) => {
      const rows = removals.filter((item) => item.clientId === client.id);
      const removed = rows.filter((item) => item.success === true).length;
      const pending = rows.filter((item) => isRemovalOpen(item.status)).length;
      const value = rows.reduce((acc, item) => acc + Number(item.chargedAmount || 0), 0);
      const closed = rows.filter((item) => item.success !== null).length;
      const successRate = closed > 0 ? Math.round((removed / closed) * 100) : 0;

      return {
        client,
        total: rows.length,
        removed,
        pending,
        value,
        successRate,
      };
    });
  }, [clients, removals]);

  function clearFilters() {
    setQuery("");
    setClientFilter("all");
    setStatusFilter("all");
    setTypeFilter("all");
    setStartDate("");
    setEndDate("");
  }

  function openNewDrawer() {
    setEditingId(null);
    setForm(defaultForm(clientFilter !== "all" ? clientFilter : clients[0]?.id ?? ""));
    setClientFormOpen(false);
    setClientDraft(emptyClientDraft());
    setDrawerOpen(true);
  }

  function openEditDrawer(item: AdminRemoval) {
    setEditingId(item.id);
    setClientFormOpen(false);
    setClientDraft(emptyClientDraft());
    setForm({
      clientId: item.clientId,
      sellerId: item.sellerId ?? "",
      mlOrderId: item.mlOrderId ?? "",
      packId: item.packId ?? "",
      claimId: item.claimId ?? "",
      shipmentId: item.shipmentId ?? "",
      impactType: item.impactType,
      status: item.status,
      title: item.title,
      description: item.description,
      chargedAmount: item.chargedAmount,
      serviceDate: item.serviceDate,
      dueDate: item.dueDate,
      completedAt: item.completedAt ?? "",
      reportNotes: item.reportNotes,
      internalNotes: item.internalNotes,
      evidenceText: item.evidenceLinks.join("\n"),
      priority: item.priority,
    });
    setDrawerOpen(true);
  }

  function updateForm<K extends keyof RemovalForm>(key: K, value: RemovalForm[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function updateClientDraft<K extends keyof ClientDraft>(key: K, value: ClientDraft[K]) {
    setClientDraft((current) => ({ ...current, [key]: value }));
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
  }

  function ensureClientId(clientId: string) {
    if (clientId) return clientId;
    if (clients[0]?.id) return clients[0].id;

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
    return nextClient.id;
  }

  function saveRemoval() {
    const clientId = ensureClientId(form.clientId);
    const title =
      form.title.trim() ||
      form.mlOrderId.trim() ||
      form.packId.trim() ||
      "Atendimento sem título";

    const payload: AdminRemoval = {
      id: editingId ?? `rem-local-${Date.now()}`,
      clientId,
      sellerId: form.sellerId.trim() || undefined,
      mlOrderId: form.mlOrderId.trim() || undefined,
      packId: form.packId.trim() || undefined,
      claimId: form.claimId.trim() || undefined,
      shipmentId: form.shipmentId.trim() || undefined,
      impactType: form.impactType,
      status: form.status,
      title,
      description: form.description.trim(),
      chargedAmount: Number(form.chargedAmount || 0),
      success: successFromStatus(form.status),
      serviceDate: form.serviceDate,
      dueDate: form.dueDate,
      completedAt: form.completedAt || undefined,
      reportNotes: form.reportNotes.trim(),
      internalNotes: form.internalNotes.trim(),
      evidenceLinks: form.evidenceText
        .split("\n")
        .map((link) => link.trim())
        .filter(Boolean),
      priority: form.priority,
    };

    setRemovals((current) => {
      if (!editingId) return [payload, ...current];
      return current.map((item) => (item.id === editingId ? payload : item));
    });

    setDrawerOpen(false);
  }

  function deleteRemoval(item: AdminRemoval) {
    const confirmed = window.confirm(
      `Excluir o atendimento "${item.title}"? Esta ação remove o registro salvo neste navegador.`
    );

    if (!confirmed) return;

    setRemovals((current) => current.filter((row) => row.id !== item.id));

    if (editingId === item.id) {
      setEditingId(null);
      setDrawerOpen(false);
    }
  }

  function openPrintableReport() {
    const targetRows =
      clientFilter === "all" ? filtered : filtered.filter((item) => item.clientId === clientFilter);
    const targetClient = clientFilter === "all" ? null : clientById.get(clientFilter);
    const total = targetRows.length;
    const removed = targetRows.filter((item) => item.success === true).length;
    const pending = targetRows.filter((item) => isRemovalOpen(item.status)).length;
    const value = targetRows.reduce((acc, item) => acc + Number(item.chargedAmount || 0), 0);
    const closed = targetRows.filter((item) => item.success !== null).length;
    const successRate = closed > 0 ? Math.round((removed / closed) * 100) : 0;

    const rowsHtml = targetRows
      .map((item) => {
        const client = clientById.get(item.clientId);
        return `
          <tr>
            <td>${safeText(formatDate(item.serviceDate))}</td>
            <td>${safeText(client?.name ?? "Cliente")}</td>
            <td>${safeText(impactTypeLabel[item.impactType])}</td>
            <td>${safeText(statusLabel[item.status])}</td>
            <td>${safeText(item.title)}</td>
            <td>${safeText(formatCurrency(item.chargedAmount))}</td>
          </tr>
        `;
      })
      .join("");

    const html = `
      <!doctype html>
      <html lang="pt-BR">
        <head>
          <meta charset="utf-8" />
          <title>Relatorio Suba Pro Verde</title>
          <style>
            body { margin: 0; font-family: Arial, sans-serif; background: #06100c; color: #eafff4; }
            .page { padding: 42px; }
            .hero { border: 1px solid rgba(255,255,255,.12); border-radius: 20px; padding: 28px; background: linear-gradient(135deg, rgba(0,255,136,.14), rgba(255,255,255,.04)); }
            h1 { margin: 0; font-size: 28px; }
            p { color: rgba(234,255,244,.72); }
            .grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin: 24px 0; }
            .card { border: 1px solid rgba(255,255,255,.12); border-radius: 16px; padding: 16px; background: rgba(255,255,255,.05); }
            .label { color: rgba(234,255,244,.62); font-size: 12px; }
            .value { margin-top: 6px; font-size: 24px; font-weight: 700; }
            table { width: 100%; border-collapse: collapse; margin-top: 18px; overflow: hidden; border-radius: 14px; }
            th, td { padding: 12px; border-bottom: 1px solid rgba(255,255,255,.10); text-align: left; font-size: 13px; }
            th { color: rgba(234,255,244,.62); background: rgba(255,255,255,.06); }
            @media print { body { background: #fff; color: #111; } .hero, .card { border-color: #ddd; background: #fff; } p, .label { color: #555; } th, td { border-color: #ddd; } th { background: #f5f5f5; } }
          </style>
        </head>
        <body>
          <div class="page">
            <section class="hero">
              <h1>Relatório de remoções - ${safeText(targetClient?.name ?? "Todos os clientes")}</h1>
              <p>Prévia operacional gerada pela área administrativa Suba Pro Verde.</p>
            </section>
            <section class="grid">
              <div class="card"><div class="label">Total</div><div class="value">${total}</div></div>
              <div class="card"><div class="label">Removidas</div><div class="value">${removed}</div></div>
              <div class="card"><div class="label">Pendentes</div><div class="value">${pending}</div></div>
              <div class="card"><div class="label">Taxa de sucesso</div><div class="value">${successRate}%</div></div>
            </section>
            <section class="card">
              <div class="label">Valor total</div>
              <div class="value">${safeText(formatCurrency(value))}</div>
            </section>
            <table>
              <thead>
                <tr>
                  <th>Data</th>
                  <th>Cliente</th>
                  <th>Tipo</th>
                  <th>Status</th>
                  <th>Atendimento</th>
                  <th>Valor</th>
                </tr>
              </thead>
              <tbody>${rowsHtml}</tbody>
            </table>
          </div>
          <script>window.onload = () => window.print();</script>
        </body>
      </html>
    `;

    const report = window.open("", "_blank", "noopener,noreferrer,width=1100,height=800");
    if (!report) return;
    report.document.write(html);
    report.document.close();
  }

  return (
    <div className="space-y-6">
      <section className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-emerald-300/20 bg-emerald-400/10 px-3 py-1 text-xs font-medium text-emerald-100">
            <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
            Operação de remoções
          </div>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-white">Remoções</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-white/58">
            Controle interno para clientes, vendas atendidas, impactos removidos, status,
            valores e relatórios premium. Esta versão usa dados mockados.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={openPrintableReport}
            className="inline-flex h-11 items-center gap-2 rounded-xl border border-white/10 bg-white/[0.05] px-4 text-sm font-medium text-white/80 transition hover:bg-white/[0.08] hover:text-white"
          >
            <Download className="h-4 w-4" aria-hidden="true" />
            Exportar relatório
          </button>
          <button
            type="button"
            onClick={openNewDrawer}
            className="inline-flex h-11 items-center gap-2 rounded-xl border border-emerald-300/20 bg-emerald-400/14 px-4 text-sm font-semibold text-emerald-50 transition hover:bg-emerald-400/18"
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            Novo atendimento
          </button>
        </div>
      </section>

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        <SummaryCard label="Atendimentos" value={String(summary.total)} />
        <SummaryCard label="Removidas" value={String(summary.removed)} tone="green" />
        <SummaryCard label="Pendentes" value={String(summary.pending)} tone="amber" />
        <SummaryCard label="Valor total" value={formatCurrency(summary.value)} tone="sky" />
        <SummaryCard label="Taxa de sucesso" value={`${summary.successRate}%`} tone="green" />
      </section>

      <section className="rounded-2xl border border-white/10 bg-white/[0.045] p-4">
        <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-white/85">
          <Filter className="h-4 w-4 text-emerald-200" aria-hidden="true" />
          Filtros
        </div>

        <div className="grid gap-3 lg:grid-cols-[1.2fr_.9fr_.8fr_.8fr_.7fr_.7fr_auto]">
          <div>
            <FieldLabel>Busca</FieldLabel>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/35" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Venda, packId, claimId, cliente..."
                className="h-11 w-full rounded-xl border border-white/10 bg-black/30 pl-9 pr-3 text-sm text-white outline-none placeholder:text-white/30 focus:border-emerald-300/35"
              />
            </div>
          </div>

          <SelectField label="Cliente" value={clientFilter} onChange={setClientFilter}>
            <option value="all">Todos</option>
            {clients.map((client) => (
              <option key={client.id} value={client.id}>
                {client.name}
              </option>
            ))}
          </SelectField>

          <SelectField
            label="Status"
            value={statusFilter}
            onChange={(value) => setStatusFilter(value as RemovalStatus | "all")}
          >
            <option value="all">Todos</option>
            {statusOptions.map((status) => (
              <option key={status} value={status}>
                {statusLabel[status]}
              </option>
            ))}
          </SelectField>

          <SelectField
            label="Tipo"
            value={typeFilter}
            onChange={(value) => setTypeFilter(value as ImpactType | "all")}
          >
            <option value="all">Todos</option>
            {impactOptions.map((type) => (
              <option key={type} value={type}>
                {impactTypeLabel[type]}
              </option>
            ))}
          </SelectField>

          <DateField label="Início" value={startDate} onChange={setStartDate} />
          <DateField label="Fim" value={endDate} onChange={setEndDate} />

          <div className="flex items-end">
            <button
              type="button"
              onClick={clearFilters}
              className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-3 text-sm font-medium text-white/65 transition hover:bg-white/[0.08] hover:text-white lg:w-auto"
            >
              <X className="h-4 w-4" aria-hidden="true" />
              Limpar
            </button>
          </div>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-[1fr_360px]">
        <div className="overflow-hidden rounded-2xl border border-white/10 bg-black/24">
          <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
            <div>
              <h2 className="text-sm font-semibold text-white">Atendimentos</h2>
              <p className="text-xs text-white/45">{filtered.length} registro(s) encontrados</p>
            </div>
            <FileText className="h-4 w-4 text-white/40" aria-hidden="true" />
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] text-left text-sm">
              <thead className="bg-white/[0.035] text-xs uppercase tracking-wide text-white/42">
                <tr>
                  <th className="px-4 py-3 font-medium">Cliente</th>
                  <th className="px-4 py-3 font-medium">Impacto</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">IDs ML</th>
                  <th className="px-4 py-3 font-medium">Datas</th>
                  <th className="px-4 py-3 font-medium">Valor</th>
                  <th className="px-4 py-3 font-medium">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/8">
                {filtered.map((item) => (
                  <tr key={item.id} className="align-top transition hover:bg-white/[0.035]">
                    <td className="px-4 py-4">
                      <div className="font-medium text-white">
                        {clientById.get(item.clientId)?.name ?? "Cliente"}
                      </div>
                      <div className="mt-1 max-w-[250px] text-xs leading-5 text-white/45">{item.title}</div>
                    </td>
                    <td className="px-4 py-4">
                      <div className="text-white/80">{impactTypeLabel[item.impactType]}</div>
                      <span
                        className={cn(
                          "mt-2 inline-flex rounded-full border px-2 py-1 text-[11px] font-medium",
                          priorityTone(item.priority)
                        )}
                      >
                        prioridade {item.priority}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      <span className={cn("inline-flex rounded-full border px-2.5 py-1 text-xs font-medium", statusTone(item.status))}>
                        {statusLabel[item.status]}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-xs leading-5 text-white/55">
                      <div>Venda: {item.mlOrderId ?? "-"}</div>
                      <div>Pack: {item.packId ?? "-"}</div>
                      <div>Claim: {item.claimId ?? "-"}</div>
                      <div>Shipment: {item.shipmentId ?? "-"}</div>
                    </td>
                    <td className="px-4 py-4 text-xs leading-5 text-white/55">
                      <div className="flex items-center gap-1.5">
                        <CalendarDays className="h-3.5 w-3.5" aria-hidden="true" />
                        {formatDate(item.serviceDate)}
                      </div>
                      <div>Prevista: {formatDate(item.dueDate)}</div>
                      <div>Fim: {formatDate(item.completedAt)}</div>
                    </td>
                    <td className="px-4 py-4 font-medium text-white">
                      {formatCurrency(item.chargedAmount)}
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => openEditDrawer(item)}
                        className="inline-flex h-9 items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-3 text-xs font-medium text-white/70 transition hover:bg-white/[0.08] hover:text-white"
                      >
                        <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                        Editar
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteRemoval(item)}
                        className="inline-flex h-9 items-center gap-2 rounded-xl border border-rose-300/15 bg-rose-400/10 px-3 text-xs font-medium text-rose-50 transition hover:bg-rose-400/16"
                      >
                        <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                        Excluir
                      </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {filtered.length === 0 ? (
            <div className="px-4 py-12 text-center text-sm text-white/45">
              Nenhum atendimento encontrado para os filtros selecionados.
            </div>
          ) : null}
        </div>

        <aside className="space-y-4">
          <div className="rounded-2xl border border-white/10 bg-white/[0.045] p-4">
            <h2 className="text-sm font-semibold text-white">Resumo por cliente</h2>
            <div className="mt-4 space-y-3">
              {clientSummaries.map((item) => (
                <button
                  key={item.client.id}
                  type="button"
                  onClick={() => setClientFilter(item.client.id)}
                  className="w-full rounded-xl border border-white/10 bg-black/20 p-3 text-left transition hover:border-emerald-300/20 hover:bg-white/[0.05]"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-sm font-medium text-white">{item.client.name}</div>
                      <div className="mt-1 text-xs text-white/45">
                        {item.total} total | {item.pending} pendente(s)
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-semibold text-emerald-100">{item.successRate}%</div>
                      <div className="text-[11px] text-white/35">sucesso</div>
                    </div>
                  </div>
                  <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/10">
                    <div
                      className="h-full rounded-full bg-emerald-300"
                      style={{ width: `${Math.min(item.successRate, 100)}%` }}
                    />
                  </div>
                  <div className="mt-2 text-xs font-medium text-white/70">{formatCurrency(item.value)}</div>
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-amber-300/16 bg-amber-400/[0.055] p-4">
            <h2 className="text-sm font-semibold text-amber-50">Alertas operacionais</h2>
            <div className="mt-3 space-y-2 text-sm text-amber-50/72">
              <p>Atendimentos vencendo em até 24h devem virar prioridade do dia.</p>
              <p>Clientes aguardando resposta precisam de follow-up antes do relatório.</p>
            </div>
          </div>
        </aside>
      </section>

      {drawerOpen ? (
        <div className="fixed inset-0 z-[80]">
          <button
            type="button"
            aria-label="Fechar drawer"
            onClick={() => setDrawerOpen(false)}
            className="absolute inset-0 bg-black/65 backdrop-blur-sm"
          />

          <div className="absolute right-0 top-0 flex h-full w-full max-w-2xl flex-col border-l border-white/10 bg-[#07100d] shadow-[-28px_0_80px_rgba(0,0,0,0.45)]">
            <div className="flex items-start justify-between border-b border-white/10 p-5">
              <div>
                <h2 className="text-lg font-semibold text-white">
                  {editingId ? "Editar atendimento" : "Novo atendimento"}
                </h2>
                <p className="mt-1 text-sm text-white/48">
                  Registro salvo neste navegador. A persistência no Supabase vem na próxima etapa.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setDrawerOpen(false)}
                className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-white/65 transition hover:bg-white/[0.08] hover:text-white"
                aria-label="Fechar"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5">
              <div className="grid gap-4 md:grid-cols-2">
                <ClientPicker
                  clients={clients}
                  value={form.clientId}
                  draft={clientDraft}
                  open={clientFormOpen}
                  onChange={(value) => updateForm("clientId", value)}
                  onDraftChange={updateClientDraft}
                  onToggle={() => setClientFormOpen((current) => !current)}
                  onCreate={createClientFromDraft}
                />

                <SelectField
                  label="Tipo do impacto"
                  value={form.impactType}
                  onChange={(value) => updateForm("impactType", value as ImpactType)}
                >
                  {impactOptions.map((type) => (
                    <option key={type} value={type}>
                      {impactTypeLabel[type]}
                    </option>
                  ))}
                </SelectField>

                <SelectField
                  label="Status"
                  value={form.status}
                  onChange={(value) => updateForm("status", value as RemovalStatus)}
                >
                  {statusOptions.map((status) => (
                    <option key={status} value={status}>
                      {statusLabel[status]}
                    </option>
                  ))}
                </SelectField>

                <SelectField
                  label="Prioridade"
                  value={form.priority}
                  onChange={(value) => updateForm("priority", value as AdminRemoval["priority"])}
                >
                  <option value="alta">Alta</option>
                  <option value="media">Media</option>
                  <option value="baixa">Baixa</option>
                </SelectField>

                <TextField label="Título" value={form.title} onChange={(value) => updateForm("title", value)} span />
                <TextField label="Seller ID" value={form.sellerId} onChange={(value) => updateForm("sellerId", value)} />
                <TextField label="ID da venda" value={form.mlOrderId} onChange={(value) => updateForm("mlOrderId", value)} />
                <TextField label="Pack ID" value={form.packId} onChange={(value) => updateForm("packId", value)} />
                <TextField label="Claim ID" value={form.claimId} onChange={(value) => updateForm("claimId", value)} />
                <TextField label="Shipment ID" value={form.shipmentId} onChange={(value) => updateForm("shipmentId", value)} />
                <NumberField label="Valor cobrado" value={form.chargedAmount} onChange={(value) => updateForm("chargedAmount", value)} />
                <DateField label="Data do atendimento" value={form.serviceDate} onChange={(value) => updateForm("serviceDate", value)} />
                <DateField label="Data prevista" value={form.dueDate} onChange={(value) => updateForm("dueDate", value)} />
                <DateField label="Data de conclusão" value={form.completedAt ?? ""} onChange={(value) => updateForm("completedAt", value)} />

                <TextAreaField
                  label="Descrição"
                  value={form.description}
                  onChange={(value) => updateForm("description", value)}
                />
                <TextAreaField
                  label="Observações internas"
                  value={form.internalNotes}
                  onChange={(value) => updateForm("internalNotes", value)}
                />
                <TextAreaField
                  label="Notas para relatório"
                  value={form.reportNotes}
                  onChange={(value) => updateForm("reportNotes", value)}
                />
                <TextAreaField
                  label="Evidências ou links"
                  value={form.evidenceText}
                  onChange={(value) => updateForm("evidenceText", value)}
                  helper="Um link por linha."
                />
              </div>
            </div>

            <div className="flex items-center justify-between gap-3 border-t border-white/10 p-5">
              <div className="text-xs text-white/40">
                Você pode salvar com dados parciais e completar depois.
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setDrawerOpen(false)}
                  className="inline-flex h-11 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] px-4 text-sm font-medium text-white/70 transition hover:bg-white/[0.08] hover:text-white"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={saveRemoval}
                  className="inline-flex h-11 items-center justify-center rounded-xl border border-emerald-300/20 bg-emerald-400/14 px-4 text-sm font-semibold text-emerald-50 transition hover:bg-emerald-400/18"
                >
                  Salvar atendimento
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
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
    <div className="md:col-span-2">
      <div className="flex items-end gap-2">
        <div className="min-w-0 flex-1">
          <FieldLabel>Cliente</FieldLabel>
          <select
            value={value}
            onChange={(event) => onChange(event.target.value)}
            className="h-11 w-full rounded-xl border border-white/10 bg-black/30 px-3 text-sm text-white outline-none focus:border-emerald-300/35"
          >
            {clients.length === 0 ? <option value="">Sem clientes cadastrados</option> : null}
            {clients.map((client) => (
              <option key={client.id} value={client.id}>
                {client.name}
              </option>
            ))}
          </select>
        </div>
        <button
          type="button"
          onClick={onToggle}
          className="inline-flex h-11 shrink-0 items-center justify-center rounded-xl border border-sky-300/20 bg-sky-400/12 px-3 text-sm font-semibold text-sky-50 transition hover:bg-sky-400/18"
        >
          {open ? "Fechar" : "Novo cliente"}
        </button>
      </div>

      {open ? (
        <div className="mt-3 rounded-2xl border border-sky-300/16 bg-sky-400/[0.055] p-4">
          <div className="text-sm font-semibold text-white">Cadastrar cliente rápido</div>
          <div className="mt-3 grid gap-3 md:grid-cols-2">
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
            className="mt-3 inline-flex h-10 items-center justify-center rounded-xl border border-emerald-300/20 bg-emerald-400/14 px-4 text-sm font-semibold text-emerald-50 transition hover:bg-emerald-400/18"
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
      <span className="mb-1 block text-xs font-medium text-white/55">{label}</span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-11 w-full rounded-xl border border-white/10 bg-black/30 px-3 text-sm text-white outline-none placeholder:text-white/30 focus:border-emerald-300/35"
      />
    </label>
  );
}

function SummaryCard({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: string;
  tone?: "default" | "green" | "amber" | "sky";
}) {
  const toneClass = {
    default: "border-white/10 bg-white/[0.045] text-white",
    green: "border-emerald-300/18 bg-emerald-400/[0.075] text-emerald-50",
    amber: "border-amber-300/18 bg-amber-400/[0.075] text-amber-50",
    sky: "border-sky-300/18 bg-sky-400/[0.07] text-sky-50",
  }[tone];

  return (
    <div className={cn("rounded-2xl border p-4", toneClass)}>
      <div className="text-xs font-medium text-white/48">{label}</div>
      <div className="mt-2 text-2xl font-semibold tracking-tight">{value}</div>
    </div>
  );
}

function SelectField({
  label,
  value,
  onChange,
  children,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  children: React.ReactNode;
}) {
  return (
    <div>
      <FieldLabel>{label}</FieldLabel>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-11 w-full rounded-xl border border-white/10 bg-black/30 px-3 text-sm text-white outline-none focus:border-emerald-300/35"
      >
        {children}
      </select>
    </div>
  );
}

function DateField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div>
      <FieldLabel>{label}</FieldLabel>
      <input
        type="date"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-11 w-full rounded-xl border border-white/10 bg-black/30 px-3 text-sm text-white outline-none focus:border-emerald-300/35"
      />
    </div>
  );
}

function TextField({
  label,
  value,
  onChange,
  span,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  span?: boolean;
}) {
  return (
    <div className={span ? "md:col-span-2" : undefined}>
      <FieldLabel>{label}</FieldLabel>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-11 w-full rounded-xl border border-white/10 bg-black/30 px-3 text-sm text-white outline-none placeholder:text-white/30 focus:border-emerald-300/35"
      />
    </div>
  );
}

function NumberField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <div>
      <FieldLabel>{label}</FieldLabel>
      <input
        type="number"
        min="0"
        step="0.01"
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="h-11 w-full rounded-xl border border-white/10 bg-black/30 px-3 text-sm text-white outline-none focus:border-emerald-300/35"
      />
    </div>
  );
}

function TextAreaField({
  label,
  value,
  onChange,
  helper,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  helper?: string;
}) {
  return (
    <div className="md:col-span-2">
      <FieldLabel>{label}</FieldLabel>
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        rows={4}
        className="w-full resize-none rounded-xl border border-white/10 bg-black/30 px-3 py-3 text-sm text-white outline-none placeholder:text-white/30 focus:border-emerald-300/35"
      />
      {helper ? <div className="mt-1 text-xs text-white/35">{helper}</div> : null}
    </div>
  );
}
