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

export const metadata = {
  title: "Suba Pro Verde",
  description: "Radar inteligente de reputação para vendedores do Mercado Livre. Identifique impactos, atrasos e reclamações antes que virem prejuízo.",
  openGraph: {
    title: "Suba Pro Verde",
    description:
      "Radar inteligente de reputação para vendedores do Mercado Livre.",
    url: "https://www.subaproverde.com",
    siteName: "Suba Pro Verde",
    images: [
      {
        url: "https://www.subaproverde.com/og-image.png",
        width: 1200,
        height: 630,
      },
    ],
    locale: "pt_BR",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
