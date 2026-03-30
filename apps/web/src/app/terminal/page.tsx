"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import type { EnrolledUser } from "../api/enrolled-users/route";

const PRIMARY = "#1f9850";
const PRIMARY_LIGHT = "#e8f5ee";

const MOCK_MERCHANTS = [
  { id: "merchant_rema1000", name: "Rema 1000 Storo", terminalId: "terminal_001" },
  { id: "merchant_kiwi", name: "Kiwi Trondhjemsgata", terminalId: "terminal_002" },
  { id: "merchant_coop", name: "Coop Obs! Oslo City", terminalId: "terminal_003" },
  { id: "merchant_narvesen", name: "Narvesen Oslo Lufthavn", terminalId: "terminal_004" },
];

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
    setState({ step: "ENTER_AMOUNT", merchantId: merchant.id, merchantName: merchant.name, terminalId: merchant.terminalId });
  };

  const handleAmountSubmit = () => {
    if (state.step !== "ENTER_AMOUNT") return;
    const amount = parseFloat(amountInput);
    if (isNaN(amount) || amount <= 0) return;
    setState({ ...state, step: "SCANNING", amountCents: Math.round(amount * 100) });
  };

  const handlePalmSelect = async (user: EnrolledUser) => {
    if (state.step !== "SCANNING") return;
    setState({ step: "PROCESSING", palmId: user.palmId, merchantId: state.merchantId, merchantName: state.merchantName, terminalId: state.terminalId, amountCents: state.amountCents });

    try {
      const response = await fetch("/api/process-payment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ palmId: user.palmId, amountCents: state.amountCents, currency: "NOK", merchantName: state.merchantName, merchantId: state.merchantId, terminalId: state.terminalId }),
      });
      const data = await response.json() as { transactionId?: string; error?: string; message?: string };
      if (!response.ok) {
        setState({ step: "ERROR", message: data.message ?? data.error ?? "Betaling feilet", code: response.status });
        return;
      }
      setState({ step: "SUCCESS", transactionId: data.transactionId!, amountCents: (state as { amountCents: number }).amountCents, merchantName: (state as { merchantName: string }).merchantName });
    } catch {
      setState({ step: "ERROR", message: "Kunne ikke nå BioPay API. Er serveren startet?" });
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md">
        <TerminalHeader step={state.step} />
        <div className="bg-white border border-gray-200 rounded-b-2xl overflow-hidden shadow-sm">
          {state.step === "SELECT_MERCHANT" && <MerchantSelect onSelect={handleSelectMerchant} />}
          {state.step === "ENTER_AMOUNT" && (
            <AmountEntry merchantName={state.merchantName} value={amountInput} onChange={setAmountInput} onSubmit={handleAmountSubmit} onBack={reset} />
          )}
          {state.step === "SCANNING" && (
            <PalmScan
              merchantName={state.merchantName}
              amountCents={state.amountCents}
              users={enrolledUsers}
              loading={loadingUsers}
              onSelect={handlePalmSelect}
              onBack={() => setState({ step: "ENTER_AMOUNT", merchantId: state.merchantId, merchantName: state.merchantName, terminalId: state.terminalId })}
            />
          )}
          {state.step === "PROCESSING" && <Processing />}
          {state.step === "SUCCESS" && <ReceiptScreen transactionId={state.transactionId} amountCents={state.amountCents} merchantName={state.merchantName} onReset={reset} />}
          {state.step === "ERROR" && <ErrorScreen message={state.message} code={state.code} onReset={reset} />}
        </div>
      </div>

      <div className="mt-8 flex items-center gap-6 text-xs text-gray-400">
        <Link href="/" className="hover:text-gray-600 transition-colors">
          ← Tilbake til BioPay
        </Link>
        <span>PalmID Terminal Simulator v1.0</span>
      </div>
    </div>
  );
}

