"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabaseBrowser } from "@/lib/supabaseClient";

function readHashParams() {
  if (typeof window === "undefined") return new URLSearchParams();
  const hash = window.location.hash.startsWith("#")
    ? window.location.hash.slice(1)
    : window.location.hash;
  return new URLSearchParams(hash);
}

export default function ResetPasswordPage() {
  const [loading, setLoading] = useState(true);
  const [hasRecovery, setHasRecovery] = useState(false);

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string>("");
  const [success, setSuccess] = useState<string>("");

  const passwordMismatch = useMemo(() => {
    return confirmPassword.length > 0 && password !== confirmPassword;
  }, [password, confirmPassword]);

  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        setLoading(true);
        setError("");
        setSuccess("");

        const hashParams = readHashParams();
        const type = hashParams.get("type");
        const accessToken = hashParams.get("access_token");
        const refreshToken = hashParams.get("refresh_token");

        if (type !== "recovery" || !accessToken || !refreshToken) {
          if (!alive) return;
          setHasRecovery(false);
          setError("Link de recuperação inválido ou expirado.");
          return;
        }

        const { error: sessionError } = await supabaseBrowser.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });

        if (!alive) return;

        if (sessionError) {
          setHasRecovery(false);
          setError("Não foi possível validar o link de recuperação. Peça um novo email.");
          return;
        }

        setHasRecovery(true);

        try {
          const cleanUrl = `${window.location.origin}${window.location.pathname}`;
          window.history.replaceState({}, document.title, cleanUrl);
        } catch {}
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (!hasRecovery) {
      setError("Link de recuperação inválido.");
      return;
    }

    if (!password || password.length < 6) {
      setError("A nova senha precisa ter pelo menos 6 caracteres.");
      return;
    }

    if (password !== confirmPassword) {
      setError("As senhas não coincidem.");
      return;
    }

    try {
      setSubmitting(true);

      const { error: updateError } = await supabaseBrowser.auth.updateUser({
        password,
      });

      if (updateError) {
        setError(updateError.message || "Não foi possível atualizar a senha.");
        return;
      }

      setSuccess("Senha alterada com sucesso. Agora você já pode entrar com a nova senha.");
      setPassword("");
      setConfirmPassword("");
    } catch (err: any) {
      setError(err?.message ?? "Erro inesperado ao alterar a senha.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#0a0f15] text-white flex items-center justify-center px-4">
      <div className="w-full max-w-md rounded-3xl border border-white/10 bg-white/5 backdrop-blur-xl shadow-[0_20px_80px_rgba(0,0,0,0.35)] p-6">
        <div className="mb-5">
          <h1 className="text-2xl font-extrabold">Redefinir senha</h1>
          <p className="mt-2 text-sm text-white/60">
            Digite sua nova senha para concluir a recuperação de acesso.
          </p>
        </div>

        {loading ? (
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-white/70">
            Validando link de recuperação...
          </div>
        ) : (
          <>
            {error ? (
              <div className="mb-4 rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
                {error}
              </div>
            ) : null}

            {success ? (
              <div className="mb-4 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
                {success}
              </div>
            ) : null}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-white/80">
                  Nova senha
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Digite a nova senha"
                  className="h-11 w-full rounded-xl border border-white/10 bg-black/40 px-4 text-white placeholder:text-white/35 outline-none focus:border-white/20"
                  disabled={!hasRecovery || submitting}
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-white/80">
                  Confirmar nova senha
                </label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Repita a nova senha"
                  className="h-11 w-full rounded-xl border border-white/10 bg-black/40 px-4 text-white placeholder:text-white/35 outline-none focus:border-white/20"
                  disabled={!hasRecovery || submitting}
                />
                {passwordMismatch ? (
                  <p className="mt-2 text-xs text-rose-300">As senhas não coincidem.</p>
                ) : null}
              </div>

              <button
                type="submit"
                disabled={!hasRecovery || submitting || passwordMismatch}
                className="inline-flex h-11 w-full items-center justify-center rounded-xl border border-emerald-400/20 bg-gradient-to-b from-emerald-400/20 to-emerald-900/20 px-4 py-2 text-sm font-semibold text-white/90 hover:from-emerald-400/25 hover:to-emerald-900/25 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {submitting ? "Salvando..." : "Salvar nova senha"}
              </button>
            </form>

            <div className="mt-5 text-center">
              <Link
                href="/login"
                className="text-sm text-emerald-200/90 hover:text-emerald-200"
              >
                Voltar para o login
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
}