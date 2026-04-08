"use client";

import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

/**
 * Intro premium para a landing da Suba Pro Verde.
 *
 * Como usar:
 * 1) Salve este arquivo como `components/SubaProVerdeIntro.tsx`
 * 2) Coloque a logo em `public/logo-suba-pro-verde.png`
 * 3) Renderize no topo da página/layout:
 *
 *    <SubaProVerdeIntro />
 *
 * Observação:
 * - O som é opcional e só toca após interação do usuário por causa das políticas do navegador.
 * - Para trocar a duração total, ajuste INTRO_DURATION.
 */

const INTRO_DURATION = 3600;
const METER_START = 0.08;
const METER_END = 0.98;

export default function SubaProVerdeIntro() {
  const [mounted, setMounted] = useState(false);
  const [hide, setHide] = useState(false);
  const [progress, setProgress] = useState(METER_START);
  const [allowSound, setAllowSound] = useState(false);
  const [pulse, setPulse] = useState(false);

  useEffect(() => {
    setMounted(true);

    const enableSound = () => setAllowSound(true);
    window.addEventListener("pointerdown", enableSound, { once: true });
    window.addEventListener("keydown", enableSound, { once: true });

    const startDelay = window.setTimeout(() => {
      const startedAt = performance.now();
      const duration = 1500;

      const step = (now: number) => {
        const elapsed = now - startedAt;
        const t = Math.min(elapsed / duration, 1);
        const eased = 1 - Math.pow(1 - t, 3);
        const next = METER_START + (METER_END - METER_START) * eased;
        setProgress(next);

        if (t < 1) {
          requestAnimationFrame(step);
        } else {
          setPulse(true);
          window.setTimeout(() => setPulse(false), 900);
        }
      };

      requestAnimationFrame(step);
    }, 750);

    const finishTimer = window.setTimeout(() => {
      setHide(true);
    }, INTRO_DURATION);

    return () => {
      window.clearTimeout(startDelay);
      window.clearTimeout(finishTimer);
      window.removeEventListener("pointerdown", enableSound);
      window.removeEventListener("keydown", enableSound);
    };
  }, []);

  useEffect(() => {
    if (!allowSound) return;
    if (progress < 0.2) return;

    let cancelled = false;
    const AudioCtx = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;

    const ctx = new AudioCtx();
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();

    osc.type = "sine";
    osc.frequency.setValueAtTime(220, now);
    osc.frequency.exponentialRampToValueAtTime(880, now + 0.8);

    filter.type = "lowpass";
    filter.frequency.setValueAtTime(1200, now);

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.025, now + 0.15);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.95);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 1);

    osc.onended = () => {
      if (!cancelled) void ctx.close();
    };

    return () => {
      cancelled = true;
      try {
        osc.stop();
      } catch {}
      void ctx.close();
    };
  }, [allowSound]);

  const arcLength = useMemo(() => 565.48, []);
  const dashOffset = arcLength * (1 - progress);

  if (!mounted) return null;

  return (
    <AnimatePresence>
      {!hide && (
        <motion.div
          initial={{ opacity: 1 }}
          exit={{ opacity: 0, scale: 1.02, filter: "blur(8px)" }}
          transition={{ duration: 0.75, ease: "easeInOut" }}
          className="fixed inset-0 z-[9999] overflow-hidden bg-black"
        >
          <BackgroundFX intense={pulse} />

          <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(34,197,94,0.12),transparent_35%),radial-gradient(circle_at_20%_30%,rgba(255,255,255,0.06),transparent_18%),radial-gradient(circle_at_80%_70%,rgba(34,197,94,0.08),transparent_24%)]" />

          <div className="relative flex h-full w-full items-center justify-center px-6">
            <div className="relative mx-auto flex w-full max-w-6xl flex-col items-center justify-center gap-8">
              <motion.div
                initial={{ opacity: 0, y: -80, scale: 0.92, filter: "blur(16px)" }}
                animate={{ opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }}
                transition={{ duration: 1.1, ease: [0.16, 1, 0.3, 1] }}
                className="relative"
              >
                <motion.div
                  animate={pulse ? { scale: [1, 1.03, 1], filter: ["drop-shadow(0 0 0px rgba(34,197,94,0.0))", "drop-shadow(0 0 24px rgba(34,197,94,0.55))", "drop-shadow(0 0 8px rgba(34,197,94,0.2))"] } : { scale: 1 }}
                  transition={{ duration: 0.8, ease: "easeOut" }}
                  className="relative"
                >
                  <img
                    src="/logo-suba-pro-verde.png"
                    alt="Suba Pro Verde"
                    className="relative z-10 w-[300px] max-w-[78vw] select-none md:w-[620px]"
                  />

                  <div className="pointer-events-none absolute -left-10 top-1/2 z-20 h-[170px] w-[170px] -translate-y-1/2 md:-left-16 md:h-[260px] md:w-[260px]">
                    <AnimatedGauge progress={progress} pulse={pulse} arcLength={arcLength} dashOffset={dashOffset} />
                  </div>
                </motion.div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: progress > 0.78 ? 1 : 0, y: progress > 0.78 ? 0 : 14 }}
                transition={{ duration: 0.5, ease: "easeOut" }}
                className="text-center"
              >
                <h1 className="text-2xl font-semibold tracking-[0.18em] text-white/95 md:text-4xl">
                  BEM-VINDO À SUBA PRO VERDE
                </h1>
                <p className="mt-3 max-w-3xl text-sm font-light tracking-[0.22em] text-white/55 md:text-base">
                  Sua plataforma de gestão de reputação e performance para sellers do Mercado Livre
                </p>
              </motion.div>
            </div>
          </div>

          <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-black via-black/40 to-transparent" />
        </motion.div>
      )}
    </AnimatePresence>
  );
}

