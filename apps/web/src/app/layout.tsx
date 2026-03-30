import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "BioPay — Palmebetaling",
  description: "Betal i butikk ved å holde hånden over terminalen. Digital lommebok med BankID.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="nb">
      <body className="bg-white text-gray-900 antialiased">{children}</body>
    </html>
  );
}
