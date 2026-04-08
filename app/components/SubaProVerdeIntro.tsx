"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

const INTRO_DURATION = 2600;
const START_ANGLE = -130;
const END_ANGLE = 50;

export default function SubaProVerdeIntro() {
  const [show, setShow] = useState(true);
  const [progress, setProgress] = useState(0.06);
  const [pulse, setPulse] = useState(false);

  useEffect(() => {
    const startTimer = window.setTimeout(() => {
      const startedAt = performance.now();
      const duration = 1100;

      const step = (now: number) => {
        const t = Math.min((now - startedAt) / duration, 1);
        const eased = 1 - Math.pow(1 - t, 3);
        setProgress(0.06 + 0.92 * eased);

        if (t < 1) {
          requestAnimationFrame(step);
        } else {
          setPulse(true);
          window.setTimeout(() => setPulse(false), 700);
        }
      };

      requestAnimationFrame(step);
    }, 260);

    const endTimer = window.setTimeout(() => {
      setShow(false);
    }, INTRO_DURATION);

    return () => {
      window.clearTimeout(startTimer);
      window.clearTimeout(endTimer);
    };
  }, []);

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.45, ease: "easeInOut" }}
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/92 backdrop-blur-md"
        >
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(34,197,94,0.18),transparent_30%)]" />

          <motion.div
            initial={{ opacity: 0, y: 26, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.7, ease: [0.16,1,0.3,1] }}
            className="relative flex w-full max-w-4xl flex-col items-center px-6 text-center"
          >
            <AnimatedGauge progress={progress} pulse={pulse} />

            <motion.h1
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: progress > 0.7 ? 1 : 0, y: progress > 0.7 ? 0 : 12 }}
              transition={{ duration: 0.35 }}
              className="mt-10 text-2xl font-semibold tracking-[0.24em] text-white md:text-5xl"
            >
              BEM-VINDO À SUBA PRO VERDE
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: progress > 0.78 ? 1 : 0, y: progress > 0.78 ? 0 : 10 }}
              transition={{ duration: 0.35, delay: 0.05 }}
              className="mt-4 max-w-3xl text-sm font-light tracking-[0.18em] text-white/70 md:text-lg"
            >
              Sua plataforma de gestão de reputação e performance para sellers do Mercado Livre
            </motion.p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function AnimatedGauge({ progress, pulse }: { progress: number; pulse: boolean }) {
  const angle = START_ANGLE + (END_ANGLE - START_ANGLE) * progress;
  const arcLength = 565.48;
  const dashOffset = arcLength * (1 - progress);

  return (
    <div className="relative h-[170px] w-[230px] md:h-[210px] md:w-[280px]">
      <svg viewBox="0 0 240 180" className="h-full w-full overflow-visible">
        <defs>
          <linearGradient id="gaugeGradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#ff2d12" />
            <stop offset="28%" stopColor="#ff7a00" />
            <stop offset="52%" stopColor="#ffd000" />
            <stop offset="76%" stopColor="#79db27" />
            <stop offset="100%" stopColor="#00c853" />
          </linearGradient>
          <filter id="gaugeGlow" x="-60%" y="-60%" width="220%" height="220%">
            <feGaussianBlur stdDeviation="5" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        <path
          d="M 25 145 A 95 95 0 0 1 215 145"
          fill="none"
          stroke="rgba(255,255,255,0.10)"
          strokeWidth="18"
          strokeLinecap="round"
        />

        <path
          d="M 25 145 A 95 95 0 0 1 215 145"
          fill="none"
          stroke="url(#gaugeGradient)"
          strokeWidth="18"
          strokeLinecap="round"
          strokeDasharray={arcLength}
          strokeDashoffset={dashOffset}
          filter="url(#gaugeGlow)"
          style={{ transition: "stroke-dashoffset 40ms linear" }}
        />
      </svg>

      <motion.div
        style={{ transform: `translate(-50%, -84%) rotate(${angle}deg)` }}
        animate={pulse ? { scale: [1, 1.04, 1], rotate: [angle - 1.2, angle + 1.2, angle] } : { scale: 1, rotate: angle }}
        transition={{ duration: 0.45, ease: "easeOut" }}
        className="absolute left-1/2 top-[80%] h-[8px] w-[88px] origin-[6px_center] rounded-full bg-gradient-to-r from-emerald-900 via-emerald-500 to-emerald-300 shadow-[0_0_24px_rgba(34,197,94,0.35)] md:h-[10px] md:w-[118px]"
      >
        <div className="absolute -left-2.5 top-1/2 h-6 w-6 -translate-y-1/2 rounded-full border-4 border-emerald-400 bg-white shadow-[0_0_25px_rgba(255,255,255,0.35)] md:h-8 md:w-8" />
      </motion.div>

      <motion.div
        animate={pulse ? { scale: [1, 1.12, 1], boxShadow: ["0 0 0 rgba(34,197,94,0)", "0 0 28px rgba(34,197,94,0.55)", "0 0 10px rgba(34,197,94,0.22)"] } : { scale: 1 }}
        transition={{ duration: 0.55, ease: "easeOut" }}
        className="absolute right-[6%] top-[42%] flex h-10 w-10 items-center justify-center rounded-full border border-white/15 bg-emerald-500 text-lg font-bold text-white md:h-12 md:w-12"
      >
        ✓
      </motion.div>
    </div>
  );
}
