"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import type { EnrolledUser } from "../api/enrolled-users/route";

// ── Mock merchant data ─────────────────────────────────────────────────────────
const MOCK_MERCHANTS = [
  { id: "merchant_rema1000", name: "Rema 1000 Storo", terminalId: "terminal_001" },
  { id: "merchant_kiwi", name: "Kiwi Trondhjemsgata", terminalId: "terminal_002" },
  { id: "merchant_coop", name: "Coop Obs! Oslo City", terminalId: "terminal_003" },
  { id: "merchant_narvesen", name: "Narvesen Oslo Lufthavn", terminalId: "terminal_004" },
];

// ── State machine ──────────────────────────────────────────────────────────────
type TerminalStep =
  | { step: "SELECT_MERCHANT" }
  | { step: "ENTER_AMOUNT"; merchantId: string; merchantName: string; terminalId: string }
  | { step: "SCANNING"; merchantId: string; merchantName: string; terminalId: string; amountCents: number }
  | { step: "PROCESSING"; palmId: string; merchantId: string; merchantName: string; terminalId: string; amountCents: number }
  | { step: "SUCCESS"; transactionId: string; amountCents: number; merchantName: string }
  | { step: "ERROR"; message: string; code?: number };

export default function TerminalPage() {
  const [state, setState] = useState<TerminalStep>({ step: "SELECT_MERCHANT" });
  const [enrolledUsers, setEnrolledUsers] = useState<EnrolledUser[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [amountInput, setAmountInput] = useState("");

  // Load enrolled users when reaching scanning step
  useEffect(() => {
    if (state.step === "SCANNING") {
      setLoadingUsers(true);
      fetch("/api/enrolled-users")
        .then((r) => r.json())
        .then((users: EnrolledUser[]) => setEnrolledUsers(users))
        .catch(() => setEnrolledUsers([]))
        .finally(() => setLoadingUsers(false));
    }
  }, [state.step]);

  const reset = () => {
    setState({ step: "SELECT_MERCHANT" });
    setAmountInput("");
  };

  const handleSelectMerchant = (merchant: (typeof MOCK_MERCHANTS)[number]) => {
    setState({
      step: "ENTER_AMOUNT",
      merchantId: merchant.id,
      merchantName: merchant.name,
      terminalId: merchant.terminalId,
    });
  };

  const handleAmountSubmit = () => {
    if (state.step !== "ENTER_AMOUNT") return;
    const amount = parseFloat(amountInput);
    if (isNaN(amount) || amount <= 0) return;
    const amountCents = Math.round(amount * 100);
    setState({ ...state, step: "SCANNING", amountCents });
  };

  const handlePalmSelect = async (user: EnrolledUser) => {
    if (state.step !== "SCANNING") return;

    setState({
      step: "PROCESSING",
      palmId: user.palmId,
      merchantId: state.merchantId,
      merchantName: state.merchantName,
      terminalId: state.terminalId,
      amountCents: state.amountCents,
    });

    try {
      const response = await fetch("/api/process-payment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          palmId: user.palmId,
          amountCents: state.amountCents,
          currency: "NOK",
          merchantName: state.merchantName,
          merchantId: state.merchantId,
          terminalId: state.terminalId,
        }),
      });

      const data = await response.json() as { transactionId?: string; error?: string; message?: string };

      if (!response.ok) {
        setState({
          step: "ERROR",
          message: data.message ?? data.error ?? "Betaling feilet",
          code: response.status,
        });
        return;
      }

      setState({
        step: "SUCCESS",
        transactionId: data.transactionId!,
        amountCents: (state as { amountCents: number }).amountCents,
        merchantName: (state as { merchantName: string }).merchantName,
      });
    } catch {
      setState({
        step: "ERROR",
        message: "Kunne ikke nå BioPay API. Er serveren startet?",
      });
    }
  };

  return (
    <div className="terminal-scanlines min-h-screen bg-[#0a0a0f] flex flex-col items-center justify-center p-4 font-mono">
      {/* Background grid */}
      <div
        className="fixed inset-0 opacity-[0.03]"
        style={{
          backgroundImage: "linear-gradient(#00e5cc 1px, transparent 1px), linear-gradient(90deg, #00e5cc 1px, transparent 1px)",
          backgroundSize: "40px 40px",
        }}
      />

      {/* Terminal frame */}
      <div className="relative z-20 w-full max-w-md">
        {/* Header */}
        <TerminalHeader step={state.step} />

        {/* Main panel */}
        <div className="bg-[#0d0d14] border border-[#1e1e2e] rounded-b-2xl overflow-hidden shadow-2xl shadow-black/50">
          {state.step === "SELECT_MERCHANT" && (
            <MerchantSelect onSelect={handleSelectMerchant} />
          )}
          {state.step === "ENTER_AMOUNT" && (
            <AmountEntry
              merchantName={state.merchantName}
              value={amountInput}
              onChange={setAmountInput}
              onSubmit={handleAmountSubmit}
              onBack={reset}
            />
          )}
          {state.step === "SCANNING" && (
            <PalmScan
              merchantName={state.merchantName}
              amountCents={state.amountCents}
              users={enrolledUsers}
              loading={loadingUsers}
              onSelect={handlePalmSelect}
              onBack={() =>
                setState({
                  step: "ENTER_AMOUNT",
                  merchantId: state.merchantId,
                  merchantName: state.merchantName,
                  terminalId: state.terminalId,
                })
              }
            />
          )}
          {state.step === "PROCESSING" && <Processing />}
          {state.step === "SUCCESS" && (
            <ReceiptScreen
              transactionId={state.transactionId}
              amountCents={state.amountCents}
              merchantName={state.merchantName}
              onReset={reset}
            />
          )}
          {state.step === "ERROR" && (
            <ErrorScreen message={state.message} code={state.code} onReset={reset} />
          )}
        </div>
      </div>

      {/* Footer links */}
      <div className="relative z-20 mt-8 flex items-center gap-6 text-xs text-[#64748b]">
        <Link href="/" className="hover:text-[#00e5cc] transition-colors">
          ← Tilbake til BioPay
        </Link>
        <span>PalmID Terminal Simulator v1.0</span>
      </div>
    </div>
  );
}

