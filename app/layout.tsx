import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import ThemeSync from "./components/ThemeSync";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Suba Pro Verde",
  description:
    "Plataforma de gestão de reputação, performance operacional e customer experience para sellers Mercado Livre.",
  openGraph: {
    title: "Suba Pro Verde",
    description:
      "Inteligência operacional para sellers Mercado Livre acompanharem reputação, riscos, atendimento e performance.",
    url: "https://www.subaproverde.com",
    images: [
      {
        url: "https://www.subaproverde.com/logo.png",
        width: 512,
        height: 512,
      },
    ],
  },
  manifest: "/manifest.webmanifest",
  applicationName: "Radar SPV",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Radar SPV",
  },
  icons: {
    icon: "/brand/suba-logo.png",
    apple: "/mobile/icon-180.png",
  },
};

export const viewport = {
  themeColor: "#1d2224",
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <ThemeSync />
        {children}
      </body>
    </html>
  );
}
