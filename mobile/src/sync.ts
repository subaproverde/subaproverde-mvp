import { Platform } from "react-native";
import { fetchRadar, type RadarSummary } from "./api";
import type { RadarProps } from "../widgets/RadarWidget";
let revision = 0;

export async function clearWidget() {
  revision++;
  if (Platform.OS !== "ios") return;
  const { default: widget } = await import("../widgets/RadarWidget");
  widget.updateSnapshot({ signedIn: false, stale: false, updatedLabel: "", today: 0, overdue: 0, waiting: 0, tasks: [] });
}

export async function publishWidget(data: RadarSummary) {
  const initialRevision = revision;
  if (Platform.OS !== "ios") return;
  const { default: widget } = await import("../widgets/RadarWidget");
  if (initialRevision !== revision) return;
  const formatter = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
  const props: RadarProps = {
    signedIn: true, stale: false, updatedLabel: `Atualizado ${formatter.format(new Date(data.generatedAt))}`,
    today: data.metrics.today, overdue: data.metrics.overdue, waiting: data.metrics.waitingTeam,
    tasks: data.tasks.map((task) => ({ title: `${task.contactName} · ${task.title}`, time: formatter.format(new Date(task.dueAt)) })),
  };
  // Expire the cached snapshot even if iOS doesn't grant background execution.
  widget.updateTimeline([
    { date: new Date(), props },
    { date: new Date(Date.now() + 60 * 60_000), props: { ...props, stale: true } },
    { date: new Date(Date.now() + 24 * 60 * 60_000), props: { ...props, signedIn: false, tasks: [] } },
  ]);
}

export async function syncRadar() {
  const summary = await fetchRadar();
  await publishWidget(summary);
  return summary;
}
