// app/page.tsx
"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  BarChart3,
  BellRing,
  CalendarClock,
  CheckCircle2,
  ChevronRight,
  FileText,
  Gauge,
  LineChart,
  LockKeyhole,
  Mail,
  MessageCircle,
  MonitorCheck,
  ShieldCheck,
  Sparkles,
  Target,
  TrendingUp,
  Users,
  X,
  Zap,
  type LucideIcon,
} from "lucide-react";
import SubaProVerdeIntro from "./components/SubaProVerdeIntro";

const WHATSAPP_LINK =
  "https://wa.me/554388231544?text=Quero%20analisar%20minha%20opera%C3%A7%C3%A3o%20no%20Mercado%20Livre";
const CONTACT_EMAIL = "contato@subaproverde.com.br";

const painPoints = [
  {
    icon: AlertTriangle,
    title: "Reputação oscila sem aviso claro",
    text: "Reclamações, mediações, cancelamentos e atrasos aparecem em lugares diferentes e tiram velocidade da operação.",
  },
  {
    icon: Gauge,
    title: "Perda de exposição vira perda de receita",
    text: "Quando o termômetro piora, o seller perde tração comercial e passa a operar no modo reação.",
  },
  {
    icon: CalendarClock,
    title: "Prazos e tratativas ficam espalhados",
    text: "Sem uma rotina estruturada, casos importantes ficam parados e oportunidades de revisão se perdem.",
  },
];

const modules = [
  {
    icon: ShieldCheck,
    title: "Reputação",
    text: "Acompanhe sinais do termômetro, limites e evolução operacional em uma visão executiva.",
  },
  {
    icon: MessageCircle,
    title: "Reclamações e mediações",
    text: "Organize atendimentos, histórico, evidências e oportunidades passíveis de revisão.",
  },
  {
    icon: Zap,
    title: "Atrasos e expedição",
    text: "Entenda gargalos de envio, prazos críticos e rotas que exigem atenção.",
  },
  {
    icon: BellRing,
    title: "Alertas operacionais",
    text: "Priorize o que vence hoje, o que parou e o que pode virar impacto.",
  },
  {
    icon: FileText,
    title: "Relatórios executivos",
    text: "Consolide contexto, evolução e próximos passos em uma narrativa profissional.",
  },
  {
    icon: LineChart,
    title: "Performance do seller",
    text: "Transforme dados soltos em decisões para crescimento saudável no Mercado Livre.",
  },
];

const platformSignals = [
  { label: "Reclamações", value: "2", tone: "emerald", detail: "sob acompanhamento" },
  { label: "Mediações", value: "1", tone: "sky", detail: "prioridade alta" },
  { label: "Atrasos", value: "64", tone: "amber", detail: "risco operacional" },
  { label: "Cancelamentos", value: "0", tone: "rose", detail: "dentro do limite" },
];

const methodSteps = [
  "Monitorar indicadores",
  "Priorizar riscos",
  "Registrar evidências",
  "Acompanhar tratativas",
  "Reportar evolução",
];

export default function LandingPage() {
  return (
    <>
      <SubaProVerdeIntro />

      <div className="min-h-screen bg-[#050807] text-white">
        <Header />

        <main>
          <HeroSection />
          <ProblemSection />
          <SolutionSection />
          <ModulesSection />
          <PlatformSection />
          <AuthoritySection />
          <FinalCTA />
        </main>

        <Footer />
        <MascotChatWidget />
      </div>
    </>
  );
}

