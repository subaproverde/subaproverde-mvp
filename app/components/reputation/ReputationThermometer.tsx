"use client";

import { useEffect, useId, useState, type ComponentType } from "react";
import { AlertTriangle, CheckCircle2, Gauge, ShieldAlert, Zap } from "lucide-react";

export type ReputationLevel = "verde" | "amarelo" | "laranja" | "vermelho";

type Props = {
  level: ReputationLevel;
  label?: string;
  subtitle?: string;
  scoreText?: string;
  theme?: "auto" | "dark" | "light";
  size?: "sm" | "md";
};

type LevelConfig = {
  angle: number;
  color: string;
  color2: string;
  soft: string;
  glow: string;
  icon: ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
};

const levelConfigs: Record<ReputationLevel, LevelConfig> = {
  vermelho: {
    angle: 154,
    color: "#ff4d62",
    color2: "#ff1f4a",
    soft: "rgba(255,77,98,0.16)",
    glow: "rgba(255,77,98,0.44)",
    icon: ShieldAlert,
  },
  laranja: {
    angle: 113,
    color: "#ff8a1f",
    color2: "#ffb02e",
    soft: "rgba(255,138,31,0.16)",
    glow: "rgba(255,138,31,0.40)",
    icon: AlertTriangle,
  },
  amarelo: {
    angle: 68,
    color: "#ffe14d",
    color2: "#fff7a8",
    soft: "rgba(255,225,77,0.18)",
    glow: "rgba(255,225,77,0.34)",
    icon: Zap,
  },
  verde: {
    angle: 22,
    color: "#25f29a",
    color2: "#00d87b",
    soft: "rgba(37,242,154,0.14)",
    glow: "rgba(37,242,154,0.38)",
    icon: CheckCircle2,
  },
};

const segments = [
  { key: "red", start: 180, end: 137, gradient: "red" },
  { key: "orange", start: 134, end: 92, gradient: "orange" },
  { key: "yellow", start: 89, end: 45, gradient: "yellow" },
  { key: "green", start: 42, end: 0, gradient: "green" },
] as const;

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function degToRad(deg: number) {
  return (deg * Math.PI) / 180;
}

function polar(cx: number, cy: number, r: number, angleDeg: number) {
  const a = degToRad(angleDeg);
  return {
    x: cx + r * Math.cos(a),
    y: cy - r * Math.sin(a),
  };
}

function arcPath(cx: number, cy: number, r: number, startDeg: number, endDeg: number) {
  const s = polar(cx, cy, r, startDeg);
  const e = polar(cx, cy, r, endDeg);
  return `M ${s.x} ${s.y} A ${r} ${r} 0 0 1 ${e.x} ${e.y}`;
}

function readThemePreference(): "dark" | "light" {
  if (typeof document === "undefined") return "dark";
  return document.documentElement.dataset.spvTheme === "light" ? "light" : "dark";
}

function normalizeLabel(value: string) {
  return value
    .replace(/ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¡/g, "C")
    .replace(/ÃƒÆ’Ã¢â‚¬Â¡/g, "C")
    .replace(/Ãƒâ€¡/g, "C")
    .replace(/Ã‡/g, "C")
    .replace(/ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢/g, "A");
}

