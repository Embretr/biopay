export interface MangopayUser {
  id: string;
}

export interface MangopayWallet {
  id: string;
  balanceCents: number;
  currency: string;
}

export interface MangopayPayIn {
  id: string;
  status: "CREATED" | "SUCCEEDED" | "FAILED";
  redirectUrl?: string;
}

export interface MangopayPayOut {
  id: string;
  status: "CREATED" | "SUCCEEDED" | "FAILED";
}

export interface MangopayTransfer {
  id: string;
  status: "CREATED" | "SUCCEEDED" | "FAILED";
}

export interface MangopayProvider {
  createUser(userId: string, email: string, name: string): Promise<MangopayUser>;
  createWallet(mangopayUserId: string, currency: string): Promise<MangopayWallet>;
  createPayIn(
    walletId: string,
    amountCents: number,
    currency: string,
    idempotencyKey: string,
  ): Promise<MangopayPayIn>;
  createPayOut(
    walletId: string,
    bankAccountIban: string,
    amountCents: number,
    currency: string,
    idempotencyKey: string,
  ): Promise<MangopayPayOut>;
  transfer(
    fromWalletId: string,
    toWalletId: string,
    amountCents: number,
    currency: string,
    idempotencyKey: string,
  ): Promise<MangopayTransfer>;
  getWalletBalance(walletId: string): Promise<MangopayWallet>;
}