function Header() {
  return (
    <header className="sticky top-0 z-50 border-b border-white/10 bg-[#050807]/82 backdrop-blur-xl">
      <div className="mx-auto flex h-20 max-w-7xl items-center justify-between px-5 sm:px-6 lg:px-8">
        <Link href="/" className="flex items-center gap-3" aria-label="Suba Pro Verde">
          <span className="flex h-11 w-11 items-center justify-center rounded-lg border border-emerald-400/20 bg-emerald-400/10">
            <Image
              src="/brand/suba-logo.png"
              alt=""
              width={34}
              height={34}
              className="h-8 w-8 object-contain"
              priority
            />
          </span>
          <span className="hidden leading-tight sm:block">
            <span className="block text-base font-semibold text-white">Suba Pro Verde</span>
            <span className="block text-xs text-white/52">Inteligência para sellers ML</span>
          </span>
        </Link>

        <nav className="hidden items-center gap-1 text-sm text-white/62 lg:flex">
          <a className="rounded-lg px-3 py-2 hover:bg-white/7 hover:text-white" href="#plataforma">
            Plataforma
          </a>
          <a className="rounded-lg px-3 py-2 hover:bg-white/7 hover:text-white" href="#modulos">
            Módulos
          </a>
          <a className="rounded-lg px-3 py-2 hover:bg-white/7 hover:text-white" href="#metodo">
            Método
          </a>
          <a className="rounded-lg px-3 py-2 hover:bg-white/7 hover:text-white" href="#contato">
            Contato
          </a>
        </nav>

        <div className="flex items-center gap-2">
          <Link
            href="/login"
            className="hidden rounded-lg border border-white/12 bg-white/6 px-4 py-2 text-sm font-semibold text-white/82 hover:bg-white/10 sm:inline-flex"
          >
            Entrar
          </Link>
          <a
            href={WHATSAPP_LINK}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 rounded-lg bg-emerald-400 px-4 py-2 text-sm font-bold text-[#062016] shadow-[0_18px_60px_rgba(52,211,153,0.22)] hover:bg-emerald-300"
          >
            <MessageCircle className="h-4 w-4" />
            <span className="hidden sm:inline">Falar com a Suba</span>
            <span className="sm:hidden">Contato</span>
          </a>
        </div>
      </div>
    </header>
  );
}

function HeroSection() {
  return (
    <section
      id="home"
      className="relative overflow-hidden border-b border-white/10 bg-[linear-gradient(180deg,#07100d_0%,#050807_66%,#070a09_100%)]"
    >
      <div className="absolute inset-0 opacity-[0.18] [background-image:linear-gradient(rgba(255,255,255,0.08)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.08)_1px,transparent_1px)] [background-size:48px_48px]" />
      <div className="absolute inset-x-0 top-0 h-28 bg-[linear-gradient(180deg,rgba(52,211,153,0.18),transparent)]" />
      <div className="absolute inset-0 bg-[linear-gradient(115deg,rgba(5,8,7,0.10)_0%,rgba(5,8,7,0.25)_45%,rgba(52,211,153,0.10)_100%)]" />

      <div className="relative mx-auto grid max-w-7xl gap-12 px-5 pb-16 pt-14 sm:px-6 md:pb-20 md:pt-20 lg:grid-cols-[0.96fr_1.04fr] lg:items-center lg:px-8">
        <div>
          <div className="inline-flex items-center gap-2 rounded-lg border border-emerald-300/20 bg-emerald-300/8 px-3 py-2 text-xs font-semibold text-emerald-100">
            <Sparkles className="h-4 w-4" />
            Plataforma de reputação, performance operacional e CX
          </div>

          <h1 className="mt-7 text-5xl font-semibold leading-[0.95] text-white md:text-7xl">
            Suba Pro Verde
          </h1>

          <p className="mt-6 max-w-3xl text-2xl font-semibold leading-tight text-white/92 md:text-4xl">
            Inteligência operacional para sellers Mercado Livre protegerem reputação,
            prevenirem impactos e tomarem decisões melhores.
          </p>

          <p className="mt-6 max-w-2xl text-base leading-7 text-white/66 md:text-lg">
            Uma central premium para acompanhar indicadores, organizar tratativas,
            enxergar riscos e transformar atendimento em performance saudável.
          </p>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <a
              href={WHATSAPP_LINK}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-400 px-6 py-3 text-sm font-bold text-[#062016] shadow-[0_22px_80px_rgba(52,211,153,0.25)] hover:bg-emerald-300"
            >
              <MessageCircle className="h-4 w-4" />
              Quero analisar minha operação
            </a>
            <Link
              href="/login"
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-white/14 bg-white/7 px-6 py-3 text-sm font-bold text-white hover:bg-white/11"
            >
              Acessar plataforma
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>

          <div className="mt-7 flex flex-wrap gap-3 text-xs text-white/50">
            <TrustBadge icon={ShieldCheck} text="Sem promessa de resultado garantido" />
            <TrustBadge icon={LockKeyhole} text="Foco em operação regular e evidências" />
            <TrustBadge icon={MonitorCheck} text="Visão construída para rotina de seller" />
          </div>
        </div>

        <OperationsCockpit />
      </div>
    </section>
  );
}

function OperationsCockpit() {
  return (
    <div className="relative">
      <div className="absolute -inset-4 bg-[linear-gradient(135deg,rgba(52,211,153,0.16),rgba(14,165,233,0.08),rgba(245,158,11,0.10))] blur-2xl" />
      <div className="relative overflow-hidden rounded-lg border border-white/12 bg-[#0a100e]/92 shadow-[0_35px_140px_rgba(0,0,0,0.45)]">
        <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-rose-400" />
            <span className="h-2.5 w-2.5 rounded-full bg-amber-300" />
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
          </div>
          <div className="text-xs font-semibold text-white/42">SPV Operational Radar</div>
        </div>

        <div className="grid gap-0 md:grid-cols-[1fr_280px]">
          <div className="border-b border-white/10 p-5 md:border-b-0 md:border-r">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-xs font-semibold text-emerald-200/80">
                  Saúde operacional
                </div>
                <div className="mt-2 text-3xl font-semibold text-white">Verde sob controle</div>
              </div>
              <div className="rounded-lg border border-emerald-300/20 bg-emerald-300/10 px-3 py-2 text-right">
                <div className="text-xs text-white/46">score</div>
                <div className="text-xl font-bold text-emerald-200">88</div>
              </div>
            </div>

            <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {platformSignals.map((item) => (
                <SignalTile key={item.label} {...item} />
              ))}
            </div>

            <div className="mt-6 space-y-3">
              <RiskRow
                title="Prazo de expedição próximo do limite"
                detail="Prioridade hoje"
                value="09:30"
                tone="amber"
              />
              <RiskRow
                title="Cliente aguardando resposta"
                detail="Tratativa em acompanhamento"
                value="2h"
                tone="sky"
              />
              <RiskRow
                title="Oportunidade de relatório executivo"
                detail="Enviar evolução ao seller"
                value="R$"
                tone="emerald"
              />
            </div>
          </div>

          <div className="p-5">
            <div className="flex items-center justify-between">
              <div className="text-xs font-semibold text-white/50">Rotina inteligente</div>
              <BellRing className="h-4 w-4 text-emerald-200" />
            </div>
            <div className="mt-5 space-y-4">
              {methodSteps.slice(0, 4).map((step, index) => (
                <div key={step} className="flex gap-3">
                  <div className="flex flex-col items-center">
                    <span className="flex h-7 w-7 items-center justify-center rounded-lg border border-white/12 bg-white/7 text-xs font-bold text-white">
                      {index + 1}
                    </span>
                    {index < 3 && <span className="mt-2 h-7 w-px bg-white/10" />}
                  </div>
                  <div className="pt-1">
                    <div className="text-sm font-semibold text-white/86">{step}</div>
                    <div className="mt-1 text-xs leading-5 text-white/44">
                      Dados, prioridade e histórico na mesma rotina.
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ProblemSection() {
  return (
    <section className="bg-[#070a09] py-20">
      <div className="mx-auto max-w-7xl px-5 sm:px-6 lg:px-8">
        <SectionHeader
          eyebrow="O problema"
          title="Seller cresce quando a operação enxerga o risco antes do prejuízo."
          text="A reputação no Mercado Livre é reflexo de experiência do comprador, expedição, atendimento e rotina. Sem visibilidade, o time descobre tarde demais onde está perdendo performance."
        />

        <div className="mt-10 grid gap-4 md:grid-cols-3">
          {painPoints.map((item) => (
            <FeatureCard key={item.title} {...item} />
          ))}
        </div>
      </div>
    </section>
  );
}

function SolutionSection() {
  return (
    <section id="plataforma" className="border-y border-white/10 bg-[#0a0f0d] py-20">
      <div className="mx-auto grid max-w-7xl gap-10 px-5 sm:px-6 lg:grid-cols-[0.9fr_1.1fr] lg:items-center lg:px-8">
        <div>
          <SectionKicker>Como a Suba Pro Verde atua</SectionKicker>
          <h2 className="mt-4 text-3xl font-semibold leading-tight text-white md:text-5xl">
            Uma central operacional para recuperar clareza, prevenir impactos e elevar CX.
          </h2>
          <p className="mt-5 text-base leading-7 text-white/62">
            A plataforma ajuda a mapear sinais críticos, estruturar o atendimento e
            manter evidências para decisões mais rápidas. O foco é operação saudável,
            experiência do comprador e performance consistente.
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <OutcomeItem icon={Target} title="Prioridade real" text="O que precisa de ação hoje aparece primeiro." />
          <OutcomeItem icon={Users} title="Atendimento organizado" text="Histórico, contexto e próximos passos em uma única visão." />
          <OutcomeItem icon={TrendingUp} title="Evolução visível" text="Risco, oportunidade e recuperação acompanhados por indicador." />
          <OutcomeItem icon={CheckCircle2} title="Ação responsável" text="Análise de impactos passíveis de revisão, sem promessas indevidas." />
        </div>
      </div>
    </section>
  );
}

function ModulesSection() {
  return (
    <section id="modulos" className="bg-[#050807] py-20">
      <div className="mx-auto max-w-7xl px-5 sm:px-6 lg:px-8">
        <SectionHeader
          eyebrow="Módulos"
          title="Tudo que um seller precisa para ter a operação na palma da mão."
          text="Reputação não é uma tela isolada. É a soma de rotina, prazo, atendimento, evidência, relatório e decisão."
        />

        <div className="mt-10 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {modules.map((item) => (
            <ModuleCard key={item.title} {...item} />
          ))}
        </div>
      </div>
    </section>
  );
}

function PlatformSection() {
  return (
    <section id="metodo" className="border-y border-white/10 bg-[#0a100e] py-20">
      <div className="mx-auto max-w-7xl px-5 sm:px-6 lg:px-8">
        <div className="grid gap-10 lg:grid-cols-[0.95fr_1.05fr] lg:items-start">
          <div>
            <SectionKicker>Visão de plataforma</SectionKicker>
            <h2 className="mt-4 text-3xl font-semibold leading-tight text-white md:text-5xl">
              Não é só tratar caso. É operar reputação com método.
            </h2>
            <p className="mt-5 text-base leading-7 text-white/62">
              A Suba Pro Verde nasce para centralizar inteligência operacional de
              sellers Mercado Livre: acompanhamento contínuo, calendário, alertas,
              relatórios executivos e suporte à tomada de decisão.
            </p>
          </div>

          <div className="rounded-lg border border-white/12 bg-[#050807]/70 p-5">
            <div className="grid gap-3">
              {methodSteps.map((step, index) => (
                <div
                  key={step}
                  className="flex items-center justify-between gap-4 border-b border-white/8 pb-3 last:border-0 last:pb-0"
                >
                  <div className="flex items-center gap-3">
                    <span className="flex h-9 w-9 items-center justify-center rounded-lg border border-emerald-300/18 bg-emerald-300/8 text-sm font-bold text-emerald-100">
                      {index + 1}
                    </span>
                    <span className="text-sm font-semibold text-white/84">{step}</span>
                  </div>
                  <ChevronRight className="h-4 w-4 text-white/34" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function AuthoritySection() {
  return (
    <section className="bg-[#070a09] py-20">
      <div className="mx-auto max-w-7xl px-5 sm:px-6 lg:px-8">
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <SectionKicker>Autoridade com responsabilidade</SectionKicker>
            <h2 className="mt-4 text-3xl font-semibold leading-tight text-white md:text-5xl">
              Uma linguagem alinhada ao que marketplaces valorizam: experiência,
              prevenção e operação confiável.
            </h2>
          </div>
          <div className="rounded-lg border border-white/12 bg-white/[0.045] p-5">
            <div className="flex items-center gap-3">
              <ShieldCheck className="h-5 w-5 text-emerald-200" />
              <div className="text-sm font-semibold text-white">Atuação criteriosa</div>
            </div>
            <p className="mt-4 text-sm leading-6 text-white/58">
              A plataforma apoia análise, organização e acompanhamento. Cada caso
              depende das regras, dados disponíveis e critérios do Mercado Livre.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

function FinalCTA() {
  return (
    <section id="contato" className="bg-[#050807] px-5 py-20 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl overflow-hidden rounded-lg border border-emerald-300/18 bg-[linear-gradient(135deg,rgba(16,185,129,0.18),rgba(255,255,255,0.055)_48%,rgba(14,165,233,0.10))] p-8 md:p-12">
        <div className="max-w-3xl">
          <SectionKicker>Próximo passo</SectionKicker>
          <h2 className="mt-4 text-3xl font-semibold leading-tight text-white md:text-5xl">
            Quer enxergar onde sua operação está perdendo reputação, tempo e dinheiro?
          </h2>
          <p className="mt-5 text-base leading-7 text-white/66">
            Fale com a Suba Pro Verde para uma conversa inicial sobre indicadores,
            riscos e oportunidades de melhoria operacional no Mercado Livre.
          </p>
        </div>

        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <a
            href={WHATSAPP_LINK}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-400 px-6 py-3 text-sm font-bold text-[#062016] hover:bg-emerald-300"
          >
            <MessageCircle className="h-4 w-4" />
            Falar com a Suba Pro Verde
          </a>
          <Link
            href="/login"
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-white/14 bg-white/7 px-6 py-3 text-sm font-bold text-white hover:bg-white/11"
          >
            Acessar plataforma
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        <div className="mt-6 text-sm text-white/48">
          E-mail:{" "}
          <a className="font-semibold text-emerald-100 hover:text-emerald-50" href={`mailto:${CONTACT_EMAIL}`}>
            {CONTACT_EMAIL}
          </a>
        </div>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="border-t border-white/10 bg-[#050807]">
      <div className="mx-auto flex max-w-7xl flex-col gap-5 px-5 py-8 text-sm text-white/46 sm:px-6 md:flex-row md:items-center md:justify-between lg:px-8">
        <div className="flex items-center gap-3">
          <Image
            src="/brand/suba-logo.png"
            alt="Suba Pro Verde"
            width={150}
            height={42}
            className="h-9 w-auto object-contain"
          />
          <span>Gestão de reputação, performance operacional e CX.</span>
        </div>
        <div>© {new Date().getFullYear()} Suba Pro Verde. Todos os direitos reservados.</div>
      </div>
    </footer>
  );
}

function MascotChatWidget() {
  const [open, setOpen] = useState(false);

  return (
    <div className="fixed bottom-5 right-5 z-[80] flex flex-col items-end gap-3 sm:bottom-6 sm:right-6">
      {open && (
        <div className="w-[min(360px,calc(100vw-40px))] overflow-hidden rounded-lg border border-emerald-300/20 bg-[#07100d]/95 shadow-[0_28px_110px_rgba(0,0,0,0.55)] backdrop-blur-xl">
          <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
            <div className="flex items-center gap-3">
              <div className="relative h-11 w-11 overflow-hidden rounded-lg border border-emerald-300/20 bg-emerald-300/10">
                <Image
                  src="/landing/spv-mascot.png"
                  alt="Mascote Suba Pro Verde"
                  width={72}
                  height={72}
                  className="absolute -bottom-3 left-1/2 h-16 w-16 -translate-x-1/2 object-contain"
                />
              </div>
              <div>
                <div className="text-sm font-bold text-white">Verdinho da Suba</div>
                <div className="flex items-center gap-1.5 text-xs text-emerald-100/70">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-300" />
                  Radar de reputação ativo
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-lg border border-white/10 bg-white/5 p-2 text-white/62 hover:bg-white/10 hover:text-white"
              aria-label="Fechar chat"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="space-y-3 p-4">
            <div className="rounded-lg rounded-tl-sm border border-white/10 bg-white/[0.055] p-4">
              <p className="text-sm font-semibold leading-6 text-white">
                Oi, eu sou o Verdinho. Quer enxergar riscos de reputação, atrasos,
                reclamações e oportunidades na sua operação?
              </p>
              <p className="mt-2 text-xs leading-5 text-white/54">
                Posso te levar direto para uma conversa com a Suba Pro Verde.
              </p>
            </div>

            <div className="grid gap-2">
              <a
                href={WHATSAPP_LINK}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-400 px-4 py-3 text-sm font-bold text-[#062016] hover:bg-emerald-300"
              >
                <MessageCircle className="h-4 w-4" />
                Falar no WhatsApp
              </a>
              <a
                href={`mailto:${CONTACT_EMAIL}`}
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-white/12 bg-white/6 px-4 py-3 text-sm font-bold text-white/82 hover:bg-white/10"
              >
                <Mail className="h-4 w-4" />
                Enviar e-mail
              </a>
              <Link
                href="/login"
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-white/12 bg-white/6 px-4 py-3 text-sm font-bold text-white/82 hover:bg-white/10"
              >
                Acessar plataforma
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className="group relative flex h-20 w-20 items-center justify-center rounded-full border border-emerald-300/24 bg-[#07100d] shadow-[0_22px_80px_rgba(16,185,129,0.28)] transition hover:-translate-y-1 hover:border-emerald-200/50 sm:h-24 sm:w-24"
        aria-label={open ? "Fechar contato com a Suba" : "Abrir contato com a Suba"}
      >
        <span className="absolute inset-0 rounded-full bg-emerald-300/12 blur-xl transition group-hover:bg-emerald-300/18" />
        <span className="absolute -right-1 top-2 flex h-6 w-6 items-center justify-center rounded-full border border-[#07100d] bg-emerald-300 text-[#062016] shadow-[0_8px_24px_rgba(52,211,153,0.28)]">
          <MessageCircle className="h-3.5 w-3.5" />
        </span>
        <Image
          src="/landing/spv-mascot.png"
          alt=""
          width={120}
          height={120}
          className="relative h-[86px] w-[86px] translate-y-1 object-contain transition group-hover:scale-105 sm:h-[104px] sm:w-[104px]"
          priority
        />
      </button>
    </div>
  );
}

function TrustBadge({ icon: Icon, text }: { icon: LucideIcon; text: string }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2">
      <Icon className="h-4 w-4 text-emerald-200" />
      {text}
    </span>
  );
}

function SignalTile({
  label,
  value,
  detail,
  tone,
}: {
  label: string;
  value: string;
  detail: string;
  tone: string;
}) {
  const toneClass =
    tone === "sky"
      ? "text-sky-100 bg-sky-300/9 border-sky-300/16"
      : tone === "amber"
        ? "text-amber-100 bg-amber-300/9 border-amber-300/16"
        : tone === "rose"
          ? "text-rose-100 bg-rose-300/9 border-rose-300/16"
          : "text-emerald-100 bg-emerald-300/9 border-emerald-300/16";

  return (
    <div className={`rounded-lg border p-3 ${toneClass}`}>
      <div className="text-xs text-white/44">{label}</div>
      <div className="mt-2 text-2xl font-bold text-white">{value}</div>
      <div className="mt-1 text-xs">{detail}</div>
    </div>
  );
}

function RiskRow({
  title,
  detail,
  value,
  tone,
}: {
  title: string;
  detail: string;
  value: string;
  tone: "emerald" | "sky" | "amber";
}) {
  const iconClass =
    tone === "amber" ? "text-amber-200" : tone === "sky" ? "text-sky-200" : "text-emerald-200";

  return (
    <div className="flex items-center justify-between gap-4 rounded-lg border border-white/10 bg-white/[0.045] p-3">
      <div className="flex min-w-0 items-center gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/6">
          <BarChart3 className={`h-4 w-4 ${iconClass}`} />
        </span>
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold text-white/86">{title}</div>
          <div className="mt-1 truncate text-xs text-white/44">{detail}</div>
        </div>
      </div>
      <div className="shrink-0 rounded-lg border border-white/10 bg-black/20 px-3 py-1.5 text-sm font-bold text-white/82">
        {value}
      </div>
    </div>
  );
}

function SectionHeader({
  eyebrow,
  title,
  text,
}: {
  eyebrow: string;
  title: string;
  text: string;
}) {
  return (
    <div className="max-w-3xl">
      <SectionKicker>{eyebrow}</SectionKicker>
      <h2 className="mt-4 text-3xl font-semibold leading-tight text-white md:text-5xl">{title}</h2>
      <p className="mt-5 text-base leading-7 text-white/62">{text}</p>
    </div>
  );
}

function SectionKicker({ children }: { children: React.ReactNode }) {
  return (
    <div className="inline-flex items-center gap-2 rounded-lg border border-emerald-300/18 bg-emerald-300/8 px-3 py-2 text-xs font-bold text-emerald-100">
      <span className="h-1.5 w-1.5 rounded-full bg-emerald-300" />
      {children}
    </div>
  );
}

function FeatureCard({ icon: Icon, title, text }: { icon: LucideIcon; title: string; text: string }) {
  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.045] p-5 shadow-[0_22px_90px_rgba(0,0,0,0.20)]">
      <Icon className="h-6 w-6 text-emerald-200" />
      <h3 className="mt-5 text-lg font-semibold text-white">{title}</h3>
      <p className="mt-3 text-sm leading-6 text-white/58">{text}</p>
    </div>
  );
}

function ModuleCard({ icon: Icon, title, text }: { icon: LucideIcon; title: string; text: string }) {
  return (
    <div className="group rounded-lg border border-white/10 bg-[#0b100e] p-5 transition hover:border-emerald-300/24 hover:bg-[#0d1512]">
      <div className="flex items-start justify-between gap-4">
        <Icon className="h-6 w-6 text-emerald-200" />
        <ArrowRight className="h-4 w-4 text-white/24 transition group-hover:translate-x-0.5 group-hover:text-emerald-200" />
      </div>
      <h3 className="mt-5 text-lg font-semibold text-white">{title}</h3>
      <p className="mt-3 text-sm leading-6 text-white/58">{text}</p>
    </div>
  );
}

function OutcomeItem({ icon: Icon, title, text }: { icon: LucideIcon; title: string; text: string }) {
  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.045] p-5">
      <Icon className="h-5 w-5 text-emerald-200" />
      <div className="mt-4 text-base font-semibold text-white">{title}</div>
      <p className="mt-2 text-sm leading-6 text-white/56">{text}</p>
    </div>
  );
}
