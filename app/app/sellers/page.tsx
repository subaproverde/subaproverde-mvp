"use client";

import { useEffect, useState } from "react";
import { supabaseBrowser } from "@/lib/supabaseClient";
import type { User } from "@supabase/supabase-js";

export default function SellersConnectPage() {
  const [loading, setLoading] = useState(true);
  const [logged, setLogged] = useState(false);
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabaseBrowser.auth.getUser();
      const u = data?.user ?? null;
      setUser(u);
      setLogged(!!u);
      setLoading(false);
    })();
  }, []);

  function startOAuth() {
    // ✅ inicia OAuth SEM sellerId (seller será criado no callback)
    if (!user?.id) return;
    window.location.href = `/api/ml/connect?userId=${encodeURIComponent(user.id)}`;
  }

  if (loading) {
    return <div className="text-white/60 p-6">Carregando…</div>;
  }

  if (!logged) {
    return (
      <div className="p-6">
        <div className="text-white/80 font-semibold text-xl">Selecione sua conta Mercado Livre</div>
        <div className="text-white/60 mt-2">Você precisa estar logado para conectar o Mercado Livre.</div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <h1 className="text-3xl font-semibold text-white">Selecione sua conta Mercado Livre</h1>
      <p className="text-white/60 mt-2">
        Se você ainda não conectou o Mercado Livre, clique em <b>Conectar Mercado Livre</b>.
      </p>

      <div className="mt-6 flex gap-3">
        <button
          onClick={startOAuth}
          className="rounded-xl px-4 py-2 border border-white/10 bg-white/5 text-white/90 hover:bg-white/10"
        >
          Conectar Mercado Livre
        </button>
      </div>
    </div>
  );
}
