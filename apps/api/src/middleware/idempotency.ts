import { FastifyRequest, FastifyReply } from "fastify";

/**
 * Idempotency middleware for payment endpoints.
 * Requires `Idempotency-Key` header on POST requests.
 * Caches responses in Redis for 24h keyed by userId + idempotency key.
 *
 * Usage: add `preHandler: [requireAuth, idempotencyCheck]` to payment routes.
 */
export async function idempotencyCheck(request: FastifyRequest, reply: FastifyReply) {
  const key = request.headers["idempotency-key"] as string | undefined;
  if (!key) {
    return reply
      .status(422)
      .send({ error: "Missing header", message: "Idempotency-Key header is required" });
  }

  if (!/^[0-9a-f-]{36}$/.test(key)) {
    return reply
      .status(422)
      .send({ error: "Invalid header", message: "Idempotency-Key must be a UUID v4" });
  }

  const redisKey = `idempotency:${request.userId}:${key}`;
  const cached = await request.server.redis.get(redisKey);
  if (cached) {
    const parsed = JSON.parse(cached) as { status: number; body: unknown };
    reply.header("X-Idempotency-Replayed", "true");
    return reply.status(parsed.status).send(parsed.body);
  }

  // Store idempotency key reference so route handler can cache its response
  (request as FastifyRequest & { idempotencyKey: string; idempotencyRedisKey: string }).idempotencyKey = key;
  (request as FastifyRequest & { idempotencyKey: string; idempotencyRedisKey: string }).idempotencyRedisKey = redisKey;
}

/** Call this in the route handler after successfully processing to cache the response */
export async function cacheIdempotencyResponse(
  request: FastifyRequest,
  status: number,
  body: unknown,
) {
  const req = request as FastifyRequest & { idempotencyRedisKey?: string };
  if (req.idempotencyRedisKey) {
    await request.server.redis.setex(
      req.idempotencyRedisKey,
      86400, // 24 hours
      JSON.stringify({ status, body }),
    );
  }
}
