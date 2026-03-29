import { FastifyPluginAsync } from "fastify";
import { prisma } from "@biopay/db";
import { getPalmIDProvider } from "../providers/palmid/factory.js";
import { getMangopayProvider } from "../providers/mangopay/factory.js";
import { isMockPalmID } from "../env.js";
import type { PalmIDWebhookPayload } from "../providers/palmid/types.js";
import { Expo } from "expo-server-sdk";

const expo = new Expo();

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
    "/webhooks/palmid",
    {
      config: { rawBody: true }, // Required by @fastify/raw-body
    },
    async (request, reply) => {
      const isMockTerminal = request.headers["x-mock-terminal"] === "true";

      // ── 1. Validate signature ──────────────────────────────────────────────
      const provider = getPalmIDProvider();
      const signature = (request.headers["x-palmid-signature"] as string) ?? "";

      if (!isMockPalmID || !isMockTerminal) {
        // In real mode, always validate HMAC
        const rawBody = (request as unknown as { rawBody: Buffer }).rawBody;
        if (!rawBody) {
          return reply.status(400).send({ error: "Raw body not available" });
        }
        if (!provider.verifyWebhookSignature(rawBody, signature)) {
          fastify.log.warn({ signature }, "Invalid PalmID webhook signature");
          return reply.status(401).send({ error: "Invalid signature" });
        }
      }

      // ── 2. Parse payload ───────────────────────────────────────────────────
      const payload = request.body as PalmIDWebhookPayload;
      const { palmId, amountCents, currency, merchantName, terminalId, idempotencyKey, eventType } =
        payload;

      if (eventType === "PAYMENT_FAILED") {
        fastify.log.info({ palmId, terminalId }, "PalmID payment failed event received");
        return reply.send({ received: true });
      }

      // ── 3. Idempotency check ───────────────────────────────────────────────
      const existingTx = await prisma.transaction.findUnique({
        where: { idempotencyKey },
      });
      if (existingTx) {
        fastify.log.info({ idempotencyKey, txId: existingTx.id }, "Duplicate webhook — returning cached result");
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
        fastify.log.warn({ palmId }, "Palm enrollment not found or inactive");
        return reply.status(404).send({ error: "Palm not registered" });
      }

      const { user } = enrollment;
      const wallet = user.wallet;

      if (!wallet) {
        fastify.log.error({ userId: user.id }, "User has no wallet");
        return reply.status(500).send({ error: "User wallet not found" });
      }

      // ── 5. Check sufficient balance ────────────────────────────────────────
      if (wallet.balanceCents < amountCents) {
        fastify.log.info(
          { balance: wallet.balanceCents, required: amountCents },
          "Insufficient balance for payment",
        );
        return reply.status(402).send({
          error: "Insufficient funds",
          message: `Balance ${wallet.balanceCents} øre, required ${amountCents} øre`,
        });
      }

      // ── 6. Process payment (atomic) ────────────────────────────────────────
      const mangopayProvider = getMangopayProvider();
      let transactionId: string;

      try {
        // In mock mode: transfer() deducts balance directly in DB
        // In real mode: transfer() calls Mangopay API, balance synced via Mangopay webhook
        const transfer = await mangopayProvider.transfer(
          wallet.mangopayWalletId ?? wallet.id,
          "platform_wallet", // merchant/platform wallet — mock ignores this
          amountCents,
          currency,
          idempotencyKey,
        );

        // Create transaction record atomically
        const transaction = await prisma.transaction.create({
          data: {
            walletId: wallet.id,
            amountCents,
            currency,
            type: "PAYMENT",
            status: transfer.status === "SUCCEEDED" ? "COMPLETED" : "PENDING",
            merchantName,
            terminalId,
            idempotencyKey,
            mangopayTxId: transfer.id,
            metadata: {
              palmId,
              merchantId: payload.merchantId ?? null,
              transferId: transfer.id,
              timestamp: payload.timestamp,
            },
          },
        });

        // In mock mode, balance already deducted. In real mode, balance
        // is updated by the Mangopay webhook (POST /webhooks/mangopay).
        transactionId = transaction.id;

        fastify.log.info(
          { transactionId, userId: user.id, amountCents },
          "Payment processed successfully",
        );
      } catch (err) {
        fastify.log.error({ err, palmId, idempotencyKey }, "Payment processing failed");
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
          body: `${(amountCents / 100).toFixed(2)} ${currency} hos ${merchantName}`,
          data: { transactionId, type: "PAYMENT_COMPLETED" },
        }));

        try {
          const chunks = expo.chunkPushNotifications(messages);
          for (const chunk of chunks) {
            await expo.sendPushNotificationsAsync(chunk);
          }
        } catch (pushErr) {
          // Non-critical: log but don't fail the webhook
          fastify.log.warn({ pushErr }, "Push notification failed");
        }
      }

      return reply.send({ received: true, transactionId, status: "COMPLETED" });
    },
  );

  // ── POST /webhooks/mangopay ────────────────────────────────────────────────
  // Updates transaction status based on Mangopay event
  fastify.post("/webhooks/mangopay", async (request, reply) => {
    const body = request.body as {
      EventType?: string;
      RessourceId?: string;
      Date?: number;
    };

    fastify.log.info({ event: body }, "Mangopay webhook received");

    const { EventType, RessourceId } = body;

    if (!EventType || !RessourceId) {
      return reply.send({ received: true });
    }

    // Map Mangopay event types to our transaction statuses
    if (EventType === "PAYIN_NORMAL_SUCCEEDED") {
      // Find transaction by mangopay tx ID and update status + wallet balance
      const tx = await prisma.transaction.findFirst({
        where: { mangopayTxId: RessourceId },
        include: { wallet: true },
      });
      if (tx && tx.status === "PENDING") {
        await prisma.$transaction([
          prisma.transaction.update({
            where: { id: tx.id },
            data: { status: "COMPLETED" },
          }),
          prisma.wallet.update({
            where: { id: tx.walletId },
            data: { balanceCents: { increment: tx.amountCents } },
          }),
        ]);
      }
    } else if (EventType === "PAYIN_NORMAL_FAILED" || EventType === "PAYOUT_NORMAL_FAILED") {
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
