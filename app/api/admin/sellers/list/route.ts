import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { isAdminEmail } from "@/lib/adminEmails";
import { getValidMlAccessToken } from "@/lib/mlToken";

export const dynamic = "force-dynamic";

type SellerRow = {
  id: string;
  name: string | null;
  company_name: string | null;
  status: string | null;
  created_at: string | null;
  ml_user_id?: string | number | null;
};

type SellerAccountRow = {
  id: string;
  owner_user_id: string | null;
  seller_id: string | null;
  ml_user_id: string | number | null;
  nickname: string | null;
  created_at: string | null;
};

type MlTokenRow = {
  seller_id: string;
  refresh_token: string | null;
  expires_at: string | null;
  updated_at: string | null;
  created_at: string | null;
  ml_user_id?: string | number | null;
};

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

function supabaseWithBearer(token: string) {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: { persistSession: false },
      global: {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    }
  );
}

function parseAuthToken(req: Request) {
  const auth = req.headers.get("authorization") || "";
  return auth.replace(/^Bearer\s+/i, "").trim();
}

async function requireAdmin(req: Request) {
  const token = parseAuthToken(req);

  if (!token) {
    return { ok: false as const, status: 401, error: "Nao autenticado" };
  }

  const { data, error } = await supabaseAdmin.auth.getUser(token);
  const user = data?.user;

  if (error || !user) {
    return { ok: false as const, status: 401, error: "Sessao invalida" };
  }

  if (isAdminEmail(user.email)) {
    return { ok: true as const, userId: user.id };
  }

  const supabaseUser = supabaseWithBearer(token);
  const { data: isAdmin, error: adminErr } = await supabaseUser.rpc("is_admin");

  if (adminErr) {
    return { ok: false as const, status: 500, error: `Falha ao verificar admin: ${adminErr.message}` };
  }

  if (!isAdmin) {
    return { ok: false as const, status: 403, error: "Acesso negado" };
  }

  return { ok: true as const, userId: user.id };
}

function isExpired(expiresAt?: string | null) {
  if (!expiresAt) return false;
  const t = Date.parse(expiresAt);
  if (Number.isNaN(t)) return false;
  return t <= Date.now();
}

function isExpiringSoon(expiresAt?: string | null) {
  if (!expiresAt) return true;
  const t = Date.parse(expiresAt);
  if (Number.isNaN(t)) return true;
  return t - Date.now() <= 5 * 60 * 1000;
}

function secondsUntil(expiresAt?: string | null) {
  if (!expiresAt) return null;
  const t = Date.parse(expiresAt);
  if (Number.isNaN(t)) return null;
  return Math.round((t - Date.now()) / 1000);
}

function bestAccount(accounts: SellerAccountRow[], sellerId: string) {
  return accounts.find((acc) => acc.seller_id === sellerId) ?? null;
}

function displayName(seller: SellerRow, account: SellerAccountRow | null) {
  return (
    account?.nickname?.trim() ||
    seller.name?.trim() ||
    seller.company_name?.trim() ||
    "Seller sem nome"
  );
}

export async function GET(req: Request) {
  const admin = await requireAdmin(req);

  if (!admin.ok) {
    return NextResponse.json(
      { ok: false, error: admin.error },
      { status: admin.status, headers: { "Cache-Control": "no-store" } }
    );
  }

  try {
    const [sellersRes, accountsRes, tokensRes] = await Promise.all([
      supabaseAdmin
        .from("sellers")
        .select("id, name, company_name, status, created_at, ml_user_id")
        .order("created_at", { ascending: false }),
      supabaseAdmin
        .from("seller_accounts")
        .select("id, owner_user_id, seller_id, ml_user_id, nickname, created_at")
        .order("created_at", { ascending: false }),
      supabaseAdmin
        .from("ml_tokens")
        .select("seller_id, refresh_token, expires_at, updated_at, created_at, ml_user_id")
        .order("updated_at", { ascending: false }),
    ]);

    if (sellersRes.error) throw new Error(`sellers: ${sellersRes.error.message}`);
    if (accountsRes.error) throw new Error(`seller_accounts: ${accountsRes.error.message}`);
    if (tokensRes.error) throw new Error(`ml_tokens: ${tokensRes.error.message}`);

    const accounts = (accountsRes.data ?? []) as SellerAccountRow[];
    const tokens = (tokensRes.data ?? []) as MlTokenRow[];
    const tokenBySellerId = new Map<string, MlTokenRow>();

    for (const token of tokens) {
      if (token.seller_id && !tokenBySellerId.has(token.seller_id)) {
        tokenBySellerId.set(token.seller_id, token);
      }
    }

    const sellerMap = new Map<string, SellerRow>();
    for (const seller of (sellersRes.data ?? []) as SellerRow[]) {
      sellerMap.set(seller.id, seller);
    }

    for (const account of accounts) {
      if (account.seller_id && !sellerMap.has(account.seller_id)) {
        sellerMap.set(account.seller_id, {
          id: account.seller_id,
          name: account.nickname,
          company_name: null,
          status: "active",
          created_at: account.created_at,
          ml_user_id: account.ml_user_id,
        });
      }
    }

    const items = [];

    for (const seller of sellerMap.values()) {
      const account = bestAccount(accounts, seller.id);
      let token = tokenBySellerId.get(seller.id) ?? null;
      let refreshed = false;
      let refreshError: string | null = null;

      if (token && isExpiringSoon(token.expires_at) && token.refresh_token) {
        try {
          const valid = await getValidMlAccessToken(seller.id);
          refreshed = valid.refreshed;
          token = {
            ...token,
            expires_at: valid.expiresAt,
            updated_at: new Date().toISOString(),
          };
        } catch (e: any) {
          refreshError = e?.message ?? "Falha ao renovar token";
        }
      }

      const hasToken = !!token;
      const hasRefresh = !!token?.refresh_token;
      const expired = hasToken && isExpired(token?.expires_at);
      const expiring = hasToken && !expired && isExpiringSoon(token?.expires_at);

      const tokenStatus = !hasToken
        ? "not_connected"
        : refreshError || (expired && !hasRefresh)
        ? "needs_reconnect"
        : expiring
        ? "expiring"
        : "connected";

      items.push({
        id: seller.id,
        name: displayName(seller, account),
        sellerName: seller.name ?? null,
        companyName: seller.company_name ?? null,
        status: seller.status ?? null,
        sellerAccountId: account?.id ?? null,
        nickname: account?.nickname ?? null,
        ml_user_id: String(account?.ml_user_id ?? seller.ml_user_id ?? token?.ml_user_id ?? ""),
        created_at: seller.created_at ?? account?.created_at ?? null,
        token: {
          status: tokenStatus,
          hasToken,
          hasRefresh,
          refreshed,
          refreshError,
          expires_at: token?.expires_at ?? null,
          updated_at: token?.updated_at ?? null,
          secondsUntilExpiry: secondsUntil(token?.expires_at),
        },
      });
    }

    items.sort((a, b) => {
      const ad = Date.parse(a.created_at ?? "") || 0;
      const bd = Date.parse(b.created_at ?? "") || 0;
      return bd - ad;
    });

    const summary = {
      total: items.length,
      connected: items.filter((item) => item.token.status === "connected").length,
      expiring: items.filter((item) => item.token.status === "expiring").length,
      needsReconnect: items.filter((item) => item.token.status === "needs_reconnect").length,
      notConnected: items.filter((item) => item.token.status === "not_connected").length,
      refreshedNow: items.filter((item) => item.token.refreshed).length,
    };

    return NextResponse.json(
      { ok: true, summary, items },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message ?? "Erro ao listar sellers" },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}
