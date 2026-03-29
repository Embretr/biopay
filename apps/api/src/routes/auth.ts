import { FastifyPluginAsync } from "fastify";
import { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import { createId } from "@paralleldrive/cuid2";
import { randomBytes, createHash } from "crypto";
import { prisma } from "@biopay/db";
import { issueTokenPair, verifyRefreshToken } from "@biopay/auth";
import { getBankIDProvider, MockBankIDProvider } from "../providers/bankid/factory.js";
import { getMangopayProvider } from "../providers/mangopay/factory.js";
import { env, isMockBankID, isMockMangopay } from "../env.js";
import { requireAuth } from "../middleware/require-auth.js";

const authRoutes: FastifyPluginAsync = async (fastify) => {
  const app = fastify.withTypeProvider<ZodTypeProvider>();

  // ── POST /auth/bankid/initiate ─────────────────────────────────────────────
  app.post(
    "/auth/bankid/initiate",
    {
      schema: {
        body: z.object({
          redirectUri: z.string().url().optional(),
        }),
        response: {
          200: z.object({
            authUrl: z.string(),
            state: z.string(),
          }),
        },
      },
    },
    async (request, reply) => {
      const redirectUri =
        request.body.redirectUri ??
        env.BANKID_REDIRECT_URI ??
        `http://localhost:${env.API_PORT}/auth/bankid/callback`;

      const state = randomBytes(16).toString("hex");
      const codeVerifier = randomBytes(32).toString("base64url");
      const codeChallenge = createHash("sha256")
        .update(codeVerifier)
        .digest("base64url");

      // Store PKCE params in Redis (TTL 10min)
      await fastify.redis.setex(
        `pkce:${state}`,
        600,
        JSON.stringify({ codeVerifier, redirectUri }),
      );

      const provider = getBankIDProvider();
      const authUrl = provider.initiateAuth({ state, codeChallenge, redirectUri });

      return reply.send({ authUrl, state });
    },
  );

  // ── GET /auth/bankid/callback ──────────────────────────────────────────────
  app.get(
    "/auth/bankid/callback",
    {
      schema: {
        querystring: z.object({
          code: z.string(),
          state: z.string(),
        }),
      },
    },
    async (request, reply) => {
      const { code, state } = request.query;

      // Retrieve PKCE params from Redis
      const pkceRaw = await fastify.redis.get(`pkce:${state}`);
      if (!pkceRaw) {
        return reply.status(400).send({ error: "Invalid or expired state" });
      }
      await fastify.redis.del(`pkce:${state}`);
      const { codeVerifier, redirectUri } = JSON.parse(pkceRaw) as {
        codeVerifier: string;
        redirectUri: string;
      };

      const provider = getBankIDProvider();
      const tokens = await provider.handleCallback(code, codeVerifier, redirectUri);
      const userInfo = await provider.getUserInfo(tokens.accessToken);

      // Upsert user
      const user = await prisma.user.upsert({
        where: { bankidSub: userInfo.sub },
        update: {
          email: userInfo.email,
          name: userInfo.name,
          phoneNumber: userInfo.phoneNumber,
        },
        create: {
          bankidSub: userInfo.sub,
          email: userInfo.email,
          name: userInfo.name,
          phoneNumber: userInfo.phoneNumber,
          kycStatus: "VERIFIED",
        },
      });

      // Ensure wallet exists
      const existingWallet = await prisma.wallet.findUnique({ where: { userId: user.id } });
      if (!existingWallet) {
        const mangopayProvider = getMangopayProvider();
        const mgpUser = await mangopayProvider.createUser(user.id, user.email, user.name);
        const mgpWallet = await mangopayProvider.createWallet(mgpUser.id, "NOK");

        await prisma.wallet.create({
          data: {
            userId: user.id,
            mangopayUserId: isMockMangopay ? null : mgpUser.id,
            mangopayWalletId: isMockMangopay ? null : mgpWallet.id,
            currency: "NOK",
          },
        });
      }

      // Create session
      const sessionId = createId();
      const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
      const { accessToken, refreshToken } = await issueTokenPair(
        user.id,
        sessionId,
        env.JWT_SECRET,
        env.JWT_REFRESH_SECRET,
      );

      await prisma.session.create({
        data: {
          id: sessionId,
          userId: user.id,
          refreshToken,
          expiresAt,
        },
      });

      // Redirect to app deep link
      const deepLink = `biopay://auth/callback?accessToken=${encodeURIComponent(accessToken)}&refreshToken=${encodeURIComponent(refreshToken)}`;
      return reply.redirect(deepLink);
    },
  );

  // ── GET /auth/bankid/mock-login (mock mode only) ───────────────────────────
  if (isMockBankID) {
    app.get("/auth/bankid/mock-login", {}, async (request, reply) => {
      const qs = request.query as { state?: string; redirect_uri?: string };
      const state = qs.state ?? "";
      const redirectUri = qs.redirect_uri ?? "";

      // Return a simple HTML form
      return reply.type("text/html").send(`<!DOCTYPE html>
<html lang="nb">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>BioPay — Mock BankID</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      background: #0a0a0f;
      color: #e2e8f0;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .card {
      background: #111118;
      border: 1px solid #1e1e2e;
      border-radius: 12px;
      padding: 2rem;
      width: 100%;
      max-width: 400px;
    }
    .logo {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      margin-bottom: 1.5rem;
    }
    .logo-icon {
      width: 40px;
      height: 40px;
      background: #00e5cc;
      border-radius: 8px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: bold;
      color: #0a0a0f;
      font-size: 18px;
    }
    h1 { font-size: 1.25rem; margin-bottom: 0.25rem; }
    .subtitle { color: #64748b; font-size: 0.875rem; margin-bottom: 1.5rem; }
    .mock-badge {
      background: #f59e0b20;
      color: #f59e0b;
      border: 1px solid #f59e0b30;
      border-radius: 6px;
      padding: 0.5rem 0.75rem;
      font-size: 0.8rem;
      margin-bottom: 1.5rem;
    }
    label { display: block; font-size: 0.875rem; color: #94a3b8; margin-bottom: 0.25rem; }
    input {
      width: 100%;
      padding: 0.625rem 0.75rem;
      background: #0a0a0f;
      border: 1px solid #1e1e2e;
      border-radius: 6px;
      color: #e2e8f0;
      font-size: 1rem;
      margin-bottom: 1rem;
    }
    input:focus { outline: none; border-color: #00e5cc; }
    button {
      width: 100%;
      padding: 0.75rem;
      background: #00e5cc;
      color: #0a0a0f;
      border: none;
      border-radius: 6px;
      font-size: 1rem;
      font-weight: 600;
      cursor: pointer;
    }
    button:hover { background: #00b8a3; }
  </style>
</head>
<body>
  <div class="card">
    <div class="logo">
      <div class="logo-icon">B</div>
      <div>
        <h1>BioPay</h1>
      </div>
    </div>
    <p class="subtitle">Logg inn med BankID</p>
    <div class="mock-badge">⚠️ Mock-modus — ingen ekte BankID-integrasjon</div>
    <form method="POST" action="/auth/bankid/mock-callback">
      <input type="hidden" name="state" value="${state}" />
      <input type="hidden" name="redirect_uri" value="${redirectUri}" />
      <label for="email">E-postadresse</label>
      <input id="email" name="email" type="email" placeholder="ola@example.no" required autofocus />
      <label for="name">Fullt navn</label>
      <input id="name" name="name" type="text" placeholder="Ola Nordmann" required />
      <button type="submit">Logg inn</button>
    </form>
  </div>
</body>
</html>`);
    });

    // ── POST /auth/bankid/mock-callback ──────────────────────────────────────
    app.post("/auth/bankid/mock-callback", {}, async (request, reply) => {
      const body = request.body as { email?: string; name?: string; state?: string; redirect_uri?: string };
      const { email, name, state, redirect_uri } = body;

      if (!email || !name) {
        return reply.status(400).send({ error: "email and name are required" });
      }

      const code = MockBankIDProvider.generateCode(email, name);
      const redirectUri = redirect_uri ?? `http://localhost:${env.API_PORT}/auth/bankid/callback`;

      // Simulate the OAuth callback with the mock code
      return reply.redirect(
        `/auth/bankid/callback?code=${encodeURIComponent(code)}&state=${encodeURIComponent(state ?? "")}`,
      );
    });
  }

  // ── POST /auth/refresh ─────────────────────────────────────────────────────
  app.post(
    "/auth/refresh",
    {
      schema: {
        body: z.object({ refreshToken: z.string() }),
        response: {
          200: z.object({ accessToken: z.string(), refreshToken: z.string() }),
        },
      },
    },
    async (request, reply) => {
      const { refreshToken } = request.body;

      let payload;
      try {
        payload = await verifyRefreshToken(refreshToken, env.JWT_REFRESH_SECRET);
      } catch {
        return reply.status(401).send({ error: "Invalid refresh token" });
      }

      // Find and delete the session (token rotation)
      const session = await prisma.session.findUnique({
        where: { refreshToken },
      });
      if (!session || session.expiresAt < new Date()) {
        return reply.status(401).send({ error: "Session expired or not found" });
      }

      await prisma.session.delete({ where: { id: session.id } });

      // Issue new token pair with new session
      const newSessionId = createId();
      const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
      const newTokens = await issueTokenPair(
        payload.sub,
        newSessionId,
        env.JWT_SECRET,
        env.JWT_REFRESH_SECRET,
      );

      await prisma.session.create({
        data: {
          id: newSessionId,
          userId: payload.sub,
          refreshToken: newTokens.refreshToken,
          expiresAt,
        },
      });

      return reply.send(newTokens);
    },
  );

  // ── DELETE /auth/logout ────────────────────────────────────────────────────
  app.delete(
    "/auth/logout",
    { preHandler: [requireAuth] },
    async (request, reply) => {
      // Delete all sessions for this user
      await prisma.session.deleteMany({ where: { userId: request.userId } });
      return reply.status(204).send();
    },
  );
};

export default authRoutes;