type GaugeProps = {
  progress: number;
  pulse: boolean;
  arcLength: number;
  dashOffset: number;
};

function AnimatedGauge({ progress, pulse, arcLength, dashOffset }: GaugeProps) {
  const angle = -130 + progress * 180;

  return (
    <div className="relative h-full w-full">
      <svg viewBox="0 0 240 180" className="h-full w-full overflow-visible">
        <defs>
          <linearGradient id="gaugeTrack" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#ff2d12" />
            <stop offset="25%" stopColor="#ff7a00" />
            <stop offset="50%" stopColor="#ffd000" />
            <stop offset="72%" stopColor="#74d700" />
            <stop offset="100%" stopColor="#00c853" />
          </linearGradient>
          <filter id="softGlow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="4" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <filter id="greenBlast" x="-80%" y="-80%" width="260%" height="260%">
            <feGaussianBlur stdDeviation="8" result="blur2" />
            <feColorMatrix
              in="blur2"
              type="matrix"
              values="1 0 0 0 0  0 1 0 0 0.35  0 0 1 0 0.1  0 0 0 1 0"
            />
            <feMerge>
              <feMergeNode in="blur2" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        <path
          d="M 25 145 A 95 95 0 0 1 215 145"
          fill="none"
          stroke="rgba(255,255,255,0.08)"
          strokeWidth="18"
          strokeLinecap="round"
        />

        <motion.path
          d="M 25 145 A 95 95 0 0 1 215 145"
          fill="none"
          stroke="url(#gaugeTrack)"
          strokeWidth="18"
          strokeLinecap="round"
          strokeDasharray={arcLength}
          strokeDashoffset={dashOffset}
          filter={pulse ? "url(#greenBlast)" : "url(#softGlow)"}
          style={{ transition: "stroke-dashoffset 40ms linear" }}
        />

        <motion.circle
          cx="215"
          cy="145"
          r={pulse ? 10 : 0}
          fill="rgba(34,197,94,0.9)"
          animate={pulse ? { r: [8, 20, 8], opacity: [0.9, 0.2, 0] } : { r: 0, opacity: 0 }}
          transition={{ duration: 0.7, ease: "easeOut" }}
        />
      </svg>

      <motion.div
        style={{ transform: `translate(-50%, -84%) rotate(${angle}deg)` }}
        animate={pulse ? { rotate: [angle - 1.8, angle + 1.8, angle - 0.8, angle], scale: [1, 1.03, 0.995, 1] } : { rotate: angle, scale: 1 }}
        transition={pulse ? { duration: 0.55, ease: "easeOut" } : { duration: 0.08, ease: "linear" }}
        className="absolute left-1/2 top-[80%] h-[8px] w-[88px] origin-[6px_center] rounded-full bg-gradient-to-r from-emerald-900 via-emerald-600 to-emerald-400 shadow-[0_0_20px_rgba(34,197,94,0.4)] md:h-[10px] md:w-[124px]"
      >
        <div className="absolute -left-2.5 top-1/2 h-6 w-6 -translate-y-1/2 rounded-full border-4 border-emerald-500 bg-white shadow-[0_0_25px_rgba(255,255,255,0.28)] md:h-8 md:w-8" />
        <div className="absolute right-0 top-1/2 h-3.5 w-3.5 -translate-y-1/2 rounded-full bg-white/40 blur-[2px] md:h-4 md:w-4" />
      </motion.div>

      <motion.div
        animate={pulse ? { scale: [1, 1.08, 1], opacity: [0.7, 1, 0.8] } : { scale: 1, opacity: 0.7 }}
        transition={{ duration: 0.75, ease: "easeOut" }}
        className="absolute right-[5%] top-[43%] flex h-11 w-11 items-center justify-center rounded-full border border-white/20 bg-emerald-500/90 text-xl font-bold text-white shadow-[0_0_24px_rgba(34,197,94,0.55)] backdrop-blur-md md:h-14 md:w-14"
      >
        ✓
      </motion.div>
    </div>
  );
}

function BackgroundFX({ intense }: { intense: boolean }) {
  const particles = Array.from({ length: 16 }, (_, i) => i);

  return (
    <>
      <div className="absolute inset-0 opacity-70">
        {particles.map((item) => {
          const size = 20 + ((item * 13) % 54);
          const left = 4 + ((item * 7.3) % 88);
          const delay = (item % 7) * 0.55;
          const duration = 5 + (item % 6);

          return (
            <motion.span
              key={item}
              className="absolute rounded-full bg-white/10 blur-xl"
              style={{
                width: size,
                height: size,
                left: `${left}%`,
                bottom: "-10%",
              }}
              animate={{
                y: [0, -180 - item * 8],
                x: [0, (item % 2 === 0 ? 18 : -18), 0],
                opacity: [0, 0.32, 0],
                scale: [0.8, 1.15, 1],
              }}
              transition={{
                duration,
                delay,
                repeat: Infinity,
                ease: "easeInOut",
              }}
            />
          );
        })}
      </div>

      <motion.div
        className="absolute inset-0 bg-[radial-gradient(circle,rgba(34,197,94,0.16),transparent_40%)]"
        animate={intense ? { opacity: [0.25, 0.6, 0.18], scale: [1, 1.06, 1.02] } : { opacity: 0.2, scale: 1 }}
        transition={{ duration: 0.9, ease: "easeOut" }}
      />

      <motion.div
        className="absolute inset-0 bg-[linear-gradient(135deg,rgba(255,255,255,0.08),transparent_20%,transparent_80%,rgba(34,197,94,0.1))]"
        animate={{ opacity: [0.22, 0.1, 0.22] }}
        transition={{ duration: 4.5, repeat: Infinity, ease: "easeInOut" }}
      />
    </>
  );
}
