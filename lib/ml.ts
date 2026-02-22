type MLFetchOptions = {
  accessToken: string;
  signal?: AbortSignal;
};

export async function mlFetch<T>(url: string, { accessToken, signal }: MLFetchOptions): Promise<T> {
  const res = await fetch(url, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    signal,
    // evita cache em dev e garante “sempre atual”
    cache: "no-store",
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`ML error ${res.status}: ${text}`);
  }

  return res.json() as Promise<T>;
}