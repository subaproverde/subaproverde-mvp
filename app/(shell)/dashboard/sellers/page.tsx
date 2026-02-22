import AdminSellersClient from "./AdminSellersClient";

export const dynamic = "force-dynamic";

export default function DashboardSellersPage() {
  return (
    // ✅ “canvas” escuro só na área da página (não encosta no header do layout)
    <div className="w-full">
      
        {/* faixa de topo escura para “colar” visualmente com o header */}
      

        <div className="mx-auto max-w-6xl px-6 pb-14">
          {/* ✅ Aqui fica o componente com os cards */}
          <AdminSellersClient />
        </div>
      </div>
    
  );
}
