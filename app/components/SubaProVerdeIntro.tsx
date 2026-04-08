"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

const INTRO_DURATION = 3600;
const START_ANGLE = -130;
const END_ANGLE = 20; // limite correto (não passar do verde)

export default function SubaProVerdeIntro() {
  const [show, setShow] = useState(true);
  const [progress, setProgress] = useState(0.06);
  const [pulse, setPulse] = useState(false);

  useEffect(() => {
    const startTimer = window.setTimeout(() => {
      const startedAt = performance.now();
      const duration = 1800; // mais suave

      const step = (now: number) => {
        const t = Math.min((now - startedAt) / duration, 1);
        const eased = 1 - Math.pow(1 - t, 3);

        // trava no máximo
        const next = Math.min(0.94, 0.06 + 0.9 * eased);
        setProgress(next);

        if (t < 1) {
          requestAnimationFrame(step);
        } else {
          setPulse(true);
          window.setTimeout(() => setPulse(false), 900);
        }
      };

      requestAnimationFrame(step);
    }, 400);

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
          transition={{ duration: 0.6 }}
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/92 backdrop-blur-md overflow-hidden"
        >
          {/* FUNDO COM BOLHAS */}
          <div className="absolute inset-0">
            {[...Array(12)].map((_, i) => (
              <motion.div
                key={i}
                className="absolute rounded-full bg-emerald-400/10 blur-2xl"
                style={{
                  width: 120 + i * 10,
                  height: 120 + i * 10,
                  left: `${(i * 13) % 100}%`,
                  top: `${(i * 7) % 100}%`,
                }}
                animate={{
                  y: [0, -40, 0],
                  opacity: [0.2, 0.5, 0.2],
                }}
                transition={{
                  duration: 6 + i,
                  repeat: Infinity,
                  ease: "easeInOut",
                }}
              />
            ))}
          </div>

          {/* GLOW CENTRAL */}
          <motion.div
            animate={pulse ? { scale: [1, 1.2, 1], opacity: [0.3, 0.6, 0.3] } : { scale: 1 }}
            transition={{ duration: 0.9 }}
            className="absolute w-[500px] h-[500px] bg-emerald-400/20 blur-[120px] rounded-full"
          />

          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="relative flex flex-col items-center text-center px-6"
          >
            <AnimatedGauge progress={progress} pulse={pulse} />

            <motion.h1
              initial={{ opacity: 0 }}
              animate={{ opacity: progress > 0.7 ? 1 : 0 }}
              transition={{ duration: 0.4 }}
              className="mt-10 text-3xl md:text-5xl font-semibold tracking-[0.25em] text-white"
            >
              BEM-VINDO À SUBA PRO VERDE
            </motion.h1>

            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: progress > 0.8 ? 1 : 0 }}
              transition={{ duration: 0.4 }}
              className="mt-4 text-white/70 text-sm md:text-lg max-w-2xl"
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
    <div className="relative h-[180px] w-[260px]">
      <svg viewBox="0 0 240 180" className="w-full h-full">
        <defs>
          <linearGradient id="gaugeGradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#ff2d12" />
            <stop offset="30%" stopColor="#ff7a00" />
            <stop offset="55%" stopColor="#ffd000" />
            <stop offset="80%" stopColor="#79db27" />
            <stop offset="100%" stopColor="#00c853" />
          </linearGradient>
        </defs>

        <path
          d="M 25 145 A 95 95 0 0 1 215 145"
          fill="none"
          stroke="rgba(255,255,255,0.1)"
          strokeWidth="18"
          strokeLinecap="round"
        />

        <motion.path
          d="M 25 145 A 95 95 0 0 1 215 145"
          fill="none"
          stroke="url(#gaugeGradient)"
          strokeWidth="18"
          strokeLinecap="round"
          strokeDasharray={arcLength}
          strokeDashoffset={dashOffset}
          animate={pulse ? { filter: "drop-shadow(0 0 15px #00ff88)" } : {}}
          style={{ transition: "stroke-dashoffset 40ms linear" }}
        />
      </svg>

      <motion.div
        style={{ transform: `translate(-50%, -84%) rotate(${angle}deg)` }}
        animate={pulse ? { scale: [1, 1.08, 1] } : {}}
        transition={{ duration: 0.5 }}
        className="absolute left-1/2 top-[80%] h-[10px] w-[120px] origin-[6px_center] rounded-full bg-emerald-500 shadow-[0_0_25px_rgba(0,255,150,0.5)]"
      >
        <div className="absolute -left-3 top-1/2 h-7 w-7 -translate-y-1/2 rounded-full bg-white border-4 border-emerald-400" />
      </motion.div>

      <motion.div
        animate={pulse ? { scale: [1, 1.2, 1], boxShadow: ["0 0 0", "0 0 25px #00ff88", "0 0 10px #00ff88"] } : {}}
        className="absolute right-[8%] top-[42%] h-12 w-12 rounded-full bg-emerald-500 text-white flex items-center justify-center"
      >
        ✓
      </motion.div>
    </div>
  );
}
