import { NextResponse } from "next/server";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

export interface EnrolledUser {
  palmId: string;
  userId: string;
  name: string;
  email: string;
  balanceCents: number;
  currency: string;
}

export async function GET() {
  try {
    const response = await fetch(`${API_URL}/users/enrolled`, {
      cache: "no-store",
      headers: { "Content-Type": "application/json" },
    });

    if (!response.ok) {
      return NextResponse.json({ error: "Failed to fetch enrolled users" }, { status: 500 });
    }

    const users: EnrolledUser[] = await response.json();
    return NextResponse.json(users);
  } catch (err) {
    return NextResponse.json(
      { error: "API unavailable", detail: err instanceof Error ? err.message : "Unknown error" },
      { status: 503 },
    );
  }
}
