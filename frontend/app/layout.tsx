import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "./globals.css";

const geist = Geist({ subsets: ["latin"], variable: "--font-geist" });

export const metadata: Metadata = {
  title: "Tellana — Animated Web Scenes",
  description: "Créez et partagez des scènes interactives au format Visual Novel",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="fr" className={geist.variable}>
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
