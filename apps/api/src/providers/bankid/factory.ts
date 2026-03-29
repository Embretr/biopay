import { env, isMockBankID } from "../../env.js";
import { MockBankIDProvider } from "./mock.js";
import { RealBankIDProvider } from "./real.js";
import type { BankIDProvider } from "./types.js";

let _instance: BankIDProvider | null = null;

export function getBankIDProvider(): BankIDProvider {
  if (_instance) return _instance;
  if (isMockBankID) {
    console.info("[BankID] Using MOCK provider (set BANKID_CLIENT_ID to use real BankID)");
    _instance = new MockBankIDProvider();
  } else {
    console.info("[BankID] Using REAL provider (Idura/BankID)");
    _instance = new RealBankIDProvider(
      env.BANKID_CLIENT_ID!,
      env.BANKID_CLIENT_SECRET!,
      env.BANKID_ISSUER!,
    );
  }
  return _instance;
}

export { MockBankIDProvider };
