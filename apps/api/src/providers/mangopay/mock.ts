import { prisma } from "@biopay/db";
import { createId } from "@paralleldrive/cuid2";
import type {
  MangopayProvider,
  MangopayUser,
  MangopayWallet,
  MangopayPayIn,
  MangopayPayOut,
  MangopayTransfer,
} from "./types.js";

/**
 * Mock Mangopay provider for development.
 *
 * All money movement happens in PostgreSQL — no external calls.
 * wallet.balance_cents is the single source of truth in mock mode.
 *
 * In real mode, balance_cents is a cache synchronized by Mangopay webhooks.
 */
export class MockMangopayProvider implements MangopayProvider {
  async createUser(userId: string, _email: string, _name: string): Promise<MangopayUser> {
    return { id: `mock_mgp_user_${userId}` };
  }

  async createWallet(_mangopayUserId: string, currency: string): Promise<MangopayWallet> {
    return {
      id: `mock_mgp_wallet_${createId()}`,
      balanceCents: 0,
      currency,
    };
  }

  async createPayIn(
    walletId: string,
    amountCents: number,
    currency: string,
    idempotencyKey: string,
  ): Promise<MangopayPayIn> {
    // In mock mode: immediately update the wallet balance in DB
    // The caller (wallet route) creates the Transaction record
    await prisma.wallet.update({
      where: { id: walletId },
      data: { balanceCents: { increment: amountCents } },
    });

    return {
      id: `mock_payin_${idempotencyKey}`,
      status: "SUCCEEDED",
    };
  }

  async createPayOut(
    walletId: string,
    _bankAccountIban: string,
    amountCents: number,
    currency: string,
    idempotencyKey: string,
  ): Promise<MangopayPayOut> {
    // Validate sufficient balance
    const wallet = await prisma.wallet.findUniqueOrThrow({ where: { id: walletId } });
    if (wallet.balanceCents < amountCents) {
      throw new Error(`Insufficient balance: ${wallet.balanceCents} < ${amountCents}`);
    }

    await prisma.wallet.update({
      where: { id: walletId },
      data: { balanceCents: { decrement: amountCents } },
    });

    return {
      id: `mock_payout_${idempotencyKey}`,
      status: "SUCCEEDED",
    };
  }

  async transfer(
    fromWalletId: string,
    _toWalletId: string,
    amountCents: number,
    _currency: string,
    idempotencyKey: string,
  ): Promise<MangopayTransfer> {
    // In mock mode: only deduct from user wallet (no merchant wallet to credit)
    // Balance validation happens in the webhook route before calling transfer()
    await prisma.wallet.update({
      where: { id: fromWalletId },
      data: { balanceCents: { decrement: amountCents } },
    });

    return {
      id: `mock_transfer_${idempotencyKey}`,
      status: "SUCCEEDED",
    };
  }

  async getWalletBalance(walletId: string): Promise<MangopayWallet> {
    const wallet = await prisma.wallet.findUniqueOrThrow({ where: { id: walletId } });
    return {
      id: wallet.id,
      balanceCents: wallet.balanceCents,
      currency: wallet.currency,
    };
  }
}
