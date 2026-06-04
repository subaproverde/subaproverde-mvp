"use client";

import { supabaseBrowser } from "@/lib/supabaseClient";

export async function getAccessToken() {
  const { data } = await supabaseBrowser.auth.getSession();
  return data.session?.access_token ?? "";
}

export async function authHeaders(headers?: HeadersInit) {
  const nextHeaders = new Headers(headers);
  const token = await getAccessToken();

  if (token && !nextHeaders.has("Authorization")) {
    nextHeaders.set("Authorization", `Bearer ${token}`);
  }

  return nextHeaders;
}

export async function authFetch(input: RequestInfo | URL, init: RequestInit = {}) {
  const headers = await authHeaders(init.headers);
  return fetch(input, { ...init, headers });
}
