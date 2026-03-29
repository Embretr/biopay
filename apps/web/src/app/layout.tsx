import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "BioPay — Palmebetaling",
  description: "Betal i butikk ved å holde hånden over terminalen. Digital lommebok med BankID.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="nb" className="dark">
      <body className="bg-[#0a0a0f] text-[#e2e8f0] antialiased">{children}</body>
    </html>
  );
}
