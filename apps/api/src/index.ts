import Fastify from "fastify";
import cors from "@fastify/cors";
import rateLimit from "@fastify/rate-limit";
import rawBody from "fastify-raw-body";
import fp from "fastify-plugin";
import { serializerCompiler, validatorCompiler } from "fastify-type-provider-zod";
import { env } from "./env.js";
import redisPlugin from "./plugins/redis.js";
import authRoutes from "./routes/auth.js";
import usersRoutes from "./routes/users.js";
import palmRoutes from "./routes/palm.js";
import walletRoutes from "./routes/wallet.js";
import transactionsRoutes from "./routes/transactions.js";
import webhooksRoutes from "./routes/webhooks.js";

async function buildApp() {
  const app = Fastify({
    logger: {
      level: env.NODE_ENV === "production" ? "info" : "debug",
      transport:
        env.NODE_ENV !== "production"
          ? {
              target: "pino-pretty",
              options: { colorize: true, translateTime: "SYS:standard", ignore: "pid,hostname" },
            }
          : undefined,
    },
  });

  // ── Zod type provider ──────────────────────────────────────────────────────
  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);

  // ── Raw body (required for HMAC webhook validation) ────────────────────────
  await app.register(rawBody, {
    field: "rawBody",
    global: false,
    encoding: "utf8",
    runFirst: true,
  });

  // ── CORS ───────────────────────────────────────────────────────────────────
  await app.register(cors, {
    origin: env.CORS_ORIGINS.split(",").map((o) => o.trim()),
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "Idempotency-Key", "X-Mock-Terminal"],
    credentials: true,
  });

  // ── Rate limiting ──────────────────────────────────────────────────────────
  await app.register(rateLimit, {
    global: true,
    max: 100,
    timeWindow: "1 minute",
    keyGenerator: (req) => req.headers.authorization?.split(" ")[1]?.slice(0, 8) ?? req.ip,
  });

  // ── Redis plugin ──────────────────────────────────────────────────────────
  await app.register(redisPlugin);

  // ── Health check ──────────────────────────────────────────────────────────
  app.get("/health", async () => ({
    status: "ok",
    timestamp: new Date().toISOString(),
    version: "1.0.0",
    mock: {
      bankid: !env.BANKID_CLIENT_ID,
      palmid: !env.PALMID_API_KEY,
      mangopay: !env.MANGOPAY_CLIENT_ID,
    },
  }));

  // ── Routes ─────────────────────────────────────────────────────────────────
  await app.register(authRoutes, { prefix: "/auth" });
  await app.register(usersRoutes, { prefix: "/users" });
  await app.register(palmRoutes, { prefix: "/palm" });
  await app.register(walletRoutes, { prefix: "/wallet" });
  await app.register(transactionsRoutes, { prefix: "/transactions" });
  await app.register(webhooksRoutes, { prefix: "/webhooks" });

  // ── Global error handler ───────────────────────────────────────────────────
  app.setErrorHandler((error, request, reply) => {
    app.log.error({ err: error, url: request.url }, "Unhandled error");

    if (error.statusCode) {
      return reply.status(error.statusCode).send({
        error: error.message,
        statusCode: error.statusCode,
      });
    }

    // Zod validation errors
    if (error.code === "FST_ERR_VALIDATION") {
      return reply.status(400).send({
        error: "Validation error",
        message: error.message,
      });
    }

    return reply.status(500).send({
      error: "Internal server error",
    });
  });

  return app;
}

async function main() {
  const app = await buildApp();

  try {
    const address = await app.listen({
      port: env.API_PORT,
      host: env.API_HOST,
    });
    app.log.info(`BioPay API running at ${address}`);
    app.log.info(`Mock mode — BankID: ${!env.BANKID_CLIENT_ID}, PalmID: ${!env.PALMID_API_KEY}, Mangopay: ${!env.MANGOPAY_CLIENT_ID}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

main();

export { buildApp };
