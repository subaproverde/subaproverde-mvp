"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { supabaseBrowser } from "@/lib/supabaseClient";

type ImpactType = "reclamacoes" | "atrasos" | "cancelamentos" | "mediacoes";

type ImpactItem = {
  id: string;
  type: ImpactType;
  title: string;
  reason: string;
  createdAt: string;
  updatedAt: string;
  ageLabel: string;
  buyerName: string;
  statusPill?: string;
  chip?: string;
  source?: string;
  claimId?: string | null;
  orderId?: string | null;
  shipmentId?: string | null;
};

type Message = {
  id: string;
  from: "seller" | "buyer";
  text: string;
  time: string;
  name?: string;
};

const ROUTES = {
  dashboard: "/app",
};

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function MetricCard({
  labelTop,
  value,
  labelBottom,
  tint,
}: {
  labelTop: string;
  value: number;
  labelBottom: string;
  tint: "green" | "amber" | "rose" | "sky";
}) {
  const tintMap = {
    green: "bg-emerald-50/80 border-emerald-200 text-emerald-800",
    amber: "bg-amber-50/80 border-amber-200 text-amber-800",
    rose: "bg-rose-50/80 border-rose-200 text-rose-800",
    sky: "bg-sky-50/80 border-sky-200 text-sky-800",
  } as const;

  return (
    <div
      className={cn(
        "rounded-2xl border px-4 py-3 shadow-[0_10px_40px_rgba(2,6,23,0.05)]",
        tintMap[tint]
      )}
    >
      <div className="text-[11px] font-semibold opacity-80">{labelTop}</div>
      <div className="mt-1 text-2xl font-extrabold leading-none">{value}</div>
      <div className="mt-1 text-[12px] font-semibold opacity-90">{labelBottom}</div>
    </div>
  );
}

function SmallPill({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full border border-black/10 bg-white/70 px-2 py-0.5 text-[11px] font-semibold text-slate-200">
      {children}
    </span>
  );
}

function ButtonPrimary({
  children,
  onClick,
}: {
  children: React.ReactNode;
  onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="inline-flex items-center justify-center rounded-xl bg-gradient-to-b from-emerald-600 to-emerald-700 px-4 py-2 text-sm font-semibold text-white shadow-[0_18px_55px_rgba(16,185,129,0.22)] hover:from-emerald-700 hover:to-emerald-800"
    >
      {children}
    </button>
  );
}

function ButtonGhost({
  children,
  onClick,
}: {
  children: React.ReactNode;
  onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="inline-flex items-center justify-center rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-white/85 hover:bg-white/10"
    >
      {children}
    </button>
  );
}

function TabButton({
  active,
  children,
  onClick,
}: {
  active: boolean;
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "rounded-2xl px-4 py-2 text-[13px] font-extrabold transition",
        active
          ? "bg-white/10 border border-white/10 text-white shadow-[0_12px_45px_rgba(0,0,0,0.25)]"
          : "text-white/65 hover:text-white"
      )}
    >
      {children}
    </button>
  );
}

