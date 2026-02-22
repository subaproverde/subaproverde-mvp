"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { supabase } from "@/lib/supabase";

export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    setLoading(true);

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error || !data?.user?.id) {
      setLoading(false);
      return setMsg(error?.message ?? "Falha ao autenticar.");
    }

    const userId = data.user.id;

    // 🔐 busca role do usuário
    const { data: profile, error: roleError } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", userId)
      .maybeSingle();

    setLoading(false);

    if (roleError || !profile?.role) {
      return setMsg("Falha ao identificar perfil do usuário.");
    }

    // 🚀 REDIRECT INTELIGENTE
    if (profile.role === "admin") {
      router.replace("/dashboard");
    } else {
      router.replace("/app");
    }
  }

  return (
    <div className="fixed inset-0 bg-[#0a0f15] flex items-center justify-center px-4">
      <div className="w-full max-w-md bg-[#0f1620] border border-white/10 rounded-2xl p-8 shadow-xl">
        {/* LOGO */}
        <div className="flex justify-center mb-8">
          <Image
            src="/brand/suba-logo.png"
            alt="Suba Pro Verde"
            width={220}
            height={60}
            priority
          />
        </div>

        <h1 className="text-2xl font-semibold text-white text-center mb-6">
          Entrar na plataforma
        </h1>

        <form onSubmit={handleLogin} className="space-y-4">
          <input
            placeholder="E-mail"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-xl bg-[#0a0f15] border border-white/10 px-4 py-3 text-white placeholder:text-white/40 outline-none focus:border-white/30"
          />

          <input
            placeholder="Senha"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-xl bg-[#0a0f15] border border-white/10 px-4 py-3 text-white placeholder:text-white/40 outline-none focus:border-white/30"
          />

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-white text-black font-semibold py-3 rounded-xl hover:opacity-90 transition disabled:opacity-60"
          >
            {loading ? "Entrando..." : "Entrar"}
          </button>
        </form>

        {msg && <div className="mt-4 text-sm text-red-400 text-center">{msg}</div>}

        <div className="text-center text-xs text-white/40 mt-6">
          Suba Pro Verde © {new Date().getFullYear()}
        </div>
      </div>
    </div>
  );
}
