import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import type { User } from "@supabase/supabase-js";
import { isAdminEmail } from "@/lib/adminEmails";

export function isAdmin(email?: string | null) {
  return isAdminEmail(email);
}

export type AdminAccess =
  | { ok: true; user: User }
  | { ok: false; reason: "unauthenticated" | "not_admin" };

export async function getAdminAccess(): Promise<AdminAccess> {
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
          // The admin gate only needs to read the current session.
        },
      },
    }
  );

  const { data, error } = await supabase.auth.getUser();

  if (error || !data?.user) {
    return { ok: false, reason: "unauthenticated" };
  }

  if (!isAdmin(data.user.email)) {
    return { ok: false, reason: "not_admin" };
  }

  return { ok: true, user: data.user };
}
