"use client";

export type ReputationLevel = "verde" | "amarelo" | "vermelho";

type Props = {
  level: ReputationLevel;
  label?: string;
  subtitle?: string;
  score?: number | string | null;
};

export function HeroReputationThermometer({
  level,
  label,
  subtitle,
  score,
}: Props) {
  const labelText =
    label ??
    (level === "vermelho"
      ? "VERMELHO"
      : level === "amarelo"
      ? "AMARELO"
      : "VERDE");

  const subtitleText =
    subtitle ??
    (level === "vermelho"
      ? "Conta em risco"
      : level === "amarelo"
      ? "Atenção"
      : "Saudável");

  // evita NaN quebrando o React
  const safeScore =
    score === null || score === undefined || score === ""
      ? "—"
      : String(score);

  // posição do marcador
  const pos =
    level === "vermelho"
      ? "-34px"
      : level === "amarelo"
      ? "0px"
      : "34px";

  return (
    <div className="rounded-xl border bg-spv-surface p-5 shadow-md ring-1 ring-slate-100">
      <div className="flex items-center gap-5">
        {/* Termômetro grande estilo Suba Pro Verde */}
        <div className="relative w-[54px] h-[150px] rounded-xl border bg-spv-surface overflow-hidden shadow-lg">
          <div className="h-1/3 bg-red-500" />
          <div className="h-1/3 bg-yellow-400" />
          <div className="h-1/3 bg-green-500" />

          {/* marcador */}
          <div
            className={`absolute left-1/2 -translate-x-1/2 w-[22px] h-[22px] rounded-full border-4 border-white shadow-lg ${
              level === "vermelho"
                ? "bg-red-500"
                : level === "amarelo"
                ? "bg-yellow-400"
                : "bg-green-500"
            }`}
            style={{
              top: "50%",
              marginTop: pos,
            }}
          />
        </div>

        {/* Texto */}
        <div>
          <div className="text-xs text-spv-muted uppercase tracking-wide">
            Reputação do Seller
          </div>

          <div className="text-3xl font-bold text-spv-ink">
            {labelText}
          </div>

          <div className="text-sm text-spv-muted mt-1">
            {subtitleText}
          </div>
        </div>

        {/* Score */}
        <div className="ml-auto text-right">
          <div className="text-xs text-spv-muted">Score</div>
          <div className="text-4xl font-bold text-spv-ink">
            {safeScore}
          </div>
        </div>
      </div>
    </div>
  );
}
