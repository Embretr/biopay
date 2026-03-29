import Link from "next/link";

export default function LandingPage() {
  return (
    <main className="min-h-screen bg-[#0a0a0f] flex flex-col">
      {/* Nav */}
      <nav className="flex items-center justify-between px-8 py-6 border-b border-[#1e1e2e]">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-[#00e5cc] rounded-lg flex items-center justify-center font-bold text-[#0a0a0f] text-lg">
            B
          </div>
          <span className="font-bold text-xl text-[#e2e8f0]">BioPay</span>
        </div>
        <div className="flex items-center gap-4">
          <Link
            href="/terminal"
            className="px-4 py-2 border border-[#1e1e2e] rounded-lg text-sm text-[#e2e8f0] hover:bg-[#111118] transition-colors font-mono"
          >
            Terminal Simulator
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="flex-1 flex flex-col items-center justify-center px-8 py-24 text-center max-w-4xl mx-auto">
        <div className="inline-flex items-center gap-2 px-4 py-2 bg-[#00e5cc15] border border-[#00e5cc30] rounded-full text-[#00e5cc] text-sm font-mono mb-8">
          <span className="w-2 h-2 bg-[#00e5cc] rounded-full animate-pulse" />
          Palmebetaling · Norsk BankID · PSD2-compliant
        </div>

        <h1 className="text-5xl md:text-7xl font-extrabold text-[#e2e8f0] leading-tight tracking-tight mb-6">
          Betal med
          <br />
          <span className="text-[#00e5cc]">håndflaten din</span>
        </h1>

        <p className="text-xl text-[#64748b] max-w-2xl mb-12 leading-relaxed">
          BioPay er en norsk digital lommebok. Registrer hånden din én gang,
          og betal i butikk uten kort eller telefon — bare hold hånden over terminalen.
        </p>

        <div className="flex flex-wrap gap-4 justify-center">
          <Link
            href="/terminal"
            className="px-8 py-4 bg-[#00e5cc] text-[#0a0a0f] rounded-xl font-bold text-lg hover:bg-[#00b8a3] transition-colors"
          >
            Prøv terminal-simulatoren
          </Link>
        </div>
      </section>

      {/* Features */}
      <section className="px-8 py-20 border-t border-[#1e1e2e]">
        <div className="max-w-5xl mx-auto grid md:grid-cols-3 gap-8">
          <FeatureCard
            icon="👋"
            title="Palmebetaling"
            description="Hold hånden over PalmID-terminalen. Ingen telefon, ingen kort — bare du."
          />
          <FeatureCard
            icon="🔐"
            title="BankID-sikring"
            description="Konto verifisert med norsk BankID via Idura. Fullt KYC og PSD2-compliant."
          />
          <FeatureCard
            icon="💰"
            title="Digital lommebok"
            description="Sett inn og ta ut penger. Mangopay håndterer e-money compliance."
          />
        </div>
      </section>

      {/* Footer */}
      <footer className="px-8 py-8 border-t border-[#1e1e2e] text-center text-[#64748b] text-sm">
        <p>BioPay © 2025 · Norsk palmebetaling · BankID · PalmID · Mangopay</p>
      </footer>
    </main>
  );
}

function FeatureCard({
  icon,
  title,
  description,
}: {
  icon: string;
  title: string;
  description: string;
}) {
  return (
    <div className="bg-[#111118] border border-[#1e1e2e] rounded-2xl p-6">
      <div className="text-3xl mb-4">{icon}</div>
      <h3 className="font-bold text-lg text-[#e2e8f0] mb-2">{title}</h3>
      <p className="text-[#64748b] text-sm leading-relaxed">{description}</p>
    </div>
  );
}
