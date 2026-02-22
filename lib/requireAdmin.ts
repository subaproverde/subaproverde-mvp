// lib/requireAdmin.ts
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

export async function requireAdmin() {
  const cookieStore = await cookies();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll() {
          // Route Handlers não precisam setar cookie aqui para leitura
        },
      },
    }
  );

  const { data: userData, error: userErr } = await supabase.auth.getUser();
  if (userErr || !userData?.user) {
    return { ok: false as const, status: 401, error: "Não autenticado" };
  }

  const { data: isAdmin, error: adminErr } = await supabase.rpc("is_admin");
  if (adminErr) {
    return { ok: false as const, status: 500, error: `Falha is_admin: ${adminErr.message}` };
  }

  if (!isAdmin) {
    return { ok: false as const, status: 403, error: "Acesso restrito (admin)" };
  }

  return { ok: true as const, userId: userData.user.id };
}
