import LogoutButton from "@/app/components/LogoutButton";

export default function SellerHome() {
  return (
    <div style={{ padding: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between" }}>
        <h1 style={{ fontSize: 22, fontWeight: 700 }}>Painel do Seller</h1>
        <LogoutButton />
      </div>

      <p>Seller: vê apenas seus dados.</p>
    </div>
  );
}
