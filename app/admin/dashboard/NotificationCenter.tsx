"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  BellRing,
  CheckCircle2,
  Clock3,
  MessageCircle,
  Play,
  RadioTower,
  Volume2,
} from "lucide-react";
import type { AdminAppointment, AdminClient, AdminRemoval } from "../admin-data";
import {
  formatDate,
} from "../admin-data";
import {
  appointmentDateTime,
  buildAppointmentReminderMessage,
  buildDailySummaryMessage,
  getClientName,
  getDayAppointments,
  minutesUntilAppointment,
  todayIso,
} from "@/lib/adminNotificationMessages";
import { authFetch } from "@/lib/authFetch";

const DEFAULT_WHATSAPP_PHONE = "554388231544";
const REMINDER_WINDOWS = [30, 10, 5, 1];

type SendState = {
  kind: "idle" | "success" | "error";
  text: string;
};

type WhatsAppConfigState = {
  mode: "mock" | "live-ready" | "loading";
  hasAccessToken: boolean;
  hasPhoneNumberId: boolean;
  templateName: string | null;
};

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function canUseNotifications() {
  return typeof window !== "undefined" && "Notification" in window;
}

function reminderKey(appointmentId: string, minutes: number) {
  return `spv-reminder-${todayIso()}-${appointmentId}-${minutes}`;
}

function dailyKey() {
  return `spv-daily-summary-${todayIso()}`;
}

function shortMessage(value: string) {
  return value.length > 120 ? `${value.slice(0, 117)}...` : value;
}

