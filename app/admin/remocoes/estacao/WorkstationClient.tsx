"use client";

import {
  useEffect,
  useMemo,
  useState,
  type ClipboardEvent,
  type ComponentType,
  type CSSProperties,
  type ReactNode,
} from "react";
import Link from "next/link";
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  ArrowLeft,
  Bold,
  CalendarDays,
  CheckCircle2,
  Code2,
  Italic,
  PaintBucket,
  Palette,
  Plus,
  Search,
  Table2,
  Type,
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

type TextAlign = "left" | "center" | "right";
type TextSize = "sm" | "md" | "lg";
type TextWeight = "regular" | "bold";
type BoardFont = "mono" | "sans";

type BoardStyle = {
  color: string;
  background: string;
  align: TextAlign;
  size: TextSize;
  weight: TextWeight;
  italic: boolean;
  font: BoardFont;
};

type SheetStyle = {
  color: string;
  background: string;
  align: TextAlign;
  size: TextSize;
  weight: TextWeight;
  italic: boolean;
};

type WorkstationEntry = {
  clientId: string;
  date: string;
  boardText: string;
  boardStyle?: Partial<BoardStyle>;
  boardLineStyles?: Record<string, Partial<BoardStyle>>;
  rows: SheetRow[];
  sheetStyle?: Partial<SheetStyle>;
  sheetCellStyles?: Record<string, Partial<SheetStyle>>;
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

const DEFAULT_BOARD_STYLE: BoardStyle = {
  color: "var(--ws-board-text)",
  background: "transparent",
  align: "left",
  size: "md",
  weight: "regular",
  italic: false,
  font: "mono",
};

const DEFAULT_SHEET_STYLE: SheetStyle = {
  color: "var(--ws-sheet-text)",
  background: "transparent",
  align: "left",
  size: "md",
  weight: "regular",
  italic: false,
};

const textSizePx: Record<TextSize, string> = {
  sm: "12px",
  md: "14px",
  lg: "16px",
};

const boardFontFamily: Record<BoardFont, string> = {
  mono: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
  sans: "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif",
};

const textSwatches = [
  { label: "Verde", value: "#d1fae5" },
  { label: "Branco", value: "#f8fafc" },
  { label: "Azul", value: "#bfdbfe" },
  { label: "Amarelo", value: "#fde68a" },
  { label: "Rosa", value: "#fecdd3" },
  { label: "Grafite", value: "#12372b" },
];

const fillSwatches = [
  { label: "Sem preenchimento", value: "transparent" },
  { label: "Verde", value: "rgba(16, 185, 129, 0.16)" },
  { label: "Azul", value: "rgba(56, 189, 248, 0.16)" },
  { label: "Amarelo", value: "rgba(245, 158, 11, 0.18)" },
  { label: "Rosa", value: "rgba(244, 63, 94, 0.16)" },
  { label: "Preto", value: "rgba(2, 6, 4, 0.55)" },
];

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

function resolveBoardStyle(style?: Partial<BoardStyle>): BoardStyle {
  return { ...DEFAULT_BOARD_STYLE, ...(style ?? {}) };
}

function resolveSheetStyle(style?: Partial<SheetStyle>): SheetStyle {
  return { ...DEFAULT_SHEET_STYLE, ...(style ?? {}) };
}

function boardStyleToCss(style: BoardStyle): CSSProperties {
  return {
    color: style.color,
    backgroundColor: style.background,
    textAlign: style.align,
    fontSize: textSizePx[style.size],
    fontWeight: style.weight === "bold" ? 700 : 500,
    fontStyle: style.italic ? "italic" : "normal",
    fontFamily: boardFontFamily[style.font],
    lineHeight: 1.6,
  };
}

function sheetStyleToCss(style: SheetStyle): CSSProperties {
  return {
    color: style.color,
    backgroundColor: style.background,
    textAlign: style.align,
    fontSize: textSizePx[style.size],
    fontWeight: style.weight === "bold" ? 700 : 500,
    fontStyle: style.italic ? "italic" : "normal",
  };
}

function cellStyleKey(rowId: string, columnIndex: number) {
  return `${rowId}:${columnIndex}`;
}

function boardLineStyleKey(lineIndex: number) {
  return String(lineIndex);
}

function compactBoardLines(lines: string[]) {
  const next = [...lines];
  while (next.length > 1 && next.at(-1) === "") next.pop();
  return next.every((line) => !line) ? "" : next.join("\n");
}

function pastedTextLines(raw: string) {
  return raw.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
}

function colorInputValue(color: string, fallback: string) {
  return /^#[0-9a-f]{6}$/i.test(color) ? color : fallback;
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
  const [selectedCell, setSelectedCell] = useState<{ rowId: string; columnIndex: number } | null>(null);
  const [selectedBoardLine, setSelectedBoardLine] = useState<number | null>(0);

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
  const boardStyle = resolveBoardStyle(entry.boardStyle);
  const selectedBoardLineKey =
    selectedBoardLine === null ? "" : boardLineStyleKey(selectedBoardLine);
  const selectedBoardStyle = resolveBoardStyle({
    ...boardStyle,
    ...(selectedBoardLineKey ? entry.boardLineStyles?.[selectedBoardLineKey] : undefined),
  });
  const selectedBoardLabel = selectedBoardLine === null ? "lousa inteira" : `linha ${selectedBoardLine + 1}`;
  const sheetStyle = resolveSheetStyle(entry.sheetStyle);
  const selectedCellKey = selectedCell ? cellStyleKey(selectedCell.rowId, selectedCell.columnIndex) : "";
  const selectedSheetStyle = resolveSheetStyle({
    ...sheetStyle,
    ...(selectedCellKey ? entry.sheetCellStyles?.[selectedCellKey] : undefined),
  });
  const selectedCellLabel = useMemo(() => {
    if (!selectedCell) return "planilha inteira";
    const rowIndex = entry.rows.findIndex((row) => row.id === selectedCell.rowId);
    const rowLabel = rowIndex >= 0 ? `linha ${rowIndex + 1}` : "linha";
    return `${rowLabel} / ${columns[selectedCell.columnIndex] ?? "célula"}`;
  }, [entry.rows, selectedCell]);

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
    const lines = entry.boardText ? entry.boardText.split("\n") : [""];
    while (lines.length < 24) lines.push("");
    return lines;
  }, [entry.boardText]);

  const stats = useMemo(() => {
    const clientEntries = Object.values(entries).filter((item) => item.clientId === activeClientId);
    const activeDays = clientEntries.filter(hasContent).length;
    const rows = clientEntries.reduce((acc, item) => acc + countFilledRows(item), 0);
    const chars = entry.boardText.length;

    return { activeDays, rows, chars };
  }, [activeClientId, entries, entry.boardText]);

  useEffect(() => {
    setSelectedCell(null);
    setSelectedBoardLine(0);
  }, [activeKey]);

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
      const previous = current[activeKey] ?? entry;
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

  function updateBoardLine(lineIndex: number, value: string) {
    const nextLines = [...boardLines];
    nextLines[lineIndex] = value;
    updateEntry({ boardText: compactBoardLines(nextLines) });
  }

  function pasteBoardLines(lineIndex: number, event: ClipboardEvent<HTMLInputElement>) {
    const raw = event.clipboardData.getData("text");
    if (!raw || !/[\n\r]/.test(raw)) return;

    event.preventDefault();

    const pastedLines = pastedTextLines(raw);
    const nextLines = [...boardLines];
    pastedLines.forEach((line, offset) => {
      nextLines[lineIndex + offset] = line;
    });

    updateEntry({ boardText: compactBoardLines(nextLines) });
  }

  function focusBoardLine(lineIndex: number) {
    window.requestAnimationFrame(() => {
      document.querySelector<HTMLInputElement>(`[data-board-line="${lineIndex}"]`)?.focus();
    });
  }

  function ensureBoardLine(lineIndex: number) {
    if (lineIndex < boardLines.length) return;
    const nextLines = [...boardLines];
    nextLines[lineIndex] = "";
    updateEntry({ boardText: nextLines.join("\n") });
  }

  function getBoardLineStyle(lineIndex: number) {
    const key = boardLineStyleKey(lineIndex);
    return resolveBoardStyle({
      ...boardStyle,
      ...(entry.boardLineStyles?.[key] ?? {}),
    });
  }

  function updateBoardStyle(patch: Partial<BoardStyle>) {
    if (selectedBoardLine === null) {
      updateEntry({ boardStyle: { ...boardStyle, ...patch } });
      return;
    }

    updateEntry({
      boardLineStyles: {
        ...(entry.boardLineStyles ?? {}),
        [boardLineStyleKey(selectedBoardLine)]: { ...selectedBoardStyle, ...patch },
      },
    });
  }

  function clearBoardFormatting() {
    if (selectedBoardLine === null) {
      updateEntry({ boardStyle: DEFAULT_BOARD_STYLE, boardLineStyles: {} });
      return;
    }

    const nextStyles = { ...(entry.boardLineStyles ?? {}) };
    delete nextStyles[boardLineStyleKey(selectedBoardLine)];
    updateEntry({ boardLineStyles: nextStyles });
  }

  function getSheetCellStyle(rowId: string, columnIndex: number) {
    const key = cellStyleKey(rowId, columnIndex);
    return resolveSheetStyle({
      ...sheetStyle,
      ...(entry.sheetCellStyles?.[key] ?? {}),
    });
  }

  function updateSheetStyle(patch: Partial<SheetStyle>) {
    if (!selectedCellKey) {
      updateEntry({ sheetStyle: { ...sheetStyle, ...patch } });
      return;
    }

    updateEntry({
      sheetCellStyles: {
        ...(entry.sheetCellStyles ?? {}),
        [selectedCellKey]: { ...selectedSheetStyle, ...patch },
      },
    });
  }

  function clearSheetFormatting() {
    if (!selectedCellKey) {
      updateEntry({ sheetStyle: DEFAULT_SHEET_STYLE, sheetCellStyles: {} });
      return;
    }

    const nextStyles = { ...(entry.sheetCellStyles ?? {}) };
    delete nextStyles[selectedCellKey];
    updateEntry({ sheetCellStyles: nextStyles });
  }

  function addRow() {
    updateEntry({ rows: [...entry.rows, createRow()] });
  }

  function removeRow(rowId: string) {
    const rows = entry.rows.filter((row) => row.id !== rowId);
    const sheetCellStyles = Object.fromEntries(
      Object.entries(entry.sheetCellStyles ?? {}).filter(([key]) => !key.startsWith(`${rowId}:`))
    );
    if (selectedCell?.rowId === rowId) setSelectedCell(null);
    updateEntry({ rows: rows.length ? rows : [createRow()], sheetCellStyles });
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
        .spv-workstation {
          --ws-board-text: #d1fae5;
          --ws-sheet-text: #d1fae5;
        }

        html[data-spv-theme="light"] .spv-workstation {
          --ws-board-text: #12372b;
          --ws-sheet-text: #12372b;
        }

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

        html[data-spv-theme="light"] .spv-workstation .ws-board-line {
          caret-color: #059669;
        }

        html[data-spv-theme="light"] .spv-workstation .ws-board-line::placeholder {
          color: rgba(16, 32, 24, 0.36) !important;
        }

        html[data-spv-theme="light"] .spv-workstation table input {
          caret-color: #059669;
        }

        html[data-spv-theme="light"] .spv-workstation table input::placeholder {
          color: rgba(16, 32, 24, 0.32) !important;
        }

        html[data-spv-theme="light"] .spv-workstation select,
        html[data-spv-theme="light"] .spv-workstation input[type="date"],
        html[data-spv-theme="light"] .spv-workstation .ws-control-input {
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
                  className="ws-control-input h-10 w-full rounded-lg border border-white/10 bg-black/30 pl-9 pr-3 text-sm text-white outline-none placeholder:text-white/28 focus:border-emerald-300/35"
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
              <BoardFormatToolbar
                style={selectedBoardStyle}
                selected={selectedBoardLine !== null}
                selectedLabel={selectedBoardLabel}
                onChange={updateBoardStyle}
                onClear={clearBoardFormatting}
                onUseGlobal={() => setSelectedBoardLine(null)}
              />
              <div className="mt-3 overflow-hidden rounded-xl border border-white/10 bg-[#020403] font-mono">
                <div className="flex border-b border-white/8 bg-white/[0.025] px-3 py-2 text-[11px] text-white/35">
                  <span>{activeClient?.name ?? "cliente"}</span>
                  <span className="mx-2 text-white/18">/</span>
                  <span>{selectedDate}</span>
                </div>
                <div className="min-h-[610px]">
                  {boardLines.map((line, index) => {
                    const lineStyle = getBoardLineStyle(index);
                    const active = selectedBoardLine === index;

                    return (
                      <div key={index} className="grid grid-cols-[48px_1fr]">
                        <button
                          type="button"
                          onClick={() => setSelectedBoardLine(index)}
                          className={cn(
                            "select-none border-r border-white/8 bg-white/[0.018] px-3 text-right font-mono text-xs text-white/22 transition",
                            active && "bg-emerald-400/10 text-emerald-100"
                          )}
                          style={{
                            minHeight: "26px",
                            lineHeight: "26px",
                            fontFamily: boardFontFamily[lineStyle.font],
                          }}
                          aria-label={`Selecionar linha ${index + 1}`}
                        >
                          {index + 1}
                        </button>
                        <input
                          data-board-line={index}
                          value={line}
                          onChange={(event) => updateBoardLine(index, event.target.value)}
                          onFocus={() => setSelectedBoardLine(index)}
                          onPaste={(event) => pasteBoardLines(index, event)}
                          onKeyDown={(event) => {
                            if (event.key !== "Enter") return;
                            event.preventDefault();
                            const nextLine = index + 1;
                            ensureBoardLine(nextLine);
                            setSelectedBoardLine(nextLine);
                            focusBoardLine(nextLine);
                          }}
                          placeholder={index === 0 ? "Digite qualquer coisa aqui: vendas, datas, roteiro, defesa..." : ""}
                          className={cn(
                            "ws-board-line h-[26px] w-full border-0 bg-transparent px-4 outline-none placeholder:text-white/22 focus:bg-emerald-400/[0.055]",
                            active && "ring-1 ring-inset ring-emerald-300/50"
                          )}
                          style={boardStyleToCss(lineStyle)}
                        />
                      </div>
                    );
                  })}
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
              <SheetFormatToolbar
                style={selectedSheetStyle}
                selected={Boolean(selectedCellKey)}
                selectedLabel={selectedCellLabel}
                onChange={updateSheetStyle}
                onClear={clearSheetFormatting}
                onUseGlobal={() => setSelectedCell(null)}
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
                        {columns.map((column, index) => {
                          const currentCellStyle = getSheetCellStyle(row.id, index);
                          const isSelected =
                            selectedCell?.rowId === row.id && selectedCell.columnIndex === index;

                          return (
                            <td
                              key={`${row.id}-${column}`}
                              className={cn(
                                "border-r border-white/8 last:border-r-0",
                                isSelected && "ring-1 ring-inset ring-emerald-300/70"
                              )}
                            >
                              <input
                                value={row.cells[index] ?? ""}
                                onChange={(event) => updateCell(row.id, index, event.target.value)}
                                onFocus={() => setSelectedCell({ rowId: row.id, columnIndex: index })}
                                onPaste={(event) => pasteGrid(row.id, index, event)}
                                placeholder={column}
                                className="ws-sheet-cell h-10 w-full bg-transparent px-2 text-emerald-50 outline-none placeholder:text-white/18 focus:bg-emerald-400/[0.055]"
                                style={sheetStyleToCss(currentCellStyle)}
                              />
                            </td>
                          );
                        })}
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

function BoardFormatToolbar({
  style,
  selected,
  selectedLabel,
  onChange,
  onClear,
  onUseGlobal,
}: {
  style: BoardStyle;
  selected: boolean;
  selectedLabel: string;
  onChange: (patch: Partial<BoardStyle>) => void;
  onClear: () => void;
  onUseGlobal: () => void;
}) {
  return (
    <div className="mt-3 rounded-xl border border-white/10 bg-white/[0.025] p-2">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div className="font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-white/42">
          formatando: <span className="text-emerald-100/80">{selectedLabel}</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onUseGlobal}
            disabled={!selected}
            className="h-7 rounded-lg border border-white/10 bg-black/20 px-2 text-[11px] font-semibold text-white/55 transition hover:bg-white/[0.05] hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
          >
            lousa toda
          </button>
          <button
            type="button"
            onClick={onClear}
            className="h-7 rounded-lg border border-white/10 bg-black/20 px-2 text-[11px] font-semibold text-white/55 transition hover:bg-white/[0.05] hover:text-white"
          >
            limpar estilo
          </button>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <ToolbarGroup icon={Type} label="Texto">
          <SizeControl value={style.size} onChange={(size) => onChange({ size })} />
          <ToggleButton
            active={style.weight === "bold"}
            title="Negrito"
            onClick={() => onChange({ weight: style.weight === "bold" ? "regular" : "bold" })}
          >
            <Bold className="h-3.5 w-3.5" aria-hidden={true} />
          </ToggleButton>
          <ToggleButton
            active={style.italic}
            title="Itálico"
            onClick={() => onChange({ italic: !style.italic })}
          >
            <Italic className="h-3.5 w-3.5" aria-hidden={true} />
          </ToggleButton>
          <SegmentButton active={style.font === "mono"} onClick={() => onChange({ font: "mono" })}>
            Mono
          </SegmentButton>
          <SegmentButton active={style.font === "sans"} onClick={() => onChange({ font: "sans" })}>
            Sans
          </SegmentButton>
        </ToolbarGroup>

        <ToolbarGroup icon={AlignLeft} label="Alinhar">
          <AlignControl value={style.align} onChange={(align) => onChange({ align })} />
        </ToolbarGroup>

        <ColorControl
          icon={Palette}
          label="Cor"
          colors={textSwatches}
          value={style.color}
          fallback="#d1fae5"
          onChange={(color) => onChange({ color })}
        />

        <ColorControl
          icon={PaintBucket}
          label="Fundo"
          colors={fillSwatches}
          value={style.background}
          fallback="#052e22"
          onChange={(background) => onChange({ background })}
        />
      </div>
    </div>
  );
}

function SheetFormatToolbar({
  style,
  selected,
  selectedLabel,
  onChange,
  onClear,
  onUseGlobal,
}: {
  style: SheetStyle;
  selected: boolean;
  selectedLabel: string;
  onChange: (patch: Partial<SheetStyle>) => void;
  onClear: () => void;
  onUseGlobal: () => void;
}) {
  return (
    <div className="mt-3 rounded-xl border border-white/10 bg-white/[0.025] p-2">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div className="font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-white/42">
          formatando: <span className="text-emerald-100/80">{selectedLabel}</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onUseGlobal}
            disabled={!selected}
            className="h-7 rounded-lg border border-white/10 bg-black/20 px-2 text-[11px] font-semibold text-white/55 transition hover:bg-white/[0.05] hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
          >
            planilha toda
          </button>
          <button
            type="button"
            onClick={onClear}
            className="h-7 rounded-lg border border-white/10 bg-black/20 px-2 text-[11px] font-semibold text-white/55 transition hover:bg-white/[0.05] hover:text-white"
          >
            limpar estilo
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <ToolbarGroup icon={Type} label="Texto">
          <SizeControl value={style.size} onChange={(size) => onChange({ size })} />
          <ToggleButton
            active={style.weight === "bold"}
            title="Negrito"
            onClick={() => onChange({ weight: style.weight === "bold" ? "regular" : "bold" })}
          >
            <Bold className="h-3.5 w-3.5" aria-hidden={true} />
          </ToggleButton>
          <ToggleButton
            active={style.italic}
            title="Itálico"
            onClick={() => onChange({ italic: !style.italic })}
          >
            <Italic className="h-3.5 w-3.5" aria-hidden={true} />
          </ToggleButton>
        </ToolbarGroup>

        <ToolbarGroup icon={AlignLeft} label="Alinhar">
          <AlignControl value={style.align} onChange={(align) => onChange({ align })} />
        </ToolbarGroup>

        <ColorControl
          icon={Palette}
          label="Cor"
          colors={textSwatches}
          value={style.color}
          fallback="#d1fae5"
          onChange={(color) => onChange({ color })}
        />

        <ColorControl
          icon={PaintBucket}
          label="Fundo"
          colors={fillSwatches}
          value={style.background}
          fallback="#052e22"
          onChange={(background) => onChange({ background })}
        />
      </div>
    </div>
  );
}

