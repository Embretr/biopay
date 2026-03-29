import { FastifyPluginAsync } from "fastify";
import { ZodTypeProvider } from "fastify-type-provider-zod";
import { prisma } from "@biopay/db";
import { getPalmIDProvider } from "../providers/palmid/factory.js";
import { requireAuth } from "../middleware/require-auth.js";

const palmRoutes: FastifyPluginAsync = async (fastify) => {
  const app = fastify.withTypeProvider<ZodTypeProvider>();

  // ── GET /palm ──────────────────────────────────────────────────────────────
  app.get(
    "/",
    { preHandler: [requireAuth] },
    async (request, reply) => {
      const enrollment = await prisma.palmEnrollment.findFirst({
        where: { userId: request.userId, status: "ACTIVE" },
      });

      return reply.send(
        enrollment
          ? {
              palmId: enrollment.palmId,
              status: enrollment.status,
              enrolledAt: enrollment.enrolledAt,
            }
          : null,
      );
    },
  );

  // ── POST /palm/enroll ──────────────────────────────────────────────────────
  app.post(
    "/enroll",
    {
      preHandler: [requireAuth],
    },
    async (request, reply) => {
      // Check for existing active enrollment
      const existing = await prisma.palmEnrollment.findFirst({
        where: { userId: request.userId, status: "ACTIVE" },
      });

      if (existing) {
        return reply.status(409).send({
          error: "Already enrolled",
          message: "You already have an active palm enrollment. Revoke it first.",
        });
      }

      const provider = getPalmIDProvider();
      const { palmId, enrollmentToken } = await provider.enrollPalm(request.userId);

      await prisma.palmEnrollment.create({
        data: {
          userId: request.userId,
          palmId,
          status: "ACTIVE",
        },
      });

      return reply.send({ palmId, enrollmentToken });
    },
  );

  // ── DELETE /palm ───────────────────────────────────────────────────────────
  app.delete(
    "/",
    { preHandler: [requireAuth] },
    async (request, reply) => {
      const enrollment = await prisma.palmEnrollment.findFirst({
        where: { userId: request.userId, status: "ACTIVE" },
      });

      if (!enrollment) {
        return reply.status(404).send({ error: "No active palm enrollment found" });
      }

      const provider = getPalmIDProvider();
      await provider.deletePalm(enrollment.palmId);

      await prisma.palmEnrollment.update({
        where: { id: enrollment.id },
        data: { status: "REVOKED", revokedAt: new Date() },
      });

      return reply.status(204).send();
    },
  );
};

export default palmRoutes;
