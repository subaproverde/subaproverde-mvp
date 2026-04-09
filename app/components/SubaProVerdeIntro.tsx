"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

declare global {
  interface Window {
    __subaAudioUnlocked?: boolean;
  }
}

const INTRO_DURATION = 4600;
const START_ANGLE = -128;
const END_ANGLE = 8;
const START_PROGRESS = 0.06;
const END_PROGRESS = 0.92;

export default function SubaProVerdeIntro() {
  const [show, setShow] = useState(true);
  const [progress, setProgress] = useState(START_PROGRESS);
  const [pulse, setPulse] = useState(false);

  const audioCtxRef = useRef<AudioContext | null>(null);
  const introStartedRef = useRef(false);
  const introFinishedRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    let pulseTimeout: number | undefined;

    const unlockAudioOnly = async () => {
      try {
        const AudioCtx =
          window.AudioContext ||
          (window as Window & { webkitAudioContext?: typeof AudioContext })
            .webkitAudioContext;

        if (!AudioCtx) return;

        if (!audioCtxRef.current || audioCtxRef.current.state === "closed") {
          audioCtxRef.current = new AudioCtx();
        }

        if (audioCtxRef.current.state === "suspended") {
          await audioCtxRef.current.resume();
        }

        window.__subaAudioUnlocked = true;
      } catch (error) {
        console.error("Erro ao desbloquear áudio:", error);
      }
    };

    const onUnlockInteraction = () => {
      void unlockAudioOnly();
    };

    window.addEventListener("pointerdown", onUnlockInteraction);
    window.addEventListener("keydown", onUnlockInteraction);
    window.addEventListener("touchstart", onUnlockInteraction, {
      passive: true,
    });

    const getAudioContext = async () => {
      const AudioCtx =
        window.AudioContext ||
        (window as Window & { webkitAudioContext?: typeof AudioContext })
          .webkitAudioContext;

      if (!AudioCtx) return null;

      if (!audioCtxRef.current || audioCtxRef.current.state === "closed") {
        audioCtxRef.current = new AudioCtx();
      }

      if (audioCtxRef.current.state === "suspended") {
        await audioCtxRef.current.resume();
      }

      return audioCtxRef.current;
    };

    const playEngineRise = async () => {
      if (!window.__subaAudioUnlocked) return;
      if (introFinishedRef.current || cancelled) return;

      const ctx = await getAudioContext();
      if (!ctx || introFinishedRef.current || cancelled) return;

      try {
        const now = ctx.currentTime;

        const oscA = ctx.createOscillator();
        const oscB = ctx.createOscillator();
        const oscC = ctx.createOscillator();
        const gain = ctx.createGain();
        const filter = ctx.createBiquadFilter();

        oscA.type = "sawtooth";
        oscB.type = "triangle";
        oscC.type = "sine";

        oscA.frequency.setValueAtTime(72, now);
        oscB.frequency.setValueAtTime(108, now);
        oscC.frequency.setValueAtTime(36, now);

        oscA.frequency.exponentialRampToValueAtTime(150, now + 0.9);
        oscB.frequency.exponentialRampToValueAtTime(230, now + 0.9);
        oscC.frequency.exponentialRampToValueAtTime(72, now + 0.9);

        oscA.frequency.exponentialRampToValueAtTime(255, now + 2.2);
        oscB.frequency.exponentialRampToValueAtTime(390, now + 2.2);
        oscC.frequency.exponentialRampToValueAtTime(110, now + 2.2);

        filter.type = "lowpass";
        filter.frequency.setValueAtTime(380, now);
        filter.frequency.exponentialRampToValueAtTime(900, now + 0.9);
        filter.frequency.exponentialRampToValueAtTime(2400, now + 2.2);
        filter.Q.setValueAtTime(5, now);

        gain.gain.setValueAtTime(0.0001, now);
        gain.gain.exponentialRampToValueAtTime(0.018, now + 0.18);
        gain.gain.exponentialRampToValueAtTime(0.034, now + 1.4);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 2.8);

        oscA.connect(filter);
        oscB.connect(filter);
        oscC.connect(filter);
        filter.connect(gain);
        gain.connect(ctx.destination);

        oscA.start(now);
        oscB.start(now);
        oscC.start(now);

        oscA.stop(now + 2.85);
        oscB.stop(now + 2.85);
        oscC.stop(now + 2.85);
      } catch (error) {
        console.error("Erro ao tocar intro:", error);
      }
    };

    const startIntro = () => {
      if (introStartedRef.current || cancelled) return;
      introStartedRef.current = true;

      if (window.__subaAudioUnlocked) {
        void playEngineRise();
      }

      const startedAt = performance.now();
      const duration = 2400;

      const step = (now: number) => {
        if (cancelled || introFinishedRef.current) return;

        const t = Math.min((now - startedAt) / duration, 1);
        const eased = 1 - Math.pow(1 - t, 3);
        const next = START_PROGRESS + (END_PROGRESS - START_PROGRESS) * eased;
        setProgress(next);

        if (t < 1) {
          requestAnimationFrame(step);
        } else {
          setPulse(true);
          pulseTimeout = window.setTimeout(() => setPulse(false), 1200);
        }
      };

      requestAnimationFrame(step);
    };

    const startTimer = window.setTimeout(startIntro, 550);

    const endTimer = window.setTimeout(() => {
      introFinishedRef.current = true;
      setShow(false);
    }, INTRO_DURATION);

    return () => {
      cancelled = true;
      introFinishedRef.current = true;

      window.clearTimeout(startTimer);
      window.clearTimeout(endTimer);
      if (pulseTimeout) window.clearTimeout(pulseTimeout);

      window.removeEventListener("pointerdown", onUnlockInteraction);
      window.removeEventListener("keydown", onUnlockInteraction);
      window.removeEventListener("touchstart", onUnlockInteraction);
    };
  }, []);

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.7, ease: "easeInOut" }}
          className="fixed inset-0 z-[9999] flex items-center justify-center overflow-hidden bg-black/92 backdrop-blur-md"
        >
          <div className="absolute inset-0">
            {[...Array(14)].map((_, i) => (
              <motion.div
                key={i}
                className="absolute rounded-full bg-emerald-400/10 blur-3xl"
                style={{
                  width: 110 + i * 12,
                  height: 110 + i * 12,
                  left: `${(i * 11.5) % 100}%`,
                  top: `${(i * 8.2) % 100}%`,
                }}
                animate={{
                  y: [0, -55, 0],
                  x: [0, i % 2 === 0 ? 10 : -10, 0],
                  opacity: [0.14, 0.38, 0.14],
                }}
                transition={{
                  duration: 7 + i * 0.35,
                  repeat: Infinity,
                  ease: "easeInOut",
                }}
              />
            ))}
          </div>

          <motion.div
            animate={
              pulse
                ? { scale: [1, 1.18, 1], opacity: [0.22, 0.48, 0.24] }
                : { scale: 1, opacity: 0.22 }
            }
            transition={{ duration: 1.1, ease: "easeOut" }}
            className="absolute h-[560px] w-[560px] rounded-full bg-emerald-400/20 blur-[140px]"
          />

          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.9 }}
            className="relative flex flex-col items-center px-6 text-center"
          >
            <AnimatedGauge progress={progress} pulse={pulse} />

            <motion.h1
              initial={{ opacity: 0 }}
              animate={{ opacity: progress > 0.66 ? 1 : 0 }}
              transition={{ duration: 0.5 }}
              className="mt-10 text-3xl font-semibold tracking-[0.23em] text-white md:text-5xl"
            >
              BEM-VINDO À SUBA PRO VERDE
            </motion.h1>

            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: progress > 0.75 ? 1 : 0 }}
              transition={{ duration: 0.45 }}
              className="mt-4 max-w-2xl text-sm text-white/70 md:text-lg"
            >
              Sua plataforma de gestão de reputação e performance para sellers do
              Mercado Livre
            </motion.p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function AnimatedGauge({
  progress,
  pulse,
}: {
  progress: number;
  pulse: boolean;
}) {
  const angle = START_ANGLE + (END_ANGLE - START_ANGLE) * progress;
  const arcLength = 565.48;
  const dashOffset = arcLength * (1 - progress);

  return (
    <div className="relative h-[190px] w-[280px] md:h-[230px] md:w-[330px]">
      <svg viewBox="0 0 240 180" className="h-full w-full overflow-visible">
        <defs>
          <linearGradient id="gaugeGradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#ff2d12" />
            <stop offset="28%" stopColor="#ff7a00" />
            <stop offset="52%" stopColor="#ffd000" />
            <stop offset="78%" stopColor="#79db27" />
            <stop offset="100%" stopColor="#00c853" />
          </linearGradient>
          <filter id="meterGlow" x="-60%" y="-60%" width="220%" height="220%">
            <feGaussianBlur stdDeviation="4" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
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
          stroke="url(#gaugeGradient)"
          strokeWidth="18"
          strokeLinecap="round"
          strokeDasharray={arcLength}
          strokeDashoffset={dashOffset}
          filter="url(#meterGlow)"
          animate={
            pulse
              ? {
                  filter: [
                    "drop-shadow(0 0 3px rgba(0,255,136,0.2))",
                    "drop-shadow(0 0 18px rgba(0,255,136,1))",
                    "drop-shadow(0 0 8px rgba(0,255,136,0.45))",
                  ],
                }
              : undefined
          }
          transition={{ duration: 0.8, ease: "easeOut" }}
          style={{ transition: "stroke-dashoffset 50ms linear" }}
        />
      </svg>

      <div className="absolute left-1/2 top-[79%] h-0 w-0">
        <motion.div
          animate={
            pulse
              ? {
                  rotate: [angle, angle + 1.4, angle - 0.8, angle],
                  scale: [1, 1.04, 1],
                }
              : { rotate: angle, scale: 1 }
          }
          transition={{
            duration: pulse ? 0.7 : 0.06,
            ease: pulse ? "easeOut" : "linear",
          }}
          className="relative h-0 w-0 origin-center"
          style={{ transformOrigin: "0px 0px" }}
        >
          <div className="absolute left-0 top-0 h-[10px] w-[122px] -translate-y-1/2 rounded-full bg-gradient-to-r from-emerald-700 via-emerald-500 to-emerald-300 shadow-[0_0_28px_rgba(0,255,150,0.45)]" />
          <div className="absolute -left-[14px] -top-[14px] h-7 w-7 rounded-full border-4 border-emerald-400 bg-white shadow-[0_0_18px_rgba(255,255,255,0.35)]" />
        </motion.div>
      </div>

      <motion.div
        animate={
          pulse
            ? {
                scale: [1, 1.18, 1],
                boxShadow: [
                  "0 0 0 rgba(0,255,136,0)",
                  "0 0 28px rgba(0,255,136,1)",
                  "0 0 12px rgba(0,255,136,0.45)",
                ],
              }
            : undefined
        }
        transition={{ duration: 0.8, ease: "easeOut" }}
        className="absolute right-[7.5%] top-[42%] flex h-12 w-12 items-center justify-center rounded-full border border-white/10 bg-emerald-500 text-white"
      >
        ✓
      </motion.div>
    </div>
  );
}