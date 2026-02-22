import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

/**
 * Server-side client para ler sessão do usuário via cookies.
 * Usamos ANON KEY aqui (não service role), porque é pra identificar o usuário logado.
 */
export function supabaseServer() {
  const cookieStore = cookies();

  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      global: {
        headers: {
          Cookie: cookieStore.toString(),
        },
      },
    }
  );
}
