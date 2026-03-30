import { FastifyPluginAsync } from "fastify";
import { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import { prisma } from "@biopay/db";
import { requireAuth } from "../middleware/require-auth.js";

const bankAccountRoutes: FastifyPluginAsync = async (fastify) => {
  const app = fastify.withTypeProvider<ZodTypeProvider>();

  // ── GET /bank-accounts ────────────────────────────────────────────────────
  app.get(
    "/",
    { preHandler: [requireAuth] },
    async (request, reply) => {
      const accounts = await prisma.bankAccount.findMany({
        where: { userId: request.userId },
        orderBy: { createdAt: "desc" },
      });
      return reply.send(accounts.map((a) => ({
        id: a.id,
        iban: a.iban,
        ownerName: a.ownerName,
        bankName: a.bankName,
        createdAt: a.createdAt,
      })));
    },
  );

  // ── POST /bank-accounts ───────────────────────────────────────────────────
  app.post(
    "/",
    {
      preHandler: [requireAuth],
      schema: {
        body: z.object({
          iban: z.string().min(10).max(34),
          ownerName: z.string().min(1).max(100),
          bankName: z.string().min(1).max(100),
        }),
      },
    },
    async (request, reply) => {
      const { iban, ownerName, bankName } = request.body;

      // Normalise IBAN — strip spaces, uppercase
      const normalisedIban = iban.replace(/\s/g, "").toUpperCase();

      const existing = await prisma.bankAccount.findFirst({
        where: { userId: request.userId, iban: normalisedIban },
      });
      if (existing) {
        return reply.status(409).send({ error: "This bank account is already connected" });
      }

      const account = await prisma.bankAccount.create({
        data: {
          userId: request.userId,
          iban: normalisedIban,
          ownerName,
          bankName,
        },
      });

      return reply.status(201).send({
        id: account.id,
        iban: account.iban,
        ownerName: account.ownerName,
        bankName: account.bankName,
        createdAt: account.createdAt,
      });
    },
  );

  // ── DELETE /bank-accounts/:id ─────────────────────────────────────────────
  app.delete(
    "/:id",
    { preHandler: [requireAuth] },
    async (request, reply) => {
      const { id } = request.params as { id: string };

      const account = await prisma.bankAccount.findUnique({ where: { id } });
      if (!account || account.userId !== request.userId) {
        return reply.status(404).send({ error: "Bank account not found" });
      }

      await prisma.bankAccount.delete({ where: { id } });
      return reply.status(204).send();
    },
  );
};

export default bankAccountRoutes;
