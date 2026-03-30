import type React from "react";
import Link from "next/link";

export default function LandingPage() {
  return (
    <main className="min-h-screen bg-white flex flex-col">
      {/* Nav */}
      <nav className="flex items-center justify-between px-8 py-5 border-b border-gray-100">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: "#1f9850" }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
              <path d="M18 11V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h12" />
              <path d="M6 12v4" />
              <path d="M10 12v4" />
              <path d="M14 12v4" />
              <circle cx="19" cy="17" r="3" />
            </svg>
          </div>
          <span className="font-bold text-lg text-gray-900">Biopay</span>
        </div>

        <div className="hidden md:flex items-center gap-8 text-sm font-medium text-gray-600">
          <a href="#how-it-works" className="hover:text-gray-900 transition-colors">Slik fungerer det</a>
          <a href="#why-biopay" className="hover:text-gray-900 transition-colors">Hvorfor Biopay</a>
          <Link href="/terminal" className="hover:text-gray-900 transition-colors">Terminal</Link>
        </div>

        <Link
          href="/terminal"
          className="px-5 py-2.5 rounded-full text-sm font-semibold text-white transition-colors"
          style={{ backgroundColor: "#1f9850" }}
        >
          Prøv simulator
        </Link>
      </nav>

      {/* Hero */}
      <section className="blob-bg flex-1 flex flex-col items-center justify-center px-8 py-24 text-center">
        <div className="relative z-10 max-w-3xl mx-auto">
          <div
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium mb-8"
            style={{ backgroundColor: "#e8f5ee", color: "#1f9850" }}
          >
            <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ backgroundColor: "#1f9850" }} />
            Håndflate-betaling · Norsk BankID · PSD2-sertifisert
          </div>

          <h1 className="text-5xl md:text-7xl font-extrabold text-gray-900 leading-tight tracking-tight mb-4 uppercase">
            Fremtidens
            <br />
            betalinger
          </h1>

          <p className="text-2xl md:text-3xl font-extrabold mb-8 uppercase">
            er i din{" "}
            <span style={{ color: "#1f9850" }}>hånd</span>
          </p>

          <p className="text-lg text-gray-500 max-w-xl mx-auto mb-12 leading-relaxed">
            Biopay lar deg betale trygt med bare håndflaten — raskt, sikkert og uten kort.
          </p>

          <div className="flex flex-wrap gap-4 justify-center">
            <Link
              href="/terminal"
              className="px-8 py-4 rounded-full font-bold text-white text-lg transition-colors shadow-lg shadow-green-100"
              style={{ backgroundColor: "#1f9850" }}
            >
              Prøv terminal-simulatoren
            </Link>
            <a
              href="#how-it-works"
              className="px-8 py-4 rounded-full font-bold text-gray-700 text-lg bg-gray-100 hover:bg-gray-200 transition-colors"
            >
              Slik fungerer det
            </a>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" className="px-8 py-20 bg-gray-50">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl font-extrabold text-gray-900 text-center mb-2">Slik fungerer det</h2>
          <p className="text-gray-500 text-center mb-14">Tre enkle steg — én gang oppsett, alltid klar</p>

          <div className="grid md:grid-cols-3 gap-8">
            <StepCard
              number="01"
              title="Last ned"
              description="Last ned Biopay-appen og opprett konto med BankID på under 2 minutter."
            />
            <StepCard
              number="02"
              title="Koble til"
              description="Legg til dine bankkort trygt i Biopay-lommeboken med kryptering."
            />
            <StepCard
              number="03"
              title="Betal"
              description="Hold hånden over PalmID-terminalen for å betale umiddelbart — uten kort eller telefon."
            />
          </div>
        </div>
      </section>

      {/* Why Biopay */}
      <section id="why-biopay" className="px-8 py-20 bg-white">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl font-extrabold text-gray-900 text-center mb-2">Hvorfor Biopay</h2>
          <p className="text-gray-500 text-center mb-14">Sikrere, raskere og enklere enn hva som finnes</p>

          <div className="grid md:grid-cols-3 gap-8">
            <FeatureCard
              icon={<LockIcon />}
              title="Sikkert"
              description="Biometrisk autentisering + tokeniserte betalinger. 10–100× sikrere enn Face ID."
            />
            <FeatureCard
              icon={<BoltIcon />}
              title="Raskt"
              description="1–2 sekunder fra start til bekreftelse. Raskere enn Apple Pay og kontaktløse kort."
            />
            <FeatureCard
              icon={<HandIcon />}
              title="Enkelt"
              description="Ingen kort, ingen telefon — bare hånden din. Fungerer for alle aldersgrupper."
            />
          </div>
        </div>
      </section>

      {/* CTA banner */}
      <section className="px-8 py-20" style={{ backgroundColor: "#1f9850" }}>
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="text-3xl font-extrabold text-white mb-4">
            Klar til å prøve fremtidens betaling?
          </h2>
          <p className="text-green-100 mb-8">
            Test hele flyten i vår interaktive terminal-simulator — ingen konto nødvendig.
          </p>
          <Link
            href="/terminal"
            className="inline-block px-8 py-4 bg-white rounded-full font-bold text-lg transition-colors hover:bg-gray-100"
            style={{ color: "#1f9850" }}
          >
            Åpne terminal-simulator →
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="px-8 py-8 border-t border-gray-100 flex items-center justify-between text-sm text-gray-400">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-md flex items-center justify-center" style={{ backgroundColor: "#1f9850" }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
              <path d="M18 11V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h12" />
              <path d="M6 12v4" />
              <path d="M10 12v4" />
              <path d="M14 12v4" />
              <circle cx="19" cy="17" r="3" />
            </svg>
          </div>
          <span className="font-semibold text-gray-600">Biopay</span>
        </div>
        <p>© 2025 Biopay®. Alle rettigheter forbeholdt.</p>
        <div className="flex items-center gap-4 text-xs">
          <span>BankID</span>
          <span>·</span>
          <span>PalmID</span>
          <span>·</span>
          <span>Mangopay</span>
        </div>
      </footer>
    </main>
  );
}

function StepCard({
  number,
  title,
  description,
}: {
  number: string;
  title: string;
  description: string;
}) {
  return (
    <div className="bg-white rounded-2xl p-8 shadow-sm border border-gray-100">
      <div className="text-4xl font-extrabold mb-4" style={{ color: "#1f9850" }}>
        {number}
      </div>
      <h3 className="font-bold text-lg text-gray-900 mb-2">{title}</h3>
      <p className="text-gray-500 text-sm leading-relaxed">{description}</p>
    </div>
  );
}

function FeatureCard({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-2xl p-8 border border-gray-100 bg-white shadow-sm">
      <div
        className="w-12 h-12 rounded-xl flex items-center justify-center mb-5"
        style={{ backgroundColor: "#e8f5ee" }}
      >
        {icon}
      </div>
      <h3 className="font-bold text-lg text-gray-900 mb-2">{title}</h3>
      <p className="text-gray-500 text-sm leading-relaxed">{description}</p>
    </div>
  );
}

function LockIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#1f9850" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  );
}

function BoltIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#1f9850" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
    </svg>
  );
}

function HandIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#1f9850" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 11V6a2 2 0 0 0-4 0v5" />
      <path d="M14 10V4a2 2 0 0 0-4 0v6" />
      <path d="M10 10.5V6a2 2 0 0 0-4 0v8" />
      <path d="M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L8 15" />
    </svg>
  );
}
