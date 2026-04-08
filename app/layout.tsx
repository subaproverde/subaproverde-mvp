import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

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
    "Radar inteligente de reputação para vendedores do Mercado Livre.",
  openGraph: {
    title: "Suba Pro Verde",
    description: "Proteja sua reputação antes que impactos virem prejuízo.",
    url: "https://www.subaproverde.com",
    images: [
      {
        url: "https://www.subaproverde.com/logo.png",
        width: 512,
        height: 512,
      },
    ],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}