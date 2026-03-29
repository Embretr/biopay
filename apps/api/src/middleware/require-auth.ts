import { FastifyRequest, FastifyReply } from "fastify";
import { verifyAccessToken } from "@biopay/auth";
import { env } from "../env.js";

declare module "fastify" {
  interface FastifyRequest {
    userId: string;
  }
}

export async function requireAuth(request: FastifyRequest, reply: FastifyReply) {
  const authHeader = request.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    return reply.status(401).send({ error: "Unauthorized", message: "Missing bearer token" });
  }

  const token = authHeader.slice(7);
  try {
    const payload = await verifyAccessToken(token, env.JWT_SECRET);
    request.userId = payload.sub;
  } catch {
    return reply.status(401).send({ error: "Unauthorized", message: "Invalid or expired token" });
  }
}
