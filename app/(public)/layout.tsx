import Link from "next/link";

export default function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-[#f6f7f9] flex flex-col">
      {/* HEADER */}
      <header className="bg-white border-b">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3">
            <img src="/brand/suba-logo.png" alt="Suba Pro Verde" className="h-8" />
            <div className="leading-tight">
              <div className="font-semibold">Suba Pro Verde</div>
              <div className="text-xs text-muted-foreground">
                Plataforma de Operação
              </div>
            </div>
          </Link>

          <div className="text-sm text-muted-foreground">
            Acesso de clientes
          </div>
        </div>
      </header>

      {/* CONTEÚDO CENTRAL */}
      <main className="flex-1 flex items-center justify-center px-6">
        {children}
      </main>
    </div>
  );
}