function ToolbarGroup({
  icon: Icon,
  label,
  children,
}: {
  icon: ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-9 items-center gap-1 rounded-lg border border-white/10 bg-black/20 px-2 py-1">
      <Icon className="h-3.5 w-3.5 shrink-0 text-emerald-200/65" aria-hidden={true} />
      <span className="mr-1 hidden font-mono text-[10px] font-semibold uppercase tracking-wide text-white/35 sm:inline">
        {label}
      </span>
      {children}
    </div>
  );
}

function SizeControl({ value, onChange }: { value: TextSize; onChange: (value: TextSize) => void }) {
  const options: Array<{ value: TextSize; label: string; title: string }> = [
    { value: "sm", label: "P", title: "Texto pequeno" },
    { value: "md", label: "M", title: "Texto médio" },
    { value: "lg", label: "G", title: "Texto grande" },
  ];

  return (
    <div className="flex rounded-md border border-white/10 bg-black/20 p-0.5">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          title={option.title}
          aria-pressed={value === option.value}
          onClick={() => onChange(option.value)}
          className={cn(
            "h-6 min-w-6 rounded px-1.5 text-[11px] font-bold transition",
            value === option.value
              ? "bg-emerald-300 text-emerald-950"
              : "text-white/55 hover:bg-white/[0.06] hover:text-white"
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

function AlignControl({ value, onChange }: { value: TextAlign; onChange: (value: TextAlign) => void }) {
  const options: Array<{
    value: TextAlign;
    label: string;
    icon: ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
  }> = [
    { value: "left", label: "Alinhar à esquerda", icon: AlignLeft },
    { value: "center", label: "Centralizar", icon: AlignCenter },
    { value: "right", label: "Alinhar à direita", icon: AlignRight },
  ];

  return (
    <div className="flex rounded-md border border-white/10 bg-black/20 p-0.5">
      {options.map((option) => {
        const Icon = option.icon;
        return (
          <button
            key={option.value}
            type="button"
            title={option.label}
            aria-pressed={value === option.value}
            onClick={() => onChange(option.value)}
            className={cn(
              "inline-flex h-6 w-7 items-center justify-center rounded transition",
              value === option.value
                ? "bg-emerald-300 text-emerald-950"
                : "text-white/55 hover:bg-white/[0.06] hover:text-white"
            )}
          >
            <Icon className="h-3.5 w-3.5" aria-hidden={true} />
          </button>
        );
      })}
    </div>
  );
}

function ToggleButton({
  active,
  title,
  onClick,
  children,
}: {
  active: boolean;
  title: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      title={title}
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "inline-flex h-7 w-7 items-center justify-center rounded-md border border-white/10 transition",
        active
          ? "bg-emerald-300 text-emerald-950"
          : "bg-black/20 text-white/55 hover:bg-white/[0.06] hover:text-white"
      )}
    >
      {children}
    </button>
  );
}

function SegmentButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "h-7 rounded-md border border-white/10 px-2 text-[11px] font-bold transition",
        active
          ? "bg-emerald-300 text-emerald-950"
          : "bg-black/20 text-white/55 hover:bg-white/[0.06] hover:text-white"
      )}
    >
      {children}
    </button>
  );
}