export function ReputationThermometer({
  level,
  label = level.toUpperCase(),
  subtitle = "",
  scoreText = "Score -",
  theme = "auto",
  size = "md",
}: Props) {
  const uid = useId().replace(/:/g, "");
  const [autoTheme, setAutoTheme] = useState<"dark" | "light">(() =>
    theme === "auto" ? readThemePreference() : theme
  );

  useEffect(() => {
    if (theme !== "auto") {
      setAutoTheme(theme);
      return;
    }

    const sync = () => setAutoTheme(readThemePreference());
    sync();
    window.addEventListener("storage", sync);
    window.addEventListener("spv-theme-change", sync);

    return () => {
      window.removeEventListener("storage", sync);
      window.removeEventListener("spv-theme-change", sync);
    };
  }, [theme]);

  const config = levelConfigs[level];
  const isDark = autoTheme === "dark";
  const compact = size === "sm";
  const ActiveIcon = config.icon;
  const activeLabel = normalizeLabel(label);

  const svgW = compact ? 430 : 510;
  const svgH = compact ? 258 : 300;
  const cx = svgW / 2;
  const cy = compact ? 196 : 226;
  const arcR = compact ? 120 : 145;
  const tickOuter = compact ? 104 : 126;
  const tickInner = compact ? 86 : 105;
  const needleLen = compact ? 98 : 119;
  const tip = polar(cx, cy, needleLen, config.angle);
  const startTip = polar(cx, cy, needleLen, 178);

  return (
    <div className="w-full">
      <div
        className={cn(
          "group relative overflow-hidden rounded-[1.75rem] border transition duration-300",
          compact ? "min-h-[312px]" : "min-h-[390px]",
          isDark
            ? "border-white/10 bg-[#020705] text-white shadow-[0_32px_90px_rgba(0,0,0,0.58)]"
            : "border-emerald-950/10 bg-[#f8fff9] text-slate-950 shadow-[0_26px_78px_rgba(15,70,44,0.13)]"
        )}
        style={{
          boxShadow: isDark
            ? `0 32px 90px rgba(0,0,0,0.58), 0 0 56px ${config.glow}`
            : `0 26px 78px rgba(15,70,44,0.13), 0 0 36px ${config.soft}`,
        }}
      >
        <style>{`
          @keyframes spvGaugeSweep {
            0% { stroke-dashoffset: 420; opacity: 0; }
            20% { opacity: .78; }
            100% { stroke-dashoffset: 0; opacity: 0; }
          }
          @keyframes spvPulseCore {
            0%, 100% { transform: scale(1); opacity: .86; }
            50% { transform: scale(1.18); opacity: 1; }
          }
          @keyframes spvPanelSweep {
            0% { transform: translateX(-35%) skewX(-16deg); opacity: 0; }
            30% { opacity: .58; }
            100% { transform: translateX(170%) skewX(-16deg); opacity: 0; }
          }
          @keyframes spvNeedleGlow {
            0%, 100% { opacity: .62; }
            50% { opacity: 1; }
          }
        `}</style>

        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background: isDark
              ? `radial-gradient(circle at 50% 70%, ${config.glow}, transparent 31%), radial-gradient(circle at 14% 2%, rgba(37,242,154,0.16), transparent 34%), linear-gradient(135deg, rgba(255,255,255,0.075), transparent 44%)`
              : `radial-gradient(circle at 50% 72%, ${config.soft}, transparent 34%), radial-gradient(circle at 12% 4%, rgba(37,242,154,0.18), transparent 34%), linear-gradient(135deg, rgba(255,255,255,0.98), rgba(228,255,238,0.56))`,
          }}
        />
        <div
          className="pointer-events-none absolute inset-0 opacity-60"
          style={{
            backgroundImage: isDark
              ? "linear-gradient(rgba(255,255,255,.034) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.034) 1px, transparent 1px)"
              : "linear-gradient(rgba(15,70,44,.052) 1px, transparent 1px), linear-gradient(90deg, rgba(15,70,44,.052) 1px, transparent 1px)",
            backgroundSize: "34px 34px",
            maskImage: "radial-gradient(circle at 50% 52%, black 0%, transparent 78%)",
          }}
        />
        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-px"
          style={{ background: `linear-gradient(90deg, transparent, ${config.color}, transparent)` }}
        />
        <div
          className="pointer-events-none absolute -left-1/3 top-0 h-full w-1/3 blur-xl"
          style={{
            animation: "spvPanelSweep 4.4s ease-in-out infinite",
            background: `linear-gradient(90deg, transparent, ${config.soft}, transparent)`,
          }}
        />

        <div className={cn("relative", compact ? "p-4" : "p-5 sm:p-6")}>
          <div className="flex items-start justify-between gap-4">
            <div className="flex min-w-0 items-center gap-3">
              <div
                className={cn(
                  "relative flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border",
                  isDark ? "border-white/10 bg-white/[0.055]" : "border-emerald-950/10 bg-white/80"
                )}
                style={{ color: config.color }}
              >
                <span
                  className="absolute inset-1 rounded-2xl opacity-70"
                  style={{ boxShadow: `0 0 24px ${config.glow}` }}
                />
                <Gauge className="relative h-5 w-5" aria-hidden={true} />
              </div>
              <div className="min-w-0">
                <div
                  className={cn(
                    "text-xs font-semibold uppercase tracking-[0.2em]",
                    isDark ? "text-white/45" : "text-slate-500"
                  )}
                >
                  Termômetro SPV
                </div>
                <div className={cn("mt-1 truncate text-sm font-semibold", isDark ? "text-white/82" : "text-slate-800")}>
                  Reputação do seller
                </div>
              </div>
            </div>

            <div
              className={cn(
                "shrink-0 rounded-full border px-3 py-1.5 text-sm font-bold",
                isDark ? "border-white/12 bg-white/[0.055] text-white/86" : "border-emerald-950/10 bg-white/85 text-slate-800"
              )}
            >
              {scoreText}
            </div>
          </div>

          <div className="mt-4 flex justify-center">
            <div
              className="text-3xl font-black uppercase leading-none tracking-[0.05em] sm:text-4xl"
              style={{ color: config.color, textShadow: isDark ? `0 0 30px ${config.glow}` : "none" }}
            >
              {activeLabel}
            </div>
          </div>

          <div className="relative mt-2 flex justify-center">
            <div
              className="pointer-events-none absolute left-1/2 top-[55%] h-56 w-56 -translate-x-1/2 -translate-y-1/2 rounded-full blur-3xl"
              style={{ background: config.glow }}
            />

            <svg
              width={svgW}
              height={svgH}
              viewBox={`0 0 ${svgW} ${svgH}`}
              className={cn("relative z-10 h-auto w-full", compact ? "max-w-[430px]" : "max-w-[510px]")}
              role="img"
              aria-label={`Termômetro de reputação: ${activeLabel}. ${subtitle}.`}
            >
              <defs>
                <filter id={`${uid}-glow`} x="-45%" y="-45%" width="190%" height="190%">
                  <feGaussianBlur stdDeviation="5.5" result="blur" />
                  <feMerge>
                    <feMergeNode in="blur" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
                <linearGradient id={`${uid}-panel`} x1="0" x2="1" y1="0" y2="1">
                  <stop offset="0%" stopColor={isDark ? "rgba(255,255,255,0.12)" : "rgba(255,255,255,0.98)"} />
                  <stop offset="54%" stopColor={isDark ? "rgba(37,242,154,0.024)" : "rgba(235,255,243,0.78)"} />
                  <stop offset="100%" stopColor={isDark ? "rgba(255,255,255,0.026)" : "rgba(210,248,225,0.58)"} />
                </linearGradient>
                <linearGradient id={`${uid}-red`} x1="0" x2="1" y1="0" y2="0">
                  <stop offset="0%" stopColor="#ff6a7d" />
                  <stop offset="100%" stopColor="#ff1f4a" />
                </linearGradient>
                <linearGradient id={`${uid}-orange`} x1="0" x2="1" y1="0" y2="0">
                  <stop offset="0%" stopColor="#ff8a1f" />
                  <stop offset="100%" stopColor="#ffbe3d" />
                </linearGradient>
                <linearGradient id={`${uid}-yellow`} x1="0" x2="1" y1="0" y2="0">
                  <stop offset="0%" stopColor="#ffd738" />
                  <stop offset="100%" stopColor="#fff7a8" />
                </linearGradient>
                <linearGradient id={`${uid}-green`} x1="0" x2="1" y1="0" y2="0">
                  <stop offset="0%" stopColor="#34e67d" />
                  <stop offset="100%" stopColor="#00f0a0" />
                </linearGradient>
                <linearGradient id={`${uid}-scan`} x1="0" x2="1" y1="0" y2="0">
                  <stop offset="0%" stopColor="rgba(255,255,255,0)" />
                  <stop offset="48%" stopColor="rgba(255,255,255,0.95)" />
                  <stop offset="100%" stopColor="rgba(255,255,255,0)" />
                </linearGradient>
                <linearGradient id={`${uid}-needle`} x1="0" x2="1" y1="0" y2="0">
                  <stop offset="0%" stopColor={isDark ? "rgba(255,255,255,0.92)" : "#0f172a"} />
                  <stop offset="100%" stopColor={config.color2} />
                </linearGradient>
              </defs>

              <rect
                x="18"
                y="18"
                width={svgW - 36}
                height={svgH - 36}
                rx="30"
                fill={`url(#${uid}-panel)`}
                stroke={isDark ? "rgba(255,255,255,0.08)" : "rgba(15,70,44,0.11)"}
              />

              <text
                x={cx}
                y={compact ? 85 : 94}
                textAnchor="middle"
                fill={isDark ? "rgba(255,255,255,0.045)" : "rgba(15,70,44,0.055)"}
                fontSize={compact ? 48 : 58}
                fontWeight="900"
                letterSpacing="0"
              >
                SUBA
              </text>

              <path
                d={arcPath(cx, cy, arcR, 180, 0)}
                fill="none"
                stroke={isDark ? "rgba(255,255,255,0.09)" : "rgba(15,70,44,0.10)"}
                strokeWidth="34"
                strokeLinecap="round"
              />

              {segments.map((segment) => (
                <path
                  key={segment.key}
                  d={arcPath(cx, cy, arcR, segment.start, segment.end)}
                  fill="none"
                  stroke={`url(#${uid}-${segment.gradient})`}
                  strokeWidth="22"
                  strokeLinecap="round"
                  filter={`url(#${uid}-glow)`}
                />
              ))}

              <path
                d={arcPath(cx, cy, arcR, 180, 0)}
                fill="none"
                stroke={`url(#${uid}-scan)`}
                strokeWidth="7"
                strokeLinecap="round"
                strokeDasharray="48 390"
                style={{ animation: "spvGaugeSweep 4s ease-in-out infinite" }}
              />

              {Array.from({ length: 19 }).map((_, i) => {
                const angle = 180 - i * (180 / 18);
                const tall = i % 3 === 0;
                const a = degToRad(angle);
                const xA = cx + (tall ? tickInner - 3 : tickInner) * Math.cos(a);
                const yA = cy - (tall ? tickInner - 3 : tickInner) * Math.sin(a);
                const xB = cx + tickOuter * Math.cos(a);
                const yB = cy - tickOuter * Math.sin(a);

                return (
                  <line
                    key={i}
                    x1={xA}
                    y1={yA}
                    x2={xB}
                    y2={yB}
                    stroke={isDark ? "rgba(255,255,255,0.28)" : "rgba(15,23,42,0.28)"}
                    strokeWidth={tall ? 2 : 1}
                    strokeLinecap="round"
                  />
                );
              })}

              <line
                x1={cx}
                y1={cy}
                x2={tip.x}
                y2={tip.y}
                stroke={`url(#${uid}-needle)`}
                strokeWidth="5"
                strokeLinecap="round"
                filter={`url(#${uid}-glow)`}
              >
                <animate attributeName="x2" from={startTip.x} to={tip.x} dur="1.05s" fill="freeze" />
                <animate attributeName="y2" from={startTip.y} to={tip.y} dur="1.05s" fill="freeze" />
              </line>

              <circle
                cx={cx}
                cy={cy}
                r="23"
                fill={config.color}
                opacity="0.18"
                style={{ animation: "spvPulseCore 2.2s ease-in-out infinite", transformOrigin: `${cx}px ${cy}px` }}
              />
              <circle cx={cx} cy={cy} r="15" fill={isDark ? "#050807" : "#f8fff9"} stroke={config.color} strokeWidth="2.5" />
              <circle cx={cx} cy={cy} r="6" fill={config.color2} style={{ animation: "spvNeedleGlow 2s ease-in-out infinite" }} />

              <g opacity={isDark ? "0.55" : "0.38"}>
                <circle cx={cx - 148} cy={cy - 20} r="2.5" fill={config.color} />
                <circle cx={cx + 148} cy={cy - 20} r="2.5" fill={config.color} />
                <circle cx={cx} cy={cy - arcR - 22} r="2.5" fill={config.color} />
              </g>
            </svg>
          </div>

          <div className="-mt-1 flex justify-center">
            {subtitle ? (
              <div
                className="inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-bold"
                style={{
                  backgroundColor: config.soft,
                  borderColor: config.glow,
                  color: isDark ? "rgba(255,255,255,0.94)" : "#0f172a",
                  boxShadow: isDark
                    ? `0 12px 32px rgba(0,0,0,0.32), 0 0 24px ${config.soft}`
                    : "0 12px 28px rgba(15,70,44,0.10)",
                }}
              >
                <ActiveIcon className="h-4 w-4" aria-hidden={true} />
                <span>{subtitle}</span>
              </div>
            ) : null}
          </div>
        </div>

        <div
          className="pointer-events-none absolute inset-x-8 bottom-0 h-px opacity-70"
          style={{ background: `linear-gradient(90deg, transparent, ${config.color}, transparent)` }}
        />
      </div>
    </div>
  );
}
