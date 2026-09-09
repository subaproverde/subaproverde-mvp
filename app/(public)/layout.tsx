import Link from "next/link";

export default function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-spv-page flex flex-col">
      {/* HEADER */}
      <header className="bg-spv-sidebar border-b border-spv-line">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3">
            <img src="/brand/suba-logo.png" alt="Suba Pro Verde" className="h-12 spv-brand-image" />
            <div className="leading-tight hidden sm:block">
              <div className="font-semibold">Suba Pro Verde</div>
              <div className="text-xs text-spv-muted">
                Plataforma de Operação
              </div>
            </div>
          </Link>

          <div className="text-xs text-spv-muted">
            Acesso de clientes
          </div>
        </div>
      </header>

      {/* CONTEÚDO CENTRAL */}
      <main className="flex-1 flex items-center justify-center px-5 py-12">
        {children}
      </main>
    </div>
  );
}
