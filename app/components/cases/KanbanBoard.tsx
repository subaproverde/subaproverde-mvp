"use client";

import React from "react";

export type StatusCol = { key: string; label: string };
export type KanbanItem = { id: string; status: string };

type Props = {
  columns: StatusCol[];
  items: KanbanItem[];
  onOpen: (it: KanbanItem) => void;
  onMove: (caseId: string, toStatus: string) => Promise<void> | void;
  renderCard: (it: KanbanItem) => React.ReactNode;
};

export function KanbanBoard({ columns, items, onOpen, onMove, renderCard }: Props) {
  const byStatus: Record<string, KanbanItem[]> = {};
  for (const c of columns) byStatus[c.key] = [];
  for (const it of items) {
    const k = (it.status ?? "").trim();
    if (!byStatus[k]) byStatus[k] = [];
    byStatus[k].push(it);
  }

  function handleDragStart(e: React.DragEvent, it: KanbanItem) {
    e.dataTransfer.setData("text/plain", it.id);
    e.dataTransfer.effectAllowed = "move";
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  }

  async function handleDrop(e: React.DragEvent, toStatus: string) {
    e.preventDefault();
    const id = (e.dataTransfer.getData("text/plain") || "").trim();
    const s = (toStatus || "").trim();
    if (!id || !s) return;
    await onMove(id, s);
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 xl:grid-cols-4 gap-4">
      {columns.map((col) => (
        <div key={col.key} className="rounded-2xl border bg-white shadow-sm overflow-hidden">
          <div className="p-4 border-b flex justify-between">
            <div className="font-medium">{col.label}</div>
            <div className="text-xs text-muted-foreground">{byStatus[col.key]?.length ?? 0}</div>
          </div>

          {/* ✅ drop target é SEMPRE col.key */}
          <div
            className="p-3 space-y-3 min-h-[220px]"
            onDragOver={handleDragOver}
            onDrop={(e) => handleDrop(e, col.key)}
          >
            {(byStatus[col.key] ?? []).map((it) => (
              <div
                key={it.id}
                draggable
                onDragStart={(e) => handleDragStart(e, it)}
                onDoubleClick={() => onOpen(it)}
                className="cursor-grab active:cursor-grabbing"
              >
                {renderCard(it)}
              </div>
            ))}

            {(byStatus[col.key] ?? []).length === 0 && (
              <div className="text-sm text-muted-foreground p-3">Sem itens.</div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
