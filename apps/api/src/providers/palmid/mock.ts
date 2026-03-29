import { createId } from "@paralleldrive/cuid2";
import type { PalmIDProvider, PalmEnrollResult } from "./types.js";

/**
 * Mock PalmID provider for development.
 *
 * - enrollPalm: generates a fake palmId, stores userId↔palmId in Redis
 * - deletePalm: removes from Redis
 * - verifyWebhookSignature: always returns true (terminal simulator bypasses HMAC)
 */
export class MockPalmIDProvider implements PalmIDProvider {
  async enrollPalm(userId: string): Promise<PalmEnrollResult> {
    const palmId = `mock_palm_${createId()}`;
    // Actual Redis storage happens in the route (via DB — PalmEnrollment record)
    // The mock provider just returns the IDs; no external call needed
    return {
      palmId,
      enrollmentToken: `mock_enroll_token_${createId()}`,
    };
  }

  async deletePalm(_palmId: string): Promise<void> {
    // In mock mode, deletion is handled by the route (DB record update)
    // No external system to notify
    return;
  }

  verifyWebhookSignature(_rawBody: Buffer, _signature: string): boolean {
    // Always valid in mock mode — terminal simulator doesn't compute HMAC
    return true;
  }
}