export default function NotificationCenter({
  appointments,
  clients,
  removals,
}: {
  appointments: AdminAppointment[];
  clients: AdminClient[];
  removals: AdminRemoval[];
}) {
  const [enabled, setEnabled] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [whatsappEnabled, setWhatsappEnabled] = useState(true);
  const [phone, setPhone] = useState(DEFAULT_WHATSAPP_PHONE);
  const [permission, setPermission] = useState<NotificationPermission | "unsupported">(() => {
    if (!canUseNotifications()) return "unsupported";
    return Notification.permission;
  });
  const [sendState, setSendState] = useState<SendState>({
    kind: "idle",
    text: "Alertas ainda não ativados.",
  });
  const [whatsappConfig, setWhatsappConfig] = useState<WhatsAppConfigState>({
    mode: "loading",
    hasAccessToken: false,
    hasPhoneNumberId: false,
    templateName: null,
  });
  const audioContextRef = useRef<AudioContext | null>(null);

  const today = todayIso();
  const todayAppointments = useMemo(
    () => getDayAppointments(appointments, today),
    [appointments, today]
  );
  const nextAppointment = useMemo(() => {
    const now = new Date();
    return appointments
      .filter((appointment) => appointment.status !== "concluido")
      .filter((appointment) => appointmentDateTime(appointment).getTime() >= now.getTime())
      .sort((a, b) => appointmentDateTime(a).getTime() - appointmentDateTime(b).getTime())[0];
  }, [appointments]);
  const dailySummary = useMemo(
    () => buildDailySummaryMessage({ appointments, clients, removals }),
    [appointments, clients, removals]
  );

  const sendWhatsApp = useCallback(async (message: string) => {
    if (!whatsappEnabled) {
      return { ok: true, skipped: true };
    }

    const response = await authFetch("/api/admin/notifications/whatsapp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone, message }),
    });
    const data = await response.json().catch(() => null);

    if (!response.ok || data?.ok === false) {
      throw new Error(data?.error ?? "Falha ao preparar WhatsApp.");
    }

    return data;
  }, [phone, whatsappEnabled]);

  const playSound = useCallback(() => {
    if (!soundEnabled) return;

    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return;

    const context = audioContextRef.current ?? new AudioContextClass();
    audioContextRef.current = context;

    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = "sine";
    oscillator.frequency.value = 880;
    gain.gain.value = 0.001;
    gain.gain.exponentialRampToValueAtTime(0.22, context.currentTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + 0.55);
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start();
    oscillator.stop(context.currentTime + 0.6);
  }, [soundEnabled]);

  const showChromeNotification = useCallback((title: string, body: string) => {
    playSound();

    if (permission !== "granted" || !canUseNotifications()) return;

    new Notification(title, {
      body,
      icon: "/favicon.ico",
      tag: `spv-${title}-${body.slice(0, 20)}`,
    });
  }, [permission, playSound]);

  async function enableAlerts() {
    try {
      let nextPermission = permission;

      if (canUseNotifications() && Notification.permission !== "granted") {
        nextPermission = await Notification.requestPermission();
        setPermission(nextPermission);
      }

      setEnabled(true);
      playSound();
      setSendState({
        kind: "success",
        text:
          nextPermission === "granted"
            ? "Alertas Chrome e som ativados."
            : "Som ativado. Chrome ainda precisa de permissão para push.",
      });
    } catch (error) {
      setSendState({
        kind: "error",
        text: error instanceof Error ? error.message : "Não foi possível ativar alertas.",
      });
    }
  }

  const sendDailySummary = useCallback(async (reason: "manual" | "auto") => {
    try {
      showChromeNotification("Resumo do dia - Suba Pro Verde", shortMessage(dailySummary));
      const data = await sendWhatsApp(dailySummary);
      window.localStorage.setItem(dailyKey(), "sent");
      setSendState({
        kind: "success",
        text:
          data?.mode === "mock"
            ? "Resumo preparado. WhatsApp real depende das variáveis da Meta."
            : reason === "auto"
              ? "Resumo diário enviado/preparado automaticamente."
              : "Resumo diário enviado/preparado.",
      });
    } catch (error) {
      setSendState({
        kind: "error",
        text: error instanceof Error ? error.message : "Falha ao enviar resumo.",
      });
    }
  }, [dailySummary, sendWhatsApp, showChromeNotification]);

  function testChromeAlert() {
    showChromeNotification(
      "Teste de alerta Suba Pro Verde",
      "Se você viu isso e ouviu o som, os avisos locais estão prontos."
    );
    setSendState({ kind: "success", text: "Teste de Chrome/som disparado." });
  }

  useEffect(() => {
    let alive = true;

    authFetch("/api/admin/notifications/whatsapp", { cache: "no-store" })
      .then((response) => response.json())
      .then((data) => {
        if (!alive) return;
        setWhatsappConfig({
          mode: data?.mode === "live-ready" ? "live-ready" : "mock",
          hasAccessToken: Boolean(data?.hasAccessToken),
          hasPhoneNumberId: Boolean(data?.hasPhoneNumberId),
          templateName: data?.templateName ?? null,
        });
      })
      .catch(() => {
        if (!alive) return;
        setWhatsappConfig({
          mode: "mock",
          hasAccessToken: false,
          hasPhoneNumberId: false,
          templateName: null,
        });
      });

    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (!enabled) return;
    if (window.localStorage.getItem(dailyKey())) return;

    const now = new Date();
    if (now.getHours() > 11) return;

    const timer = window.setTimeout(() => {
      void sendDailySummary("auto");
    }, 0);

    return () => window.clearTimeout(timer);
  }, [enabled, sendDailySummary]);

  useEffect(() => {
    if (!enabled) return;

    const timers: number[] = [];
    const now = new Date();

    for (const appointment of appointments) {
      if (appointment.status === "concluido") continue;

      const minutesUntil = minutesUntilAppointment(appointment, now);

      for (const minutesBefore of REMINDER_WINDOWS) {
        const key = reminderKey(appointment.id, minutesBefore);
        if (window.localStorage.getItem(key)) continue;

        const delayMs = (minutesUntil - minutesBefore) * 60 * 1000;
        if (delayMs < 0) continue;

        const timer = window.setTimeout(() => {
          const clientName = getClientName(clients, appointment.clientId);
          const title = `Faltam ${minutesBefore} min`;
          const body = `${appointment.scheduledTime} | ${clientName} - ${appointment.title}`;
          const whatsappMessage = buildAppointmentReminderMessage({
            appointment,
            clients,
            minutesBefore,
          });

          showChromeNotification(title, body);
          window.localStorage.setItem(key, "sent");
          void sendWhatsApp(whatsappMessage)
            .then((data) => {
              setSendState({
                kind: "success",
                text:
                  data?.mode === "mock"
                    ? `Lembrete de ${minutesBefore} min preparado.`
                    : `Lembrete de ${minutesBefore} min enviado/preparado.`,
              });
            })
            .catch((error) => {
              setSendState({
                kind: "error",
                text: error instanceof Error ? error.message : "Falha no lembrete.",
              });
            });
        }, delayMs);

        timers.push(timer);
      }
    }

    return () => {
      for (const timer of timers) window.clearTimeout(timer);
    };
  }, [appointments, clients, enabled, sendWhatsApp, showChromeNotification]);

  const nextReminderText = nextAppointment
    ? `${formatDate(nextAppointment.scheduledDate)} ${nextAppointment.scheduledTime} | ${getClientName(
        clients,
        nextAppointment.clientId
      )}`
    : "Nenhum evento futuro";

  return (
    <section className="rounded-2xl border border-sky-300/18 bg-sky-400/[0.055] p-4">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex items-center gap-2 text-sm font-semibold text-white">
            <BellRing className="h-4 w-4 text-sky-100" aria-hidden={true} />
            Central de alertas
          </div>
          <p className="mt-1 max-w-3xl text-xs leading-5 text-white/50">
            Resumo diário no WhatsApp, push no Chrome com som e lembretes 30, 10, 5 e 1 minuto antes.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={enableAlerts}
            className="inline-flex h-10 items-center gap-2 rounded-xl border border-emerald-300/20 bg-emerald-400/14 px-3 text-xs font-semibold text-emerald-50 transition hover:bg-emerald-400/18"
          >
            <RadioTower className="h-3.5 w-3.5" aria-hidden={true} />
            Ativar Chrome + som
          </button>
          <button
            type="button"
            onClick={testChromeAlert}
            className="inline-flex h-10 items-center gap-2 rounded-xl border border-white/10 bg-white/[0.05] px-3 text-xs font-semibold text-white/72 transition hover:bg-white/[0.08]"
          >
            <Play className="h-3.5 w-3.5" aria-hidden={true} />
            Testar alerta
          </button>
          <button
            type="button"
            onClick={() => void sendDailySummary("manual")}
            className="inline-flex h-10 items-center gap-2 rounded-xl border border-violet-300/20 bg-violet-400/12 px-3 text-xs font-semibold text-violet-50 transition hover:bg-violet-400/18"
          >
            <MessageCircle className="h-3.5 w-3.5" aria-hidden={true} />
            Enviar resumo agora
          </button>
        </div>
      </div>

      <div className="mt-4 grid gap-3 xl:grid-cols-[1fr_1fr_.85fr]">
        <div className="rounded-xl border border-white/10 bg-black/18 p-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-xs text-white/45">Próximo evento</div>
              <div className="mt-1 text-sm font-semibold text-white">{nextReminderText}</div>
            </div>
            <Clock3 className="h-4 w-4 text-white/45" aria-hidden={true} />
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {REMINDER_WINDOWS.map((minutes) => (
              <span
                key={minutes}
                className="rounded-full border border-sky-300/18 bg-sky-400/10 px-2 py-1 text-[11px] text-sky-50"
              >
                {minutes} min
              </span>
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-white/10 bg-black/18 p-3">
          <div className="flex items-center justify-between gap-3">
            <label className="flex items-center gap-2 text-sm font-medium text-white/78">
              <input
                type="checkbox"
                checked={soundEnabled}
                onChange={(event) => setSoundEnabled(event.target.checked)}
                className="h-4 w-4 accent-emerald-400"
              />
              Som nos alertas
            </label>
            <Volume2 className="h-4 w-4 text-white/45" aria-hidden={true} />
          </div>
          <label className="mt-3 flex items-center gap-2 text-sm font-medium text-white/78">
            <input
              type="checkbox"
              checked={whatsappEnabled}
              onChange={(event) => setWhatsappEnabled(event.target.checked)}
              className="h-4 w-4 accent-emerald-400"
            />
            Enviar também no WhatsApp
          </label>
          <input
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
            className="mt-3 h-10 w-full rounded-xl border border-white/10 bg-black/30 px-3 text-sm text-white outline-none"
            aria-label="WhatsApp para alertas"
          />
        </div>

        <div
          className={cn(
            "rounded-xl border p-3",
            sendState.kind === "success" && "border-emerald-300/18 bg-emerald-400/10",
            sendState.kind === "error" && "border-rose-300/18 bg-rose-400/10",
            sendState.kind === "idle" && "border-white/10 bg-black/18"
          )}
        >
          <div className="flex items-center gap-2 text-sm font-semibold text-white">
            <CheckCircle2 className="h-4 w-4 text-emerald-100" aria-hidden={true} />
            Status
          </div>
          <p className="mt-2 text-xs leading-5 text-white/52">{sendState.text}</p>
          <p className="mt-2 text-[11px] leading-4 text-white/35">
            Hoje: {todayAppointments.length} agendamento(s). WhatsApp:{" "}
            {whatsappConfig.mode === "live-ready" ? "live pronto" : "mock"}.
            {whatsappConfig.templateName ? ` Template: ${whatsappConfig.templateName}.` : ""}
          </p>
          {whatsappConfig.mode !== "live-ready" ? (
            <p className="mt-2 text-[11px] leading-4 text-amber-100/65">
              Falta configurar token e Phone Number ID no ambiente.
            </p>
          ) : null}
        </div>
      </div>

      <details className="mt-3 rounded-xl border border-white/10 bg-black/18 p-3">
        <summary className="cursor-pointer text-xs font-semibold text-white/70">
          Ver resumo que será enviado
        </summary>
        <pre className="mt-3 max-h-64 overflow-auto whitespace-pre-wrap rounded-xl bg-black/30 p-3 text-xs leading-5 text-white/60">
          {dailySummary}
        </pre>
      </details>
    </section>
  );
}

declare global {
  interface Window {
    webkitAudioContext?: typeof AudioContext;
  }
}
