"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  BarChart3,
  CheckCircle2,
  Clock3,
  Download,
  FileText,
  MessageSquareText,
  RefreshCcw,
  ShieldCheck,
} from "lucide-react";
import { supabaseBrowser } from "@/lib/supabaseClient";

type Counts = {
  reclamacoes: number;
  atrasos: number;
  cancelamentos: number;
  mediacoes: number;
};

const emptyCounts: Counts = {
  reclamacoes: 0,
  atrasos: 0,
  cancelamentos: 0,
  mediacoes: 0,
};

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function ReportCard({
  icon,
  title,
  description,
  status,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  status: string;
}) {
  return (
    <div className="rounded-[24px] border border-white/10 bg-white/5 p-5 shadow-[0_20px_80px_rgba(0,0,0,0.25)]">
      <div className="flex items-start justify-between gap-3">
        <div className="grid h-11 w-11 place-items-center rounded-2xl border border-white/10 bg-black/20 text-emerald-200">
          {icon}
        </div>
        <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-bold text-white/55">
          {status}
        </span>
      </div>
      <div className="mt-4 text-[15px] font-black text-white">{title}</div>
      <p className="mt-2 text-[12px] leading-relaxed text-white/62">{description}</p>
    </div>
  );
}

function CountTile({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "emerald" | "amber" | "rose" | "sky";
}) {
  const tones = {
    emerald: "border-emerald-400/20 bg-emerald-400/10 text-emerald-100",
    amber: "border-amber-400/20 bg-amber-400/10 text-amber-100",
    rose: "border-rose-400/20 bg-rose-400/10 text-rose-100",
    sky: "border-sky-400/20 bg-sky-400/10 text-sky-100",
  } as const;

  return (
    <div className={cn("rounded-2xl border p-4", tones[tone])}>
      <div className="text-[11px] font-bold opacity-70">{label}</div>
      <div className="mt-1 text-3xl font-black">{value}</div>
    </div>
  );
}

