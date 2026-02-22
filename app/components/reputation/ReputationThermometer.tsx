"use client";

import React from "react";

export type ReputationLevel = "verde" | "amarelo" | "laranja" | "vermelho";

type Props = {
  level: ReputationLevel;

  /** Texto grande (ex: AMARELO) */
  label?: string;

  /** Texto menor (ex: Atenção / Conta em risco / Saudável) */
  subtitle?: string;

  /** Texto do score (ex: "Score 43") */
  scoreText?: string;

  /** se quiser forçar dark/light no gauge */
  theme?: "dark" | "light";

  /** controla tamanho sem esticar grid */
  size?: "sm" | "md";
};

function degToRad(deg: number) {
  return (deg * Math.PI) / 180;
}

function polar(cx: number, cy: number, r: number, angleDeg: number) {
  // Nosso gauge é 180° (esquerda) -> 0° (direita)
  const a = degToRad(angleDeg);
  return {
    x: cx + r * Math.cos(a),
    y: cy - r * Math.sin(a),
  };
}

function arcPath(cx: number, cy: number, r: number, startDeg: number, endDeg: number) {
  const s = polar(cx, cy, r, startDeg);
  const e = polar(cx, cy, r, endDeg);

  // Como sempre é arco <= 180°, largeArcFlag = 0
  const largeArcFlag = 0;
  const sweepFlag = 1; // sentido horário no topo (180 -> 0)

  return `M ${s.x} ${s.y} A ${r} ${r} 0 ${largeArcFlag} ${sweepFlag} ${e.x} ${e.y}`;
}

function angleByLevel(level: ReputationLevel) {
  // pontos centrais (ajustável fino)
  switch (level) {
    case "vermelho":
      return 155;
    case "laranja":
      return 115;
    case "amarelo":
      return 70;
    case "verde":
    default:
      return 22;
  }
}

function levelColor(level: ReputationLevel) {
  if (level === "vermelho") return "#ff4d4d";
  if (level === "laranja") return "#ff7a00";
  if (level === "amarelo") return "#ffd400";
  return "#22c55e";
}

function subtitleAccent(level: ReputationLevel) {
  if (level === "vermelho")
    return { bg: "rgba(255,77,77,0.16)", bd: "rgba(255,77,77,0.35)", fg: "rgba(255,255,255,0.92)" };
  if (level === "laranja")
    return { bg: "rgba(255,122,0,0.16)", bd: "rgba(255,122,0,0.35)", fg: "rgba(255,255,255,0.92)" };
  if (level === "amarelo")
    return { bg: "rgba(255,212,0,0.18)", bd: "rgba(255,212,0,0.38)", fg: "rgba(255,255,255,0.92)" };
  return { bg: "rgba(34,197,94,0.16)", bd: "rgba(34,197,94,0.35)", fg: "rgba(255,255,255,0.92)" };
}

function subtitleIcon(subtitle: string) {
  const s = (subtitle || "").toLowerCase();
  if (s.includes("aten")) return "⚠️";
  if (s.includes("risco")) return "🚨";
  if (s.includes("saud")) return "✅";
  return "ℹ️";
}

