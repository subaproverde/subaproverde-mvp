import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const sellerId = searchParams.get("sellerId")?.trim();

    if (!sellerId) {
      return NextResponse.json(
        { ok: false, error: "sellerId é obrigatório" },
        { status: 400 }
      );
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceKey) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Env faltando: NEXT_PUBLIC_SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY",
        },
        { status: 500 }
      );
    }

    const supabase = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false },
    });

    // =========================================================
    // 1) Preferido: cache
    // =========================================================
    const cached = await supabase
      .from("ml_seller_metrics_latest")
      .select("claims, mediations, cancellations, delays, created_at")
      .eq("seller_id", sellerId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!cached.error && cached.data) {
      return NextResponse.json({
        ok: true,
        sellerId,
        source: "cache:ml_seller_metrics_latest",
        metrics: {
          claims: Number(cached.data.claims) || 0,
          mediations: Number(cached.data.mediations) || 0,
          cancellations: Number(cached.data.cancellations) || 0,
          delays: Number(cached.data.delays) || 0,
        },
      });
    }

    // =========================================================
    // 2) Fallback: contar direto na tabela "cases"
    // - Reclamações: impact_claims
    // - Mediações:  impact_mediations (se você tiver; se não, vai ficar 0)
    // - Cancelamentos: cancellations
    // - Atrasos: delayed_handling_time
    // =========================================================
    const countByKind = async (kind: string) => {
      const r = await supabase
        .from("cases")
        .select("id", { count: "exact", head: true })
        .eq("seller_id", sellerId)
        .eq("kind", kind);

      if (r.error) return null;
      return r.count ?? 0;
    };

    const claims = await countByKind("impact_claims");
    const mediations = await countByKind("impact_mediations"); // se não existir, vai dar null
    const cancellations = await countByKind("cancellations");
    const delays = await countByKind("delayed_handling_time");

    // Se mediações não existir como kind, não quebra
    const safeMediations = mediations === null ? 0 : mediations;

    // Se deu erro em alguma contagem essencial, retorna fallback com aviso
    if (claims === null || cancellations === null || delays === null) {
      return NextResponse.json({
        ok: true,
        sellerId,
        source: "fallback:zeros",
        metrics: { claims: 0, mediations: 0, cancellations: 0, delays: 0 },
        note:
          "Não consegui contar na tabela cases. Verifique se 'cases' existe e tem colunas seller_id/kind.",
      });
    }

    return NextResponse.json({
      ok: true,
      sellerId,
      source: "db:cases(kind)",
      metrics: {
        claims,
        mediations: safeMediations,
        cancellations,
        delays,
      },
    });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message ?? "Erro desconhecido" },
      { status: 500 }
    );
  }
}
