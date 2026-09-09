import Link from "next/link";
export default function NotFound() {
  return <main className="flex min-h-dvh items-center justify-center bg-spv-page p-6 text-spv-ink"><section className="w-full max-w-lg rounded-xl border border-spv-line bg-spv-surface p-8"><p className="text-sm text-spv-accent-text">RADAR SPV · 404</p><h1 className="mt-4 text-3xl font-semibold">Página não encontrada</h1><p className="mt-3 text-spv-muted">Este endereço pode ter mudado. Volte ao seu espaço para continuar.</p><div className="mt-6 flex flex-wrap gap-3"><Link className="rounded-lg bg-spv-accent px-5 py-3 font-semibold text-spv-on-accent" href="/app">Ir para meu espaço</Link><Link className="rounded-lg border border-spv-line px-5 py-3" href="/">Página inicial</Link></div></section></main>;
}
