export const ADMIN_EMAILS = ["brunoflimaa@gmail.com"] as const;

export function isAdminEmail(email?: string | null) {
  const normalized = String(email ?? "").trim().toLowerCase();
  return ADMIN_EMAILS.includes(normalized as (typeof ADMIN_EMAILS)[number]);
}

// O login já usa o papel persistido no perfil para distinguir a operação
// administrativa da conta seller. Centralizar essa normalização evita que um
// mesmo usuário seja aceito no login e rejeitado ao abrir uma rota do CRM.
export function isAdminProfileRole(role?: string | null) {
  return String(role ?? "").trim().toLowerCase() === "admin";
}
