import type {
  MangopayProvider,
  MangopayUser,
  MangopayWallet,
  MangopayPayIn,
  MangopayPayOut,
  MangopayTransfer,
} from "./types.js";

/**
 * Real Mangopay provider.
 * Uses Mangopay REST API (v2.01).
 *
 * Requires Mangopay onboarding and compliance approval (1–3 weeks).
 * Sandbox available immediately at: https://hub.mangopay.com
 */
export class RealMangopayProvider implements MangopayProvider {
  private clientId: string;
  private apiKey: string;
  private baseUrl: string;
  private platformWalletId: string;

  constructor(clientId: string, apiKey: string, baseUrl: string, platformWalletId: string) {
    this.clientId = clientId;
    this.apiKey = apiKey;
    this.baseUrl = baseUrl;
    this.platformWalletId = platformWalletId;
  }

  private get authHeader(): string {
    const credentials = Buffer.from(`${this.clientId}:${this.apiKey}`).toString("base64");
    return `Basic ${credentials}`;
  }

  private async request<T>(path: string, options?: RequestInit): Promise<T> {
    const response = await fetch(`${this.baseUrl}/v2.01/${this.clientId}${path}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        Authorization: this.authHeader,
        ...options?.headers,
      },
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Mangopay API error: ${response.status} ${body}`);
    }

    return response.json() as Promise<T>;
  }

  async createUser(userId: string, email: string, name: string): Promise<MangopayUser> {
    const [firstName, ...rest] = name.split(" ");
    const lastName = rest.join(" ") || firstName ?? "User";

    const user = await this.request<{ Id: string }>("/users/natural", {
      method: "POST",
      body: JSON.stringify({
        Tag: userId,
        Email: email,
        FirstName: firstName ?? "User",
        LastName: lastName,
        Birthday: 0,
        Nationality: "NO",
        CountryOfResidence: "NO",
      }),
    });
    return { id: user.Id };
  }

  async createWallet(mangopayUserId: string, currency: string): Promise<MangopayWallet> {
    const wallet = await this.request<{ Id: string; Balance: { Amount: number; Currency: string } }>(
      "/wallets",
      {
        method: "POST",
        body: JSON.stringify({
          Owners: [mangopayUserId],
          Description: "BioPay Wallet",
          Currency: currency,
        }),
      },
    );
    return {
      id: wallet.Id,
      balanceCents: wallet.Balance.Amount,
      currency: wallet.Balance.Currency,
    };
  }

  async createPayIn(
    walletId: string,
    amountCents: number,
    currency: string,
    idempotencyKey: string,
  ): Promise<MangopayPayIn> {
    const result = await this.request<{
      Id: string;
      Status: string;
      RedirectURL?: string;
    }>("/payins/card/web", {
      method: "POST",
      headers: { "Idempotency-Key": idempotencyKey },
      body: JSON.stringify({
        CreditedWalletId: walletId,
        DebitedFunds: { Currency: currency, Amount: amountCents },
        Fees: { Currency: currency, Amount: 0 },
        ReturnURL: process.env["NEXT_PUBLIC_API_URL"] + "/wallet/deposit/success",
        CardType: "CB_VISA_MASTERCARD",
        Culture: "NO",
      }),
    });

    return {
      id: result.Id,
      status: result.Status === "SUCCEEDED" ? "SUCCEEDED" : "CREATED",
      redirectUrl: result.RedirectURL,
    };
  }

  async createPayOut(
    walletId: string,
    bankAccountIban: string,
    amountCents: number,
    currency: string,
    idempotencyKey: string,
  ): Promise<MangopayPayOut> {
    const result = await this.request<{ Id: string; Status: string }>("/payouts/bankwire", {
      method: "POST",
      headers: { "Idempotency-Key": idempotencyKey },
      body: JSON.stringify({
        DebitedWalletId: walletId,
        DebitedFunds: { Currency: currency, Amount: amountCents },
        Fees: { Currency: currency, Amount: 0 },
        BankAccountId: bankAccountIban,
        BankWireRef: "BioPay withdrawal",
      }),
    });

    return {
      id: result.Id,
      status: result.Status === "SUCCEEDED" ? "SUCCEEDED" : "CREATED",
    };
  }

  async transfer(
    fromWalletId: string,
    toWalletId: string,
    amountCents: number,
    currency: string,
    idempotencyKey: string,
  ): Promise<MangopayTransfer> {
    const result = await this.request<{ Id: string; Status: string }>("/transfers", {
      method: "POST",
      headers: { "Idempotency-Key": idempotencyKey },
      body: JSON.stringify({
        DebitedWalletId: fromWalletId,
        CreditedWalletId: toWalletId,
        DebitedFunds: { Currency: currency, Amount: amountCents },
        Fees: { Currency: currency, Amount: 0 },
      }),
    });

    return {
      id: result.Id,
      status: result.Status === "SUCCEEDED" ? "SUCCEEDED" : "CREATED",
    };
  }

  async getWalletBalance(walletId: string): Promise<MangopayWallet> {
    const wallet = await this.request<{
      Id: string;
      Balance: { Amount: number; Currency: string };
    }>(`/wallets/${walletId}`);

    return {
      id: wallet.Id,
      balanceCents: wallet.Balance.Amount,
      currency: wallet.Balance.Currency,
    };
  }
}
