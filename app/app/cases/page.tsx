// app/app/cases/page.tsx
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

// ======= UI helpers (mantive os seus componentes) =======

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

function ButtonPrimary({ children }: { children: React.ReactNode }) {
  return (
    <button className="inline-flex items-center justify-center rounded-xl bg-gradient-to-b from-emerald-600 to-emerald-700 px-4 py-2 text-sm font-semibold text-white shadow-[0_18px_55px_rgba(16,185,129,0.22)] hover:from-emerald-700 hover:to-emerald-800">
      {children}
    </button>
  );
}

function ButtonGhost({ children }: { children: React.ReactNode }) {
  return (
    <button className="inline-flex items-center justify-center rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-white/85 hover:bg-white/10">
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
          <button className="rounded-xl bg-gradient-to-b from-emerald-600 to-emerald-700 px-4 py-2 text-[12px] font-semibold text-white shadow-[0_14px_50px_rgba(16,185,129,0.18)] hover:from-emerald-700 hover:to-emerald-800">
            Ver detalhes
          </button>
          <button className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-[12px] font-semibold text-white/85 hover:bg-white/10">
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

// normaliza qualquer formato que sua API retornar
function normalizeCasesResponse(json: any): ImpactItem[] {
  const rawList = (json?.cases as any[]) || (json?.items as any[]) || (Array.isArray(json) ? json : []);

  return (rawList ?? []).map((c: any, idx: number) => {
    const kind = String(c?.kind ?? c?.type ?? "").toLowerCase();

    const type: ImpactType =
      kind.includes("claim")
        ? "reclamacoes"
        : kind.includes("delay") || kind.includes("late")
        ? "atrasos"
        : kind.includes("cancel")
        ? "cancelamentos"
        : kind.includes("mediation")
        ? "mediacoes"
        : "reclamacoes";

    const id = String(c?.id ?? c?.external_ref ?? c?.claim_id ?? idx);

    return {
      id,
      type,
      chip: c?.external_ref ? String(c.external_ref) : c?.claim_id ? `#${c.claim_id}` : undefined,
      title: String(c?.title ?? c?.reason ?? c?.type ?? "Caso"),
      reason: String(c?.note ?? c?.description ?? c?.details ?? "—"),
      createdAt: String(c?.created_at ?? c?.date_created ?? "—"),
      updatedAt: String(c?.updated_at ?? c?.last_updated ?? "—"),
      ageLabel: String(c?.ageLabel ?? c?.age_label ?? c?.time_ago ?? "—"),
      buyerName: String(c?.buyerName ?? c?.buyer_name ?? c?.buyer?.nickname ?? "Comprador"),
      statusPill: String(c?.status ?? c?.statusPill ?? c?.status_pill ?? "—"),
    };
  });
}

export default function CasesPage() {
  const [activeTab, setActiveTab] = useState<ImpactType>("reclamacoes");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<ImpactItem[]>([]);
  const [sellerId, setSellerId] = useState<string | null>(null);

  const counts = useMemo(() => {
    const base = { reclamacoes: 0, atrasos: 0, cancelamentos: 0, mediacoes: 0 };
    for (const it of items) base[it.type] = (base[it.type] ?? 0) + 1;
    return base;
  }, [items]);

  const filtered = useMemo(() => items.filter((x) => x.type === activeTab), [items, activeTab]);

  const [selectedId, setSelectedId] = useState<string>("");

  const selected = useMemo(() => items.find((x) => x.id === selectedId) ?? items[0], [items, selectedId]);

  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        setLoading(true);
        setError(null);

        // ✅ 1) pega user logado (MESMO padrão do /app)
        const { data } = await supabaseBrowser.auth.getUser();
        const user = data?.user;

        if (!user?.id) {
          throw new Error("Você não está logado. Volte para /login e entre novamente.");
        }

        // ✅ 2) resolve sellerId a partir do userId (MESMO endpoint do /app)
        const r = await fetch(`/api/me/seller?userId=${encodeURIComponent(user.id)}`, { cache: "no-store" });
        const j = await r.json().catch(() => ({}));

        if (!r.ok || !j?.sellerId) {
          throw new Error("Nenhum seller conectado para este usuário. Vá em /app/sellers e conecte o Mercado Livre.");
        }

        const sid = String(j.sellerId);
        if (!alive) return;

        setSellerId(sid);

        // ✅ 3) busca cases pelo seller (seu projeto já usa /api/ml/cases?seller_id=...)
        const res = await fetch(`/api/ml/cases?seller_id=${encodeURIComponent(sid)}`, { cache: "no-store" });

        const json = await res.json().catch(() => ({}));
        if (!res.ok || json?.ok === false) {
          throw new Error(json?.error ?? `Falha ao buscar cases (${res.status})`);
        }

        const norm = normalizeCasesResponse(json);
        if (!alive) return;

        setItems(norm);
        setSelectedId(norm[0]?.id ?? "");
      } catch (e: any) {
        if (!alive) return;
        setError(e?.message ?? "Erro desconhecido");
        setItems([]);
        setSellerId(null);
      } finally {
        if (!alive) return;
        setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, []);

  // mensagens ainda mockadas (porque falta liberar scope)
  const MOCK_MESSAGES: Message[] = [
    { id: "m1", from: "seller", text: "Oi! Me conta o que aconteceu para eu te ajudar rapidinho.", time: "11:49", name: "Seller" },
    { id: "m2", from: "buyer", text: "Faz 2 dias que comprei e ainda não recebi. Consegue verificar?", time: "11:52", name: "Comprador" },
  ];

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

          <h1 className="mt-2 text-[34px] leading-tight font-extrabold text-white">Casos e Reclamações</h1>

          <p className="mt-1 text-[13px] text-white/70">
            {loading ? "Carregando dados..." : "Visualize impactos por categoria e abra detalhes da venda + mensagens."}
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
            <div className="text-[11px] text-emerald-200/90 font-semibold">Reputação • ações & sugestões</div>
          </div>
        </div>
      </div>

      {/* TOP CARDS */}
      <section className="mt-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <MetricCard labelTop="Reclamações" value={counts.reclamacoes} labelBottom="impactos" tint="green" />
          <MetricCard labelTop="Atrasos" value={counts.atrasos} labelBottom="impactos" tint="amber" />
          <MetricCard labelTop="Cancelamentos" value={counts.cancelamentos} labelBottom="impactos" tint="rose" />
          <MetricCard labelTop="Mediações" value={counts.mediacoes} labelBottom="impactos" tint="sky" />
        </div>
      </section>

      {/* LIST */}
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
            <ImpactRow key={it.id} item={it} selected={it.id === selectedId} onSelect={() => setSelectedId(it.id)} />
          ))}
        </div>
      </section>

      {/* DETAILS + MESSAGES (mensagens mock por enquanto) */}
      <section className="mt-6 grid grid-cols-12 gap-4">
        <div className="col-span-12 lg:col-span-4">
          <div className="rounded-[26px] border border-white/10 bg-white/5 backdrop-blur-xl shadow-[0_22px_90px_rgba(0,0,0,0.35)] p-5">
            <div className="flex items-center justify-between gap-3">
              <div className="text-[12px] font-extrabold text-white">Venda</div>
              <SmallPill>API (parcial)</SmallPill>
            </div>

            <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="text-[12px] font-extrabold text-white">{selected?.chip ?? "#—"}</div>
              <div className="mt-1 text-[13px] font-bold text-white">{selected?.title ?? "-"}</div>

              <div className="mt-3 grid grid-cols-2 gap-2 text-[11px] text-white/65">
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
              </div>
            </div>

            <div className="mt-4 flex items-center justify-between gap-3">
              <ButtonGhost>Suporte</ButtonGhost>
              <ButtonPrimary>Ação sugerida</ButtonPrimary>
            </div>

            <div className="mt-4 text-[11px] text-white/60 leading-relaxed">
              Mensagens reais vão entrar quando liberarmos o escopo de “messages/post-sale” no app do ML.
            </div>
          </div>
        </div>

        <div className="col-span-12 lg:col-span-8">
          <div className="rounded-[26px] border border-white/10 bg-white/5 backdrop-blur-xl shadow-[0_22px_90px_rgba(0,0,0,0.35)] p-5">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className="h-11 w-11 rounded-2xl bg-white/10 border border-white/10" />
                <div className="leading-tight">
                  <div className="text-[13px] font-extrabold text-white">{selected?.buyerName ?? "Comprador"}</div>
                  <div className="mt-0.5 text-[11px] text-white/60 font-semibold">Histórico de mensagens</div>
                </div>
              </div>

              <span className="inline-flex items-center rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-[11px] font-extrabold text-white/80">
                Mensagens (mock)
              </span>
            </div>

            <div className="mt-5 space-y-3">
              {MOCK_MESSAGES.map((m) => (
                <ChatBubble key={m.id} msg={m} />
              ))}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}