function ColorControl({
  icon: Icon,
  label,
  colors,
  value,
  fallback,
  onChange,
}: {
  icon: ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
  label: string;
  colors: Array<{ label: string; value: string }>;
  value: string;
  fallback: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="flex min-h-9 items-center gap-1 rounded-lg border border-white/10 bg-black/20 px-2 py-1">
      <Icon className="h-3.5 w-3.5 shrink-0 text-emerald-200/65" aria-hidden={true} />
      <span className="mr-1 hidden font-mono text-[10px] font-semibold uppercase tracking-wide text-white/35 sm:inline">
        {label}
      </span>
      {colors.map((color) => (
        <button
          key={`${label}-${color.value}`}
          type="button"
          title={color.label}
          aria-label={`${label}: ${color.label}`}
          aria-pressed={value === color.value}
          onClick={() => onChange(color.value)}
          className={cn(
            "h-6 w-6 rounded-full border transition hover:scale-105",
            value === color.value ? "border-emerald-200 ring-2 ring-emerald-300/35" : "border-white/18"
          )}
          style={
            color.value === "transparent"
              ? {
                  backgroundImage:
                    "linear-gradient(135deg, rgba(255,255,255,.18) 25%, transparent 25%, transparent 50%, rgba(255,255,255,.18) 50%, rgba(255,255,255,.18) 75%, transparent 75%, transparent)",
                  backgroundSize: "8px 8px",
                }
              : { backgroundColor: color.value }
          }
        />
      ))}
      <input
        type="color"
        title={`${label}: cor personalizada`}
        aria-label={`${label}: cor personalizada`}
        value={colorInputValue(value, fallback)}
        onChange={(event) => onChange(event.target.value)}
        className="h-6 w-7 cursor-pointer rounded-md border border-white/12 bg-transparent p-0.5"
      />
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
