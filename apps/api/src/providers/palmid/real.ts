import { createHmac, timingSafeEqual } from "crypto";
import type { PalmIDProvider, PalmEnrollResult } from "./types.js";

/**
 * Real PalmID SaaS provider.
 * Requires commercial agreement with PalmID / Redrock Biometrics.
 */
export class RealPalmIDProvider implements PalmIDProvider {
  private apiKey: string;
  private baseUrl: string;
  private webhookSecret: string;

  constructor(apiKey: string, baseUrl: string, webhookSecret: string) {
    this.apiKey = apiKey;
    this.baseUrl = baseUrl;
    this.webhookSecret = webhookSecret;
  }

  async enrollPalm(userId: string): Promise<PalmEnrollResult> {
    const response = await fetch(`${this.baseUrl}/v1/enrollments`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({ externalUserId: userId }),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`PalmID enrollment failed: ${response.status} ${text}`);
    }

    const data = (await response.json()) as { palmId: string; enrollmentToken: string };
    return {
      palmId: data.palmId,
      enrollmentToken: data.enrollmentToken,
    };
  }

  async deletePalm(palmId: string): Promise<void> {
    const response = await fetch(`${this.baseUrl}/v1/enrollments/${palmId}`, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
      },
    });

    if (!response.ok && response.status !== 404) {
      throw new Error(`PalmID delete failed: ${response.status}`);
    }
  }

  verifyWebhookSignature(rawBody: Buffer, signature: string): boolean {
    // Expected: "sha256=<hex>"
    const parts = signature.split("=");
    if (parts.length !== 2 || parts[0] !== "sha256") return false;

    const expectedHex = parts[1]!;
    const hmac = createHmac("sha256", this.webhookSecret);
    hmac.update(rawBody);
    const computed = hmac.digest("hex");

    try {
      return timingSafeEqual(Buffer.from(computed, "hex"), Buffer.from(expectedHex, "hex"));
    } catch {
      return false;
    }
  }
}
