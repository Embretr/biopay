import { FastifyPluginAsync } from "fastify";
import { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import { createId } from "@paralleldrive/cuid2";
import { randomBytes, createHash } from "crypto";
import { createRemoteJWKSet, jwtVerify } from "jose";
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
    "/bankid/initiate",
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
    "/bankid/callback",
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
    app.get("/bankid/mock-login", {}, async (request, reply) => {
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
      background: #f8faf9;
      color: #111827;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .card {
      background: #ffffff;
      border: 1px solid #e5e7eb;
      border-radius: 16px;
      padding: 2rem;
      width: 100%;
      max-width: 400px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.06);
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
      background: #1f9850;
      border-radius: 10px;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .logo-icon svg { display: block; }
    h1 { font-size: 1.25rem; font-weight: 700; color: #111827; margin-bottom: 0.25rem; }
    .subtitle { color: #6b7280; font-size: 0.875rem; margin-bottom: 1.5rem; }
    .mock-badge {
      background: #fefce8;
      color: #92400e;
      border: 1px solid #fde68a;
      border-radius: 8px;
      padding: 0.5rem 0.75rem;
      font-size: 0.8rem;
      margin-bottom: 1.5rem;
    }
    label { display: block; font-size: 0.875rem; color: #374151; font-weight: 500; margin-bottom: 0.375rem; }
    input {
      width: 100%;
      padding: 0.625rem 0.75rem;
      background: #ffffff;
      border: 1px solid #d1d5db;
      border-radius: 8px;
      color: #111827;
      font-size: 1rem;
      margin-bottom: 1rem;
    }
    input:focus { outline: none; border-color: #1f9850; box-shadow: 0 0 0 3px rgba(31,152,80,0.1); }
    button {
      width: 100%;
      padding: 0.75rem;
      background: #1f9850;
      color: #ffffff;
      border: none;
      border-radius: 10px;
      font-size: 1rem;
      font-weight: 600;
      cursor: pointer;
    }
    button:hover { background: #187a40; }
  </style>
</head>
<body>
  <div class="card">
    <div class="logo">
      <div class="logo-icon">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <rect x="2" y="7" width="20" height="14" rx="2"/>
          <path d="M16 7V5a2 2 0 0 0-4 0v2"/>
        </svg>
      </div>
      <div>
        <h1>BioPay</h1>
      </div>
    </div>
    <p class="subtitle">Logg inn med BankID</p>
    <div class="mock-badge">Mock-modus — ingen ekte BankID-integrasjon</div>
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
    app.post("/bankid/mock-callback", {}, async (request, reply) => {
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

  // ── POST /auth/bankid/exchange ────────────────────────────────────────────
  // Verifies a Criipto/Idura Verify id_token from @criipto/verify-expo,
  // upserts the user, and returns BioPay access + refresh tokens.
  app.post(
    "/bankid/exchange",
    {
      schema: {
        body: z.object({ idToken: z.string() }),
        response: {
          200: z.object({ accessToken: z.string(), refreshToken: z.string() }),
          400: z.object({ error: z.string() }),
          401: z.object({ error: z.string() }),
        },
      },
    },
    async (request, reply) => {
      if (!env.IDURA_DOMAIN) {
        return reply.status(400).send({ error: "IDURA_DOMAIN is not configured on the server." });
      }

      const { idToken } = request.body;

      // Verify the JWT signature using Criipto's JWKS endpoint
      const JWKS = createRemoteJWKSet(
        new URL(`https://${env.IDURA_DOMAIN}/.well-known/jwks`),
      );

      let claims: Record<string, unknown>;
      try {
        const { payload } = await jwtVerify(idToken, JWKS, {
          issuer: `https://${env.IDURA_DOMAIN}`,
        });
        claims = payload as Record<string, unknown>;
      } catch (err) {
        fastify.log.error(err, "Criipto id_token verification failed");
        return reply.status(401).send({ error: "Invalid or expired ID token" });
      }

      const sub = claims.sub as string;
      if (!sub) return reply.status(401).send({ error: "Missing sub claim" });

      // Norwegian BankID via Criipto provides `name`; email is not guaranteed
      const name = (claims.name as string | undefined) ?? sub;
      const email = (claims.email as string | undefined) ??
        `${sub.replace(/[^a-z0-9]/gi, "").toLowerCase()}@idura.user`;

      // Upsert user
      const user = await prisma.user.upsert({
        where: { bankidSub: sub },
        update: { name, email },
        create: {
          bankidSub: sub,
          name,
          email,
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

      // Issue BioPay token pair
      const sessionId = createId();
      const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
      const { accessToken, refreshToken } = await issueTokenPair(
        user.id,
        sessionId,
        env.JWT_SECRET,
        env.JWT_REFRESH_SECRET,
      );

      await prisma.session.create({
        data: { id: sessionId, userId: user.id, refreshToken, expiresAt },
      });

      return reply.send({ accessToken, refreshToken });
    },
  );

  // ── POST /auth/refresh ─────────────────────────────────────────────────────
  app.post(
    "/refresh",
    {
      schema: {
        body: z.object({ refreshToken: z.string() }),
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
    "/logout",
    { preHandler: [requireAuth] },
    async (request, reply) => {
      // Delete all sessions for this user
      await prisma.session.deleteMany({ where: { userId: request.userId } });
      return reply.status(204).send();
    },
  );
};

export default authRoutes;
