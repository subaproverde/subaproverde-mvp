"use client";

import { useEffect, useState } from "react";
import { ReputationThermometer, type ReputationLevel } from "@/app/components/reputation/ReputationThermometer";

const levels: Array<{
  key: ReputationLevel;
  label: string;
  subtitle: string;
  score: string;
}> = [
  { key: "verde", label: "BOM", subtitle: "Saudável", score: "Score 91" },
  { key: "amarelo", label: "ATENÇÃO", subtitle: "Atenção", score: "Score 67" },
  { key: "laranja", label: "ALTO RISCO", subtitle: "Alto risco", score: "Score 42" },
  { key: "vermelho", label: "CRÍTICO", subtitle: "Conta em risco", score: "Score 18" },
];

export default function ThermometerPreviewPage() {
  const [active, setActive] = useState<ReputationLevel>("verde");
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const selected = levels.find((item) => item.key === active) ?? levels[0];

  useEffect(() => {
    document.documentElement.dataset.spvTheme = theme;
    window.dispatchEvent(new Event("spv-theme-change"));
  }, [theme]);

  return (
    <main
      className={
        theme === "dark"
          ? "min-h-screen bg-[#06100c] px-5 py-8 text-white"
          : "min-h-screen bg-[#f4fff8] px-5 py-8 text-slate-950"
      }
    >
      <div className="mx-auto max-w-6xl">
        <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className={theme === "dark" ? "text-sm font-semibold text-emerald-200/70" : "text-sm font-semibold text-emerald-900/70"}>
              Preview local Suba Pro Verde
            </div>
            <h1 className="mt-2 text-3xl font-black tracking-tight sm:text-5xl">
              Termômetro tecnológico da página Resumo
            </h1>
            <p className={theme === "dark" ? "mt-3 max-w-2xl text-sm text-white/55" : "mt-3 max-w-2xl text-sm text-slate-600"}>
              Versão em arco, com leitura de reputação, brilho e animação visual antes de publicar.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setTheme("dark")}
              className={
                theme === "dark"
                  ? "rounded-full bg-emerald-400 px-4 py-2 text-sm font-bold text-emerald-950"
                  : "rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700"
              }
            >
              Dark
            </button>
            <button
              type="button"
              onClick={() => setTheme("light")}
              className={
                theme === "light"
                  ? "rounded-full bg-emerald-500 px-4 py-2 text-sm font-bold text-white"
                  : "rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-bold text-white/70"
              }
            >
              Claro
            </button>
          </div>
        </div>

        <div className="mb-4 flex flex-wrap gap-2">
          {levels.map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => setActive(item.key)}
              className={
                active === item.key
                  ? "rounded-full bg-emerald-400 px-4 py-2 text-sm font-black text-emerald-950"
                  : theme === "dark"
                    ? "rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-white/65"
                    : "rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-600"
              }
            >
              {item.label}
            </button>
          ))}
        </div>

        <section
          className={
            theme === "dark"
              ? "rounded-[2rem] border border-white/10 bg-white/[0.045] p-4 shadow-[0_28px_90px_rgba(0,0,0,0.35)] sm:p-6"
              : "rounded-[2rem] border border-emerald-950/10 bg-white/70 p-4 shadow-[0_24px_80px_rgba(15,70,44,0.12)] sm:p-6"
          }
        >
          <div className="grid gap-5 xl:grid-cols-[1fr_.42fr]">
            <ReputationThermometer
              level={selected.key}
              label={selected.label}
              subtitle={selected.subtitle}
              scoreText={selected.score}
              theme={theme}
            />

            <div className={theme === "dark" ? "rounded-[1.5rem] border border-white/10 bg-black/20 p-5" : "rounded-[1.5rem] border border-emerald-950/10 bg-white/80 p-5"}>
              <div className={theme === "dark" ? "text-xs font-semibold uppercase tracking-[0.2em] text-white/45" : "text-xs font-semibold uppercase tracking-[0.2em] text-slate-500"}>
                Contexto Resumo
              </div>
              <div className="mt-3 text-2xl font-black">ESPELHOS TAIMOR</div>
              <div className={theme === "dark" ? "mt-2 text-sm leading-6 text-white/55" : "mt-2 text-sm leading-6 text-slate-600"}>
                Área lateral mockada apenas para sentir composição, peso visual e leitura dentro da tela Resumo.
              </div>

              <div className="mt-5 grid gap-3">
                {[
                  ["Reclamações", "2", "0,26%"],
                  ["Mediações", "1", "0,13%"],
                  ["Cancelamentos", "0", "0%"],
                  ["Atrasos", "64", "9,22%"],
                ].map(([label, value, rate]) => (
                  <div
                    key={label}
                    className={
                      theme === "dark"
                        ? "rounded-2xl border border-white/10 bg-white/[0.045] p-4"
                        : "rounded-2xl border border-emerald-950/10 bg-emerald-50/60 p-4"
                    }
                  >
                    <div className={theme === "dark" ? "text-xs text-white/45" : "text-xs text-slate-500"}>{label}</div>
                    <div className="mt-1 flex items-end justify-between gap-3">
                      <div className="text-2xl font-black">{value}</div>
                      <div className={theme === "dark" ? "text-sm font-semibold text-white/60" : "text-sm font-semibold text-slate-600"}>{rate}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
