"use client";

import {
  useEffect,
  useMemo,
  useState,
  type ClipboardEvent,
  type ComponentType,
  type ReactNode,
} from "react";
import Link from "next/link";
import {
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  Code2,
  Plus,
  Search,
  Table2,
  Trash2,
  Users,
  X,
} from "lucide-react";
import type { AdminClient } from "../../admin-data";
import { formatDate } from "../../admin-data";

type SheetRow = {
  id: string;
  cells: string[];
};

type WorkstationEntry = {
  clientId: string;
  date: string;
  boardText: string;
  rows: SheetRow[];
  updatedAt: string;
};

type StoredAdminRemocoes = {
  clients?: AdminClient[];
};

type StoredWorkstation = {
  entries?: Record<string, WorkstationEntry>;
};

const ADMIN_REMOCOES_STORAGE_KEY = "spv:admin-remocoes:v1";
const WORKSTATION_STORAGE_KEY = "spv:admin-workstation:v1";
const columns = ["Venda / ID", "Data", "Valor", "Status", "Próximo passo", "Observação"];

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function addDaysIso(baseIso: string, amount: number) {
  const date = new Date(`${baseIso}T12:00:00`);
  date.setDate(date.getDate() + amount);
  return date.toISOString().slice(0, 10);
}

function entryKey(clientId: string, date: string) {
  return `${clientId}::${date}`;
}

