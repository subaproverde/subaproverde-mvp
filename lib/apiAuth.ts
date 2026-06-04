import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import type { User } from "@supabase/supabase-js";
import { isAdminEmail } from "@/lib/adminEmails";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export type ApiAuthOk = {
  ok: true;
  token: string;
  user: User;
  isAdmin: boolean;
};

export type ApiAuthFailure = {
  ok: false;
  status: number;
  error: string;
};

export type ApiAuthResult = ApiAuthOk | ApiAuthFailure;

export const supabaseApiAdmin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false },
});

export function getBearerToken(req: Request) {
  const auth = req.headers.get("authorization") ?? "";
  const match = auth.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() ?? "";
}

export function authErrorResponse(result: ApiAuthResult) {
  const failure =
    result.ok === true
      ? { status: 403, error: "Acesso negado." }
      : { status: result.status, error: result.error };

  return NextResponse.json(
    { ok: false, error: failure.error },
    { status: failure.status, headers: { "Cache-Control": "no-store" } }
  );
}

export function hasInternalSecret(req: Request, ...envNames: string[]) {
  const auth = req.headers.get("authorization") ?? "";
  const secretParam = new URL(req.url).searchParams.get("secret") ?? "";

  return envNames.some((name) => {
    const expected = process.env[name]?.trim();
    return Boolean(expected && (auth === `Bearer ${expected}` || secretParam === expected));
  });
}

function userClient(token: string) {
  return createClient(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
}

async function isAdminByRpc(token: string) {
  try {
    const { data, error } = await userClient(token).rpc("is_admin");
    if (error) return false;
    return Boolean(data);
  } catch {
    return false;
  }
}

export async function requireRequestUser(req: Request): Promise<ApiAuthResult> {
  const token = getBearerToken(req);

  if (!token) {
    return { ok: false, status: 401, error: "Nao autenticado." };
  }

  const { data, error } = await supabaseApiAdmin.auth.getUser(token);
  const user = data?.user ?? null;

  if (error || !user) {
    return { ok: false, status: 401, error: "Sessao invalida." };
  }

  const isAdmin = isAdminEmail(user.email) || (await isAdminByRpc(token));
  return { ok: true, token, user, isAdmin };
}

export async function requireAdminRequest(req: Request): Promise<ApiAuthResult> {
  const auth = await requireRequestUser(req);

  if (!auth.ok) return auth;

  if (!auth.isAdmin) {
    return { ok: false, status: 403, error: "Acesso restrito ao administrador." };
  }

  return auth;
}

export async function requireSellerAccess(req: Request, sellerId: string): Promise<ApiAuthResult> {
  const auth = await requireRequestUser(req);

  if (!auth.ok) return auth;
  if (auth.isAdmin) return auth;

  const normalizedSellerId = String(sellerId ?? "").trim();
  if (!normalizedSellerId) {
    return { ok: false, status: 400, error: "sellerId obrigatorio." };
  }

  const { data: ownerRow, error: ownerError } = await supabaseApiAdmin
    .from("seller_accounts")
    .select("seller_id")
    .eq("owner_user_id", auth.user.id)
    .eq("seller_id", normalizedSellerId)
    .maybeSingle();

  if (ownerError) {
    return { ok: false, status: 500, error: "Falha ao validar acesso ao seller." };
  }

  if (ownerRow?.seller_id) return auth;

  const { data: memberRow, error: memberError } = await supabaseApiAdmin
    .from("seller_users")
    .select("seller_id")
    .eq("user_id", auth.user.id)
    .eq("seller_id", normalizedSellerId)
    .maybeSingle();

  if (memberError && memberError.code !== "42P01" && memberError.code !== "PGRST205") {
    return { ok: false, status: 500, error: "Falha ao validar usuario do seller." };
  }

  if (memberRow?.seller_id) return auth;

  return { ok: false, status: 403, error: "Sem permissao para este seller." };
}
