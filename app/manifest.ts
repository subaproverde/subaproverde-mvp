import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Radar SPV — Suba Pro Verde",
    short_name: "Radar SPV",
    description: "CRM, agenda e operação da Suba Pro Verde.",
    start_url: "/admin/crm",
    scope: "/",
    display: "standalone",
    background_color: "#07140f",
    theme_color: "#07140f",
    orientation: "portrait-primary",
    icons: [
      {
        src: "/mobile/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/mobile/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
