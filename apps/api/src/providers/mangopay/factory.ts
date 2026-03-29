import { env, isMockMangopay } from "../../env.js";
import { MockMangopayProvider } from "./mock.js";
import { RealMangopayProvider } from "./real.js";
import type { MangopayProvider } from "./types.js";

let _instance: MangopayProvider | null = null;

export function getMangopayProvider(): MangopayProvider {
  if (_instance) return _instance;
  if (isMockMangopay) {
    console.info("[Mangopay] Using MOCK provider (set MANGOPAY_CLIENT_ID to use real Mangopay)");
    _instance = new MockMangopayProvider();
  } else {
    console.info("[Mangopay] Using REAL provider (Mangopay API)");
    _instance = new RealMangopayProvider(
      env.MANGOPAY_CLIENT_ID!,
      env.MANGOPAY_API_KEY!,
      env.MANGOPAY_BASE_URL!,
      env.MANGOPAY_PLATFORM_WALLET_ID!,
    );
  }
  return _instance;
}
