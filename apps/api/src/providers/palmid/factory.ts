import { env, isMockPalmID } from "../../env.js";
import { MockPalmIDProvider } from "./mock.js";
import { RealPalmIDProvider } from "./real.js";
import type { PalmIDProvider } from "./types.js";

let _instance: PalmIDProvider | null = null;

export function getPalmIDProvider(): PalmIDProvider {
  if (_instance) return _instance;
  if (isMockPalmID) {
    console.info("[PalmID] Using MOCK provider (set PALMID_API_KEY to use real PalmID)");
    _instance = new MockPalmIDProvider();
  } else {
    console.info("[PalmID] Using REAL provider (PalmID SaaS)");
    _instance = new RealPalmIDProvider(
      env.PALMID_API_KEY!,
      env.PALMID_API_BASE_URL!,
      env.PALMID_WEBHOOK_SECRET!,
    );
  }
  return _instance;
}