function TerminalHeader({ step }: { step: string }) {
  const steps = ["SELECT_MERCHANT", "ENTER_AMOUNT", "SCANNING", "PROCESSING", "SUCCESS"];
  const currentIndex = steps.indexOf(step);

  return (
    <div className="bg-white border border-b-0 border-gray-200 rounded-t-2xl p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: PRIMARY }}>
            <PalmTerminalIcon />
          </div>
          <div>
            <div className="font-bold text-sm text-gray-900">PalmID Terminal</div>
            <div className="text-gray-400 text-xs">BioPay Simulator</div>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
          <span className="text-green-600 text-xs font-semibold">ONLINE</span>
        </div>
      </div>

      <div className="flex gap-1.5">
        {["Butikk", "Beløp", "Håndflate", "Prosesserer"].map((label, i) => (
          <div key={label} className="flex-1">
            <div
              className="h-1 rounded-full transition-all duration-500"
              style={{
                backgroundColor: i < currentIndex ? PRIMARY : i === currentIndex ? PRIMARY : "#e5e7eb",
                opacity: i === currentIndex ? 1 : i < currentIndex ? 1 : 1,
              }}
            />
            <div className="text-[10px] mt-1 text-center" style={{ color: i <= currentIndex ? PRIMARY : "#d1d5db" }}>
              {label}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function MerchantSelect({ onSelect }: { onSelect: (m: (typeof MOCK_MERCHANTS)[number]) => void }) {
  return (
    <div className="p-6">
      <h2 className="font-bold text-lg text-gray-900 mb-1">Velg butikk</h2>
      <p className="text-gray-400 text-sm mb-5">Simuler betaling hos en av disse butikkene</p>
      <div className="flex flex-col gap-2">
        {MOCK_MERCHANTS.map((merchant) => (
          <button
            key={merchant.id}
            onClick={() => onSelect(merchant)}
            className="w-full flex items-center justify-between p-4 bg-gray-50 border border-gray-200 rounded-xl hover:border-green-300 hover:bg-green-50 transition-all group text-left"
          >
            <div>
              <div className="text-gray-900 font-medium group-hover:text-green-700 transition-colors">
                {merchant.name}
              </div>
              <div className="text-gray-400 text-xs mt-0.5 font-mono">
                terminal: {merchant.terminalId}
              </div>
            </div>
            <ChevronIcon />
          </button>
        ))}
      </div>
    </div>
  );
}

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
      <button onClick={onBack} className="text-gray-400 text-sm mb-4 hover:text-gray-600 transition-colors flex items-center gap-1">
        <span>←</span> {merchantName}
      </button>
      <h2 className="font-bold text-lg text-gray-900 mb-1">Skriv inn beløp</h2>
      <p className="text-gray-400 text-sm mb-5">Betalingsbeløp i NOK</p>

      <div className="bg-gray-50 border border-gray-200 rounded-xl p-6 mb-4 text-center">
        <input
          type="number"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="0.00"
          className="w-full bg-transparent text-4xl font-bold text-center outline-none placeholder:text-gray-300"
          style={{ color: PRIMARY }}
          autoFocus
          onKeyDown={(e) => e.key === "Enter" && isValid && onSubmit()}
          min="0.01"
          step="0.01"
        />
        <div className="text-gray-400 text-sm mt-1">NOK</div>
      </div>

      <div className="grid grid-cols-4 gap-2 mb-5">
        {quickAmounts.map((amt) => (
          <button
            key={amt}
            onClick={() => onChange(amt.toString())}
            className="py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-700 hover:border-green-300 hover:text-green-700 hover:bg-green-50 transition-all"
          >
            {amt},-
          </button>
        ))}
      </div>

      <button
        onClick={onSubmit}
        disabled={!isValid}
        className="w-full py-4 rounded-xl font-bold text-white text-base disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        style={{ backgroundColor: PRIMARY }}
      >
        Gå til betaling →
      </button>
    </div>
  );
}

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
      <button onClick={onBack} className="text-gray-400 text-sm mb-4 hover:text-gray-600 transition-colors flex items-center gap-1">
        <span>←</span> Endre beløp
      </button>

      <div className="text-center mb-5">
        <div className="text-gray-400 text-xs uppercase tracking-widest mb-1">{merchantName}</div>
        <div className="text-4xl font-bold text-gray-900">
          {(amountCents / 100).toLocaleString("nb-NO", { minimumFractionDigits: 2 })}
          <span className="text-gray-400 text-xl ml-2">NOK</span>
        </div>
      </div>

      <div className="relative flex items-center justify-center h-28 mb-5">
        <div className="absolute w-24 h-24 rounded-full border-2 opacity-20 ring-animate" style={{ borderColor: PRIMARY }} />
        <div className="absolute w-16 h-16 rounded-full border opacity-30 ring-animate" style={{ borderColor: PRIMARY, animationDelay: "0.5s" }} />
        <div className="w-14 h-14 rounded-full flex items-center justify-center" style={{ backgroundColor: PRIMARY_LIGHT }}>
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke={PRIMARY} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 11V6a2 2 0 0 0-4 0v5" />
            <path d="M14 10V4a2 2 0 0 0-4 0v6" />
            <path d="M10 10.5V6a2 2 0 0 0-4 0v8" />
            <path d="M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L8 15" />
          </svg>
        </div>
      </div>

      <h2 className="font-bold text-center text-gray-900 mb-1">Hold hånden over leseren</h2>
      <p className="text-gray-400 text-sm text-center mb-5">Velg hvilken bruker som betaler (simulering)</p>

      {loading ? (
        <div className="text-center text-gray-400 text-sm py-8">
          <div className="inline-block w-5 h-5 border-2 border-t-transparent rounded-full animate-spin mb-2" style={{ borderColor: PRIMARY, borderTopColor: "transparent" }} />
          <div>Søker etter registrerte brukere...</div>
        </div>
      ) : users.length === 0 ? (
        <div className="bg-gray-50 border border-gray-200 rounded-xl p-6 text-center">
          <div className="text-gray-900 font-medium mb-1">Ingen brukere funnet</div>
          <div className="text-gray-400 text-sm">Registrer en håndflate i mobilappen for å teste betalingen.</div>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {users.map((user) => (
            <button
              key={user.palmId}
              onClick={() => onSelect(user)}
              className="w-full flex items-center gap-3 p-4 bg-gray-50 border border-gray-200 rounded-xl hover:border-green-300 hover:bg-green-50 transition-all group text-left"
            >
              <div className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-white text-base" style={{ backgroundColor: PRIMARY }}>
                {user.name[0]?.toUpperCase() ?? "?"}
              </div>
              <div className="flex-1">
                <div className="text-gray-900 font-medium group-hover:text-green-700 transition-colors">{user.name}</div>
                <div className="text-gray-400 text-xs">
                  Saldo: {(user.balanceCents / 100).toLocaleString("nb-NO", { minimumFractionDigits: 2 })} {user.currency}
                </div>
              </div>
              {user.balanceCents < amountCents ? (
                <span className="text-red-500 text-xs font-medium">Lav saldo</span>
              ) : (
                <span className="text-green-600 text-xs font-medium opacity-0 group-hover:opacity-100 transition-opacity">Betal →</span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function Processing() {
  return (
    <div className="p-12 flex flex-col items-center text-center gap-6">
      <div className="relative w-16 h-16">
        <div className="w-16 h-16 rounded-full border-2 border-gray-100" />
        <div className="absolute inset-0 w-16 h-16 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: PRIMARY, borderTopColor: "transparent" }} />
        <div className="absolute inset-0 flex items-center justify-center">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={PRIMARY} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect width="20" height="14" x="2" y="5" rx="2" />
            <line x1="2" x2="22" y1="10" y2="10" />
          </svg>
        </div>
      </div>
      <div>
        <div className="text-gray-900 font-bold text-lg mb-1">Prosesserer betaling...</div>
        <div className="text-gray-400 text-sm">Kobler til BioPay API</div>
      </div>
      <div className="flex gap-1">
        {[0, 1, 2].map((i) => (
          <div key={i} className="w-2 h-2 rounded-full animate-bounce" style={{ backgroundColor: PRIMARY, animationDelay: `${i * 0.15}s` }} />
        ))}
      </div>
    </div>
  );
}

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
      <div className="flex flex-col items-center text-center mb-6">
        <div className="w-16 h-16 rounded-full flex items-center justify-center mb-4" style={{ backgroundColor: PRIMARY_LIGHT }}>
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke={PRIMARY} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </div>
        <div className="font-bold text-xl mb-1" style={{ color: PRIMARY }}>Betaling godkjent!</div>
        <div className="text-gray-400 text-sm">{merchantName}</div>
      </div>

      <div className="bg-gray-50 border border-gray-200 rounded-xl p-5 mb-5 text-sm">
        <div className="text-gray-400 text-xs text-center mb-4 uppercase tracking-widest">Kvittering</div>
        <ReceiptRow label="Butikk" value={merchantName} />
        <ReceiptRow label="Beløp" value={`${(amountCents / 100).toLocaleString("nb-NO", { minimumFractionDigits: 2 })} NOK`} highlight />
        <ReceiptRow label="Tidspunkt" value={new Date().toLocaleTimeString("nb-NO", { hour: "2-digit", minute: "2-digit" })} />
        <div className="border-t border-dashed border-gray-200 my-3" />
        <div className="text-[10px] text-gray-400 break-all font-mono">TX: {transactionId}</div>
      </div>

      <button
        onClick={onReset}
        className="w-full py-4 border border-gray-200 text-gray-700 font-bold rounded-xl hover:bg-gray-50 transition-all"
      >
        Ny betaling
      </button>
    </div>
  );
}

function ReceiptRow({ label, value, highlight = false }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="flex justify-between items-center py-1.5">
      <span className="text-gray-400">{label}</span>
      <span className="font-semibold" style={{ color: highlight ? PRIMARY : "#111827" }}>{value}</span>
    </div>
  );
}

function ErrorScreen({ message, code, onReset }: { message: string; code?: number; onReset: () => void }) {
  const isInsufficientFunds = code === 402;

  return (
    <div className="p-6 flex flex-col items-center text-center gap-4">
      <div className="w-16 h-16 bg-red-50 border border-red-100 rounded-full flex items-center justify-center">
        {isInsufficientFunds ? (
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="1" x2="12" y2="23" />
            <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
          </svg>
        ) : (
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        )}
      </div>
      <div>
        <div className="text-red-600 font-bold text-lg mb-1">
          {isInsufficientFunds ? "Utilstrekkelig saldo" : "Betaling feilet"}
        </div>
        <div className="text-gray-400 text-sm">{message}</div>
        {code && <div className="text-gray-300 text-xs mt-1 font-mono">HTTP {code}</div>}
      </div>
      <button
        onClick={onReset}
        className="mt-2 w-full py-4 border border-gray-200 text-gray-700 font-bold rounded-xl hover:bg-gray-50 transition-all"
      >
        Prøv igjen
      </button>
    </div>
  );
}

function ChevronIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gray-300 group-hover:text-green-500 transition-colors">
      <polyline points="9 18 15 12 9 6" />
    </svg>
  );
}

function PalmTerminalIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 11V6a2 2 0 0 0-4 0v5" />
      <path d="M14 10V4a2 2 0 0 0-4 0v6" />
      <path d="M10 10.5V6a2 2 0 0 0-4 0v8" />
      <path d="M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L8 15" />
    </svg>
  );
}
