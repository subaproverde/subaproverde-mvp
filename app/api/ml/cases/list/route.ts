import { NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const DEFAULT_NEW_STATUS = "novo";

function makeTitleFromKind(kind: string) {
  if (kind === "impact_claims") return "Reclamações";
  if (kind === "impact_delayed_handling_metric") return "Atrasos";
  if (kind === "impact_delayed_handling_time") return "Atrasos";
  if (kind === "impact_claims_metric") return "Métrica Reclamações";
  if (kind === "impact_delayed_handling_metric") return "Métrica Atrasos";
  return kind || "Impacto";
}

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;

  const sellerId = sp.get("sellerId");
  if (!sellerId) return Response.json({ error: "sellerId obrigatório" }, { status: 400 });

  const kindFilter = (sp.get("kind") || "").trim(); // opcional
  const q = (sp.get("q") || "").trim();             // opcional
  const limit = Math.min(parseInt(sp.get("limit") ?? "200", 10) || 200, 500);

  const nowIso = new Date().toISOString();

  // =========================
  // 1) Fonte da verdade: impactos abertos
  // =========================
  let issuesQuery = supabaseAdmin
    .from("reputation_issues")
    .select("id, kind, severity, external_ref, created_at")
    .eq("seller_id", sellerId)
    .eq("status", "open")
    .like("kind", "impact_%")
    .order("created_at", { ascending: false })
    .limit(500);

  if (kindFilter) issuesQuery = issuesQuery.eq("kind", kindFilter);

  const { data: openIssues, error: oiErr } = await issuesQuery;

  if (oiErr) {
    return Response.json(
      { error: "Falha ao buscar impactos abertos", details: oiErr.message },
      { status: 500 }
    );
  }

  const issues = (openIssues ?? []).filter((x: any) => x?.id && x?.kind);

  // Se não tem impacto aberto, lista vazia (kanban vazio de propósito)
  if (issues.length === 0) {
    return Response.json({ ok: true, count: 0, items: [] });
  }

  const issueIds = issues.map((x: any) => x.id);

  // =========================
  // 2) Puxa cases existentes pra esses impacts
  // =========================
  const { data: existingCases, error: ecErr } = await supabaseAdmin
    .from("cases")
    .select(
      "id, seller_id, issue_id, kind, severity, title, status, priority, assigned_to, due_date, protocol, notes, last_seen_open_at, resolved_at, status_changed_at, created_at, updated_at, external_ref"
    )
    .eq("seller_id", sellerId)
    .in("issue_id", issueIds)
    .limit(500);

  if (ecErr) {
    return Response.json(
      { error: "Falha ao buscar cases existentes", details: ecErr.message },
      { status: 500 }
    );
  }

  const byIssueId = new Map<string, any>();
  for (const c of existingCases ?? []) {
    if (c?.issue_id) byIssueId.set(c.issue_id, c);
  }

  // =========================
  // 3) Cria cases faltantes (somente para impacts abertos)
  //    e atualiza metadados (sem resetar status)
  // =========================
  const toInsert: any[] = [];
  const toUpsertMeta: any[] = []; // atualiza kind/title/severity/external_ref/updated_at

  for (const it of issues) {
    const title = makeTitleFromKind(it.kind);
    const baseMeta = {
      seller_id: sellerId,
      issue_id: it.id,
      kind: it.kind,
      severity: it.severity ?? null,
      external_ref: it.external_ref ?? null,
      title,
      updated_at: nowIso,
      last_seen_open_at: nowIso,
    };

    const exists = byIssueId.get(it.id);

    if (!exists) {
      toInsert.push({
        ...baseMeta,
        status: DEFAULT_NEW_STATUS,
        created_at: nowIso,
      });
    } else {
      // Não inclui "status" aqui pra NÃO resetar workflow.
      toUpsertMeta.push(baseMeta);
    }
  }

  // Insere novos
  if (toInsert.length > 0) {
    const { error: insErr } = await supabaseAdmin.from("cases").insert(toInsert);
    if (insErr) {
      return Response.json(
        { error: "Falha ao criar cases novos", details: insErr.message },
        { status: 500 }
      );
    }
  }

  // Upsert de metadados (sem status)
  if (toUpsertMeta.length > 0) {
    const { error: upErr } = await supabaseAdmin
      .from("cases")
      .upsert(toUpsertMeta, { onConflict: "seller_id,issue_id" });

    if (upErr) {
      return Response.json(
        { error: "Falha ao atualizar metadados dos cases", details: upErr.message },
        { status: 500 }
      );
    }
  }

  // =========================
  // 4) Lista final: agora SEMPRE reflete impact_* open
  // =========================
  let finalQuery = supabaseAdmin
    .from("cases")
    .select(
      "id, seller_id, issue_id, kind, severity, title, status, priority, assigned_to, due_date, protocol, notes, last_seen_open_at, resolved_at, status_changed_at, created_at, updated_at, external_ref"
    )
    .eq("seller_id", sellerId)
    .in("issue_id", issueIds)
    .order("updated_at", { ascending: false })
    .limit(limit);

  if (q) finalQuery = finalQuery.ilike("title", `%${q}%`);

  const { data: items, error: liErr } = await finalQuery;

  if (liErr) {
    return Response.json(
      { error: "Falha ao listar cases", details: liErr.message },
      { status: 500 }
    );
  }

  return Response.json({ ok: true, count: items?.length ?? 0, items: items ?? [] });
}
