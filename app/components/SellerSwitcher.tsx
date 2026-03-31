"use client";

import { useEffect, useRef, useState } from "react";
import { supabaseBrowser } from "@/lib/supabaseClient";

type SellerItem = {
  sellerId: string;
  sellerAccountId: string;
  ml_user_id?: string | null;
  nickname?: string | null;
  created_at?: string | null;
};

export default function SellerSwitcher() {
  const [loading, setLoading] = useState(true);
  const [switching, setSwitching] = useState(false);
  const [open, setOpen] = useState(false);

  const [userId, setUserId] = useState<string>("");
  const [activeSellerId, setActiveSellerId] = useState<string>("");
  const [items, setItems] = useState<SellerItem[]>([]);

  const wrapRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        setLoading(true);

        const { data } = await supabaseBrowser.auth.getUser();
        const user = data?.user;

        if (!user?.id) {
          if (!alive) return;
          setUserId("");
          setItems([]);
          setActiveSellerId("");
          return;
        }

        setUserId(user.id);

        const [rList, rActive] = await Promise.all([
          fetch(`/api/me/sellers?userId=${encodeURIComponent(user.id)}`, {
            cache: "no-store",
          }),
          fetch(`/api/me/seller?userId=${encodeURIComponent(user.id)}`, {
            cache: "no-store",
          }),
        ]);

        const jList = await rList.json().catch(() => ({}));
        const jActive = await rActive.json().catch(() => ({}));

        if (!alive) return;

        const nextItems = Array.isArray(jList?.items) ? jList.items : [];
        const nextActive = jActive?.sellerId ? String(jActive.sellerId) : "";

        setItems(nextItems);
        setActiveSellerId(nextActive);

        try {
          if (nextActive) {
            localStorage.setItem("activeSellerId", nextActive);
          }
        } catch {}
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (!wrapRef.current) return;
      if (!wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }

    function handleEsc(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }

    document.addEventListener("mousedown", handleClickOutside);
    window.addEventListener("keydown", handleEsc);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      window.removeEventListener("keydown", handleEsc);
    };
  }, []);

  const activeSeller =
    items.find((x) => x.sellerId === activeSellerId) ?? items[0] ?? null;

  async function handleSelectSeller(sellerId: string) {
    if (!sellerId || !userId || sellerId === activeSellerId) {
      setOpen(false);
      return;
    }

    try {
      setSwitching(true);

      const {
        data: { session },
      } = await supabaseBrowser.auth.getSession();

      const accessToken = session?.access_token;

      if (!accessToken) {
        return;
      }

      const r = await fetch("/api/seller/set", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ sellerId }),
      });

      const j = await r.json().catch(() => ({}));

      if (!r.ok || j?.ok === false) {
        return;
      }

      try {
        localStorage.setItem("activeSellerId", sellerId);
      } catch {}

      setActiveSellerId(sellerId);
      setOpen(false);

      window.location.reload();
    } finally {
      setSwitching(false);
    }
  }

  if (loading) {
    return (
      <div className="inline-flex items-center rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/60">
        Carregando seller...
      </div>
    );
  }

  if (!items.length) {
    return (
      <div className="inline-flex items-center rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/60">
        Sem sellers
      </div>
    );
  }

  return (
    <div className="relative" ref={wrapRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        disabled={switching}
        className="inline-flex min-w-[220px] items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-left text-sm text-white/90 hover:bg-white/10 disabled:opacity-60"
      >
        <div className="min-w-0">
          <div className="text-[11px] text-white/50">Seller ativo</div>
          <div className="truncate font-semibold">
            {activeSeller?.nickname || activeSeller?.sellerId || "Selecionar"}
          </div>
        </div>

        <div className="shrink-0 text-white/50">{switching ? "..." : "▾"}</div>
      </button>

      {open && (
        <div className="absolute right-0 z-50 mt-2 w-[320px] overflow-hidden rounded-2xl border border-white/10 bg-[#0f1620] shadow-[0_20px_80px_rgba(0,0,0,0.45)]">
          <div className="border-b border-white/10 px-4 py-3">
            <div className="text-sm font-semibold text-white">Selecionar seller</div>
            <div className="text-xs text-white/50">
              Escolha qual operação deseja visualizar
            </div>
          </div>

          <div className="max-h-[320px] overflow-auto p-2">
            {items.map((item) => {
              const active = item.sellerId === activeSellerId;

              return (
                <button
                  key={`${item.sellerAccountId}-${item.sellerId}`}
                  type="button"
                  onClick={() => handleSelectSeller(item.sellerId)}
                  className={[
                    "mb-2 w-full rounded-xl border px-3 py-3 text-left transition",
                    active
                      ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-100"
                      : "border-white/10 bg-white/5 text-white/85 hover:bg-white/10",
                  ].join(" ")}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold">
                        {item.nickname || "Seller sem nickname"}
                      </div>
                      <div className="mt-1 truncate text-[11px] text-white/50">
                        sellerId: {item.sellerId}
                      </div>
                      {item.ml_user_id ? (
                        <div className="truncate text-[11px] text-white/40">
                          ml_user_id: {item.ml_user_id}
                        </div>
                      ) : null}
                    </div>

                    {active ? (
                      <span className="rounded-full border border-emerald-400/30 bg-emerald-400/10 px-2 py-1 text-[10px] font-semibold text-emerald-100">
                        ATIVO
                      </span>
                    ) : null}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}