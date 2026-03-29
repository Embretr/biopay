export interface PalmEnrollResult {
  palmId: string;
  enrollmentToken: string;
}

export interface PalmIDWebhookPayload {
  eventType: "PAYMENT_AUTHORIZED" | "PAYMENT_FAILED";
  terminalId: string;
  palmId: string;
  amountCents: number;
  currency: string;
  merchantName: string;
  merchantId: string;
  timestamp: string;
  idempotencyKey: string;
}

export interface PalmIDProvider {
  enrollPalm(userId: string): Promise<PalmEnrollResult>;
  deletePalm(palmId: string): Promise<void>;
  /** Returns true if signature is valid. In mock mode, always returns true. */
  verifyWebhookSignature(rawBody: Buffer, signature: string): boolean;
}
