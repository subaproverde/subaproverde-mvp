import "react-native-url-polyfill/auto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import * as SecureStore from "expo-secure-store";

export const API = "https://www.subaproverde.com";
export class RadarAuthError extends Error {}
let clientPromise: Promise<SupabaseClient> | undefined;

export function getClient() {
  if (!clientPromise) {
    clientPromise = (async () => {
      const response = await fetch(`${API}/api/mobile/config`, { signal: AbortSignal.timeout(15000) });
      if (!response.ok) throw new Error("Não foi possível conectar ao CRM. Tente novamente.");
      const { url, anonKey } = await response.json();
      if (typeof url !== "string" || !url.startsWith("https://") || typeof anonKey !== "string") throw new Error("Configuração do CRM inválida.");
      return createClient(url, anonKey, {
        auth: {
          storage: {
            getItem: (key) => SecureStore.getItemAsync(key),
            setItem: (key, value) => SecureStore.setItemAsync(key, value, { keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY }),
            removeItem: (key) => SecureStore.deleteItemAsync(key),
          },
          persistSession: true, autoRefreshToken: true, detectSessionInUrl: false,
        },
      });
    })().catch((error) => { clientPromise = undefined; throw error; });
  }
  return clientPromise;
}

export type RadarTask = { id: string; title: string; contactName: string; dueAt: string; priority: string; overdue: boolean; deepLink: string };
export type RadarSummary = {
  ok: true; generatedAt: string; timezone: string;
  metrics: { today: number; overdue: number; waitingTeam: number; activeLeads: number };
  tasks: RadarTask[];
  links: { crm: string; agenda: string; conversations: string; finance: string };
};

export async function fetchRadar(): Promise<RadarSummary> {
  const client = await getClient();
  const { data, error } = await client.auth.getSession();
  if (error || !data.session) throw new RadarAuthError("Entre com sua conta para atualizar.");
  const response = await fetch(`${API}/api/mobile/widget`, {
    headers: { Authorization: `Bearer ${data.session.access_token}` }, signal: AbortSignal.timeout(20000),
  });
  const result = await response.json();
  if (response.status === 401 || response.status === 403) throw new RadarAuthError(result.error || "Acesso administrativo necessário.");
  if (!response.ok || !result.ok) throw new Error(result.error || "Falha ao atualizar o Radar.");
  return result;
}
