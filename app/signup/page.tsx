"use client";

import React, { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { supabaseBrowser } from "@/lib/supabaseClient";
import { authFetch } from "@/lib/authFetch";

export default function SignupPage() {
  const [sellerFullName, setSellerFullName] = useState("");
  const [storeName, setStoreName] = useState("");
  const [couponCode, setCouponCode] = useState("");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [loading, setLoading] = useState(false);

  function normCoupon(v: string) {
    return v.trim().toUpperCase();
  }

  async function onSignup() {
    setLoading(true);
    try {
      const { data, error } = await supabaseBrowser.auth.signUp({
        email,
        password,
      });

      if (error) {
        alert(error.message);
        return;
      }

      const userId = data?.user?.id;

      // cria seller_accounts (seu ensure já existe)
      if (userId) {
        const r = await authFetch("/api/seller_accounts/ensure", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ userId }),
        });

        const j = await r.json().catch(() => ({}));
        if (!r.ok || !j?.ok) {
          alert(`Conta criada, mas falhou ao criar seller no banco: ${j?.error ?? "erro"}`);
          return;
        }

        // aplica cupom/vínculo (não trava fluxo se falhar)
        const coupon = normCoupon(couponCode);
        if (coupon) {
          const rr = await authFetch("/api/referral/apply", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              sellerAccountId: j.sellerAccountId,
              couponCode: coupon,
              sellerFullName: sellerFullName.trim(),
              storeName: storeName.trim(),
            }),
          });

          const jj = await rr.json().catch(() => ({}));
          if (!rr.ok || !jj?.ok) {
            alert(`Cadastro criado, mas cupom não aplicado: ${jj?.error ?? "erro"}`);
          }
        }

        // ✅ vai pra tela de obrigado (sempre)
        const qs = new URLSearchParams({
          name: sellerFullName.trim(),
          store: storeName.trim(),
          coupon: normCoupon(couponCode),
        }).toString();

        window.location.href = `/signup/thanks?${qs}`;
        return;
      }

      // se userId não veio (confirm email ligado), ainda manda pro thanks (sem travar)
      const qs = new URLSearchParams({
        name: sellerFullName.trim(),
        store: storeName.trim(),
        coupon: normCoupon(couponCode),
      }).toString();

      window.location.href = `/signup/thanks?${qs}`;
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative min-h-[100vh] overflow-hidden bg-spv-page text-spv-ink">
      {/* BACKGROUND */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-48 -left-48 h-[520px] w-[520px] rounded-full bg-emerald-500/20 blur-3xl" />
        <div className="absolute -bottom-56 -right-56 h-[620px] w-[620px] rounded-full bg-lime-400/15 blur-3xl" />
        <div className="absolute inset-0 bg-gradient-to-b from-black/25 via-black/60 to-black/75" />
        <div
          className="absolute inset-0 opacity-[0.06]"
          style={{
            backgroundImage:
              "linear-gradient(to right, rgba(255,255,255,.25) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,.25) 1px, transparent 1px)",
            backgroundSize: "48px 48px",
          }}
        />
      </div>

      <div className="relative mx-auto flex min-h-[100vh] max-w-6xl items-center justify-center px-6 py-14">
        <div className="w-full max-w-xl">
          {/* LOGO */}
          <div className="mb-6 flex flex-col items-center">
            <div className="relative h-[44px] w-[200px]">
              <Image
                src="/brand/suba-logo.png"
                alt="Suba Pro Verde"
                fill
                sizes="200px"
                className="object-contain spv-brand-image"
                priority
              />
            </div>
            <div className="mt-3 rounded-full border border-emerald-400/20 bg-emerald-500/10 px-4 py-2 text-xs text-spv-ink">
              Cadastro do seller
            </div>
          </div>

          {/* CARD */}
          <div className="relative overflow-hidden rounded-xl border border-spv-line bg-spv-surface shadow-none backdrop-blur-none">
            <div className="absolute inset-0 bg-gradient-to-br from-white/10 via-transparent to-transparent" />
            <div className="relative p-7 sm:p-10">
              <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">Criar conta</h1>
              <p className="mt-2 text-sm sm:text-base text-spv-ink">
                Crie sua conta para acessar o Radar SPV. Se tiver cupom, você ganha <b>10% de desconto</b>.
              </p>

              <div className="mt-6 grid gap-4">
                {/* Nome completo */}
                <div className="space-y-2">
                  <div className="text-sm text-spv-ink">Nome completo</div>
                  <input
                    className="w-full rounded-xl border border-spv-line bg-spv-page px-4 py-3 text-sm text-spv-ink placeholder:text-spv-muted outline-none focus:border-emerald-400/30"
                    value={sellerFullName}
                    onChange={(e) => setSellerFullName(e.target.value)}
                    placeholder="Ex: Bruno Lima"
                  />
                </div>

                {/* Loja */}
                <div className="space-y-2">
                  <div className="text-sm text-spv-ink">Nome da loja</div>
                  <input
                    className="w-full rounded-xl border border-spv-line bg-spv-page px-4 py-3 text-sm text-spv-ink placeholder:text-spv-muted outline-none focus:border-emerald-400/30"
                    value={storeName}
                    onChange={(e) => setStoreName(e.target.value)}
                    placeholder="Ex: Brud’s Glass"
                  />
                </div>

                {/* Cupom */}
                <div className="space-y-2">
                  <div className="text-sm text-spv-ink">Cupom de desconto</div>
                  <input
                    className="w-full rounded-xl border border-spv-line bg-spv-page px-4 py-3 text-sm text-spv-ink placeholder:text-spv-muted outline-none focus:border-emerald-400/30"
                    value={couponCode}
                    onChange={(e) => setCouponCode(e.target.value)}
                    placeholder="Ex: INFLUENCER10"
                  />
                  <div className="text-xs text-spv-muted">
                    Se tiver cupom, você ganha 10% de desconto. (A comissão do influencer é calculada depois pelo admin.)
                  </div>
                </div>

                {/* Email */}
                <div className="space-y-2">
                  <div className="text-sm text-spv-ink">Email</div>
                  <input
                    className="w-full rounded-xl border border-spv-line bg-spv-page px-4 py-3 text-sm text-spv-ink placeholder:text-spv-muted outline-none focus:border-emerald-400/30"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="seuemail@empresa.com"
                  />
                </div>

                {/* Senha */}
                <div className="space-y-2">
                  <div className="text-sm text-spv-ink">Senha</div>
                  <input
                    type="password"
                    className="w-full rounded-xl border border-spv-line bg-spv-page px-4 py-3 text-sm text-spv-ink placeholder:text-spv-muted outline-none focus:border-emerald-400/30"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                  />
                </div>

                {/* CTA */}
                <button
                  className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-5 py-3 text-sm font-semibold text-spv-ink hover:bg-emerald-500 disabled:opacity-60 shadow-none"
                  onClick={onSignup}
                  disabled={loading}
                >
                  {loading ? "Criando..." : "Criar conta"}
                </button>

                <div className="text-sm text-spv-muted">
                  Já tem conta?{" "}
                  <Link className="text-spv-ink underline underline-offset-4" href="/login">
                    Entrar
                  </Link>
                </div>

                <div className="text-xs text-spv-muted">
                  Obs.: se a confirmação de e-mail estiver ativa no Supabase, você pode precisar confirmar o e-mail antes de logar.
                </div>
              </div>
            </div>
          </div>

          <div className="mt-6 text-center text-xs text-spv-muted">
            © {new Date().getFullYear()} Suba Pro Verde
          </div>
        </div>
      </div>
    </div>
  );
}