function ImpactRow({
  item,
  selected,
  onSelect,
}: {
  item: ImpactItem;
  selected: boolean;
  onSelect: () => void;
}) {
  const leftBorder = cn(selected ? "border-emerald-300" : "border-white/10", "border");

  return (
    <div
      onClick={onSelect}
      className={cn(
        "cursor-pointer rounded-2xl bg-white/5 backdrop-blur-xl px-4 py-4 shadow-[0_16px_60px_rgba(0,0,0,0.25)] transition",
        "hover:shadow-[0_22px_80px_rgba(0,0,0,0.35)]",
        leftBorder
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            {item.chip && (
              <span className="inline-flex items-center rounded-full bg-emerald-500/15 text-emerald-200 border border-white/10 px-2 py-0.5 text-[11px] font-semibold">
                {item.chip}
              </span>
            )}
            <span className="text-[12px] text-white/60">{item.ageLabel}</span>
          </div>

          <div className="mt-2 text-[15px] font-bold text-white leading-snug">{item.title}</div>
          <div className="mt-1 text-[12px] text-white/70 leading-relaxed line-clamp-2">{item.reason}</div>

          <div className="mt-3 grid grid-cols-2 md:grid-cols-4 gap-2 text-[11px] text-white/60">
            <div className="flex items-center gap-2">
              <span className="opacity-70">Vendida:</span>
              <span className="font-semibold text-white/75">{item.createdAt}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="opacity-70">Atual.:</span>
              <span className="font-semibold text-white/75">{item.updatedAt}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="opacity-70">Status:</span>
              <span className="font-semibold text-white/75">{item.statusPill ?? "-"}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="opacity-70">Comprador:</span>
              <span className="font-semibold text-white/75 truncate">{item.buyerName}</span>
            </div>
          </div>
        </div>

        <div className="shrink-0 flex flex-col items-end gap-2">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onSelect();
            }}
            className="rounded-xl bg-gradient-to-b from-emerald-600 to-emerald-700 px-4 py-2 text-[12px] font-semibold text-white shadow-[0_14px_50px_rgba(16,185,129,0.18)] hover:from-emerald-700 hover:to-emerald-800"
          >
            Ver detalhes
          </button>
          <button
            onClick={(e) => e.stopPropagation()}
            className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-[12px] font-semibold text-white/85 hover:bg-white/10"
          >
            WhatsApp
          </button>
        </div>
      </div>
    </div>
  );
}

function ChatBubble({ msg }: { msg: Message }) {
  const isSeller = msg.from === "seller";

  return (
    <div className={cn("flex", isSeller ? "justify-end" : "justify-start")}>
      <div className={cn("max-w-[78%] flex items-end gap-2", isSeller ? "flex-row-reverse" : "flex-row")}>
        <div className="h-9 w-9 rounded-2xl bg-white/10 border border-white/10 shrink-0" />

        <div className={cn("min-w-0", isSeller ? "text-right" : "text-left")}>
          <div className={cn("text-[11px] font-semibold text-white/65", isSeller ? "pr-2" : "pl-2")}>
            {msg.name ?? (isSeller ? "Seller" : "Comprador")} • {msg.time}
          </div>

          <div
            className={cn(
              "mt-1 rounded-2xl px-4 py-3 text-[13px] leading-relaxed border",
              isSeller
                ? "bg-emerald-700 text-white border-emerald-800/30 shadow-[0_16px_55px_rgba(16,185,129,0.18)]"
                : "bg-white/5 text-white border-white/10 shadow-[0_16px_55px_rgba(0,0,0,0.25)]"
            )}
          >
            {msg.text}
          </div>
        </div>
      </div>
    </div>
  );
}

