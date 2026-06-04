"use client";

import { useEffect, useState } from "react";
import { authFetch } from "@/lib/authFetch";

export default function MlConnectCard({ sellerId }: { sellerId: string }) {
  const [meLoading, setMeLoading] = useState(true);
  const [mlUser, setMlUser] = useState<any | null>(null);

  async function loadMe() {
    setMeLoading(true);

    try {
      // Se não tem sellerId, não tenta buscar ML
      if (!sellerId) {
        setMlUser(null);
        setMeLoading(false);
        return;
      }

      // tenta buscar /me do ML (se token existir)
      const r = await authFetch(`/api/ml/account/me?sellerId=${sellerId}`, { cache: "no-store" });
      const j = await r.json().catch(() => ({}));
      if (r.ok && j?.data) setMlUser(j.data);
      else setMlUser(null);
    } finally {
      setMeLoading(false);
    }
  }

  useEffect(() => {
    loadMe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sellerId]);

  const connected = !!mlUser;

  return (
    <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-white/90 font-semibold">Mercado Livre</div>
          <div className="text-white/60 text-sm">
            {meLoading ? "Verificando conexão..." : connected ? "Conectado ✓" : "Não conectado"}
          </div>
        </div>

        {connected ? (
          <span className="text-xs px-3 py-1 rounded-full border border-emerald-400/30 bg-emerald-400/10 text-emerald-100">
            Conectado ✓
          </span>
        ) : (
          <span className="text-xs px-3 py-1 rounded-full border border-yellow-400/30 bg-yellow-400/10 text-yellow-100">
            Pendente
          </span>
        )}
      </div>

      <div className="mt-4 grid gap-2">
        <button
          onClick={loadMe}
          className="w-full rounded-xl px-4 py-2 border border-white/10 bg-transparent text-white/70 hover:bg-white/5"
        >
          Recarregar status
        </button>
      </div>
    </div>
  );
}
