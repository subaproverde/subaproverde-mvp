"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { supabase } from "@/lib/supabase";
import { authFetch } from "@/lib/authFetch";

export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);

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

    const { data: profile, error: roleError } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", userId)
      .maybeSingle();

    if (roleError || !profile?.role) {
      setLoading(false);
      return setMsg("Falha ao identificar perfil do usuário.");
    }

    if (profile.role !== "admin") {
      const metadata = data.user.user_metadata ?? {};
      // A criação ou reparação do seller é complementar ao login. Uma falha
      // temporária nessa etapa não pode encerrar uma sessão já autenticada.
      // O app continuará tentando obter o seller ativo após o redirecionamento.
      try {
        const ensureResponse = await authFetch("/api/seller_accounts/ensure", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            userId,
            fullName: String(metadata.full_name ?? ""),
            storeName: String(metadata.store_name ?? ""),
            couponCode: String(metadata.coupon_code ?? ""),
          }),
        });

        if (!ensureResponse.ok) {
          console.warn("Não foi possível preparar o seller durante o login.", ensureResponse.status);
        }
      } catch (error) {
        console.warn("Erro ao preparar o seller durante o login.", error);
      }
    }

    setLoading(false);

    if (profile.role === "admin") {
      const next = new URLSearchParams(window.location.search).get("next") || "";
      // Only allow internal CRM routes; never accept an arbitrary redirect URL.
      const valid = /^\/admin\/crm(?:\/|\?|$)/.test(next) && !/[\\\r\n]/.test(next);
      router.replace(valid ? next : "/app");
    } else {
      router.replace("/app");
    }
  }

  async function handleForgotPassword() {
    setMsg(null);

    if (!email.trim()) {
      setMsg("Digite seu e-mail para receber o link de redefinição.");
      return;
    }

    try {
      setResetLoading(true);

      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: "https://www.subaproverde.com/reset-password",
      });

      if (error) {
        setMsg(error.message ?? "Não foi possível enviar o email de redefinição.");
        return;
      }

      setMsg("Enviamos um link de redefinição de senha para o seu e-mail.");
    } catch (err: any) {
      setMsg(err?.message ?? "Erro ao solicitar redefinição de senha.");
    } finally {
      setResetLoading(false);
    }
  }

  return (
    <div className="w-full flex items-center justify-center">
      <div className="w-full max-w-md bg-spv-surface border border-spv-line rounded-xl p-6 sm:p-9">
        <div className="flex justify-center mb-8">
          <Image
            src="/brand/suba-logo.png"
            alt="Suba Pro Verde"
            width={220}
            height={60}
            priority
            className="spv-brand-image"
          />
        </div>

        <h1 className="text-2xl font-semibold text-spv-ink text-center mb-6">
          Entrar na plataforma
        </h1>

        <form onSubmit={handleLogin} className="space-y-4">
          <label htmlFor="login-email" className="block text-sm text-spv-muted">E-mail</label>
          <input
            id="login-email"
            type="email"
            autoComplete="username"
            required
            placeholder="E-mail"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-xl bg-spv-page border border-spv-line px-4 py-3 text-spv-ink placeholder:text-spv-muted outline-none focus:border-spv-line"
          />

          <label htmlFor="login-password" className="block text-sm text-spv-muted">Senha</label>
          <input
            id="login-password"
            autoComplete="current-password"
            required
            placeholder="Senha"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-xl bg-spv-page border border-spv-line px-4 py-3 text-spv-ink placeholder:text-spv-muted outline-none focus:border-spv-line"
          />

          <div className="flex justify-end">
            <button
              type="button"
              onClick={handleForgotPassword}
              disabled={resetLoading}
              className="text-sm text-spv-accent-text hover:text-spv-accent-text transition disabled:opacity-60"
            >
              {resetLoading ? "Enviando..." : "Esqueci minha senha"}
            </button>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-spv-accent text-spv-on-accent font-semibold py-3 rounded-lg hover:opacity-90 transition disabled:opacity-60"
          >
            {loading ? "Entrando..." : "Entrar"}
          </button>
        </form>

        {msg && (
          <div role="status" className="mt-4 text-sm text-center text-spv-ink">
            {msg}
          </div>
        )}

        <div className="text-center text-xs text-spv-muted mt-6">
          Suba Pro Verde © {new Date().getFullYear()}
        </div>
      </div>
    </div>
  );
}