// ── Terminal header ─────────────────────────────────────────────────────────────
function TerminalHeader({ step }: { step: string }) {
  const steps = ["SELECT_MERCHANT", "ENTER_AMOUNT", "SCANNING", "PROCESSING", "SUCCESS"];
  const currentIndex = steps.indexOf(step);

  return (
    <div className="bg-[#111118] border border-b-0 border-[#1e1e2e] rounded-t-2xl p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-[#00e5cc] rounded-lg flex items-center justify-center font-bold text-[#0a0a0f] text-sm">
            P
          </div>
          <div>
            <div className="text-[#e2e8f0] font-bold text-sm">PalmID Terminal</div>
            <div className="text-[#64748b] text-xs">BioPay Simulator</div>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-[#22c55e] animate-pulse" />
          <span className="text-[#22c55e] text-xs font-mono">ONLINE</span>
        </div>
      </div>

      {/* Step progress */}
      <div className="flex gap-1.5">
        {["Butikk", "Beløp", "Palme", "Prosesserer"].map((label, i) => (
          <div key={label} className="flex-1">
            <div
              className={`h-1 rounded-full transition-all duration-500 ${
                i < currentIndex
                  ? "bg-[#00e5cc]"
                  : i === currentIndex
                    ? "bg-[#00e5cc] animate-pulse"
                    : "bg-[#1e1e2e]"
              }`}
            />
            <div className={`text-[10px] mt-1 text-center ${i <= currentIndex ? "text-[#00e5cc]" : "text-[#1e1e2e]"}`}>
              {label}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Step 1: Select merchant ────────────────────────────────────────────────────
function MerchantSelect({ onSelect }: { onSelect: (m: (typeof MOCK_MERCHANTS)[number]) => void }) {
  return (
    <div className="p-6">
      <h2 className="text-[#e2e8f0] font-bold text-lg mb-1">Velg butikk</h2>
      <p className="text-[#64748b] text-sm mb-6">Simuler betaling hos en av disse butikkene</p>
      <div className="flex flex-col gap-2">
        {MOCK_MERCHANTS.map((merchant) => (
          <button
            key={merchant.id}
            onClick={() => onSelect(merchant)}
            className="w-full flex items-center justify-between p-4 bg-[#111118] border border-[#1e1e2e] rounded-xl hover:border-[#00e5cc] hover:bg-[#00e5cc08] transition-all group text-left"
          >
            <div>
              <div className="text-[#e2e8f0] font-medium group-hover:text-[#00e5cc] transition-colors">
                {merchant.name}
              </div>
              <div className="text-[#64748b] text-xs mt-0.5 font-mono">
                terminal: {merchant.terminalId}
              </div>
            </div>
            <span className="text-[#64748b] group-hover:text-[#00e5cc] transition-colors">→</span>
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Step 2: Enter amount ──────────────────────────────────────────────────────
function AmountEntry({
  merchantName,
  value,
  onChange,
  onSubmit,
  onBack,
}: {
  merchantName: string;
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
  onBack: () => void;
}) {
  const amount = parseFloat(value);
  const isValid = !isNaN(amount) && amount > 0;

  const quickAmounts = [49, 99, 149, 299];

  return (
    <div className="p-6">
      <button onClick={onBack} className="text-[#64748b] text-sm mb-4 hover:text-[#00e5cc] transition-colors">
        ← {merchantName}
      </button>
      <h2 className="text-[#e2e8f0] font-bold text-lg mb-1">Skriv inn beløp</h2>
      <p className="text-[#64748b] text-sm mb-6">Betalingsbeløp i NOK</p>

      {/* Amount display */}
      <div className="bg-[#0a0a0f] border border-[#1e1e2e] rounded-xl p-6 mb-4 text-center">
        <input
          type="number"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="0.00"
          className="w-full bg-transparent text-4xl font-bold text-[#00e5cc] text-center outline-none placeholder:text-[#1e1e2e]"
          autoFocus
          onKeyDown={(e) => e.key === "Enter" && isValid && onSubmit()}
          min="0.01"
          step="0.01"
        />
        <div className="text-[#64748b] text-sm mt-1">NOK</div>
      </div>

      {/* Quick amounts */}
      <div className="grid grid-cols-4 gap-2 mb-6">
        {quickAmounts.map((amt) => (
          <button
            key={amt}
            onClick={() => onChange(amt.toString())}
            className="py-2 bg-[#111118] border border-[#1e1e2e] rounded-lg text-sm text-[#e2e8f0] hover:border-[#00e5cc] hover:text-[#00e5cc] transition-all"
          >
            {amt},-
          </button>
        ))}
      </div>

      <button
        onClick={onSubmit}
        disabled={!isValid}
        className="w-full py-4 bg-[#00e5cc] text-[#0a0a0f] font-bold rounded-xl disabled:opacity-30 disabled:cursor-not-allowed hover:bg-[#00b8a3] transition-colors"
      >
        Gå til betaling →
      </button>
    </div>
  );
}

// ── Step 3: Palm scan (user selection) ──────────────────────────────────────────
function PalmScan({
  merchantName,
  amountCents,
  users,
  loading,
  onSelect,
  onBack,
}: {
  merchantName: string;
  amountCents: number;
  users: EnrolledUser[];
  loading: boolean;
  onSelect: (user: EnrolledUser) => void;
  onBack: () => void;
}) {
  return (
    <div className="p-6">
      <button onClick={onBack} className="text-[#64748b] text-sm mb-4 hover:text-[#00e5cc] transition-colors">
        ← Endre beløp
      </button>

      {/* Amount display */}
      <div className="text-center mb-6">
        <div className="text-[#64748b] text-xs uppercase tracking-widest mb-1">{merchantName}</div>
        <div className="text-4xl font-bold text-[#e2e8f0]">
          {(amountCents / 100).toLocaleString("nb-NO", { minimumFractionDigits: 2 })}
          <span className="text-[#64748b] text-xl ml-2">NOK</span>
        </div>
      </div>

      {/* Palm scan animation */}
      <div className="relative flex items-center justify-center h-28 mb-6">
        <div className="absolute w-24 h-24 rounded-full border-2 border-[#00e5cc] opacity-20 ring-animate" />
        <div className="absolute w-16 h-16 rounded-full border border-[#00e5cc] opacity-40 ring-animate" style={{ animationDelay: "0.5s" }} />
        <div className="text-5xl" style={{ animation: "palmScan 2s ease-in-out infinite" }}>🖐️</div>
      </div>

      <h2 className="text-[#e2e8f0] font-bold text-center mb-1">Hold hånden over leseren</h2>
      <p className="text-[#64748b] text-sm text-center mb-6">
        Velg hvilken bruker som betaler (simulering)
      </p>

      {loading ? (
        <div className="text-center text-[#64748b] text-sm py-8">
          <div className="inline-block w-5 h-5 border-2 border-[#00e5cc] border-t-transparent rounded-full animate-spin mb-2" />
          <div>Søker etter registrerte brukere...</div>
        </div>
      ) : users.length === 0 ? (
        <div className="bg-[#111118] border border-[#1e1e2e] rounded-xl p-6 text-center">
          <div className="text-2xl mb-2">😶</div>
          <div className="text-[#e2e8f0] font-medium mb-1">Ingen brukere funnet</div>
          <div className="text-[#64748b] text-sm">
            Registrer en palme i mobilappen for å teste betalingen.
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {users.map((user) => (
            <button
              key={user.palmId}
              onClick={() => onSelect(user)}
              className="w-full flex items-center gap-3 p-4 bg-[#111118] border border-[#1e1e2e] rounded-xl hover:border-[#00e5cc] hover:bg-[#00e5cc08] transition-all group text-left"
            >
              <div className="w-10 h-10 bg-[#1e1e2e] rounded-full flex items-center justify-center text-xl">
                {user.name[0]?.toUpperCase() ?? "?"}
              </div>
              <div className="flex-1">
                <div className="text-[#e2e8f0] font-medium group-hover:text-[#00e5cc] transition-colors">
                  {user.name}
                </div>
                <div className="text-[#64748b] text-xs">
                  Saldo: {(user.balanceCents / 100).toLocaleString("nb-NO", { minimumFractionDigits: 2 })} {user.currency}
                </div>
              </div>
              {user.balanceCents < amountCents ? (
                <span className="text-[#ef4444] text-xs font-mono">Lav saldo</span>
              ) : (
                <span className="text-[#00e5cc] text-xs group-hover:opacity-100 opacity-0 transition-opacity">
                  Betal →
                </span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Step 4: Processing ────────────────────────────────────────────────────────
function Processing() {
  return (
    <div className="p-12 flex flex-col items-center text-center gap-6">
      <div className="relative">
        <div className="w-16 h-16 rounded-full border-2 border-[#00e5cc20]" />
        <div className="absolute inset-0 w-16 h-16 rounded-full border-2 border-[#00e5cc] border-t-transparent animate-spin" />
        <div className="absolute inset-0 flex items-center justify-center text-2xl">💳</div>
      </div>
      <div>
        <div className="text-[#e2e8f0] font-bold text-lg mb-1">Prosesserer betaling...</div>
        <div className="text-[#64748b] text-sm font-mono">Kobler til BioPay API</div>
      </div>
      <div className="flex gap-1">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="w-2 h-2 bg-[#00e5cc] rounded-full animate-bounce"
            style={{ animationDelay: `${i * 0.15}s` }}
          />
        ))}
      </div>
    </div>
  );
}

// ── Step 5: Success receipt ───────────────────────────────────────────────────
function ReceiptScreen({
  transactionId,
  amountCents,
  merchantName,
  onReset,
}: {
  transactionId: string;
  amountCents: number;
  merchantName: string;
  onReset: () => void;
}) {
  return (
    <div className="p-6">
      {/* Success icon */}
      <div className="flex flex-col items-center text-center mb-6">
        <div className="w-16 h-16 bg-[#22c55e20] border border-[#22c55e40] rounded-full flex items-center justify-center text-3xl mb-4 glow-animate">
          ✓
        </div>
        <div className="text-[#22c55e] font-bold text-xl mb-1">Betaling godkjent!</div>
        <div className="text-[#64748b] text-sm">{merchantName}</div>
      </div>

      {/* Receipt */}
      <div className="bg-[#0a0a0f] border border-[#1e1e2e] rounded-xl p-5 mb-6 font-mono text-sm">
        <div className="text-[#64748b] text-xs text-center mb-4 uppercase tracking-widest">
          Kvittering
        </div>
        <ReceiptRow label="Butikk" value={merchantName} />
        <ReceiptRow
          label="Beløp"
          value={`${(amountCents / 100).toLocaleString("nb-NO", { minimumFractionDigits: 2 })} NOK`}
          highlight
        />
        <ReceiptRow
          label="Tidspunkt"
          value={new Date().toLocaleTimeString("nb-NO", { hour: "2-digit", minute: "2-digit" })}
        />
        <div className="border-t border-dashed border-[#1e1e2e] my-3" />
        <div className="text-[10px] text-[#64748b] break-all">
          TX: {transactionId}
        </div>
      </div>

      <button
        onClick={onReset}
        className="w-full py-4 border border-[#1e1e2e] text-[#e2e8f0] font-bold rounded-xl hover:bg-[#111118] hover:border-[#00e5cc] transition-all"
      >
        Ny betaling
      </button>
    </div>
  );
}

function ReceiptRow({
  label,
  value,
  highlight = false,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div className="flex justify-between items-center py-1.5">
      <span className="text-[#64748b]">{label}</span>
      <span className={highlight ? "text-[#00e5cc] font-bold" : "text-[#e2e8f0]"}>{value}</span>
    </div>
  );
}

// ── Error screen ──────────────────────────────────────────────────────────────
function ErrorScreen({
  message,
  code,
  onReset,
}: {
  message: string;
  code?: number;
  onReset: () => void;
}) {
  const isInsufficientFunds = code === 402;

  return (
    <div className="p-6 flex flex-col items-center text-center gap-4">
      <div className="w-16 h-16 bg-[#ef444420] border border-[#ef444440] rounded-full flex items-center justify-center text-3xl">
        {isInsufficientFunds ? "💸" : "✕"}
      </div>
      <div>
        <div className="text-[#ef4444] font-bold text-lg mb-1">
          {isInsufficientFunds ? "Utilstrekkelig saldo" : "Betaling feilet"}
        </div>
        <div className="text-[#64748b] text-sm">{message}</div>
        {code && (
          <div className="text-[#64748b] text-xs mt-1 font-mono">HTTP {code}</div>
        )}
      </div>
      <button
        onClick={onReset}
        className="mt-2 w-full py-4 border border-[#1e1e2e] text-[#e2e8f0] font-bold rounded-xl hover:bg-[#111118] transition-all"
      >
        Prøv igjen
      </button>
    </div>
  );
}