export function ReputationThermometer({
  level,
  label = level.toUpperCase(),
  subtitle = "",
  scoreText = "Score —",
  theme = "dark",
  size = "md",
}: Props) {
  const isDark = theme === "dark";

  // área interna do SVG (gauge)
  const svgW = size === "sm" ? 360 : 420;
  const svgH = size === "sm" ? 200 : 230;

  const cx = svgW / 2;
  const cy = size === "sm" ? 150 : 170;

  const rBase = 115;
  const rColor = 115;
  const rTicks1 = 78;
  const rTicks2 = 94;

  const needleLen = size === "sm" ? 92 : 104;
  const angleDeg = angleByLevel(level);
  const tip = polar(cx, cy, needleLen, angleDeg);

  // ✅ card totalmente preto no dark
  const cardBg = isDark ? "bg-black" : "bg-white";
  const cardBorder = isDark ? "border-white/10" : "border-slate-200";

  // ✅ aqui é a chave: no dark o “painel” do svg vira transparente
  const innerFill = isDark ? "transparent" : "#f8fafc";
  const innerStroke = isDark ? "rgba(255,255,255,0.04)" : "#e5e7eb";

  const baseArc = isDark ? "#1f2937" : "#e5e7eb";
  const tick = isDark ? "rgba(255,255,255,0.18)" : "rgba(15,23,42,0.25)";
  const needle = isDark ? "white" : "#0f172a";

  const labelColor = levelColor(level);
  const subA = subtitleAccent(level);
  const subI = subtitleIcon(subtitle);

  // ✅ SEGMENTOS (os seus, NÃO mexi)
  const segRed = { s: 180, e: 135 };
  const segOrange = { s: 133, e: 91 };
  const segYellow = { s: 89, e: 44 };
  const segGreen = { s: 42, e: 0 };

  return (
    <div className="w-full">
      <div className={`rounded-2xl border ${cardBorder} ${cardBg} shadow-sm overflow-hidden`}>
        <div className="p-5">
          {/* HEADER */}
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className={isDark ? "text-base font-semibold text-white/85" : "text-base font-semibold text-slate-700"}>
                Reputação do seller
              </div>
            </div>

            {/* score mais presente */}
            <span
              className={
                isDark
                  ? "text-base px-3 py-1.5 rounded-full border border-white/15 bg-white/5 text-white/90 whitespace-nowrap"
                  : "text-base px-3 py-1.5 rounded-full border bg-slate-50 text-slate-700 whitespace-nowrap"
              }
            >
              {scoreText}
            </span>
          </div>

          {/* LABEL CENTRALIZADO */}
          <div className="mt-2 flex justify-center">
            <div className="text-3xl font-semibold tracking-wide leading-none" style={{ color: labelColor }}>
              {label}
            </div>
          </div>

          {/* GAUGE */}
          <div className="mt-3 flex justify-center">
            <svg width={svgW} height={svgH} viewBox={`0 0 ${svgW} ${svgH}`} className="block" aria-hidden="true">
              <defs>
                <filter id="softGlow" x="-40%" y="-40%" width="180%" height="180%">
                  <feGaussianBlur stdDeviation="4" result="blur" />
                  <feMerge>
                    <feMergeNode in="blur" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>

                <linearGradient id="gRed" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="#ff4d4d" />
                  <stop offset="100%" stopColor="#ff1f1f" />
                </linearGradient>

                <linearGradient id="gOrange" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="#ff7a00" />
                  <stop offset="100%" stopColor="#ffb000" />
                </linearGradient>

                <linearGradient id="gYellow" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="#ffd400" />
                  <stop offset="100%" stopColor="#fff1a8" />
                </linearGradient>

                <linearGradient id="gGreen" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="#22c55e" />
                  <stop offset="100%" stopColor="#00e676" />
                </linearGradient>
              </defs>

              {/* painel -> transparente no dark */}
              <rect x="18" y="12" width={svgW - 36} height={svgH - 24} rx="18" fill={innerFill} stroke={innerStroke} />

              {/* arco base */}
              <path d={arcPath(cx, cy, rBase, 180, 0)} fill="none" stroke={baseArc} strokeWidth="28" strokeLinecap="round" />

              {/* segmentos */}
              <path d={arcPath(cx, cy, rColor, segRed.s, segRed.e)} fill="none" stroke="url(#gRed)" strokeWidth="20" strokeLinecap="round" filter="url(#softGlow)" />
              <path d={arcPath(cx, cy, rColor, segOrange.s, segOrange.e)} fill="none" stroke="url(#gOrange)" strokeWidth="20" strokeLinecap="round" filter="url(#softGlow)" />
              <path d={arcPath(cx, cy, rColor, segYellow.s, segYellow.e)} fill="none" stroke="url(#gYellow)" strokeWidth="20" strokeLinecap="round" filter="url(#softGlow)" />
              <path d={arcPath(cx, cy, rColor, segGreen.s, segGreen.e)} fill="none" stroke="url(#gGreen)" strokeWidth="20" strokeLinecap="round" filter="url(#softGlow)" />

              {/* ticks */}
              {Array.from({ length: 18 }).map((_, i) => {
                const t = 180 - i * (180 / 17);
                const a = degToRad(t);
                const xA = cx + rTicks1 * Math.cos(a);
                const yA = cy - rTicks1 * Math.sin(a);
                const xB = cx + rTicks2 * Math.cos(a);
                const yB = cy - rTicks2 * Math.sin(a);

                return <line key={i} x1={xA} y1={yA} x2={xB} y2={yB} stroke={tick} strokeWidth={i % 3 === 0 ? 2 : 1} />;
              })}

              {/* ponteiro */}
              <line
                x1={cx}
                y1={cy}
                x2={tip.x}
                y2={tip.y}
                stroke={needle}
                strokeWidth="4"
                strokeLinecap="round"
                style={{ filter: isDark ? "drop-shadow(0 0 10px rgba(255,255,255,0.14))" : undefined }}
              />

              {/* hub */}
              <circle cx={cx} cy={cy} r="12" fill={isDark ? "#000" : innerFill} stroke={isDark ? "rgba(255,255,255,0.25)" : "#cbd5e1"} />
              <circle cx={cx} cy={cy} r="5" fill={isDark ? "#fff" : "#0f172a"} />
            </svg>
          </div>

          {/* SUBTITLE DESTACADO */}
          <div className="mt-3 flex justify-center">
            {subtitle ? (
              <div
                className="inline-flex items-center gap-2 px-4 py-2 rounded-full border text-base font-semibold"
                style={{
                  background: subA.bg,
                  borderColor: subA.bd,
                  color: subA.fg,
                  boxShadow: isDark ? "0 8px 22px rgba(0,0,0,0.35)" : "0 10px 24px rgba(15,23,42,0.10)",
                }}
              >
                <span className="text-lg leading-none">{subI}</span>
                <span>{subtitle}</span>
              </div>
            ) : (
              <div className={isDark ? "text-base text-white/50" : "text-base text-slate-400"}>&nbsp;</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