export default function ReportsPage() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [sellerId, setSellerId] = useState("");
  const [error, setError] = useState("");
  const [counts, setCounts] = useState<Counts>(emptyCounts);

  const total = useMemo(
    () => counts.reclamacoes + counts.atrasos + counts.cancelamentos + counts.mediacoes,
    [counts]
  );

  async function loadReports() {
    try {
      setRefreshing(true);
      setError("");

      const { data } = await supabaseBrowser.auth.getUser();
      const user = data?.user;

      if (!user?.id) {
        throw new Error("Você não está logado. Faça login novamente.");
      }

      const sellerRes = await fetch(`/api/me/seller?userId=${encodeURIComponent(user.id)}`, {
        cache: "no-store",
      });
      const sellerJson = await sellerRes.json().catch(() => ({}));

      if (!sellerRes.ok || !sellerJson?.sellerId) {
        throw new Error(sellerJson?.error ?? "Não foi possível identificar o seller ativo.");
      }

      const sid = String(sellerJson.sellerId);
      setSellerId(sid);

      const casesRes = await fetch(`/api/ml/cases?sellerId=${encodeURIComponent(sid)}&page=1&limit=1&type=reclamacoes`, {
        cache: "no-store",
      });
      const casesJson = await casesRes.json().catch(() => ({}));

      if (casesJson?.counts) {
        setCounts({
          reclamacoes: Number(casesJson.counts.reclamacoes ?? 0),
          atrasos: Number(casesJson.counts.atrasos ?? 0),
          cancelamentos: Number(casesJson.counts.cancelamentos ?? 0),
          mediacoes: Number(casesJson.counts.mediacoes ?? 0),
        });
      }
    } catch (e: any) {
      setError(e?.message ?? "Erro ao carregar relatórios.");
      setCounts(emptyCounts);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    loadReports();
  }, []);

  return (
    <div className="mx-auto max-w-6xl pb-14">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <Link
            href="/app"
            className="inline-flex items-center gap-2 text-[12px] font-semibold text-emerald-200/90 hover:text-emerald-200"
          >
            <span className="inline-block h-2 w-2 rounded-full bg-emerald-500" />
            Voltar ao início
          </Link>

          <h1 className="mt-3 text-3xl font-black tracking-tight text-white">Relatórios</h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-white/65">
            Central para acompanhar impactos, preparar evidências e organizar relatórios de atendimento.
          </p>

          {sellerId && (
            <p className="mt-2 text-xs text-white/40">
              Seller ativo: <span className="font-mono text-white/65">{sellerId}</span>
            </p>
          )}
        </div>

        <button
          onClick={loadReports}
          disabled={refreshing}
          className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-bold text-white/80 hover:bg-white/10 disabled:opacity-50"
        >
          <RefreshCcw className={cn("h-4 w-4", refreshing && "animate-spin")} />
          Atualizar
        </button>
      </div>

      {error && (
        <div className="mt-5 rounded-2xl border border-rose-400/20 bg-rose-500/10 p-4 text-sm text-rose-100">
          {error}
        </div>
      )}

      <section className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        <CountTile label="Reclamações" value={counts.reclamacoes} tone="emerald" />
        <CountTile label="Atrasos" value={counts.atrasos} tone="amber" />
        <CountTile label="Cancelamentos" value={counts.cancelamentos} tone="rose" />
        <CountTile label="Mediações" value={counts.mediacoes} tone="sky" />
      </section>

      <section className="mt-6 rounded-[28px] border border-white/10 bg-white/5 p-5 shadow-[0_24px_100px_rgba(0,0,0,0.32)]">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="text-[12px] font-black uppercase tracking-wide text-white/45">Resumo operacional</div>
            <div className="mt-1 text-2xl font-black text-white">
              {loading ? "Carregando..." : `${total} impactos em acompanhamento`}
            </div>
          </div>

          <Link
            href="/app/cases"
            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-emerald-500 px-4 py-3 text-sm font-black text-white hover:bg-emerald-600"
          >
            <BarChart3 className="h-4 w-4" />
            Abrir cases
          </Link>
        </div>

        <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-3">
          <ReportCard
            icon={<FileText className="h-5 w-5" />}
            title="Relatório executivo"
            description="Visão resumida para entender o volume de impactos e priorizar o que precisa de tratativa."
            status="disponível"
          />
          <ReportCard
            icon={<ShieldCheck className="h-5 w-5" />}
            title="Relatório de defesa"
            description="Base para organizar provas, mensagens e histórico antes de solicitar revisão do impacto."
            status="em evolução"
          />
          <ReportCard
            icon={<MessageSquareText className="h-5 w-5" />}
            title="Histórico de atendimento"
            description="Espaço para consolidar conversas, protocolos e retornos do Mercado Livre por seller."
            status="planejado"
          />
        </div>
      </section>

      <section className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-[0.9fr_1.1fr]">
        <div className="rounded-[24px] border border-white/10 bg-white/5 p-5">
          <div className="flex items-center gap-2 text-sm font-black text-white">
            <AlertTriangle className="h-4 w-4 text-amber-200" />
            Próximas melhorias
          </div>
          <ul className="mt-4 space-y-3 text-sm text-white/64">
            <li className="flex gap-2">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-300" />
              Exportar PDF premium por seller e período.
            </li>
            <li className="flex gap-2">
              <Clock3 className="mt-0.5 h-4 w-4 shrink-0 text-sky-300" />
              Cruzar relatórios com atendimentos do admin/remocoes.
            </li>
            <li className="flex gap-2">
              <Download className="mt-0.5 h-4 w-4 shrink-0 text-white/55" />
              Exportar CSV/XLSX dos cases filtrados.
            </li>
          </ul>
        </div>

        <div className="rounded-[24px] border border-white/10 bg-black/20 p-5">
          <div className="text-sm font-black text-white">Nota</div>
          <p className="mt-3 text-sm leading-relaxed text-white/62">
            Esta primeira versão deixa a rota pronta e já puxa os contadores do seller ativo. A parte de relatório final para cliente pode ser conectada depois aos atendimentos administrativos e ao histórico real de defesas.
          </p>
        </div>
      </section>
    </div>
  );
}