function normalizeCasesResponse(json: any): ImpactItem[] {
  const rawList =
    (json?.cases as any[]) ||
    (json?.items as any[]) ||
    (Array.isArray(json) ? json : []);

  return (rawList ?? []).map((c: any, idx: number) => {
    const kind = String(c?.kind ?? c?.type ?? "").toLowerCase();

    let type: ImpactType = "reclamacoes";

    if (
      kind.includes("reclamacoes") ||
      kind.includes("reclamação") ||
      kind.includes("reclamacao") ||
      kind.includes("claim")
    ) {
      type = "reclamacoes";
    } else if (
      kind.includes("atrasos") ||
      kind.includes("atraso") ||
      kind.includes("delay") ||
      kind.includes("late")
    ) {
      type = "atrasos";
    } else if (
      kind.includes("cancelamentos") ||
      kind.includes("cancelamento") ||
      kind.includes("cancel")
    ) {
      type = "cancelamentos";
    } else if (
      kind.includes("mediacoes") ||
      kind.includes("mediações") ||
      kind.includes("mediacao") ||
      kind.includes("mediação") ||
      kind.includes("mediation")
    ) {
      type = "mediacoes";
    }

    const id = String(c?.id ?? c?.external_ref ?? c?.claim_id ?? idx);

    return {
      id,
      type,
      chip: c?.external_ref
        ? String(c.external_ref)
        : c?.claim_id
        ? `#${c.claim_id}`
        : c?.chip
        ? String(c.chip)
        : undefined,
      title: String(c?.title ?? c?.reason ?? c?.type ?? "Caso"),
      reason: String(c?.note ?? c?.description ?? c?.details ?? c?.reason ?? "—"),
      createdAt: String(c?.createdAt ?? c?.created_at ?? c?.date_created ?? "—"),
      updatedAt: String(c?.updatedAt ?? c?.updated_at ?? c?.last_updated ?? "—"),
      ageLabel: String(c?.ageLabel ?? c?.age_label ?? c?.time_ago ?? "—"),
      buyerName: String(c?.buyerName ?? c?.buyer_name ?? c?.buyer?.nickname ?? "Comprador"),
      statusPill: String(c?.statusPill ?? c?.status ?? c?.status_pill ?? "—"),
      source: c?.source ? String(c.source) : undefined,
      claimId: c?.claimId ? String(c.claimId) : null,
      orderId: c?.orderId ? String(c.orderId) : null,
      shipmentId: c?.shipmentId ? String(c.shipmentId) : null,
    };
  });
}

