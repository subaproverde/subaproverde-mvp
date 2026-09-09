"use client";
import SellerReputationGauge from "@/app/app/SellerReputationGauge";

export type ReputationLevel = "verde" | "amarelo" | "laranja" | "vermelho";
type Props = { level: ReputationLevel; label?: string; subtitle?: string; scoreText?: string; theme?: "auto" | "dark" | "light"; size?: "sm" | "md" };

// Reuse the approved brand gauge on seller detail pages as well as the summary.
export function ReputationThermometer({ level, label = level.toUpperCase(), subtitle = "", scoreText = "Score -", size = "md" }: Props) {
  return <section className="w-full rounded-xl border border-spv-line bg-spv-surface p-5">
    <div className="flex items-center justify-between gap-3 text-sm"><span className="text-spv-muted">Reputação</span><span className="text-spv-ink">{scoreText}</span></div>
    <div className={size === "sm" ? "mx-auto max-w-72" : "mx-auto max-w-sm"}><SellerReputationGauge level={level} label={label} available /></div>
    <h3 className="text-center text-lg font-semibold text-spv-ink">{label}</h3>
    {subtitle && <p className="mt-2 text-center text-sm text-spv-muted">{subtitle}</p>}
  </section>;
}
