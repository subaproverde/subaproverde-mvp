import { NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// status que aparecem no Kanban (abertos)
const ACTIVE_CASE_STATUSES = ["novo", "em_analise", "aguardando_cliente", "chamado_aberto"] as const;

// quando o impacto some do ML, o case vai pra cá (não aparece no Kanban)
const CLOSED_AUTO_STATUS = "resolvido";
const REOPEN_STATUS = "novo";

// nunca reabrir automaticamente
const DO_NOT_REOPEN_STATUSES = ["negado", "arquivado"] as const;

// ✅ IMPORTANTÍSSIMO:
// Só vamos considerar “open” as issues reais que você quer no Kanban.
// As *_metric atrapalham e seguram cases “abertos” mesmo quando já sumiram.
const ALLOWED_OPEN_ISSUE_KINDS = [
  "impact_claims",
  "delayed_handling_time",
  "cancellations",
  // se você usar mediations como issue real, inclua aqui:
  // "mediations",
];

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const sellerId = sp.get("sellerId");
  if (!sellerId) return Response.json({ error: "sellerId obrigatório" }, { status: 400 });

  const nowIso = new Date().toISOString();

  // 1) issues abertas (FILTRADAS) — só o que importa pro Kanban
  const { data: openIssues, error: oiErr } = await supabaseAdmin
    .from("reputation_issues")
    .select("id, kind")
    .eq("seller_id", sellerId)
    .eq("status", "open")
    .in("kind", ALLOWED_OPEN_ISSUE_KINDS);

  if (oiErr) {
    return Response.json(
      { error: "Falha ao buscar issues abertas", details: oiErr.message },
      { status: 500 }
    );
  }

  const openIssueIds = new Set((openIssues ?? []).map((x: any) => x.id));
  const openIssueArr = Array.from(openIssueIds);

  // 2) marca last_seen_open_at apenas nos cases ATIVOS que continuam impactando
  if (openIssueArr.length > 0) {
    const { error: lsErr } = await supabaseAdmin
      .from("cases")
      .update({ last_seen_open_at: nowIso, updated_at: nowIso })
      .eq("seller_id", sellerId)
      .in("status", Array.from(ACTIVE_CASE_STATUSES))
      .in("issue_id", openIssueArr);

    if (lsErr) {
      return Response.json(
        { error: "Falha ao atualizar last_seen_open_at", details: lsErr.message },
        { status: 500 }
      );
    }
  }

  // 3) pega cases ativos
  const { data: activeCases, error: acErr } = await supabaseAdmin
    .from("cases")
    .select("id, issue_id, status")
    .eq("seller_id", sellerId)
    .in("status", Array.from(ACTIVE_CASE_STATUSES));

  if (acErr) {
    return Response.json(
      { error: "Falha ao buscar cases ativos", details: acErr.message },
      { status: 500 }
    );
  }

  // 4) fecha automaticamente cases cujo issue_id não está mais open
  const toClose = (activeCases ?? [])
    .filter((c: any) => c.issue_id && !openIssueIds.has(c.issue_id))
    .map((c: any) => c.id);

  let closed = 0;
  if (toClose.length > 0) {
    const { error: upErr } = await supabaseAdmin
      .from("cases")
      .update({
        status: CLOSED_AUTO_STATUS,
        resolved_at: nowIso,
        status_changed_at: nowIso,
        updated_at: nowIso,
      })
      .in("id", toClose);

    if (upErr) {
      return Response.json(
        { error: "Falha ao fechar cases", details: upErr.message },
        { status: 500 }
      );
    }

    closed = toClose.length;

    // opcional: notificação
    await supabaseAdmin.from("notifications").insert(
      toClose.map((caseId) => ({
        seller_id: sellerId,
        type: "auto_closed",
        title: "Case resolvido automaticamente",
        body: "O impacto não aparece mais como aberto no Mercado Livre.",
        case_id: caseId,
      }))
    );
  }

  // 5) reabrir automaticamente cases resolvidos que voltaram a impactar
  const { data: maybeReopenCases, error: rcErr } = await supabaseAdmin
    .from("cases")
    .select("id, issue_id, status")
    .eq("seller_id", sellerId)
    .not("issue_id", "is", null);

  if (rcErr) {
    return Response.json(
      { error: "Falha ao buscar cases para reabrir", details: rcErr.message },
      { status: 500 }
    );
  }

  const toReopen = (maybeReopenCases ?? [])
    .filter((c: any) => {
      if (!c.issue_id) return false;
      if (!openIssueIds.has(c.issue_id)) return false;
      if (DO_NOT_REOPEN_STATUSES.includes(c.status)) return false;
      return c.status === CLOSED_AUTO_STATUS;
    })
    .map((c: any) => c.id);

  let reopened = 0;
  if (toReopen.length > 0) {
    const { error: reErr } = await supabaseAdmin
      .from("cases")
      .update({
        status: REOPEN_STATUS,
        resolved_at: null,
        last_seen_open_at: nowIso,
        status_changed_at: nowIso,
        updated_at: nowIso,
      })
      .in("id", toReopen);

    if (reErr) {
      return Response.json(
        { error: "Falha ao reabrir cases", details: reErr.message },
        { status: 500 }
      );
    }

    reopened = toReopen.length;

    await supabaseAdmin.from("notifications").insert(
      toReopen.map((caseId) => ({
        seller_id: sellerId,
        type: "reopened",
        title: "Case reaberto",
        body: "O impacto voltou a aparecer como aberto no Mercado Livre.",
        case_id: caseId,
      }))
    );
  }

  return Response.json({
    ok: true,
    sellerId,
    open_issues_considered: openIssueIds.size,
    active_cases_checked: activeCases?.length ?? 0,
    closed,
    reopened,
  });
}
