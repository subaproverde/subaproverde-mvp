"use client";

import { useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  Clipboard,
  ClipboardCheck,
  KeyRound,
  Mail,
  MonitorCog,
  Moon,
  RefreshCcw,
  ShieldCheck,
  Sun,
  UserPlus,
} from "lucide-react";
import { supabaseBrowser } from "@/lib/supabaseClient";
import { applySpvTheme, readSpvTheme, saveSpvTheme, type SpvTheme } from "@/lib/spvTheme";

type StepKey = "email_ready" | "instructions_sent" | "seller_invited" | "invite_accepted" | "access_tested";

type CollaboratorState = {
  email: string;
  roleName: string;
  notes: string;
  steps: Record<StepKey, boolean>;
  updatedAt: string | null;
};

const stepLabels: Record<StepKey, string> = {
  email_ready: "E-mail preparado",
  instructions_sent: "Instrução enviada",
  seller_invited: "Convite feito pelo seller",
  invite_accepted: "Convite aceito",
  access_tested: "Acesso testado",
};

const defaultSteps: Record<StepKey, boolean> = {
  email_ready: false,
  instructions_sent: false,
  seller_invited: false,
  invite_accepted: false,
  access_tested: false,
};

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function sellerAlias(sellerId: string) {
  const compact = sellerId.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 14);
  return compact || "seller";
}

function defaultEmail(sellerId: string) {
  return `ml+${sellerAlias(sellerId)}@subaproverde.com`;
}

function storageKey(sellerId: string) {
  return `spv:ml-collaborator:${sellerId}`;
}

function buildInstructions(sellerId: string, email: string, roleName: string) {
  return [
    "Olá! Para a Suba Pro Verde conseguir abrir chamados no Mercado Livre sem depender do seu login principal, faça o convite de colaborador abaixo.",
    "",
    `E-mail do colaborador: ${email}`,
    `Nome da função sugerida: ${roleName}`,
    "",
    "Passos no Mercado Livre:",
    "1. Acesse sua conta Mercado Livre.",
    "2. Vá em Seu negócio > Colaboradores.",
    "3. Clique em Convidar colaborador.",
    "4. Informe o e-mail acima.",
    "5. Crie ou selecione uma função com acesso a vendas, reclamações, mensagens, envios e atendimento/ajuda.",
    "6. Envie o convite.",
    "",
    "Importante: o e-mail convidado não pode estar cadastrado em nenhuma conta Mercado Livre ou Mercado Pago.",
    "",
    `Seller ID Suba: ${sellerId}`,
  ].join("\n");
}

function emptyState(sellerId: string): CollaboratorState {
  return {
    email: defaultEmail(sellerId),
    roleName: "Suba Pro Verde - Atendimento e Reputação",
    notes: "",
    steps: { ...defaultSteps, email_ready: true },
    updatedAt: null,
  };
}

function ProgressRing({ percent }: { percent: number }) {
  const deg = Math.round((percent / 100) * 360);

  return (
    <div
      className="grid h-24 w-24 place-items-center rounded-full"
      style={{
        background: `conic-gradient(rgb(52 211 153) ${deg}deg, rgba(255,255,255,0.1) ${deg}deg)`,
      }}
    >
      <div className="grid h-20 w-20 place-items-center rounded-full bg-[#0b1118]">
        <span className="text-2xl font-black text-white">{percent}%</span>
      </div>
    </div>
  );
}

