import { FastifyPluginAsync } from "fastify";
import { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import { prisma } from "@biopay/db";
import { requireAuth } from "../middleware/require-auth.js";

const usersRoutes: FastifyPluginAsync = async (fastify) => {
  const app = fastify.withTypeProvider<ZodTypeProvider>();

  // ── GET /users/me ──────────────────────────────────────────────────────────
  app.get(
    "/me",
    { preHandler: [requireAuth] },
    async (request, reply) => {
      const user = await prisma.user.findUniqueOrThrow({
        where: { id: request.userId },
        include: { wallet: true },
      });

      return reply.send({
        id: user.id,
        email: user.email,
        name: user.name,
        phoneNumber: user.phoneNumber,
        kycStatus: user.kycStatus,
        createdAt: user.createdAt,
        wallet: user.wallet
          ? {
              id: user.wallet.id,
              balanceCents: user.wallet.balanceCents,
              currency: user.wallet.currency,
            }
          : null,
      });
    },
  );

  // ── PATCH /users/me/push-token ─────────────────────────────────────────────
  app.patch(
    "/me/push-token",
    {
      preHandler: [requireAuth],
      schema: {
        body: z.object({
          token: z.string(),
          platform: z.enum(["ios", "android"]),
        }),
      },
    },
    async (request, reply) => {
      const { token, platform } = request.body;

      await prisma.pushToken.upsert({
        where: { token },
        update: { userId: request.userId, platform },
        create: { userId: request.userId, token, platform },
      });

      return reply.status(204).send();
    },
  );

  // ── GET /users/search?q= ──────────────────────────────────────────────────
  app.get(
    "/search",
    {
      preHandler: [requireAuth],
      schema: {
        querystring: z.object({ q: z.string().min(1).max(100) }),
      },
    },
    async (request, reply) => {
      const { q } = request.query;

      const users = await prisma.user.findMany({
        where: {
          id: { not: request.userId },
          name: { contains: q, mode: "insensitive" },
        },
        take: 20,
        select: { id: true, name: true, email: true },
      });

      return reply.send(
        users.map((u) => {
          const [local, domain] = u.email.split("@");
          const masked = local.slice(0, 2) + "***@" + domain;
          return { id: u.id, name: u.name, maskedEmail: masked };
        }),
      );
    },
  );

  // ── GET /users/enrolled — for terminal simulator ───────────────────────────
  // Returns users who have an active palm enrollment (for terminal simulator)
  app.get("/enrolled", async (_request, reply) => {
    const enrollments = await prisma.palmEnrollment.findMany({
      where: { status: "ACTIVE" },
      include: { user: { include: { wallet: true } } },
    });

    return reply.send(
      enrollments.map((e) => ({
        palmId: e.palmId,
        userId: e.userId,
        name: e.user.name,
        email: e.user.email,
        balanceCents: e.user.wallet?.balanceCents ?? 0,
        currency: e.user.wallet?.currency ?? "NOK",
      })),
    );
  });
};

export default usersRoutes;
