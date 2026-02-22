import { NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

function isOverdue(due?: string | null) {
  if (!due) return false;
  const t = new Date(due).getTime();
  if (Number.isNaN(t)) return false;
  return t < Date.now();
}

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const sellerId = sp.get("sellerId");
  if (!sellerId) return Response.json({ error: "sellerId obrigatório" }, { status: 400 });

  // 1) Summary (reputação)
  const { data: summary, error: sErr } = await supabaseAdmin
    .from("seller_reputation_summaries")
    .select("*")
    .eq("seller_id", sellerId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (sErr) {
    return Response.json({ error: "Falha ao buscar summary", details: sErr.message }, { status: 500 });
  }

  // 2) Issues abertas (fonte real de "impactos detectados")
  const { data: openIssues, error: iErr } = await supabaseAdmin
    .from("reputation_issues")
    .select("id, kind, status, severity, created_at, payload")
    .eq("seller_id", sellerId)
    .eq("status", "open")
    .limit(2000);

  if (iErr) {
    return Response.json({ error: "Falha ao buscar issues", details: iErr.message }, { status: 500 });
  }

  const issues = openIssues ?? [];

  // 3) MAPEAMENTO CERTO dos kinds -> métricas do dashboard
  // Ajuste aqui conforme os kinds forem crescendo
  const claims =
    issues.filter((x) => x.kind === "impact_claims" || x.kind === "impact_claims_metric").length;

  const delays =
    issues.filter((x) => x.kind === "impact_delayed_handling_metric" || x.kind === "delayed_handling_time").length;

  const cancellations =
    issues.filter((x) => x.kind === "cancellations" || x.kind === "impact_cancellations_metric").length;

  // 4) SLA vencidos: vem melhor do case (porque SLA está no case)
  const { data: openCases, error: cErr } = await supabaseAdmin
    .from("cases")
    .select("id, status, protocol, due_date")
    .eq("seller_id", sellerId)
    .in("status", ["novo", "em_analise", "aguardando_cliente", "chamado_aberto"])
    .limit(2000);

  if (cErr) {
    return Response.json({ error: "Falha ao buscar cases", details: cErr.message }, { status: 500 });
  }

  const cases = openCases ?? [];

  const sla_overdue = cases.filter((c) => isOverdue(c.due_date)).length;

  // "Chamados em andamento": casos que já têm protocolo ou estão em chamado_aberto
  const in_progress = cases.filter((c) => c.status === "chamado_aberto" || (c.protocol ?? "").trim().length > 0).length;

  return Response.json({
    ok: true,
    sellerId,
    reputation: summary ?? null,
    metrics: {
      claims,
      delays,
      cancellations,
      sla_overdue,
      in_progress,
    },
  });
}
