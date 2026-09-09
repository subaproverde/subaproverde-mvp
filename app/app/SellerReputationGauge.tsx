"use client";

import { useId, type CSSProperties } from "react";
import s from "./seller-gauge.module.css";

const bands = [
  { level: "vermelho", path: "M 45 166 A 135 135 0 0 1 80 75", light: "#faadb0", color: "#ce7278", dark: "#803a45" },
  { level: "laranja", path: "M 87 68 A 135 135 0 0 1 175 31", light: "#f6cf9e", color: "#d79962", dark: "#885126" },
  { level: "amarelo", path: "M 185 31 A 135 135 0 0 1 273 68", light: "#fff0ae", color: "#d9c46a", dark: "#8c7b30" },
  { level: "verde", path: "M 280 75 A 135 135 0 0 1 315 166", light: "#ace880", color: "#60b838", dark: "#326221" },
];

export default function SellerReputationGauge({ level, label, available }: { level: string; label: string; available: boolean }) {
  const id = `seller-gauge-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
  const index = bands.findIndex((band) => band.level === level);
  const valid = available && index >= 0;
  // Preserve the existing four-level mapping. The score is not a gauge angle.
  const angle = -72 + Math.max(0, index) * 48;
  const url = (name: string) => `url(#${id}-${name})`;
  return <svg className={s.instrument} viewBox="0 0 360 215" role="img" aria-label={valid ? `Reputação: ${label}` : "Reputação indisponível"}>
    <defs>
      <radialGradient id={`${id}-face`} cx="50%" cy="90%" r="85%"><stop stopColor="#323b3b" /><stop offset=".65" stopColor="#202729" /><stop offset="1" stopColor="#171c1e" /></radialGradient>
      <linearGradient id={`${id}-metal`} x1="0" y1="0" x2="1" y2="1"><stop stopColor="#f2f5eb" /><stop offset=".3" stopColor="#9da9a4" /><stop offset=".55" stopColor="#46524e" /><stop offset="1" stopColor="#202824" /></linearGradient>
      <linearGradient id={`${id}-needle`} x1="0" y1="0" x2="1" y2="0"><stop stopColor="#7c9086" /><stop offset=".48" stopColor="#f6fff4" /><stop offset=".53" stopColor="#c4d5c8" /><stop offset="1" stopColor="#70837a" /></linearGradient>
      {bands.map((band) => <linearGradient key={band.level} id={`${id}-${band.level}`} x1="0" y1="0" x2="0" y2="1"><stop stopColor={band.light} /><stop offset=".4" stopColor={band.color} /><stop offset="1" stopColor={band.dark} /></linearGradient>)}
      <filter id={`${id}-shadow`} x="-30%" y="-30%" width="170%" height="180%"><feDropShadow dx="0" dy="5" stdDeviation="3" floodColor="#000" floodOpacity=".55" /></filter>
      <filter id={`${id}-glow`} x="-60%" y="-60%" width="220%" height="220%"><feGaussianBlur stdDeviation="6" /></filter>
    </defs>
    <ellipse cx="180" cy="178" rx="139" ry="10" fill="#0d1214" opacity=".55" />
    <path d="M 28 169 A 152 152 0 0 1 332 169 L 332 173 Q 180 193 28 173 Z" fill={url("face")} stroke="#3b4544" strokeWidth="1" />
    <path d="M 30 163 A 150 150 0 0 1 330 163" fill="none" stroke="#57625c" strokeOpacity=".28" />
    <g transform="translate(0 5)">{bands.map((band) => <path key={band.level} d={band.path} fill="none" stroke={band.dark} strokeWidth="22" />)}</g>
    {valid && <path className={s.halo} d={bands[index].path} fill="none" stroke={bands[index].color} strokeWidth="24" filter={url("glow")} />}
    <g filter={url("shadow")}>{bands.map((band) => <g key={band.level}><path d={band.path} fill="none" stroke={url(band.level)} strokeWidth="18" /><path d={band.path} transform="translate(0 -5)" fill="none" stroke={band.light} strokeWidth="1.5" strokeOpacity=".65" /></g>)}</g>
    <path d="M 68 166 A 112 112 0 0 1 292 166" fill="none" stroke="#58685e" strokeWidth="1" strokeDasharray="2 9" />
    {Array.from({ length: 9 }, (_, i) => <path key={i} d="M 180 56 L 180 63" stroke="#93a195" strokeOpacity=".65" strokeWidth="1.5" transform={`rotate(${-90 + i * 22.5} 180 166)`} />)}
    {valid && <g key={level} className={s.needle} style={{ "--needle-angle": `${angle}deg` } as CSSProperties}>
      <path d="M 175 171 L 180 58 L 185 171 L 180 178 Z" fill={url("needle")} filter={url("shadow")} />
      <path d="M 180 65 L 180 164" stroke="#fff" strokeOpacity=".7" strokeWidth=".8" />
    </g>}
    {valid && <g><circle cx="180" cy="166" r="13" fill={url("metal")} filter={url("shadow")} /><circle cx="180" cy="166" r="8.5" fill="#25332c" stroke="#9eafa1" strokeWidth=".8" /><circle cx="180" cy="166" r="3" fill={bands[index].light} /></g>}
    <text x="43" y="205" textAnchor="middle" fill="#aeb7b4" fontSize="10">EM RISCO</text><text x="310" y="205" textAnchor="middle" fill="#aeb7b4" fontSize="10">SAUDÁVEL</text>
  </svg>;
}
