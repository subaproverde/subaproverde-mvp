// lib/getActiveSeller.ts

export async function getActiveSeller(userId: string) {
  let sid: string | null = null;

  try {
    sid = localStorage.getItem("activeSellerId");
  } catch {}

  if (sid) return sid;

  const r = await fetch(`/api/me/seller?userId=${userId}`, {
    cache: "no-store",
  });

  const j = await r.json().catch(() => ({}));

  if (!r.ok || !j?.sellerId) return null;

  sid = j.sellerId;

  try {
    localStorage.setItem("activeSellerId", sid);
  } catch {}

  return sid;
}