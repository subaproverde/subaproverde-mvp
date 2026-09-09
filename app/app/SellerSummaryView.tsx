import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowRight, ArrowUpRight, Award, CheckCheck, CircleAlert, Clock3, ShieldCheck } from "lucide-react";
import s from "./seller-home.module.css";

export type SellerSummaryViewProps = {
  name: string; sellerId: string; mlUserId: string; actions: ReactNode;
  reputation: { level: string; label: string; score: number | null; available: boolean };
  medal: { label: string; detail: string };
  impacts: { label: string; value: number | null; rate: string; period?: string }[];
  totalImpact: number | null; priority: string;
  commerce: { completed: string; canceled: string; positive: string; neutral: string; negative: string; experience: string };
  alerts: { id: string | number; title: string; meta: string }[];
  cases: { id: string | number; title: string; meta: string }[];
};
const number = (value: number | null) => value === null ? "—" : value.toLocaleString("pt-BR");

export default function SellerSummaryView({ name, sellerId, mlUserId, actions, reputation, medal, impacts, totalImpact, priority, commerce, alerts, cases }: SellerSummaryViewProps) {
  const index = ["vermelho", "laranja", "amarelo", "verde"].indexOf(reputation.level);
  const angle = -72 + Math.max(0, index) * 48;
  const max = Math.max(1, ...impacts.map((item) => item.value ?? 0));
  return <div className={s.summary}>
    <section className={s.heading}>
      <div><p className={s.eyebrow}>SUA OPERAÇÃO, EM PERSPECTIVA</p><h1>{name === "-" ? "Resumo da conta" : name}</h1><p className={s.subtitle}>Uma leitura clara da sua reputação e dos próximos passos.</p></div>
      <div className={s.headingActions}>{actions}</div>
    </section>
    {!reputation.available && <div className={s.notice} role="status"><CircleAlert size={18} /><span>Os dados de reputação não estão disponíveis. Atualize a página ou verifique a conexão com o Mercado Livre.</span></div>}
    <section className={s.metrics} aria-label="Indicadores da conta">
      <div><span>Reputação da conta</span><strong className={s.metricWord} data-level={reputation.available ? reputation.level : "unknown"}><i />{reputation.available ? reputation.label : "Indisponível"}</strong><small>Classificação do Mercado Livre</small></div>
      <div><span>Impactos registrados</span><strong>{number(totalImpact)}</strong><small>Indicadores de reputação</small></div>
      <div><span>Vendas concluídas</span><strong>{commerce.completed}</strong><small>No histórico retornado pelo ML</small></div>
      <div><span>Medalha da conta</span><strong className={s.medalWord}><Award size={19} />{medal.label.replace("Mercado Líder ", "")}</strong><small>{medal.label.includes("Mercado Líder") ? "Mercado Líder" : "Informação do Mercado Livre"}</small></div>
    </section>
    <div className={s.dashboardGrid}>
      <section className={`${s.panel} ${s.reputationPanel}`}>
        <div className={s.sectionHead}><div><span className={s.kicker}>COMO SUA CONTA ESTÁ</span><h2>Reputação do seller</h2></div><ShieldCheck size={20} /></div>
        <div className={s.gauge} data-level={reputation.available ? reputation.level : "unknown"}>
          <svg viewBox="0 0 360 215" role="img" aria-label={reputation.available ? `Reputação: ${reputation.label}` : "Reputação indisponível"}>
            <path d="M 45 166 A 135 135 0 0 1 315 166" fill="none" stroke="#3b4446" strokeWidth="18" />
            <path d="M 45 166 A 135 135 0 0 1 80 75" fill="none" stroke="#ce7278" strokeWidth="18" />
            <path d="M 87 68 A 135 135 0 0 1 175 31" fill="none" stroke="#d79962" strokeWidth="18" />
            <path d="M 185 31 A 135 135 0 0 1 273 68" fill="none" stroke="#d9c46a" strokeWidth="18" />
            <path d="M 280 75 A 135 135 0 0 1 315 166" fill="none" stroke="#60b838" strokeWidth="18" />
            <path d="M 68 166 A 112 112 0 0 1 292 166" fill="none" stroke="#465052" strokeWidth="1" strokeDasharray="2 9" />
            {reputation.available && <g transform={`rotate(${angle} 180 166)`}><path d="M 176 166 L 180 62 L 184 166 Z" fill="#e9eee8" /><circle cx="180" cy="166" r="8" fill="#e9eee8" /></g>}
            <text x="43" y="201" textAnchor="middle" fill="#aeb7b4" fontSize="11">EM RISCO</text><text x="310" y="201" textAnchor="middle" fill="#aeb7b4" fontSize="11">SAUDÁVEL</text>
          </svg>
          <span className={s.reputationBadge}>{reputation.available ? reputation.label : "Sem dados"}</span>
          <p>{reputation.available && reputation.score !== null ? `Score ${reputation.score}` : "Classificação conforme os dados da conta"}</p>
        </div>
        <div className={s.reputationFoot}><Award size={18} /><div><strong>{medal.label}</strong><span>{medal.detail}</span></div></div>
      </section>
      <section className={s.panel}>
        <div className={s.sectionHead}><div><span className={s.kicker}>ONDE ESTÁ A ATENÇÃO</span><h2>Impactos na reputação</h2></div><span className={s.subtleBadge}>{number(totalImpact)} total</span></div>
        <div className={s.impactList}>{impacts.map((item) => <div className={s.impactRow} key={item.label}><div><strong>{item.label}</strong><span>{number(item.value)}</span></div><div className={s.impactTrack} aria-hidden="true"><i style={{ width: `${Math.max(0, (item.value ?? 0) / max * 100)}%` }} /></div><p>Taxa {item.rate}{item.period && ` · ${item.period}`}</p></div>)}</div>
        <div className={s.priorityNote}><CircleAlert size={18} /><p><strong>Prioridade da conta</strong><span>{priority}</span></p></div>
      </section>
    </div>
    <section className={s.commercePanel} aria-labelledby="commerce-title"><div><span className={s.kicker}>PANORAMA COMERCIAL</span><h2 id="commerce-title">Confiança, em números.</h2><p>Avaliações retornadas pelo Mercado Livre.</p></div><dl className={s.commerceStats}><div><dt>Positivas</dt><dd>{commerce.positive}</dd></div><div><dt>Neutras</dt><dd>{commerce.neutral}</dd></div><div><dt>Negativas</dt><dd>{commerce.negative}</dd></div></dl></section>
    <div className={s.activityGrid}>
      <Activity title="Alertas recentes" subtitle="Últimas ocorrências sincronizadas" empty="Nenhum alerta por enquanto." items={alerts} icon={<CircleAlert size={18} />} />
      <Activity title="Chamados em andamento" subtitle="Últimos casos ainda não finalizados" empty="Nenhum chamado em andamento." items={cases} icon={<Clock3 size={18} />} />
    </div>
    <details className={s.details}><summary>Detalhes da conta <span>Identificadores e informações complementares</span></summary><dl><div><dt>Seller ID</dt><dd>{sellerId}</dd></div><div><dt>Usuário Mercado Livre</dt><dd>{mlUserId || "—"}</dd></div><div><dt>Experiência ML</dt><dd>{commerce.experience}</dd></div><div><dt>Vendas canceladas no histórico</dt><dd>{commerce.canceled}</dd></div></dl></details>
  </div>;
}

function Activity({ title, subtitle, empty, items, icon }: { title: string; subtitle: string; empty: string; items: SellerSummaryViewProps["alerts"]; icon: ReactNode }) {
  return <section className={s.panel}><div className={s.sectionHead}><div><span className={s.kicker}>{subtitle}</span><h2>{title}</h2></div>{icon}</div><div className={s.activityList}>{items.length ? items.map((item) => <Link href="/app/cases" key={item.id} className={s.activity}><div><strong>{item.title}</strong><span>{item.meta}</span></div><ArrowUpRight size={16} /></Link>) : <div className={s.empty}><CheckCheck size={25} /><p>{empty}</p></div>}</div><Link className={s.panelLink} href="/app/cases">Acompanhar chamados <ArrowRight size={15} /></Link></section>;
}