export default function AppSettingsPage() {
  const [loading, setLoading] = useState(true);
  const [sellerId, setSellerId] = useState("");
  const [error, setError] = useState("");
  const [state, setState] = useState<CollaboratorState | null>(null);
  const [copied, setCopied] = useState<"email" | "instructions" | "">("");
  const [theme, setTheme] = useState<SpvTheme>("dark");

  const progress = useMemo(() => {
    if (!state) return 0;
    const values = Object.values(state.steps);
    return Math.round((values.filter(Boolean).length / values.length) * 100);
  }, [state]);

  const instructions = useMemo(() => {
    if (!sellerId || !state) return "";
    return buildInstructions(sellerId, state.email, state.roleName);
  }, [sellerId, state]);

  function persist(next: CollaboratorState, sid = sellerId) {
    const withDate = { ...next, updatedAt: new Date().toISOString() };
    setState(withDate);

    try {
      window.localStorage.setItem(storageKey(sid), JSON.stringify(withDate));
    } catch {
      // Local test only; the next step can move this to Supabase.
    }
  }

  async function copy(value: string, kind: "email" | "instructions") {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(kind);
      window.setTimeout(() => setCopied(""), 1500);
    } catch {
      setCopied("");
    }
  }

  function toggleStep(step: StepKey) {
    if (!state) return;
    persist({
      ...state,
      steps: {
        ...state.steps,
        [step]: !state.steps[step],
      },
    });
  }

  function resetTest() {
    if (!sellerId) return;
    const next = emptyState(sellerId);
    persist(next);
  }

  function changeTheme(nextTheme: SpvTheme) {
    setTheme(nextTheme);
    saveSpvTheme(nextTheme);
  }

  useEffect(() => {
    const currentTheme = readSpvTheme();
    setTheme(currentTheme);
    applySpvTheme(currentTheme);
  }, []);

  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        setLoading(true);
        setError("");

        const { data } = await supabaseBrowser.auth.getUser();
        const user = data?.user;

        if (!user?.id) {
          throw new Error("Você não está logado.");
        }

        const res = await fetch(`/api/me/seller?userId=${encodeURIComponent(user.id)}`, {
          cache: "no-store",
        });
        const json = await res.json().catch(() => ({}));

        if (!res.ok || !json?.sellerId) {
          throw new Error(json?.error ?? "Não foi possível identificar o seller ativo.");
        }

        const sid = String(json.sellerId);
        if (!alive) return;

        setSellerId(sid);

        let loaded: CollaboratorState | null = null;
        try {
          const raw = window.localStorage.getItem(storageKey(sid));
          loaded = raw ? (JSON.parse(raw) as CollaboratorState) : null;
        } catch {
          loaded = null;
        }

        setState(loaded ?? emptyState(sid));
      } catch (e: unknown) {
        if (!alive) return;
        setError(e instanceof Error ? e.message : "Erro ao carregar configuração.");
        setState(null);
      } finally {
        if (!alive) return;
        setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, []);

  if (loading) {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-white/70">
        Carregando configurações...
      </div>
    );
  }

  if (error || !state) {
    return (
      <div className="rounded-2xl border border-rose-400/20 bg-rose-500/10 p-6 text-rose-100">
        {error || "Não foi possível iniciar o teste de colaborador."}
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl pb-14">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1 text-xs font-bold text-emerald-100">
            <UserPlus className="h-4 w-4" />
            Teste operacional
          </div>
          <h1 className="mt-3 text-3xl font-black tracking-tight text-white">
            Configurações
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-white/65">
            Ajustes operacionais da conta, começando pelo convite de colaborador que permite a Suba operar o contato do Mercado Livre sem senha principal do seller.
          </p>
          <p className="mt-2 text-xs text-white/45">
            Seller ativo: <span className="font-mono text-white/70">{sellerId}</span>
          </p>
        </div>

        <div className="flex items-center gap-4 rounded-2xl border border-white/10 bg-white/5 p-4">
          <ProgressRing percent={progress} />
          <div>
            <div className="text-sm font-bold text-white">Status do onboarding</div>
            <div className="mt-1 text-sm text-white/55">
              {progress === 100 ? "Pronto para operação" : "Em validação"}
            </div>
            {state.updatedAt && (
              <div className="mt-2 text-xs text-white/35">
                Atualizado em {new Date(state.updatedAt).toLocaleString("pt-BR")}
              </div>
            )}
          </div>
        </div>
      </div>

      <section className="mt-6 overflow-hidden rounded-[26px] border border-emerald-300/18 bg-[linear-gradient(135deg,rgba(16,185,129,0.12),rgba(56,189,248,0.08),rgba(255,255,255,0.055))] p-5 shadow-[0_24px_100px_rgba(0,0,0,0.26)]">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start gap-3">
            <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl border border-emerald-300/20 bg-emerald-400/12">
              <MonitorCog className="h-5 w-5 text-emerald-100" />
            </div>
            <div>
              <div className="text-sm font-black text-white">Aparência do painel</div>
              <p className="mt-1 max-w-2xl text-sm leading-relaxed text-white/58">
                Alterne entre o cockpit escuro e um modo claro mais leve, com fundo verde suave, vidro branco e acentos neon.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 rounded-2xl border border-white/10 bg-black/20 p-1.5">
            <button
              type="button"
              onClick={() => changeTheme("dark")}
              className={cn(
                "inline-flex h-11 items-center justify-center gap-2 rounded-xl px-4 text-sm font-black transition",
                theme === "dark"
                  ? "bg-slate-950 text-white shadow-[0_12px_32px_rgba(0,0,0,0.28)]"
                  : "text-white/55 hover:bg-white/8 hover:text-white"
              )}
            >
              <Moon className="h-4 w-4" />
              Escuro
            </button>
            <button
              type="button"
              onClick={() => changeTheme("light")}
              className={cn(
                "inline-flex h-11 items-center justify-center gap-2 rounded-xl px-4 text-sm font-black transition",
                theme === "light"
                  ? "bg-white text-emerald-950 shadow-[0_12px_32px_rgba(16,185,129,0.18)]"
                  : "text-white/55 hover:bg-white/8 hover:text-white"
              )}
            >
              <Sun className="h-4 w-4" />
              Claro
            </button>
          </div>
        </div>
      </section>

      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-[0.95fr_1.05fr]">
        <section className="rounded-[26px] border border-white/10 bg-white/5 p-5 shadow-[0_24px_100px_rgba(0,0,0,0.28)]">
          <div className="flex items-center gap-2 text-sm font-black text-white">
            <Mail className="h-4 w-4 text-emerald-200" />
            Identidade do colaborador
          </div>

          <label className="mt-5 block">
            <span className="text-xs font-bold text-white/55">E-mail que receberá o convite</span>
            <input
              value={state.email}
              onChange={(e) => persist({ ...state, email: e.target.value })}
              className="mt-2 w-full rounded-2xl border border-white/10 bg-black/25 px-4 py-3 text-sm font-semibold text-white outline-none focus:border-emerald-300/50"
            />
          </label>

          <label className="mt-4 block">
            <span className="text-xs font-bold text-white/55">Nome da função sugerida</span>
            <input
              value={state.roleName}
              onChange={(e) => persist({ ...state, roleName: e.target.value })}
              className="mt-2 w-full rounded-2xl border border-white/10 bg-black/25 px-4 py-3 text-sm font-semibold text-white outline-none focus:border-emerald-300/50"
            />
          </label>

          <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
            <button
              onClick={() => copy(state.email, "email")}
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-emerald-500 px-4 py-3 text-sm font-black text-white hover:bg-emerald-600"
            >
              {copied === "email" ? <ClipboardCheck className="h-4 w-4" /> : <Clipboard className="h-4 w-4" />}
              {copied === "email" ? "E-mail copiado" : "Copiar e-mail"}
            </button>
            <button
              onClick={resetTest}
              className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-bold text-white/80 hover:bg-white/10"
            >
              <RefreshCcw className="h-4 w-4" />
              Reiniciar teste
            </button>
          </div>

          <div className="mt-5 rounded-2xl border border-amber-400/20 bg-amber-500/10 p-4 text-xs leading-relaxed text-amber-50/85">
            O e-mail precisa existir ou ser um alias real da Suba, porque o Mercado Livre envia o convite por e-mail. Também não pode estar cadastrado em Mercado Livre ou Mercado Pago.
          </div>
        </section>

        <section className="rounded-[26px] border border-white/10 bg-white/5 p-5 shadow-[0_24px_100px_rgba(0,0,0,0.28)]">
          <div className="flex items-center gap-2 text-sm font-black text-white">
            <ShieldCheck className="h-4 w-4 text-sky-200" />
            Checklist do convite
          </div>

          <div className="mt-5 grid grid-cols-1 gap-2">
            {(Object.keys(stepLabels) as StepKey[]).map((step) => (
              <button
                key={step}
                onClick={() => toggleStep(step)}
                className={cn(
                  "flex items-center justify-between rounded-2xl border px-4 py-3 text-left transition",
                  state.steps[step]
                    ? "border-emerald-400/20 bg-emerald-400/10 text-emerald-50"
                    : "border-white/10 bg-black/20 text-white/65 hover:bg-white/10"
                )}
              >
                <span className="text-sm font-bold">{stepLabels[step]}</span>
                <CheckCircle2
                  className={cn("h-5 w-5", state.steps[step] ? "text-emerald-300" : "text-white/25")}
                />
              </button>
            ))}
          </div>

          <label className="mt-4 block">
            <span className="text-xs font-bold text-white/55">Notas internas</span>
            <textarea
              value={state.notes}
              onChange={(e) => persist({ ...state, notes: e.target.value })}
              rows={4}
              className="mt-2 w-full resize-none rounded-2xl border border-white/10 bg-black/25 px-4 py-3 text-sm text-white outline-none focus:border-emerald-300/50"
              placeholder="Ex.: convite enviado em 23/05, aguardando aceite do e-mail."
            />
          </label>
        </section>
      </div>

      <section className="mt-4 rounded-[26px] border border-white/10 bg-gradient-to-br from-white/[0.07] to-emerald-500/[0.08] p-5 shadow-[0_24px_100px_rgba(0,0,0,0.28)]">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-2 text-sm font-black text-white">
            <KeyRound className="h-4 w-4 text-emerald-200" />
            Mensagem para enviar ao seller
          </div>
          <button
            onClick={() => copy(instructions, "instructions")}
            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-white px-4 py-3 text-sm font-black text-slate-950 hover:bg-emerald-50"
          >
            {copied === "instructions" ? <ClipboardCheck className="h-4 w-4" /> : <Clipboard className="h-4 w-4" />}
            {copied === "instructions" ? "Instrução copiada" : "Copiar instrução"}
          </button>
        </div>

        <pre className="mt-4 max-h-[360px] overflow-auto whitespace-pre-wrap rounded-2xl border border-white/10 bg-[#07111b] p-4 text-xs leading-relaxed text-white/75">
          {instructions}
        </pre>
      </section>
    </div>
  );
}
