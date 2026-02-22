import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

type MlFetchOpts = { accessToken: string };

// ✅ Ajuste se seu mlFetch já existe em outro lugar
async function mlFetch<T>(pathOrUrl: string, opts: MlFetchOpts): Promise<T> {
  // Se você já tem uma função mlFetch no projeto, use ela.
  // Aqui vai uma versão segura: aceita path "/..." e URL completa.
  const url = pathOrUrl.startsWith("http")
    ? pathOrUrl
    : `https://api.mercadolibre.com${pathOrUrl}`;

  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${opts.accessToken}`,
      "Content-Type": "application/json",
    },
    cache: "no-store",
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`ML error ${res.status}: ${text}`);
  }

  return (await res.json()) as T;
}

// ✅ Tipos mínimos do ML (a gente mapeia depois)
type MlClaimsSearchResponse = {
  paging?: { total?: number };
  results?: Array<number | string>;
  data?: any;
};

type MlClaimDetail = {
  id: number | string;
  status?: string; // opened/closed etc
  type?: string;   // mediations/return/fulfillment/ml_case/cancel_sale...
  reason?: string;
  date_created?: string;
  last_updated?: string;
  resource_id?: string;
  buyers?: any;
};

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY! // ✅ precisa ser service role no server
);

// ✅ Busca token + ml_user_id pelo seller UUID do seu sistema
async function getSellerMlAuth(sellerUuid: string) {
  // Ajuste nomes de tabela/colunas conforme seu banco.
  // Você comentou que a “fonte da verdade” é ml_tokens.
  const { data, error } = await supabase
    .from("ml_tokens")
    .select("access_token, ml_user_id")
    .eq("seller_id", sellerUuid)
    .single();

  if (error || !data?.access_token) {
    throw new Error("Seller sem token válido no banco (ml_tokens).");
  }
  if (!data?.ml_user_id) {
    throw new Error("Seller sem ml_user_id no banco (ml_tokens).");
  }

  return {
    accessToken: data.access_token as string,
    mlUserId: String(data.ml_user_id),
  };
}

// ✅ Formata datas simples no padrão que sua UI já usa
function formatDateBR(iso?: string) {
  if (!iso) return "-";
  const d = new Date(iso);
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

function formatDateTimeBR(iso?: string) {
  if (!iso) return "-";
  const d = new Date(iso);
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  const hh = String(d.getHours()).padStart(2, "0");
  const mi = String(d.getMinutes()).padStart(2, "0");
  return `${dd}/${mm}/${yyyy} às ${hh}:${mi}`;
}

// ✅ “idade” simples (ex: “5 dias atrás”)
function ageLabelFrom(iso?: string) {
  if (!iso) return "-";
  const ms = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(ms / 60000);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days >= 1) return `${days} dia${days > 1 ? "s" : ""} atrás`;
  if (hours >= 1) return `${hours} hora${hours > 1 ? "s" : ""} atrás`;
  return `${Math.max(1, minutes)} min atrás`;
}

// ✅ mapeia tipo/status do ML para suas abas
function mapToTab(claim: MlClaimDetail) {
  const t = (claim.type || "").toLowerCase();

  // você pode refinar depois:
  if (t.includes("cancel")) return "cancelamentos";
  if (t.includes("medi")) return "mediacoes";
  // “ml_case” geralmente é atraso / envio demorado / cancelamento por demora
  if (t.includes("ml_case")) return "atrasos";

  // default
  return "reclamacoes";
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const sellerUuid = searchParams.get("seller_id");

    if (!sellerUuid) {
      return NextResponse.json({ ok: false, error: "missing seller_id" }, { status: 400 });
    }

    const { accessToken, mlUserId } = await getSellerMlAuth(sellerUuid);

    // ✅ ENDPOINT MAIS COMUM PARA “reclamações / pós-venda”
    // Se esse falhar, a gente testa o fallback abaixo.
    let search: MlClaimsSearchResponse;
    try {
      search = await mlFetch<MlClaimsSearchResponse>(
        `/post-sale/claims/search?seller_id=${encodeURIComponent(mlUserId)}`,
        { accessToken }
      );
    } catch (e) {
      // ✅ Fallback (algumas contas/ambientes usam variação antiga)
      search = await mlFetch<MlClaimsSearchResponse>(
        `/claims/search?seller_id=${encodeURIComponent(mlUserId)}`,
        { accessToken }
      );
    }

    const ids = (search?.results ?? []).slice(0, 50); // limita por enquanto

    // Puxa detalhe de cada claim (se seu ML permitir)
    const details: MlClaimDetail[] = [];
    for (const id of ids) {
      try {
        const d = await mlFetch<MlClaimDetail>(`/post-sale/claims/${id}`, { accessToken });
        details.push(d);
      } catch {
        // fallback (variação antiga)
        const d = await mlFetch<MlClaimDetail>(`/claims/${id}`, { accessToken });
        details.push(d);
      }
    }

    // ✅ Normaliza para o formato da sua UI
    const items = details.map((c) => {
      const tab = mapToTab(c);

      return {
        id: String(c.id),
        type: tab,
        title: c.reason || "Reclamação",
        reason: c.reason || "Sem descrição",
        createdAt: formatDateBR(c.date_created),
        updatedAt: formatDateTimeBR(c.last_updated),
        ageLabel: ageLabelFrom(c.last_updated || c.date_created),
        buyerName: "Comprador", // dá pra puxar depois via campo buyers/summary
        statusPill: c.status || "-",
        chip: `#${c.id}`,
      };
    });

    // counts
    const counts = {
      reclamacoes: items.filter((x: any) => x.type === "reclamacoes").length,
      atrasos: items.filter((x: any) => x.type === "atrasos").length,
      cancelamentos: items.filter((x: any) => x.type === "cancelamentos").length,
      mediacoes: items.filter((x: any) => x.type === "mediacoes").length,
    };

    return NextResponse.json({ ok: true, counts, items });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: err?.message ?? String(err) },
      { status: 500 }
    );
  }
}