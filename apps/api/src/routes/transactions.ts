import { FastifyPluginAsync } from "fastify";
import { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import { prisma } from "@biopay/db";
import { requireAuth } from "../middleware/require-auth.js";

const transactionsRoutes: FastifyPluginAsync = async (fastify) => {
  const app = fastify.withTypeProvider<ZodTypeProvider>();

  // ── GET /transactions ──────────────────────────────────────────────────────
  app.get(
    "/",
    {
      preHandler: [requireAuth],
      schema: {
        querystring: z.object({
          page: z.coerce.number().int().positive().default(1),
          limit: z.coerce.number().int().positive().max(100).default(20),
          type: z.enum(["DEPOSIT", "WITHDRAWAL", "PAYMENT", "TRANSFER"]).optional(),
          status: z.enum(["PENDING", "COMPLETED", "FAILED", "REFUNDED"]).optional(),
        }),
      },
    },
    async (request, reply) => {
      const { page, limit, type, status } = request.query;

      const wallet = await prisma.wallet.findUnique({ where: { userId: request.userId } });
      if (!wallet) {
        return reply.send({ data: [], total: 0, page, limit });
      }

      const where = {
        walletId: wallet.id,
        ...(type ? { type } : {}),
        ...(status ? { status } : {}),
      };

      const [transactions, total] = await Promise.all([
        prisma.transaction.findMany({
          where,
          orderBy: { createdAt: "desc" },
          skip: (page - 1) * limit,
          take: limit,
        }),
        prisma.transaction.count({ where }),
      ]);

      return reply.send({
        data: transactions.map((t) => ({
          id: t.id,
          amountCents: t.amountCents,
          currency: t.currency,
          type: t.type,
          status: t.status,
          merchantName: t.merchantName,
          terminalId: t.terminalId,
          createdAt: t.createdAt,
        })),
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      });
    },
  );

  // ── GET /transactions/:id ──────────────────────────────────────────────────
  app.get(
    "/:id",
    {
      preHandler: [requireAuth],
      schema: {
        params: z.object({ id: z.string() }),
      },
    },
    async (request, reply) => {
      const wallet = await prisma.wallet.findUnique({ where: { userId: request.userId } });
      if (!wallet) {
        return reply.status(404).send({ error: "Transaction not found" });
      }

      const transaction = await prisma.transaction.findFirst({
        where: { id: request.params.id, walletId: wallet.id },
      });

      if (!transaction) {
        return reply.status(404).send({ error: "Transaction not found" });
      }

      return reply.send({
        id: transaction.id,
        amountCents: transaction.amountCents,
        currency: transaction.currency,
        type: transaction.type,
        status: transaction.status,
        merchantName: transaction.merchantName,
        terminalId: transaction.terminalId,
        idempotencyKey: transaction.idempotencyKey,
        metadata: transaction.metadata,
        createdAt: transaction.createdAt,
        updatedAt: transaction.updatedAt,
      });
    },
  );
};

export default transactionsRoutes;
