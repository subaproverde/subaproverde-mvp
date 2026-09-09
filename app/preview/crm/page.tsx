import type { Metadata } from "next";
import DesignPreview from "./DesignPreview";

export const metadata: Metadata = {
  title: "Novo visual · Suba Pro Verde",
  robots: { index: false, follow: false },
};

export default function Page() { return <DesignPreview />; }
