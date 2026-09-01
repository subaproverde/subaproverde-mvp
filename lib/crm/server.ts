import { supabaseApiAdmin } from "@/lib/apiAuth";

export const CRM_WORKSPACE_SLUG = "suba-pro-verde";

export async function getCrmWorkspace() {
  const { data, error } = await supabaseApiAdmin
    .from("crm_workspaces")
    .select("id,name,slug,timezone,currency")
    .eq("slug", CRM_WORKSPACE_SLUG)
    .maybeSingle();

  if (error || !data) return { workspace: null, error };
  return { workspace: data, error: null };
}

export function cleanText(value: unknown, max = 500) {
  return String(value ?? "").trim().slice(0, max);
}
