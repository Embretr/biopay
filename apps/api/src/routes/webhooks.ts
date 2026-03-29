import type { FastifyPluginAsync } from "fastify";
import type { Currency } from "@biopay/db";
import { prisma } from "@biopay/db";
import { getPalmIDProvider } from "../providers/palmid/factory.js";
import { getMangopayProvider } from "../providers/mangopay/factory.js";
import { isMockPalmID } from "../env.js";
import type { PalmIDWebhookPayload } from "../providers/palmid/types.js";
import { Expo } from "expo-server-sdk";

const expo = new Expo();

// Use console for logging until pino types are sorted in this module
const log = {
  info: (data: unknown, msg?: string) => console.info(msg ?? "", data),
  warn: (data: unknown, msg?: string) => console.warn(msg ?? "", data),
  error: (data: unknown, msg?: string) => console.error(msg ?? "", data),
};

const webhooksRoutes: FastifyPluginAsync = async (fastify) => {
  // ── POST /webhooks/palmid ────────────────────────────────────────────────
  // Critical path: PalmID terminal → BioPay → Mangopay transfer → push notification
  //
  // MUST:
  // 1. Validate HMAC signature (or trust X-Mock-Terminal in mock mode)
  // 2. Respond within 5-10 seconds (terminal timeout)
  // 3. Be idempotent (duplicate webhooks return same result)
  // 4. Be atomic (balance update + transaction in one DB transaction)
  fastify.post(
    "/palmid",
    {
      config: { rawBody: true }, // Required by fastify-raw-body
    },
    async (request, reply) => {
      const isMockTerminal = request.headers["x-mock-terminal"] === "true";

      // ── 1. Validate signature ──────────────────────────────────────────────
      const provider = getPalmIDProvider();
      const signature = (request.headers["x-palmid-signature"] as string | undefined) ?? "";

      if (!isMockPalmID || !isMockTerminal) {
        // In real mode, always validate HMAC
        const rawBody = (request as unknown as { rawBody: Buffer }).rawBody;
        if (!rawBody) {
          return reply.status(400).send({ error: "Raw body not available" });
        }
        if (!provider.verifyWebhookSignature(rawBody, signature)) {
          log.warn({ signature }, "Invalid PalmID webhook signature");
          return reply.status(401).send({ error: "Invalid signature" });
        }
      }

      // ── 2. Parse payload ───────────────────────────────────────────────────
      const payload = request.body as PalmIDWebhookPayload;
      const { palmId, amountCents, currency, merchantName, terminalId, idempotencyKey, eventType } =
        payload;

      if (eventType === "PAYMENT_FAILED") {
        log.info({ palmId, terminalId }, "PalmID payment failed event received");
        return reply.send({ received: true });
      }

      // ── 3. Idempotency check ───────────────────────────────────────────────
      const existingTx = await prisma.transaction.findUnique({
        where: { idempotencyKey },
      });
      if (existingTx) {
        log.info({ idempotencyKey, txId: existingTx.id }, "Duplicate webhook — returning cached result");
        return reply.send({
          received: true,
          transactionId: existingTx.id,
          status: existingTx.status,
          duplicate: true,
        });
      }

      // ── 4. Look up user via palm enrollment ───────────────────────────────
      const enrollment = await prisma.palmEnrollment.findUnique({
        where: { palmId },
        include: {
          user: {
            include: {
              wallet: true,
              pushTokens: true,
            },
          },
        },
      });

      if (!enrollment || enrollment.status !== "ACTIVE") {
        log.warn({ palmId }, "Palm enrollment not found or inactive");
        return reply.status(404).send({ error: "Palm not registered" });
      }

      const { user } = enrollment;
      const wallet = user.wallet;

      if (!wallet) {
        log.error({ userId: user.id }, "User has no wallet");
        return reply.status(500).send({ error: "User wallet not found" });
      }

      // ── 5. Check sufficient balance ────────────────────────────────────────
      if (wallet.balanceCents < amountCents) {
        log.info(
          { balance: wallet.balanceCents, required: amountCents },
          "Insufficient balance for payment",
        );
        return reply.status(402).send({
          error: "Insufficient funds",
          message: `Balance ${wallet.balanceCents} øre, required ${amountCents} øre`,
        });
      }

      // ── 6. Process payment ─────────────────────────────────────────────────
      const mangopayProvider = getMangopayProvider();
      let transactionId: string;

      // Validate currency is a valid enum value
      const txCurrency: Currency =
        currency === "EUR" ? "EUR" : "NOK";

      try {
        const transfer = await mangopayProvider.transfer(
          wallet.mangopayWalletId ?? wallet.id,
          "platform_wallet", // merchant/platform wallet — mock ignores this
          amountCents,
          txCurrency,
          idempotencyKey,
        );

        const transaction = await prisma.transaction.create({
          data: {
            walletId: wallet.id,
            amountCents,
            currency: txCurrency,
            type: "PAYMENT",
            status: transfer.status === "SUCCEEDED" ? "COMPLETED" : "PENDING",
            merchantName,
            terminalId,
            idempotencyKey,
            mangopayTxId: transfer.id,
            metadata: {
              palmId,
              merchantId: (payload as unknown as Record<string, unknown>).merchantId ?? null,
              transferId: transfer.id,
              timestamp: payload.timestamp,
            },
          },
        });

        transactionId = transaction.id;
        log.info({ transactionId, userId: user.id, amountCents }, "Payment processed successfully");
      } catch (err) {
        log.error({ err, palmId, idempotencyKey }, "Payment processing failed");
        return reply.status(500).send({ error: "Payment processing failed" });
      }

      // ── 7. Send push notification ──────────────────────────────────────────
      const pushTokens = user.pushTokens
        .map((pt) => pt.token)
        .filter((t) => Expo.isExpoPushToken(t));

      if (pushTokens.length > 0) {
        const messages = pushTokens.map((token) => ({
          to: token,
          sound: "default" as const,
          title: "Betaling godkjent ✓",
          body: `${(amountCents / 100).toFixed(2)} ${txCurrency} hos ${merchantName}`,
          data: { transactionId, type: "PAYMENT_COMPLETED" },
        }));

        try {
          const chunks = expo.chunkPushNotifications(messages);
          for (const chunk of chunks) {
            await expo.sendPushNotificationsAsync(chunk);
          }
        } catch (pushErr) {
          log.warn({ pushErr }, "Push notification failed");
        }
      }

      return reply.send({ received: true, transactionId, status: "COMPLETED" });
    },
  );

  // ── POST /webhooks/mangopay ────────────────────────────────────────────────
  fastify.post("/mangopay", async (request, reply) => {
    const body = request.body as {
      EventType?: string;
      RessourceId?: string;
      Date?: number;
    };

    log.info({ event: body }, "Mangopay webhook received");

    const { EventType, RessourceId } = body;
    if (!EventType || !RessourceId) return reply.send({ received: true });

    if (EventType === "PAYIN_NORMAL_SUCCEEDED") {
      const tx = await prisma.transaction.findFirst({
        where: { mangopayTxId: RessourceId },
      });
      if (tx && tx.status === "PENDING") {
        await prisma.$transaction([
          prisma.transaction.update({ where: { id: tx.id }, data: { status: "COMPLETED" } }),
          prisma.wallet.update({
            where: { id: tx.walletId },
            data: { balanceCents: { increment: tx.amountCents } },
          }),
        ]);
      }
    } else if (
      EventType === "PAYIN_NORMAL_FAILED" ||
      EventType === "PAYOUT_NORMAL_FAILED"
    ) {
      await prisma.transaction.updateMany({
        where: { mangopayTxId: RessourceId, status: "PENDING" },
        data: { status: "FAILED" },
      });
    } else if (EventType === "PAYOUT_NORMAL_SUCCEEDED") {
      await prisma.transaction.updateMany({
        where: { mangopayTxId: RessourceId, status: "PENDING" },
        data: { status: "COMPLETED" },
      });
    }

    return reply.send({ received: true });
  });
};

export default webhooksRoutes;
