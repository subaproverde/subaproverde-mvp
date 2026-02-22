// app/page.tsx
"use client";

import Link from "next/link";

const WHATSAPP_LINK = "https://wa.me/55SEUNUMEROAQUI";
const CONTACT_EMAIL = "contato@subaproverde.com.br";

export default function LandingPage() {
  return (
    <div className="min-h-screen text-slate-900">
      {/* HEADER */}
      <header className="sticky top-0 z-50 border-b border-black/10 bg-white/70 backdrop-blur-xl">
        <div className="mx-auto max-w-6xl px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-9 w-[190px] shrink-0">
              <img
                src="/brand/suba-logo.png"
                alt="Suba Pro Verde"
                className="h-full w-full object-contain block"
              />
            </div>

            <div className="hidden md:block leading-tight">
              <div className="text-xs text-slate-600">
                Gestão de reputação no Mercado Livre
              </div>
            </div>
          </div>

          <nav className="hidden md:flex items-center gap-2 text-sm">
            <a href="#home" className="px-3 py-2 rounded-xl text-slate-700 hover:bg-black/5">
              Home
            </a>

            {/* ✅ vai direto pro signup */}
            <Link href="/signup" className="px-3 py-2 rounded-xl text-slate-700 hover:bg-black/5">
              Cadastro
            </Link>

            <a href="#contato" className="px-3 py-2 rounded-xl text-slate-700 hover:bg-black/5">
              Contato
            </a>
          </nav>

          <div className="flex items-center gap-2">
            <Link
              href="/login"
              className="hidden sm:inline-flex items-center rounded-xl border border-black/10 bg-white px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50"
            >
              Entrar
            </Link>

            <Link
              href="/login"
              className="inline-flex items-center rounded-xl bg-gradient-to-b from-emerald-600 to-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:from-emerald-700 hover:to-emerald-800 shadow-[0_18px_55px_rgba(16,185,129,0.30)]"
            >
              Acessar Plataforma
            </Link>
          </div>
        </div>
      </header>

      <main id="home" className="mx-auto max-w-6xl px-6">
        {/* BANNER (único) */}
        <section className="pt-10 md:pt-14">
          <div className="relative rounded-[34px] overflow-hidden border border-black/10 bg-white/65 backdrop-blur-xl shadow-[0_30px_120px_rgba(2,6,23,0.12)]">
            {/* brilho suave por trás, pra “integrar” com o fundo */}
            <div className="pointer-events-none absolute -inset-24 bg-emerald-400/18 blur-[120px]" />
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(900px_420px_at_30%_10%,rgba(16,185,129,0.18),transparent_60%)]" />
            <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.22),transparent_45%)]" />

            <div
              className="relative w-full overflow-hidden"
              style={{
                height: 560,
                maxHeight: 620,
              }}
            >
              <img
                src="/landing/banner.png"
                alt="Suba Pro Verde - Banner"
                className="h-full w-full object-cover block"
                style={{
                  objectPosition: "78% 50%",
                }}
              />
            </div>
          </div>

          {/* ✅ removido: CTA “Falar no WhatsApp” logo após o banner */}
        </section>

        {/* FEATURES (SEM CARD MAIOR) */}
        <section className="mt-14 md:mt-16 relative">
          {/* glow discreto só desta área, sem virar “um bloco” */}
          <div className="pointer-events-none absolute -inset-x-10 -top-10 h-44 bg-[radial-gradient(900px_220px_at_50%_0%,rgba(16,185,129,0.18),transparent_70%)]" />

          <div className="relative text-center">
            <h2 className="text-3xl md:text-4xl font-semibold text-slate-900">
              Recursos que dão clareza e controle
            </h2>
            <p className="mt-3 text-slate-700">
              Painel claro, rápido e confiável para manter sua reputação e vendas saudáveis.
            </p>
          </div>

          <div className="mt-10 grid grid-cols-1 md:grid-cols-2 gap-6">
            <FeatureCard
              emoji="📈"
              title="Monitoramento de reputação"
              desc="Acompanhe termômetro, métricas e riscos em um painel simples e rápido."
            />
            <FeatureCard
              emoji="🧩"
              title="Diagnóstico de impactos"
              desc="Identificamos atrasos, reclamações e cancelamentos que derrubam sua reputação."
            />
            <FeatureCard
              emoji="✅"
              title="Ações e tratativas"
              desc="Organize o que fazer primeiro, com históricos e acompanhamento por caso."
            />
            <FeatureCard
              emoji="🧾"
              title="Relatórios e evidências"
              desc="Gere relatórios claros para auditoria interna e rastreio das decisões."
            />
          </div>
        </section>

        {/* CTA (faixa mais “integrada”, menos cara de card solto) */}
        <section className="mt-16 mb-12 relative overflow-hidden rounded-[34px] border border-black/10 bg-white/60 backdrop-blur-xl shadow-[0_26px_120px_rgba(2,6,23,0.10)]">
          <div className="absolute inset-0 bg-[radial-gradient(900px_420px_at_50%_120%,rgba(16,185,129,0.20),transparent_60%)]" />
          <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.60),rgba(255,255,255,0.20),rgba(16,185,129,0.10))]" />

          <div className="relative px-8 py-12 md:px-12 md:py-14 text-center">
            <h4 className="text-3xl md:text-4xl font-semibold text-slate-900">
              Pronto para organizar sua reputação?
            </h4>
            <p className="mt-3 text-slate-700">
              Acesse o Suba Pro Verde e gerencie sua reputação de forma clara e confiável.
            </p>

            <div className="mt-7 flex flex-col sm:flex-row items-center justify-center gap-3">
              <Link
                href="/signup"
                className="inline-flex items-center justify-center rounded-xl bg-gradient-to-b from-emerald-600 to-emerald-700 px-6 py-3 text-sm font-semibold text-white hover:from-emerald-700 hover:to-emerald-800 shadow-[0_22px_70px_rgba(16,185,129,0.28)]"
              >
                Criar cadastro
              </Link>

              <Link
                href="/login"
                className="inline-flex items-center justify-center rounded-xl border border-black/10 bg-white/70 backdrop-blur-xl px-6 py-3 text-sm font-semibold text-slate-900 hover:bg-white"
              >
                Acessar Plataforma
              </Link>
            </div>
          </div>
        </section>

        {/* CONTATO */}
        <section
          id="contato"
          className="mb-14 rounded-[34px] border border-black/10 bg-white/62 backdrop-blur-xl shadow-[0_18px_90px_rgba(2,6,23,0.08)] p-8 md:p-10"
        >
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
            <div>
              <h5 className="text-2xl font-semibold text-slate-900">Contato</h5>
              <p className="mt-2 text-slate-700">Dúvidas, onboarding e suporte.</p>

              <div className="mt-2 text-sm text-slate-700">
                E-mail:{" "}
                <a className="text-emerald-800 font-semibold hover:underline" href={`mailto:${CONTACT_EMAIL}`}>
                  {CONTACT_EMAIL}
                </a>
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
              <a
                href={WHATSAPP_LINK}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center justify-center rounded-xl bg-gradient-to-b from-emerald-600 to-emerald-700 px-5 py-3 text-sm font-semibold text-white hover:from-emerald-700 hover:to-emerald-800 shadow-[0_18px_55px_rgba(16,185,129,0.26)]"
              >
                WhatsApp →
              </a>

              <Link
                href="/signup"
                className="inline-flex items-center justify-center rounded-xl border border-black/10 bg-white/70 backdrop-blur-xl px-5 py-3 text-sm font-semibold text-slate-900 hover:bg-white"
              >
                Criar conta
              </Link>
            </div>
          </div>
        </section>
      </main>

      {/* FOOTER */}
      <footer className="border-t border-black/10 bg-white/65 backdrop-blur-xl">
        <div className="mx-auto max-w-6xl px-6 py-8 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="h-8 w-[170px]">
              <img src="/brand/suba-logo.png" alt="Suba Pro Verde" className="h-full w-full object-contain block" />
            </div>
            <div className="text-xs text-slate-600">Gestão de reputação no Mercado Livre.</div>
          </div>

          <div className="flex items-center gap-4 text-sm text-slate-700">
            <a href="#home" className="hover:text-slate-900">Home</a>
            <Link href="/signup" className="hover:text-slate-900">Cadastro</Link>
            <a href="#contato" className="hover:text-slate-900">Contato</a>
          </div>

          <div className="text-xs text-slate-600">
            © {new Date().getFullYear()} Suba Pro Verde. Todos os direitos reservados.
          </div>
        </div>
      </footer>
    </div>
  );
}

function FeatureCard({ emoji, title, desc }: { emoji: string; title: string; desc: string }) {
  return (
    <div className={["glass-card", "lift-card", "group relative rounded-2xl p-6"].join(" ")}>
      <div className="pointer-events-none absolute inset-0 rounded-2xl opacity-0 transition-opacity duration-200 group-hover:opacity-100 bg-[radial-gradient(900px_260px_at_20%_10%,rgba(16,185,129,0.14),transparent_55%)]" />
      <div className="pointer-events-none absolute inset-0 rounded-2xl [mask-image:linear-gradient(#000,transparent)] opacity-[0.55] bg-[linear-gradient(180deg,rgba(255,255,255,0.65),rgba(255,255,255,0.00))]" />

      <div className="relative flex items-start gap-4">
        <div className="h-12 w-12 rounded-2xl border border-emerald-700/15 bg-emerald-700/10 flex items-center justify-center shadow-[0_12px_40px_rgba(16,185,129,0.14)] text-xl">
          {emoji}
        </div>

        <div>
          <div className="text-base font-semibold text-slate-900">{title}</div>
          <div className="mt-2 text-sm text-slate-700 leading-relaxed">{desc}</div>
        </div>
      </div>
    </div>
  );
}