export default function CasesPage() {
  const [activeTab, setActiveTab] = useState<ImpactType>("reclamacoes");
  const [loading, setLoading] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<ImpactItem[]>([]);
  const [sellerId, setSellerId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string>("");
  const [detailsOpen, setDetailsOpen] = useState(false);

  const [apiCounts, setApiCounts] = useState<{
    reclamacoes: number;
    atrasos: number;
    cancelamentos: number;
    mediacoes: number;
  } | null>(null);

  const [messages, setMessages] = useState<Message[]>([]);

  function openDetails(itemId: string) {
    setSelectedId(itemId);
    setDetailsOpen(true);
  }

  function closeDetails() {
    setDetailsOpen(false);
  }

  const counts = useMemo(() => {
    if (apiCounts) return apiCounts;

    const base = { reclamacoes: 0, atrasos: 0, cancelamentos: 0, mediacoes: 0 };
    for (const it of items) base[it.type] = (base[it.type] ?? 0) + 1;
    return base;
  }, [items, apiCounts]);

  const filtered = useMemo(() => items.filter((x) => x.type === activeTab), [items, activeTab]);

  const selected = useMemo(() => items.find((x) => x.id === selectedId) ?? items[0], [items, selectedId]);

  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        console.log("🔥 CASES /app/cases/page RODANDO 🔥");
        setLoading(true);
        setError(null);

        const { data } = await supabaseBrowser.auth.getUser();
        const user = data?.user;

        console.log("[cases] user =", user);

        if (!user?.id) throw new Error("Você não está logado. Faça login novamente.");

        let sid: string | null = null;

        console.log("[cases] localStorage activeSellerId =", localStorage.getItem("activeSellerId"));

        try {
          sid = localStorage.getItem("activeSellerId");
        } catch (err) {
          console.log("[cases] erro lendo localStorage =", err);
        }

        if (!sid) {
          console.log("[cases] sem activeSellerId, fallback /api/me/seller");

          const rSeller = await fetch(`/api/me/seller?userId=${encodeURIComponent(user.id)}`, {
            cache: "no-store",
          });

          const jSeller = await rSeller.json().catch(() => ({}));

          console.log("[cases] resposta /api/me/seller =", jSeller);

          if (!rSeller.ok || !jSeller?.sellerId) {
            throw new Error(jSeller?.error ?? "Não foi possível identificar o seller desta conta.");
          }

          sid = String(jSeller.sellerId);

          try {
            localStorage.setItem("activeSellerId", sid);
            console.log("[cases] salvou activeSellerId fallback =", sid);
          } catch (err) {
            console.log("[cases] erro salvando localStorage =", err);
          }
        }

        console.log("[cases] usando sellerId =", sid);

        setSellerId(sid);

        const res = await fetch(`/api/ml/cases?sellerId=${encodeURIComponent(sid)}`, {
          cache: "no-store",
        });

        const json = await res.json().catch(() => ({}));

        if (json?.counts) {
          setApiCounts({
            reclamacoes: Number(json.counts.reclamacoes ?? 0),
            atrasos: Number(json.counts.atrasos ?? 0),
            cancelamentos: Number(json.counts.cancelamentos ?? 0),
            mediacoes: Number(json.counts.mediacoes ?? 0),
          });
        }

        console.log("[cases] resposta /api/ml/cases =", json);

        if (!res.ok || json?.ok === false) {
          throw new Error(json?.error ?? `Falha ao buscar cases (${res.status})`);
        }

        const norm = normalizeCasesResponse(json);

        if (!alive) return;

        setItems(norm);
        setSelectedId(norm[0]?.id ?? "");
      } catch (e: any) {
        if (!alive) return;
        console.log("[cases] erro =", e);
        setError(e?.message ?? "Erro desconhecido");
        setItems([]);
      } finally {
        if (!alive) return;
        setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    let alive = true;

    (async () => {
      if (!sellerId || !selected?.claimId || !detailsOpen) {
        setMessages([]);
        return;
      }

      try {
        setLoadingMessages(true);

        const res = await fetch(
          `/api/ml/cases/messages?caseId=${encodeURIComponent(selected.claimId)}&sellerId=${encodeURIComponent(
            sellerId
          )}`,
          { cache: "no-store" }
        );

        const json = await res.json().catch(() => ({}));

        console.log("[cases] resposta /api/ml/cases/messages =", json);

        if (!alive) return;

        if (!res.ok || json?.ok === false) {
          setMessages([]);
          return;
        }

        const msgs: Message[] = (json?.messages ?? []).map((m: any, i: number) => ({
          id: String(m?.id ?? i),
          from: String(m?.from ?? "").toLowerCase().includes("seller") ? "seller" : "buyer",
          text: String(m?.message ?? m?.text ?? "—"),
          time: m?.date_created
            ? new Date(m.date_created).toLocaleTimeString("pt-BR", {
                hour: "2-digit",
                minute: "2-digit",
              })
            : "--:--",
          name: String(m?.from ?? "").toLowerCase().includes("seller") ? "Você" : "Comprador",
        }));

        setMessages(msgs);
      } catch (err) {
        console.log("[cases] erro carregando mensagens =", err);
        if (!alive) return;
        setMessages([]);
      } finally {
        if (!alive) return;
        setLoadingMessages(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [sellerId, selected?.claimId, detailsOpen]);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setDetailsOpen(false);
      }
    }

    if (detailsOpen) {
      document.body.style.overflow = "hidden";
      window.addEventListener("keydown", onKeyDown);
    }

    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [detailsOpen]);

  return (
    <div className="mx-auto max-w-[1120px] px-6 lg:px-8 py-8">
      <div className="flex items-start justify-between gap-6">
        <div>
          <Link
            href={ROUTES.dashboard}
            className="inline-flex items-center gap-2 text-[12px] font-semibold text-emerald-200/90 hover:text-emerald-200"
          >
            <span className="inline-block h-2 w-2 rounded-full bg-emerald-500" />
            Voltar ao Dashboard
          </Link>

          <h1 className="mt-2 text-[34px] leading-tight font-extrabold text-white">
            Casos e Reclamações
          </h1>

          <p className="mt-1 text-[13px] text-white/70">
            {loading
              ? "Carregando dados..."
              : "Visualize impactos por categoria e abra detalhes da venda + mensagens."}
          </p>

          {!!sellerId && (
            <p className="mt-1 text-[12px] text-white/45">
              sellerId: <span className="font-mono">{sellerId}</span>
            </p>
          )}

          {error && (
            <div className="mt-3 rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-[12px] text-rose-200">
              {error}
            </div>
          )}
        </div>

        <div className="hidden sm:flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl px-4 py-3 shadow-[0_18px_70px_rgba(0,0,0,0.35)]">
          <div className="h-10 w-10 rounded-2xl bg-white/10 border border-white/10" />
          <div className="leading-tight">
            <div className="text-[13px] font-extrabold text-white">Marcela Lima</div>
            <div className="text-[11px] text-emerald-200/90 font-semibold">
              Reputação • ações & sugestões
            </div>
          </div>
        </div>
      </div>

      <section className="mt-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <MetricCard
            labelTop="Reclamações"
            value={counts.reclamacoes}
            labelBottom="impactos"
            tint="green"
          />
          <MetricCard
            labelTop="Atrasos"
            value={counts.atrasos}
            labelBottom="impactos"
            tint="amber"
          />
          <MetricCard
            labelTop="Cancelamentos"
            value={counts.cancelamentos}
            labelBottom="impactos"
            tint="rose"
          />
          <MetricCard
            labelTop="Mediações"
            value={counts.mediacoes}
            labelBottom="impactos"
            tint="sky"
          />
        </div>
      </section>

      <section className="mt-6 rounded-[26px] border border-white/10 bg-white/5 backdrop-blur-xl shadow-[0_24px_100px_rgba(0,0,0,0.35)] overflow-hidden">
        <div className="px-5 pt-4">
          <div className="flex items-center gap-2">
            <TabButton active={activeTab === "reclamacoes"} onClick={() => setActiveTab("reclamacoes")}>
              Reclamações
            </TabButton>
            <TabButton active={activeTab === "atrasos"} onClick={() => setActiveTab("atrasos")}>
              Atrasos
            </TabButton>
            <TabButton active={activeTab === "cancelamentos"} onClick={() => setActiveTab("cancelamentos")}>
              Cancelamentos
            </TabButton>
            <TabButton active={activeTab === "mediacoes"} onClick={() => setActiveTab("mediacoes")}>
              Mediações
            </TabButton>
          </div>
        </div>

        <div className="p-5 space-y-4">
          {!loading && filtered.length === 0 && (
            <div className="rounded-2xl border border-white/10 bg-white/5 p-5 text-[13px] text-white/70">
              Nenhum item nessa categoria.
            </div>
          )}

          {filtered.map((it) => (
            <ImpactRow
              key={it.id}
              item={it}
              selected={it.id === selectedId}
              onSelect={() => openDetails(it.id)}
            />
          ))}
        </div>
      </section>

      {detailsOpen && selected && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
          onClick={closeDetails}
        >
          <div
            className="w-full max-w-6xl max-h-[90vh] overflow-auto rounded-[28px] border border-white/10 bg-[#0e1622] shadow-[0_30px_120px_rgba(0,0,0,0.55)]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-white/10 bg-[#0e1622]/95 backdrop-blur px-5 py-4">
              <div>
                <div className="text-[18px] font-extrabold text-white">Detalhes do caso</div>
                <div className="mt-1 text-[12px] text-white/60">
                  {selected.title} {selected.chip ? `• ${selected.chip}` : ""}
                </div>
              </div>

              <div className="flex items-center gap-2">
                <SmallPill>{selected?.source ? `Fonte: ${selected.source}` : "API (parcial)"}</SmallPill>
                <ButtonGhost onClick={closeDetails}>Fechar</ButtonGhost>
              </div>
            </div>

            <div className="grid grid-cols-12 gap-4 p-5">
              <div className="col-span-12 lg:col-span-4">
                <div className="rounded-[26px] border border-white/10 bg-white/5 backdrop-blur-xl shadow-[0_22px_90px_rgba(0,0,0,0.35)] p-5">
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-[12px] font-extrabold text-white">Detalhes do caso</div>
                    <SmallPill>{selected?.source ? `Fonte: ${selected.source}` : "API (parcial)"}</SmallPill>
                  </div>

                  <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-4">
                    <div className="text-[12px] font-extrabold text-white">{selected?.chip ?? "#—"}</div>
                    <div className="mt-1 text-[13px] font-bold text-white">{selected?.title ?? "-"}</div>
                    <div className="mt-2 text-[12px] text-white/65">{selected?.reason ?? "-"}</div>

                    <div className="mt-4 grid grid-cols-2 gap-2 text-[11px] text-white/65">
                      <div>
                        <div className="opacity-75">Criada</div>
                        <div className="font-semibold text-white/80">{selected?.createdAt ?? "-"}</div>
                      </div>
                      <div>
                        <div className="opacity-75">Status</div>
                        <div className="font-semibold text-white/80">{selected?.statusPill ?? "-"}</div>
                      </div>
                      <div>
                        <div className="opacity-75">Atualização</div>
                        <div className="font-semibold text-white/80">{selected?.updatedAt ?? "-"}</div>
                      </div>
                      <div>
                        <div className="opacity-75">Idade</div>
                        <div className="font-semibold text-white/80">{selected?.ageLabel ?? "-"}</div>
                      </div>
                      <div>
                        <div className="opacity-75">Comprador</div>
                        <div className="font-semibold text-white/80">{selected?.buyerName ?? "-"}</div>
                      </div>
                      <div>
                        <div className="opacity-75">Tipo</div>
                        <div className="font-semibold text-white/80 capitalize">{selected?.type ?? "-"}</div>
                      </div>
                      <div>
                        <div className="opacity-75">Claim ID</div>
                        <div className="font-semibold text-white/80">{selected?.claimId ?? "-"}</div>
                      </div>
                      <div>
                        <div className="opacity-75">Order ID</div>
                        <div className="font-semibold text-white/80">{selected?.orderId ?? "-"}</div>
                      </div>
                      <div>
                        <div className="opacity-75">Shipment ID</div>
                        <div className="font-semibold text-white/80">{selected?.shipmentId ?? "-"}</div>
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 flex items-center justify-between gap-3">
                    <ButtonGhost>Suporte</ButtonGhost>
                    <ButtonPrimary>Ação sugerida</ButtonPrimary>
                  </div>

                  <div className="mt-4 text-[11px] text-white/60 leading-relaxed">
                    Agora o painel já está preparado para receber detalhes reais do caso selecionado e mensagens reais da claim.
                  </div>
                </div>
              </div>

              <div className="col-span-12 lg:col-span-8">
                <div className="rounded-[26px] border border-white/10 bg-white/5 backdrop-blur-xl shadow-[0_22px_90px_rgba(0,0,0,0.35)] p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3">
                      <div className="h-11 w-11 rounded-2xl bg-white/10 border border-white/10" />
                      <div className="leading-tight">
                        <div className="text-[13px] font-extrabold text-white">
                          {selected?.buyerName ?? "Comprador"}
                        </div>
                        <div className="mt-0.5 text-[11px] text-white/60 font-semibold">
                          Histórico de mensagens
                        </div>
                      </div>
                    </div>

                    <span className="inline-flex items-center rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-[11px] font-extrabold text-white/80">
                      {selected?.claimId ? "Mensagens reais" : "Sem claim para mensagens"}
                    </span>
                  </div>

                  <div className="mt-5 space-y-3">
                    {loadingMessages ? (
                      <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-[13px] text-white/70">
                        Carregando mensagens...
                      </div>
                    ) : !selected?.claimId ? (
                      <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-[13px] text-white/70">
                        Este item não possui claim vinculada para carregar mensagens.
                      </div>
                    ) : messages.length === 0 ? (
                      <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-[13px] text-white/70">
                        Nenhuma mensagem encontrada para este caso.
                      </div>
                    ) : (
                      messages.map((m) => <ChatBubble key={m.id} msg={m} />)
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}