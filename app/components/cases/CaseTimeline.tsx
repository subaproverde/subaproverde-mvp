"use client";

import React, { useEffect, useState } from "react";

type CaseEventRow = {
  id: string;
  case_id: string;
  type: string;
  payload: any;
  actor_user_id?: string | null;
  created_at: string;
};

function fmt(iso?: string) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("pt-BR");
  } catch {
    return String(iso);
  }
}

function titleFor(type: string) {
  if (type === "note_added") return "Nota adicionada";
  if (type === "protocol_set") return "Protocolo atualizado";
  if (type === "status_changed") return "Status alterado";
  if (type === "priority_changed") return "Prioridade alterada";
  if (type === "assigned_changed") return "Responsável alterado";
  if (type === "due_date_changed") return "SLA / Prazo alterado";
  return type;
}

function descFor(type: string, payload: any) {
  const p = payload ?? {};

  if (type === "note_added") return p.note ? String(p.note) : "—";

  if (type === "protocol_set") return `De: ${p.from || "—"} → Para: ${p.to || "—"}`;

  if (type === "status_changed") return `De: ${p.from || "—"} → Para: ${p.to || "—"}`;

  if (type === "priority_changed") return `De: ${p.from || "—"} → Para: ${p.to || "—"}`;

  if (type === "assigned_changed") return `De: ${p.from || "—"} → Para: ${p.to || "—"}`;

  if (type === "due_date_changed") return `De: ${p.from || "—"} → Para: ${p.to || "—"}`;

  return JSON.stringify(p);
}

export function CaseTimeline({ caseId }: { caseId: string }) {
  const [loading, setLoading] = useState(false);
  const [events, setEvents] = useState<CaseEventRow[]>([]);
  const [err, setErr] = useState<string>("");

  async function load() {
    if (!caseId) return;
    setLoading(true);
    setErr("");

    try {
      const r = await fetch(`/api/cases/events/list?caseId=${encodeURIComponent(caseId)}`, {
        cache: "no-store",
      });

      const j = await r.json().catch(() => ({}));

      if (!r.ok || !j?.ok) {
        setErr(j?.error ?? "Erro ao carregar timeline.");
        setEvents([]);
        return;
      }

      setEvents(j.events ?? []);
    } catch (e: any) {
      setErr(e?.message ?? "Erro ao carregar timeline.");
      setEvents([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [caseId]);

  return (
    <div className="rounded-2xl border p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="text-sm font-medium">Timeline</div>
        <button
          className="rounded-xl border px-3 py-2 hover:bg-accent text-sm"
          onClick={load}
          disabled={loading}
        >
          {loading ? "Carregando..." : "Recarregar"}
        </button>
      </div>

      {err && <div className="text-sm text-red-600">{err}</div>}

      {!err && events.length === 0 && (
        <div className="text-sm text-muted-foreground">
          {loading ? "Carregando..." : "Sem eventos ainda."}
        </div>
      )}

      <div className="space-y-2">
        {events.map((ev) => (
          <div key={ev.id} className="rounded-2xl border p-3">
            <div className="flex items-center justify-between gap-3">
              <div className="font-medium text-sm">{titleFor(ev.type)}</div>
              <div className="text-xs text-muted-foreground">{fmt(ev.created_at)}</div>
            </div>

            <div className="text-sm mt-2">{descFor(ev.type, ev.payload)}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
  