function createRow(): SheetRow {
  return {
    id: `row-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    cells: Array.from({ length: columns.length }, () => ""),
  };
}

function parsePastedGrid(raw: string) {
  return raw
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .trimEnd()
    .split("\n")
    .map((line) => line.split("\t").map((cell) => cell.trim()))
    .filter((row) => row.some(Boolean));
}

function defaultRows() {
  return Array.from({ length: 10 }, () => createRow());
}

function defaultEntry(clientId: string, date: string): WorkstationEntry {
  return {
    clientId,
    date,
    boardText: "",
    rows: defaultRows(),
    updatedAt: new Date().toISOString(),
  };
}

function readStoredClients(initialClients: AdminClient[]) {
  if (typeof window === "undefined") return initialClients;

  try {
    const raw = window.localStorage.getItem(ADMIN_REMOCOES_STORAGE_KEY);
    if (!raw) return initialClients;

    const parsed = JSON.parse(raw) as StoredAdminRemocoes;
    const storedClients = Array.isArray(parsed.clients) ? parsed.clients : [];
    const merged = new Map<string, AdminClient>();

    for (const client of initialClients) merged.set(client.id, client);
    for (const client of storedClients) merged.set(client.id, client);

    return Array.from(merged.values());
  } catch {
    return initialClients;
  }
}

function readStoredWorkstation() {
  if (typeof window === "undefined") return {};

  try {
    const raw = window.localStorage.getItem(WORKSTATION_STORAGE_KEY);
    if (!raw) return {};

    const parsed = JSON.parse(raw) as StoredWorkstation;
    return parsed.entries && typeof parsed.entries === "object" ? parsed.entries : {};
  } catch {
    return {};
  }
}

function hasContent(entry?: WorkstationEntry) {
  if (!entry) return false;
  if (entry.boardText.trim()) return true;
  return entry.rows.some((row) => row.cells.some((cell) => cell.trim()));
}

function countFilledRows(entry?: WorkstationEntry) {
  if (!entry) return 0;
  return entry.rows.filter((row) => row.cells.some((cell) => cell.trim())).length;
}

export default function WorkstationClient({ initialClients }: { initialClients: AdminClient[] }) {
  const [clients, setClients] = useState(initialClients);
  const [selectedClientId, setSelectedClientId] = useState(initialClients[0]?.id ?? "");
  const [selectedDate, setSelectedDate] = useState(todayIso());
  const [entries, setEntries] = useState<Record<string, WorkstationEntry>>({});
  const [clientQuery, setClientQuery] = useState("");
  const [storageReady, setStorageReady] = useState(false);
  const [savedAt, setSavedAt] = useState("");

  useEffect(() => {
    const loadedClients = readStoredClients(initialClients);
    setClients(loadedClients);
    setSelectedClientId((current) => current || loadedClients[0]?.id || "");
    setEntries(readStoredWorkstation());
    setStorageReady(true);
  }, [initialClients]);

  const activeClient = clients.find((client) => client.id === selectedClientId) ?? clients[0];
  const activeClientId = activeClient?.id ?? "";
  const activeKey = entryKey(activeClientId, selectedDate);
  const entry = entries[activeKey] ?? defaultEntry(activeClientId, selectedDate);

  const filteredClients = useMemo(() => {
    const needle = clientQuery.trim().toLowerCase();
    if (!needle) return clients;
    return clients.filter((client) =>
      [client.name, client.contactName, client.email, client.phone]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(needle)
    );
  }, [clientQuery, clients]);

  const dayTabs = useMemo(() => {
    const today = todayIso();
    return Array.from({ length: 9 }).map((_, index) => {
      const date = addDaysIso(today, index - 2);
      return {
        date,
        label:
          date === today
            ? "Hoje"
            : date === addDaysIso(today, 1)
              ? "Amanhã"
              : formatDate(date),
        active: date === selectedDate,
        filled: hasContent(entries[entryKey(activeClientId, date)]),
      };
    });
  }, [activeClientId, entries, selectedDate]);

  const boardLines = useMemo(() => {
    const total = Math.max(24, entry.boardText.split("\n").length);
    return Array.from({ length: total }, (_, index) => index + 1);
  }, [entry.boardText]);

  const stats = useMemo(() => {
    const clientEntries = Object.values(entries).filter((item) => item.clientId === activeClientId);
    const activeDays = clientEntries.filter(hasContent).length;
    const rows = clientEntries.reduce((acc, item) => acc + countFilledRows(item), 0);
    const chars = entry.boardText.length;

    return { activeDays, rows, chars };
  }, [activeClientId, entries, entry.boardText]);

  useEffect(() => {
    if (!storageReady) return;

    try {
      window.localStorage.setItem(
        WORKSTATION_STORAGE_KEY,
        JSON.stringify({ entries, updatedAt: new Date().toISOString() })
      );
      setSavedAt(new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }));
    } catch {
      setSavedAt("erro");
    }
  }, [entries, storageReady]);

  function updateEntry(patch: Partial<WorkstationEntry>) {
    if (!activeClientId) return;

    setEntries((current) => {
      const previous = current[activeKey] ?? defaultEntry(activeClientId, selectedDate);
      return {
        ...current,
        [activeKey]: {
          ...previous,
          ...patch,
          clientId: activeClientId,
          date: selectedDate,
          updatedAt: new Date().toISOString(),
        },
      };
    });
  }

  function updateCell(rowId: string, columnIndex: number, value: string) {
    updateEntry({
      rows: entry.rows.map((row) =>
        row.id === rowId
          ? { ...row, cells: row.cells.map((cell, index) => (index === columnIndex ? value : cell)) }
          : row
      ),
    });
  }

  function pasteGrid(rowId: string, columnIndex: number, event: ClipboardEvent<HTMLInputElement>) {
    const raw = event.clipboardData.getData("text");
    if (!raw || !/[\n\r\t]/.test(raw)) return;

    const pastedRows = parsePastedGrid(raw);
    if (!pastedRows.length) return;

    event.preventDefault();

    const startRowIndex = entry.rows.findIndex((row) => row.id === rowId);
    if (startRowIndex < 0) return;

    const nextRows = entry.rows.map((row) => ({
      ...row,
      cells: [...row.cells],
    }));

    while (nextRows.length < startRowIndex + pastedRows.length) {
      nextRows.push(createRow());
    }

    pastedRows.forEach((pastedRow, rowOffset) => {
      const targetRow = nextRows[startRowIndex + rowOffset];
      const targetCells = [...targetRow.cells];

      pastedRow.forEach((cell, cellOffset) => {
        const targetColumn = columnIndex + cellOffset;
        if (targetColumn >= columns.length) return;
        targetCells[targetColumn] = cell;
      });

      targetRow.cells = targetCells;
    });

    updateEntry({ rows: nextRows });
  }

  function addRow() {
    updateEntry({ rows: [...entry.rows, createRow()] });
  }

  function removeRow(rowId: string) {
    const rows = entry.rows.filter((row) => row.id !== rowId);
    updateEntry({ rows: rows.length ? rows : [createRow()] });
  }

  function clearDay() {
    const confirmed = window.confirm("Limpar esta lousa e a planilha deste cliente neste dia?");
    if (!confirmed) return;

    setEntries((current) => {
      const next = { ...current };
      delete next[activeKey];
      return next;
    });
  }

  return (
    <div className="spv-workstation space-y-4">
      <style>{`
        html[data-spv-theme="light"] .spv-workstation [class*="bg-[#050807]"] {
          background: #f8fcf9 !important;
          box-shadow: 0 24px 70px rgba(20, 83, 45, 0.10);
        }

        html[data-spv-theme="light"] .spv-workstation [class*="bg-[#020403]"] {
          background: #fbfffc !important;
        }

        html[data-spv-theme="light"] .spv-workstation [class*="bg-white/[0.025]"] {
          background: #eef7f1 !important;
        }

        html[data-spv-theme="light"] .spv-workstation [class*="bg-white/[0.018]"],
        html[data-spv-theme="light"] .spv-workstation [class*="bg-white/[0.045]"] {
          background: #edf6f0 !important;
        }

        html[data-spv-theme="light"] .spv-workstation [class*="border-white/"] {
          border-color: rgba(22, 78, 57, 0.16) !important;
        }

        html[data-spv-theme="light"] .spv-workstation [class*="text-white/18"],
        html[data-spv-theme="light"] .spv-workstation [class*="text-white/22"],
        html[data-spv-theme="light"] .spv-workstation [class*="text-white/30"],
        html[data-spv-theme="light"] .spv-workstation [class*="text-white/32"],
        html[data-spv-theme="light"] .spv-workstation [class*="text-white/35"],
        html[data-spv-theme="light"] .spv-workstation [class*="text-white/38"],
        html[data-spv-theme="light"] .spv-workstation [class*="text-white/42"],
        html[data-spv-theme="light"] .spv-workstation [class*="text-white/44"],
        html[data-spv-theme="light"] .spv-workstation [class*="text-white/50"],
        html[data-spv-theme="light"] .spv-workstation [class*="text-white/55"],
        html[data-spv-theme="light"] .spv-workstation [class*="text-white/60"],
        html[data-spv-theme="light"] .spv-workstation [class*="text-white/70"] {
          color: rgba(16, 32, 24, 0.62) !important;
        }

        html[data-spv-theme="light"] .spv-workstation .ws-board {
          background: transparent !important;
          color: #12372b !important;
          caret-color: #059669;
        }

        html[data-spv-theme="light"] .spv-workstation .ws-board::placeholder {
          color: rgba(16, 32, 24, 0.36) !important;
        }

        html[data-spv-theme="light"] .spv-workstation table input {
          background: transparent !important;
          color: #12372b !important;
        }

        html[data-spv-theme="light"] .spv-workstation table input::placeholder {
          color: rgba(16, 32, 24, 0.32) !important;
        }

        html[data-spv-theme="light"] .spv-workstation select,
        html[data-spv-theme="light"] .spv-workstation input[type="date"],
        html[data-spv-theme="light"] .spv-workstation input[type="text"] {
          background: rgba(255, 255, 255, 0.88) !important;
          color: #102018 !important;
        }
      `}</style>
      <section className="overflow-hidden rounded-2xl border border-white/10 bg-[#050807]">
        <div className="flex flex-col gap-4 border-b border-white/10 px-4 py-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 items-center gap-3">
            <Link
              href="/admin/remocoes"
              className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-white/70 transition hover:bg-white/[0.08] hover:text-white"
              aria-label="Voltar para Remoções"
            >
              <ArrowLeft className="h-4 w-4" aria-hidden={true} />
            </Link>
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-emerald-200/70">
                <Code2 className="h-4 w-4" aria-hidden={true} />
                workstation://remocoes
              </div>
              <h1 className="mt-1 truncate text-2xl font-semibold tracking-tight text-white">
                Lousa operacional
              </h1>
            </div>
          </div>

          <div className="grid gap-2 sm:grid-cols-[230px_170px_110px]">
            <select
              value={activeClientId}
              onChange={(event) => setSelectedClientId(event.target.value)}
              className="h-10 rounded-xl border border-white/10 bg-black/35 px-3 text-sm text-white outline-none focus:border-emerald-300/35"
            >
              {clients.map((client) => (
                <option key={client.id} value={client.id} className="bg-[#08100d]">
                  {client.name}
                </option>
              ))}
            </select>
            <input
              type="date"
              value={selectedDate}
              onChange={(event) => setSelectedDate(event.target.value)}
              className="h-10 rounded-xl border border-white/10 bg-black/35 px-3 text-sm text-white outline-none focus:border-emerald-300/35"
            />
            <div className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-emerald-300/20 bg-emerald-400/10 px-3 text-xs font-semibold text-emerald-100">
              <CheckCircle2 className="h-3.5 w-3.5" aria-hidden={true} />
              {savedAt || "salvo"}
            </div>
          </div>
        </div>

        <div className="grid min-h-[calc(100vh-260px)] lg:grid-cols-[270px_1fr]">
          <aside className="border-b border-white/10 bg-white/[0.025] p-3 lg:border-b-0 lg:border-r">
            <div className="rounded-xl border border-white/10 bg-black/28 p-3">
              <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-white/42">
                <Users className="h-3.5 w-3.5" aria-hidden={true} />
                clientes
              </div>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/32" />
                <input
                  value={clientQuery}
                  onChange={(event) => setClientQuery(event.target.value)}
                  placeholder="buscar cliente"
                  className="h-10 w-full rounded-lg border border-white/10 bg-black/30 pl-9 pr-3 text-sm text-white outline-none placeholder:text-white/28 focus:border-emerald-300/35"
                />
              </div>
              <div className="mt-3 max-h-[260px] space-y-1 overflow-y-auto pr-1">
                {filteredClients.map((client) => {
                  const active = client.id === activeClientId;
                  const filledDays = Object.values(entries).filter(
                    (item) => item.clientId === client.id && hasContent(item)
                  ).length;

                  return (
                    <button
                      key={client.id}
                      type="button"
                      onClick={() => setSelectedClientId(client.id)}
                      className={cn(
                        "flex w-full items-center justify-between gap-3 rounded-lg border px-3 py-2 text-left text-sm transition",
                        active
                          ? "border-emerald-300/25 bg-emerald-400/12 text-white"
                          : "border-transparent text-white/60 hover:border-white/10 hover:bg-white/[0.045] hover:text-white"
                      )}
                    >
                      <span className="truncate">{client.name}</span>
                      <span className="shrink-0 rounded-full border border-white/10 bg-black/24 px-2 py-0.5 text-[11px] text-white/44">
                        {filledDays}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="mt-3 rounded-xl border border-white/10 bg-black/28 p-3">
              <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-white/42">
                <CalendarDays className="h-3.5 w-3.5" aria-hidden={true} />
                dias
              </div>
              <div className="grid gap-1">
                {dayTabs.map((day) => (
                  <button
                    key={day.date}
                    type="button"
                    onClick={() => setSelectedDate(day.date)}
                    className={cn(
                      "flex items-center justify-between rounded-lg border px-3 py-2 text-left text-xs transition",
                      day.active
                        ? "border-sky-300/25 bg-sky-400/12 text-white"
                        : "border-transparent text-white/55 hover:border-white/10 hover:bg-white/[0.045] hover:text-white"
                    )}
                  >
                    <span>
                      <span className="block font-semibold">{day.label}</span>
                      <span className="text-white/35">{formatDate(day.date)}</span>
                    </span>
                    <span
                      className={cn(
                        "h-2 w-2 rounded-full",
                        day.filled ? "bg-emerald-300 shadow-[0_0_14px_rgba(110,231,183,.8)]" : "bg-white/18"
                      )}
                    />
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-3 grid grid-cols-3 gap-2">
              <MiniStat label="dias" value={String(stats.activeDays)} />
              <MiniStat label="linhas" value={String(stats.rows)} />
              <MiniStat label="chars" value={String(stats.chars)} />
            </div>
          </aside>

          <main className="grid gap-0 xl:grid-cols-[minmax(0,1fr)_520px]">
            <section className="border-b border-white/10 p-3 xl:border-b-0 xl:border-r">
              <PanelHeader
                icon={Code2}
                title="lousa.txt"
                right={
                  <button
                    type="button"
                    onClick={clearDay}
                    className="inline-flex h-9 items-center gap-2 rounded-lg border border-rose-300/20 bg-rose-400/10 px-3 text-xs font-semibold text-rose-100 transition hover:bg-rose-400/16"
                  >
                    <X className="h-3.5 w-3.5" aria-hidden={true} />
                    limpar dia
                  </button>
                }
              />
              <div className="mt-3 overflow-hidden rounded-xl border border-white/10 bg-[#020403] font-mono">
                <div className="flex border-b border-white/8 bg-white/[0.025] px-3 py-2 text-[11px] text-white/35">
                  <span>{activeClient?.name ?? "cliente"}</span>
                  <span className="mx-2 text-white/18">/</span>
                  <span>{selectedDate}</span>
                </div>
                <div className="grid grid-cols-[48px_1fr]">
                  <pre className="select-none border-r border-white/8 bg-white/[0.018] px-3 py-4 text-right text-xs leading-6 text-white/22">
                    {boardLines.map((line) => (
                      <span key={line} className="block">
                        {line}
                      </span>
                    ))}
                  </pre>
                  <textarea
                    value={entry.boardText}
                    onChange={(event) => updateEntry({ boardText: event.target.value })}
                    spellCheck={false}
                    wrap="off"
                    rows={boardLines.length}
                    placeholder="Digite qualquer coisa aqui: vendas, datas, hipóteses, roteiro de atendimento, defesa, checklist..."
                    className="ws-board min-h-[610px] w-full resize-none bg-transparent px-4 py-4 text-sm leading-6 text-emerald-50 outline-none placeholder:text-white/22"
                  />
                </div>
              </div>
            </section>

            <section className="p-3">
              <PanelHeader
                icon={Table2}
                title="planilha.csv"
                right={
                  <button
                    type="button"
                    onClick={addRow}
                    className="inline-flex h-9 items-center gap-2 rounded-lg border border-emerald-300/20 bg-emerald-400/12 px-3 text-xs font-semibold text-emerald-50 transition hover:bg-emerald-400/18"
                  >
                    <Plus className="h-3.5 w-3.5" aria-hidden={true} />
                    linha
                  </button>
                }
              />
              <div className="mt-3 overflow-x-auto rounded-xl border border-white/10 bg-[#020403]">
                <table className="w-full min-w-[780px] text-left font-mono text-xs">
                  <thead className="bg-white/[0.045] text-[11px] uppercase tracking-wide text-white/38">
                    <tr>
                      {columns.map((column) => (
                        <th key={column} className="border-r border-white/8 px-2 py-2 font-semibold last:border-r-0">
                          {column}
                        </th>
                      ))}
                      <th className="w-10 px-2 py-2" aria-label="Ações" />
                    </tr>
                  </thead>
                  <tbody>
                    {entry.rows.map((row) => (
                      <tr key={row.id} className="border-t border-white/8">
                        {columns.map((column, index) => (
                          <td key={`${row.id}-${column}`} className="border-r border-white/8 last:border-r-0">
                            <input
                              value={row.cells[index] ?? ""}
                              onChange={(event) => updateCell(row.id, index, event.target.value)}
                              onPaste={(event) => pasteGrid(row.id, index, event)}
                              placeholder={column}
                              className="h-10 w-full bg-transparent px-2 text-emerald-50 outline-none placeholder:text-white/18 focus:bg-emerald-400/[0.055]"
                            />
                          </td>
                        ))}
                        <td className="px-1">
                          <button
                            type="button"
                            onClick={() => removeRow(row.id)}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-md text-white/30 transition hover:bg-rose-400/10 hover:text-rose-100"
                            aria-label="Remover linha"
                          >
                            <Trash2 className="h-3.5 w-3.5" aria-hidden={true} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </main>
        </div>
      </section>
    </div>
  );
}

function PanelHeader({
  icon: Icon,
  title,
  right,
}: {
  icon: ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
  title: string;
  right?: ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex items-center gap-2 font-mono text-xs font-semibold uppercase tracking-[0.16em] text-white/50">
        <Icon className="h-4 w-4 text-emerald-200/80" aria-hidden={true} />
        {title}
      </div>
      {right}
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-white/10 bg-black/24 px-2 py-2">
      <div className="font-mono text-[10px] uppercase tracking-wide text-white/32">{label}</div>
      <div className="mt-1 text-lg font-semibold text-white">{value}</div>
    </div>
  );
}
