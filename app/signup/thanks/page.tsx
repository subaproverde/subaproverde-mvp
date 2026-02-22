"use client";

import Link from "next/link";
import Image from "next/image";
import { Suspense } from "react";
import { useSearchParams } from "next/navigation";

const WHATSAPP_NUMBER = "55SEUNUMEROAQUI"; // ex: 5543999999999

function buildWhatsappUrl(params: { name: string; store: string; coupon: string }) {
  const { name, store, coupon } = params;

  const text = [
    "Olá! Acabei de me cadastrar na Suba Pro Verde.",
    "",
    `Nome: ${name || "-"}`,
    `Loja: ${store || "-"}`,
    `Cupom: ${coupon || "-"}`,
    "",
    "Quero abrir um chamado.",
  ].join("\n");

  return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(text)}`;
}

function Badge({ label, value }: { label: string; value: string }) {
  if (!value) return null;
  return (
    <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-3 py-2">
      <div className="text-[11px] uppercase tracking-wide text-white/50">{label}</div>
      <div className="text-sm font-medium text-white/85">{value}</div>
    </div>
  );
}

function SignupThanksContent() {
  const sp = useSearchParams();

  const name = sp.get("name") ?? "";
  const store = sp.get("store") ?? "";
  const coupon = sp.get("coupon") ?? "";

  const whatsappUrl = buildWhatsappUrl({ name, store, coupon });

  return (
    <div className="relative min-h-[100vh] overflow-hidden bg-[#07120f] text-white">
      {/* BACKGROUND */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-48 -left-48 h-[520px] w-[520px] rounded-full bg-emerald-500/20 blur-3xl" />
        <div className="absolute -bottom-56 -right-56 h-[620px] w-[620px] rounded-full bg-lime-400/15 blur-3xl" />
        <div className="absolute inset-0 bg-gradient-to-b from-black/25 via-black/60 to-black/75" />
        <div
          className="absolute inset-0 opacity-[0.06]"
          style={{
            backgroundImage:
              "linear-gradient(to right, rgba(255,255,255,.25) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,.25) 1px, transparent 1px)",
            backgroundSize: "48px 48px",
          }}
        />
      </div>

      {/* CONTENT */}
      <div className="relative mx-auto flex min-h-[100vh] max-w-6xl items-center justify-center px-6 py-14">
        <div className="w-full max-w-2xl">
          {/* LOGO */}
          <div className="mb-6 flex flex-col items-center">
            <div className="relative h-[44px] w-[200px]">
              <Image
                src="/brand/suba-logo.png"
                alt="Suba Pro Verde"
                fill
                sizes="200px"
                className="object-contain"
                priority
              />
            </div>

            <div className="mt-3 flex w-fit items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-500/10 px-4 py-2 text-xs text-white/80">
              <span className="inline-flex h-2 w-2 rounded-full bg-emerald-400" />
              Cadastro confirmado
            </div>
          </div>

          {/* glass card */}
          <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-white/5 shadow-[0_20px_70px_rgba(0,0,0,.55)] backdrop-blur-xl">
            <div className="absolute inset-0 bg-gradient-to-br from-white/10 via-transparent to-transparent" />

            <div className="relative p-7 sm:p-10">
              <div className="flex flex-col gap-3">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">
                      Cadastro recebido <span className="text-emerald-300">✅</span>
                    </h1>
                    <p className="mt-2 text-sm sm:text-base text-white/70">
                      Você já pode acessar o painel (quando quiser) ou abrir um chamado agora no WhatsApp para a gente te ajudar.
                    </p>
                  </div>

                  <div className="hidden sm:flex items-center justify-center rounded-2xl border border-white/10 bg-black/20 px-3 py-2 text-xs text-white/60">
                    Suba Pro Verde
                  </div>
                </div>

                {/* badges */}
                <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-3">
                  <Badge label="Nome" value={name} />
                  <Badge label="Loja" value={store} />
                  <Badge label="Cupom" value={coupon} />
                </div>

                {/* highlight note */}
                <div className="mt-5 rounded-2xl border border-emerald-400/15 bg-emerald-500/10 p-4">
                  <div className="text-sm font-medium text-white/90">Dica rápida</div>
                  <div className="mt-1 text-sm text-white/70">
                    Se seu objetivo agora é resolver rápido, clica em <b>“Abrir chamado”</b>. O painel do Radar SPV continua disponível,
                    mas o atendimento principal é pelo WhatsApp.
                  </div>
                </div>

                {/* buttons */}
                <div className="mt-6 flex flex-col sm:flex-row gap-3">
                  <Link
                    href="/login"
                    className="inline-flex w-full sm:w-auto items-center justify-center rounded-2xl border border-white/12 bg-white/5 px-5 py-3 text-sm font-semibold text-white/85 hover:bg-white/8"
                  >
                    Acessar painel
                  </Link>

                  <a
                    href={whatsappUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex w-full sm:flex-1 items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-5 py-3 text-sm font-semibold text-white hover:bg-emerald-500 shadow-[0_18px_55px_rgba(16,185,129,.25)]"
                  >
                    <span className="inline-flex h-2 w-2 rounded-full bg-white/90" />
                    Abrir chamado (WhatsApp)
                  </a>
                </div>

                <div className="mt-4 text-xs text-white/45">
                  Obs.: se a confirmação de e-mail estiver ativa no Supabase, você pode precisar confirmar o e-mail antes de logar.
                </div>
              </div>
            </div>
          </div>

          <div className="mt-6 text-center text-xs text-white/35">
            © {new Date().getFullYear()} Suba Pro Verde • Atendimento rápido e rastreável
          </div>
        </div>
      </div>
    </div>
  );
}

export default function SignupThanksPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#07120f]" />}>
      <SignupThanksContent />
    </Suspense>
  );
}