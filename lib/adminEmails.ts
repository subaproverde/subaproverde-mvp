export const ADMIN_EMAILS = ["brunoflimaa@gmail.com"] as const;

export function isAdminEmail(email?: string | null) {
  const normalized = String(email ?? "").trim().toLowerCase();
  return ADMIN_EMAILS.includes(normalized as (typeof ADMIN_EMAILS)[number]);
}
