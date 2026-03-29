import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

export interface ProcessPaymentRequest {
  palmId: string;
  amountCents: number;
  currency: string;
  merchantName: string;
  merchantId: string;
  terminalId: string;
}

export async function POST(request: NextRequest) {
  const body = (await request.json()) as ProcessPaymentRequest;

  const idempotencyKey = randomUUID();
  const webhookPayload = {
    eventType: "PAYMENT_AUTHORIZED",
    terminalId: body.terminalId,
    palmId: body.palmId,
    amountCents: body.amountCents,
    currency: body.currency,
    merchantName: body.merchantName,
    merchantId: body.merchantId,
    timestamp: new Date().toISOString(),
    idempotencyKey,
  };

  try {
    const response = await fetch(`${API_URL}/webhooks/palmid`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Mock-Terminal": "true",
        "X-PalmID-Signature": "mock-signature",
      },
      body: JSON.stringify(webhookPayload),
    });

    const data: unknown = await response.json();

    if (!response.ok) {
      return NextResponse.json(data, { status: response.status });
    }

    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json(
      { error: "API unavailable", detail: err instanceof Error ? err.message : "Unknown" },
      { status: 503 },
    );
  }
}
