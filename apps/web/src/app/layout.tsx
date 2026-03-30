import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "BioPay — betalingsterminal (mock)",
  description: "Lokal mock av PalmID-betalingsterminal for utvikling og testing.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="nb">
      <body className="bg-white text-gray-900 antialiased">{children}</body>
    </html>
  );
}
