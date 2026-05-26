"use client";

import type { AdminAppointment, AdminClient, AdminRemoval } from "@/app/admin/admin-data";
import { supabaseBrowser } from "@/lib/supabaseClient";

export type AdminOperationsState = {
  clients: AdminClient[];
  removals: AdminRemoval[];
  appointments: AdminAppointment[];
};

type ApiSuccess<T> = { ok: true } & T;
type ApiFailure = {
  ok: false;
  error?: string;
  setupRequired?: boolean;
};

async function getAccessToken() {
  const { data } = await supabaseBrowser.auth.getSession();
  return data.session?.access_token ?? "";
}

async function adminRequest<T>(init: RequestInit) {
  const token = await getAccessToken();

  if (!token) {
    throw new Error("Sessão expirada. Faça login novamente.");
  }

  const response = await fetch("/api/admin/operations", {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...(init.headers ?? {}),
    },
    cache: "no-store",
  });

  const json = (await response.json().catch(() => ({}))) as ApiSuccess<T> | ApiFailure;

  if (!response.ok || json.ok !== true) {
    const failure = json as ApiFailure;
    const setupHint = failure.setupRequired
      ? " As tabelas admin ainda não existem no Supabase."
      : "";
    throw new Error(`${failure.error ?? "Falha ao falar com Supabase."}${setupHint}`);
  }

  return json;
}

export async function loadAdminOperations() {
  const json = await adminRequest<AdminOperationsState>({ method: "GET" });

  return {
    clients: json.clients,
    removals: json.removals,
    appointments: json.appointments,
  };
}

export async function saveAdminClient(row: AdminClient) {
  const json = await adminRequest<{ row: AdminClient }>({
    method: "POST",
    body: JSON.stringify({ entity: "client", row }),
  });

  return json.row;
}

export async function syncAdminOperations(state: AdminOperationsState) {
  const json = await adminRequest<AdminOperationsState>({
    method: "POST",
    body: JSON.stringify({ entity: "state", row: state }),
  });

  return {
    clients: json.clients,
    removals: json.removals,
    appointments: json.appointments,
  };
}

export async function saveAdminRemoval(row: AdminRemoval) {
  const json = await adminRequest<{ row: AdminRemoval }>({
    method: "POST",
    body: JSON.stringify({ entity: "removal", row }),
  });

  return json.row;
}

export async function deleteAdminRemoval(id: string) {
  await adminRequest<Record<string, never>>({
    method: "DELETE",
    body: JSON.stringify({ entity: "removal", id }),
  });
}

export async function saveAdminAppointment(row: AdminAppointment) {
  const json = await adminRequest<{ row: AdminAppointment }>({
    method: "POST",
    body: JSON.stringify({ entity: "appointment", row }),
  });

  return json.row;
}

export async function deleteAdminAppointment(id: string) {
  await adminRequest<Record<string, never>>({
    method: "DELETE",
    body: JSON.stringify({ entity: "appointment", id }),
  });
}
