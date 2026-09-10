"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  ArrowUpRight,
  BadgeCheck,
  BriefcaseBusiness,
  CheckCircle2,
  Clock3,
  RefreshCcw,
  Search,
  ShieldAlert,
  Store,
  Trash2,
  Users,
  WifiOff,
} from "lucide-react";
import { supabaseBrowser } from "@/lib/supabaseClient";

type TokenStatus = "connected" | "expiring" | "needs_reconnect" | "not_connected";

type AdminSellerItem = {
  id: string;
  name: string;
  sellerName: string | null;
  companyName: string | null;
  status: string | null;
  sellerAccountId: string | null;
  nickname: string | null;
  ml_user_id: string;
  created_at: string | null;
  token: {
    status: TokenStatus;
    hasToken: boolean;
    hasRefresh: boolean;
    refreshed: boolean;
    refreshError: string | null;
    expires_at: string | null;
    updated_at: string | null;
    secondsUntilExpiry: number | null;
  };
};

type Summary = {
  total: number;
  connected: number;
  expiring: number;
  needsReconnect: number;
  notConnected: number;
  refreshedNow: number;
};

const emptySummary: Summary = {
  total: 0,
  connected: 0,
  expiring: 0,
  needsReconnect: 0,
  notConnected: 0,
  refreshedNow: 0,
};

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function formatDate(value?: string | null) {
  if (!value) return "Sem data";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Data invalida";
  return date.toLocaleString("pt-BR");
}

function expiryLabel(seconds: number | null, expiresAt: string | null) {
  if (!expiresAt) return "Sem validade registrada";
  if (seconds === null) return formatDate(expiresAt);
  if (seconds <= 0) return "Expirado";

  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `Vence em ${minutes} min`;

  const hours = Math.round(minutes / 60);
  if (hours < 24) return `Vence em ${hours} h`;

  const days = Math.round(hours / 24);
  return `Vence em ${days} dias`;
}

function statusMeta(status: TokenStatus) {
  if (status === "connected") {
    return {
      label: "Conectado",
      icon: CheckCircle2,
      className: "border-emerald-400/25 bg-emerald-400/10 text-spv-accent-text",
    };
  }

  if (status === "expiring") {
    return {
      label: "Vencendo",
      icon: Clock3,
      className: "border-amber-400/25 bg-amber-400/10 text-amber-100",
    };
  }

  if (status === "needs_reconnect") {
    return {
      label: "Reconectar",
      icon: ShieldAlert,
      className: "border-rose-400/25 bg-rose-500/10 text-rose-100",
    };
  }

  return {
    label: "Sem conexao",
    icon: WifiOff,
    className: "border-spv-line bg-spv-surface text-spv-muted",
  };
}

function MetricCard({
  icon,
  label,
  value,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  tone: "emerald" | "amber" | "rose" | "slate";
}) {
  const tones = {
    emerald: "from-emerald-400/18 to-emerald-900/5 text-spv-accent-text",
    amber: "from-amber-300/18 to-amber-900/5 text-amber-100",
    rose: "from-rose-400/18 to-rose-900/5 text-rose-100",
    slate: "from-white/[0.08] to-black/20 text-spv-ink",
  } as const;

  return (
    <div className={cn("rounded-xl border border-spv-line bg-gradient-to-br p-4", tones[tone])}>
      <div className="flex items-center justify-between gap-3">
        <div className="grid h-10 w-10 place-items-center rounded-xl border border-spv-line bg-spv-page">
          {icon}
        </div>
        <div className="text-3xl font-semibold">{value}</div>
      </div>
      <div className="mt-3 text-[12px] font-bold uppercase tracking-wide opacity-70">{label}</div>
    </div>
  );
}

