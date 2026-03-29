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
    "/wallet",
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
    "/wallet/deposit",
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
    "/wallet/withdraw",
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
};

export default walletRoutes;
