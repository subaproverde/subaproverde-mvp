"use client";

import { useId, type CSSProperties } from "react";
import s from "./seller-gauge.module.css";

// Broad, faceted segments follow the brand symbol rather than an instrument dial.
const segments = [
  { from: -106, to: -82, color: "#a71830", light: "#c52c3a", dark: "#85162c" },
  { from: -80, to: -43, color: "#e33518", light: "#f34e16", dark: "#b92418" },
  { from: -41, to: -4, color: "#ffad00", light: "#ffc018", dark: "#e78b00" },
  { from: -2, to: 35, color: "#ffda15", light: "#ffe440", dark: "#e9bc00" },
  { from: 37, to: 68, color: "#91c91c", light: "#a6d731", dark: "#70a419" },
  { from: 70, to: 106, color: "#22913c", light: "#41a64a", dark: "#137337" },
];

function point(radius: number, degrees: number) {
  const radians = degrees * Math.PI / 180;
  // Stable serialization across server/browser floating-point implementations.
  return `${(180 + radius * Math.sin(radians)).toFixed(3)} ${(158 - radius * Math.cos(radians)).toFixed(3)}`;
}
function sector(from: number, to: number, outer: number, inner: number) {
  return `M ${point(outer, from)} A ${outer} ${outer} 0 0 1 ${point(outer, to)} L ${point(inner, to)} A ${inner} ${inner} 0 0 0 ${point(inner, from)} Z`;
}

export default function SellerReputationGauge({ level, label, available }: { level: string; label: string; available: boolean }) {
  const id = `seller-gauge-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
  const index = ["vermelho", "laranja", "amarelo", "verde"].indexOf(level);
  const valid = available && index >= 0;
  // Retain the original reputation-level mapping; no score or business-data changes.
  const angle = -72 + Math.max(0, index) * 48;
  return <svg className={s.instrument} viewBox="0 0 360 235" role="img" aria-label={valid ? `Reputação: ${label}` : "Reputação indisponível"}>
    <defs>
      <linearGradient id={`${id}-arm`} x1="0" y1="0" x2="1" y2="1"><stop stopColor="#005b34" /><stop offset="1" stopColor="#21843d" /></linearGradient>
      <filter id={`${id}-shadow`} x="-30%" y="-30%" width="160%" height="170%"><feDropShadow dx="0" dy="3" stdDeviation="2" floodColor="#091b0c" floodOpacity=".22" /></filter>
    </defs>
    <g filter={`url(#${id}-shadow)`}>{segments.map((band, i) => <g key={i}>
      <path d={sector(band.from, band.to, 132, 82)} fill={band.color} />
      <path d={sector(band.from, band.to, 132, 107)} fill={band.light} />
      <path d={sector(band.from, band.to, 91, 82)} fill={band.dark} />
    </g>)}</g>
    {valid && <g key={level} className={s.needle} style={{ "--needle-angle": `${angle}deg` } as CSSProperties}>
      <g transform="translate(3 4)"><path d="M 164 158 L 167 59 Q 180 44 193 59 L 196 158 Z" fill="#edf1e8" /><circle cx="180" cy="158" r="22" fill="#edf1e8" /></g>
      <path d="M 164 158 L 167 59 Q 180 44 193 59 L 196 158 Z" fill={`url(#${id}-arm)`} />
      <circle cx="180" cy="158" r="22" fill="#258442" />
      <circle cx="180" cy="158" r="12" fill="#153a2c" />
      <circle cx="180" cy="158" r="11" fill="none" stroke="#53a647" strokeWidth="2" />
      {level === "verde" ? <g transform={`rotate(${-angle} 180 53)`}>
        <circle cx="180" cy="53" r="29" fill="#262c2e" />
        <circle cx="180" cy="53" r="24" fill="#5cb72f" />
        <path d="M 168 53 L 177 62 L 192 45" fill="none" stroke="#07592f" strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" />
      </g> : <path d="M 170 62 L 180 43 L 190 62 Z" fill="#0a6235" />}
    </g>}
    <text x="59" y="223" textAnchor="middle" fill="#aeb7b4" fontSize="10">EM RISCO</text><text x="301" y="223" textAnchor="middle" fill="#aeb7b4" fontSize="10">SAUDÁVEL</text>
  </svg>;
}