export default function AdminSellersClient() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [items, setItems] = useState<AdminSellerItem[]>([]);
  const [summary, setSummary] = useState<Summary>(emptySummary);
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<"all" | TokenStatus>("all");
  const [removingSellerId, setRemovingSellerId] = useState("");

  async function loadSellers() {
    try {
      setRefreshing(true);
      setError("");

      const {
        data: { session },
      } = await supabaseBrowser.auth.getSession();

      const accessToken = session?.access_token;
      if (!accessToken) {
        throw new Error("Voce nao esta logado.");
      }

      const response = await fetch("/api/admin/sellers/list", {
        cache: "no-store",
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });
      const json = await response.json().catch(() => ({}));

      if (!response.ok || json?.ok === false) {
        throw new Error(json?.error ?? "Falha ao carregar sellers.");
      }

      setItems((json.items ?? []) as AdminSellerItem[]);
      setSummary((json.summary ?? emptySummary) as Summary);
    } catch (e: any) {
      setError(e?.message ?? "Erro ao carregar sellers.");
      setItems([]);
      setSummary(emptySummary);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    loadSellers();
  }, []);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();

    return items.filter((item) => {
      if (filter !== "all" && item.token.status !== filter) return false;
      if (!needle) return true;

      return [
        item.id,
        item.name,
        item.sellerName ?? "",
        item.companyName ?? "",
        item.nickname ?? "",
        item.ml_user_id,
        item.status ?? "",
      ]
        .join(" ")
        .toLowerCase()
        .includes(needle);
    });
  }, [filter, items, q]);

  async function setActiveSeller(sellerId: string) {
    try {
      localStorage.setItem("activeSellerId", sellerId);
    } catch {
      // Local context only.
    }

    try {
      const {
        data: { session },
      } = await supabaseBrowser.auth.getSession();

      if (!session?.access_token) return;

      await fetch("/api/me/seller/set", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ sellerId }),
      });
    } catch {
      // Admin can still open explicit seller routes even when active seller is not owned by the admin user.
    }
  }

  async function openCases(sellerId: string) {
    await setActiveSeller(sellerId);
    router.push(`/app/cases?sellerId=${encodeURIComponent(sellerId)}`);
  }

  async function openDashboard(sellerId: string) {
    await setActiveSeller(sellerId);
    router.push(`/app/sellers/${encodeURIComponent(sellerId)}/dashboard`);
  }

  async function removeSeller(seller: AdminSellerItem) {
    const label = seller.name || seller.nickname || seller.id;
    const confirmed = window.confirm(
      `Remover ${label}?\n\nA conta sairá dos seletores e as credenciais Mercado Livre salvas serão apagadas. O histórico operacional será preservado. Para usar novamente, será necessário autorizar a conta ML outra vez.`
    );
    if (!confirmed) return;

    try {
      setRemovingSellerId(seller.id);
      setError("");

      const {
        data: { session },
      } = await supabaseBrowser.auth.getSession();

      if (!session?.access_token) throw new Error("Você não está logado.");

      const response = await fetch(`/api/admin/sellers/${encodeURIComponent(seller.id)}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const json = await response.json().catch(() => ({}));

      if (!response.ok || json?.ok === false) {
        throw new Error(json?.error ?? "Não foi possível remover o seller.");
      }

      await loadSellers();
    } catch (e: any) {
      setError(e?.message ?? "Não foi possível remover o seller.");
    } finally {
      setRemovingSellerId("");
    }
  }

  return (
    <div className="mx-auto max-w-7xl pb-14">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1 text-xs font-bold text-spv-accent-text">
            <Store className="h-4 w-4" />
            Admin Mercado Livre
          </div>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-spv-ink">Sellers</h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-spv-muted">
            Controle de contas conectadas, saude dos tokens OAuth e acesso rapido a cases e dashboards por seller.
          </p>
        </div>

        <button
          type="button"
          onClick={loadSellers}
          disabled={refreshing}
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-spv-line bg-spv-surface px-4 py-3 text-sm font-bold text-spv-ink hover:bg-spv-raised disabled:opacity-50"
        >
          <RefreshCcw className={cn("h-4 w-4", refreshing && "animate-spin")} />
          Atualizar tokens
        </button>
      </div>

      {error && (
        <div className="mt-5 rounded-xl border border-rose-400/20 bg-rose-500/10 p-4 text-sm text-rose-100">
          {error}
        </div>
      )}

      <section className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-5">
        <MetricCard icon={<Users className="h-5 w-5" />} label="sellers" value={summary.total} tone="slate" />
        <MetricCard icon={<BadgeCheck className="h-5 w-5" />} label="conectados" value={summary.connected} tone="emerald" />
        <MetricCard icon={<Clock3 className="h-5 w-5" />} label="vencendo" value={summary.expiring} tone="amber" />
        <MetricCard icon={<ShieldAlert className="h-5 w-5" />} label="reconectar" value={summary.needsReconnect} tone="rose" />
        <MetricCard icon={<RefreshCcw className="h-5 w-5" />} label="renovados agora" value={summary.refreshedNow} tone="emerald" />
      </section>

      <section className="mt-6 rounded-xl border border-spv-line bg-spv-surface shadow-none">
        <div className="border-b border-spv-line p-5">
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-[1fr_240px]">
            <label className="relative block">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-spv-muted" />
              <input
                value={q}
                onChange={(event) => setQ(event.target.value)}
                placeholder="Buscar por nome, nickname, sellerId ou ml_user_id"
                className="h-12 w-full rounded-xl border border-spv-line bg-spv-page pl-11 pr-4 text-sm font-semibold text-spv-ink outline-none placeholder:text-spv-muted focus:border-emerald-300/50"
              />
            </label>

            <select
              value={filter}
              onChange={(event) => setFilter(event.target.value as typeof filter)}
              className="h-12 rounded-xl border border-spv-line bg-spv-page px-4 text-sm font-bold text-spv-ink outline-none focus:border-emerald-300/50"
            >
              <option value="all">Todos</option>
              <option value="connected">Conectados</option>
              <option value="expiring">Vencendo</option>
              <option value="needs_reconnect">Reconectar</option>
              <option value="not_connected">Sem conexao</option>
            </select>
          </div>
        </div>

        <div className="p-5">
          {loading ? (
            <div className="rounded-xl border border-spv-line bg-spv-page p-5 text-sm text-spv-muted">
              Carregando sellers...
            </div>
          ) : filtered.length === 0 ? (
            <div className="rounded-xl border border-spv-line bg-spv-page p-5 text-sm text-spv-muted">
              Nenhum seller encontrado.
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
              {filtered.map((seller) => {
                const meta = statusMeta(seller.token.status);
                const StatusIcon = meta.icon;

                return (
                  <article
                    key={seller.id}
                    className="rounded-xl border border-spv-line bg-spv-page p-5 transition hover:border-spv-line hover:bg-spv-raised"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-spv-line bg-spv-surface">
                            <BriefcaseBusiness className="h-5 w-5 text-spv-accent-text" />
                          </div>
                          <div className="min-w-0">
                            <h2 className="truncate text-base font-semibold text-spv-ink">{seller.name}</h2>
                            <p className="mt-0.5 truncate text-xs font-semibold text-spv-muted">
                              sellerId: <span className="font-mono">{seller.id}</span>
                            </p>
                          </div>
                        </div>
                      </div>

                      <span className={cn("inline-flex shrink-0 items-center gap-2 rounded-full border px-3 py-1 text-[11px] font-semibold", meta.className)}>
                        <StatusIcon className="h-3.5 w-3.5" />
                        {meta.label}
                      </span>
                    </div>

                    <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
                      <div className="rounded-xl border border-spv-line bg-spv-surface p-3">
                        <div className="text-[11px] font-bold uppercase tracking-wide text-spv-muted">OAuth</div>
                        <div className="mt-1 text-sm font-bold text-spv-ink">
                          {expiryLabel(seller.token.secondsUntilExpiry, seller.token.expires_at)}
                        </div>
                        <div className="mt-1 text-[11px] text-spv-muted">
                          Atualizado: {formatDate(seller.token.updated_at)}
                        </div>
                      </div>

                      <div className="rounded-xl border border-spv-line bg-spv-surface p-3">
                        <div className="text-[11px] font-bold uppercase tracking-wide text-spv-muted">Conta ML</div>
                        <div className="mt-1 truncate text-sm font-bold text-spv-ink">
                          {seller.ml_user_id || "ml_user_id ausente"}
                        </div>
                        <div className="mt-1 text-[11px] text-spv-muted">
                          Refresh token: {seller.token.hasRefresh ? "salvo" : "ausente"}
                        </div>
                      </div>
                    </div>

                    {seller.token.refreshError && (
                      <div className="mt-3 flex gap-2 rounded-xl border border-rose-400/20 bg-rose-500/10 p-3 text-xs leading-relaxed text-rose-100">
                        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                        {seller.token.refreshError}
                      </div>
                    )}

                    <div className="mt-4 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => openCases(seller.id)}
                        className="inline-flex items-center justify-center gap-2 rounded-xl border border-spv-line bg-spv-surface px-4 py-2.5 text-sm font-bold text-spv-ink hover:bg-spv-raised"
                      >
                        Ver cases
                        <ArrowUpRight className="h-4 w-4" />
                      </button>

                      <button
                        type="button"
                        onClick={() => openDashboard(seller.id)}
                        className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-spv-ink hover:bg-emerald-600"
                      >
                        Abrir dashboard
                        <ArrowUpRight className="h-4 w-4" />
                      </button>

                      <button
                        type="button"
                        onClick={() => removeSeller(seller)}
                        disabled={removingSellerId === seller.id}
                        className="inline-flex items-center justify-center gap-2 rounded-xl border border-rose-400/30 bg-rose-500/10 px-4 py-2.5 text-sm font-bold text-rose-100 hover:bg-rose-500/20 disabled:cursor-wait disabled:opacity-60"
                      >
                        <Trash2 className="h-4 w-4" />
                        {removingSellerId === seller.id ? "Removendo…" : "Remover"}
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
