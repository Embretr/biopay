import { FastifyPluginAsync } from "fastify";
import { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import { prisma } from "@biopay/db";
import { getMangopayProvider } from "../providers/mangopay/factory.js";
import { requireAuth } from "../middleware/require-auth.js";
import { idempotencyCheck, cacheIdempotencyResponse } from "../middleware/idempotency.js";
import type { FastifyRequest } from "fastify";

const walletRoutes: FastifyPluginAsync = async (fastify) => {
  const app = fastify.withTypeProvider<ZodTypeProvider>();

  // ── GET /wallet ────────────────────────────────────────────────────────────
  app.get(
    "/",
    { preHandler: [requireAuth] },
    async (request, reply) => {
      const wallet = await prisma.wallet.findUnique({
        where: { userId: request.userId },
      });

      if (!wallet) {
        return reply.status(404).send({ error: "Wallet not found" });
      }

      return reply.send({
        id: wallet.id,
        balanceCents: wallet.balanceCents,
        currency: wallet.currency,
        updatedAt: wallet.updatedAt,
      });
    },
  );

  // ── POST /wallet/deposit ───────────────────────────────────────────────────
  app.post(
    "/deposit",
    {
      preHandler: [requireAuth, idempotencyCheck],
      schema: {
        body: z.object({
          amountCents: z.number().int().positive().max(1_000_000),
          currency: z.enum(["NOK", "EUR"]).default("NOK"),
        }),
      },
    },
    async (request, reply) => {
      const { amountCents, currency } = request.body;
      const req = request as FastifyRequest & { idempotencyKey: string };

      const wallet = await prisma.wallet.findUnique({ where: { userId: request.userId } });
      if (!wallet) {
        return reply.status(404).send({ error: "Wallet not found" });
      }

      const provider = getMangopayProvider();
      const payIn = await provider.createPayIn(
        wallet.mangopayWalletId ?? wallet.id,
        amountCents,
        currency,
        req.idempotencyKey,
      );

      // Create transaction record
      const transaction = await prisma.transaction.create({
        data: {
          walletId: wallet.id,
          amountCents,
          currency,
          type: "DEPOSIT",
          status: payIn.status === "SUCCEEDED" ? "COMPLETED" : "PENDING",
          idempotencyKey: req.idempotencyKey,
          mangopayTxId: payIn.id,
          metadata: { payInId: payIn.id },
        },
      });

      // In mock mode, balance is already updated by mock provider.
      // In real mode, wallet balance is updated via Mangopay webhook.

      const responseBody = {
        transaction: {
          id: transaction.id,
          amountCents: transaction.amountCents,
          currency: transaction.currency,
          status: transaction.status,
          createdAt: transaction.createdAt,
        },
        redirectUrl: payIn.redirectUrl ?? null,
      };

      await cacheIdempotencyResponse(request, 200, responseBody);
      return reply.send(responseBody);
    },
  );

  // ── POST /wallet/withdraw ──────────────────────────────────────────────────
  app.post(
    "/withdraw",
    {
      preHandler: [requireAuth, idempotencyCheck],
      schema: {
        body: z.object({
          amountCents: z.number().int().positive().max(1_000_000),
          currency: z.enum(["NOK", "EUR"]).default("NOK"),
          bankAccountIban: z.string().min(10),
        }),
      },
    },
    async (request, reply) => {
      const { amountCents, currency, bankAccountIban } = request.body;
      const req = request as FastifyRequest & { idempotencyKey: string };

      const wallet = await prisma.wallet.findUnique({ where: { userId: request.userId } });
      if (!wallet) {
        return reply.status(404).send({ error: "Wallet not found" });
      }

      if (wallet.balanceCents < amountCents) {
        return reply.status(402).send({
          error: "Insufficient funds",
          message: `Balance (${wallet.balanceCents} øre) is less than requested amount (${amountCents} øre)`,
        });
      }

      const provider = getMangopayProvider();
      const payOut = await provider.createPayOut(
        wallet.mangopayWalletId ?? wallet.id,
        bankAccountIban,
        amountCents,
        currency,
        req.idempotencyKey,
      );

      const transaction = await prisma.transaction.create({
        data: {
          walletId: wallet.id,
          amountCents,
          currency,
          type: "WITHDRAWAL",
          status: payOut.status === "SUCCEEDED" ? "COMPLETED" : "PENDING",
          idempotencyKey: req.idempotencyKey,
          mangopayTxId: payOut.id,
          metadata: { payOutId: payOut.id, bankAccountIban },
        },
      });

      const responseBody = {
        transaction: {
          id: transaction.id,
          amountCents: transaction.amountCents,
          currency: transaction.currency,
          status: transaction.status,
          createdAt: transaction.createdAt,
        },
      };

      await cacheIdempotencyResponse(request, 200, responseBody);
      return reply.send(responseBody);
    },
  );

  // ── POST /wallet/transfer ──────────────────────────────────────────────────
  app.post(
    "/transfer",
    {
      preHandler: [requireAuth, idempotencyCheck],
      schema: {
        body: z.object({
          recipientEmail: z.string().email(),
          amountCents: z.number().int().positive().max(1_000_000),
        }),
        response: {
          200: z.object({
            transaction: z.object({
              id: z.string(),
              amountCents: z.number(),
              currency: z.string(),
              status: z.string(),
              createdAt: z.date(),
            }),
          }),
          400: z.object({ error: z.string() }),
          402: z.object({ error: z.string() }),
          404: z.object({ error: z.string() }),
        },
      },
    },
    async (request, reply) => {
      const { recipientEmail, amountCents } = request.body;
      const req = request as FastifyRequest & { idempotencyKey: string };

      if (request.userId === undefined) {
        return reply.status(400).send({ error: "Not authenticated" });
      }

      // Find sender wallet
      const senderWallet = await prisma.wallet.findUnique({ where: { userId: request.userId } });
      if (!senderWallet) {
        return reply.status(404).send({ error: "Sender wallet not found" });
      }

      if (senderWallet.balanceCents < amountCents) {
        return reply.status(402).send({ error: "Insufficient funds" });
      }

      // Find recipient by email
      const recipient = await prisma.user.findUnique({
        where: { email: recipientEmail },
        include: { wallet: true },
      });
      if (!recipient || !recipient.wallet) {
        return reply.status(404).send({ error: "Recipient not found" });
      }

      if (recipient.id === request.userId) {
        return reply.status(400).send({ error: "Cannot transfer to yourself" });
      }

      const result = await execTransfer({
        idempotencyKey: req.idempotencyKey,
        senderId: request.userId,
        senderWallet,
        recipientId: recipient.id,
        recipientWalletId: recipient.wallet.id,
        amountCents,
        meta: { recipientEmail, direction: "outbound" },
      });

      await cacheIdempotencyResponse(request, 200, result);
      return reply.send(result);
    },
  );

  // ── POST /wallet/transfer-by-id ────────────────────────────────────────────
  app.post(
    "/transfer-by-id",
    {
      preHandler: [requireAuth, idempotencyCheck],
      schema: {
        body: z.object({
          recipientId: z.string(),
          amountCents: z.number().int().positive().max(1_000_000),
        }),
      },
    },
    async (request, reply) => {
      const { recipientId, amountCents } = request.body;
      const req = request as FastifyRequest & { idempotencyKey: string };

      const senderWallet = await prisma.wallet.findUnique({ where: { userId: request.userId } });
      if (!senderWallet) return reply.status(404).send({ error: "Sender wallet not found" });
      if (senderWallet.balanceCents < amountCents) return reply.status(402).send({ error: "Insufficient funds" });
      if (recipientId === request.userId) return reply.status(400).send({ error: "Cannot transfer to yourself" });

      const recipient = await prisma.user.findUnique({
        where: { id: recipientId },
        include: { wallet: true },
      });
      if (!recipient || !recipient.wallet) return reply.status(404).send({ error: "Recipient not found" });

      const result = await execTransfer({
        idempotencyKey: req.idempotencyKey,
        senderId: request.userId,
        senderWallet,
        recipientId: recipient.id,
        recipientWalletId: recipient.wallet.id,
        amountCents,
        meta: { recipientId, direction: "outbound" },
      });

      await cacheIdempotencyResponse(request, 200, result);
      return reply.send(result);
    },
  );
};

async function execTransfer({
  idempotencyKey,
  senderId,
  senderWallet,
  recipientId,
  recipientWalletId,
  amountCents,
  meta,
}: {
  idempotencyKey: string;
  senderId: string;
  senderWallet: { id: string; currency: string };
  recipientId: string;
  recipientWalletId: string;
  amountCents: number;
  meta: Record<string, unknown>;
}) {
  const [transaction] = await prisma.$transaction([
    prisma.transaction.create({
      data: {
        walletId: senderWallet.id,
        amountCents,
        currency: senderWallet.currency as "NOK" | "EUR",
        type: "TRANSFER",
        status: "COMPLETED",
        idempotencyKey,
        metadata: { ...meta, direction: "outbound" },
      },
    }),
    prisma.transaction.create({
      data: {
        walletId: recipientWalletId,
        amountCents,
        currency: senderWallet.currency as "NOK" | "EUR",
        type: "TRANSFER",
        status: "COMPLETED",
        idempotencyKey: `${idempotencyKey}:in`,
        metadata: { senderId, direction: "inbound" },
      },
    }),
    prisma.wallet.update({
      where: { id: senderWallet.id },
      data: { balanceCents: { decrement: amountCents } },
    }),
    prisma.wallet.update({
      where: { id: recipientWalletId },
      data: { balanceCents: { increment: amountCents } },
    }),
  ]);

  return {
    transaction: {
      id: transaction.id,
      amountCents: transaction.amountCents,
      currency: transaction.currency,
      status: transaction.status,
      createdAt: transaction.createdAt,
    },
  };
}

export default walletRoutes;
