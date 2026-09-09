"use client";
import SellerHomeShell from "../app/SellerHomeShell";
export default function AdminShell({children,email}:{children:React.ReactNode;email:string}) { return <SellerHomeShell isAdmin mode="admin" email={email}>{children}</SellerHomeShell>; }
