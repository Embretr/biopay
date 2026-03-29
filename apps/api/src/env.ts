import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

export const env = createEnv({
  server: {
    // ── Infrastructure ──────────────────────────────────────────────────────
    DATABASE_URL: z.string().url(),
    REDIS_URL: z.string().url().default("redis://localhost:6379"),
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),

    // ── Server ──────────────────────────────────────────────────────────────
    API_PORT: z.coerce.number().default(3001),
    API_HOST: z.string().default("0.0.0.0"),
    CORS_ORIGINS: z.string().default("http://localhost:3000"),

    // ── JWT ─────────────────────────────────────────────────────────────────
    JWT_SECRET: z.string().min(32),
    JWT_REFRESH_SECRET: z.string().min(32),

    // ── BankID via Idura (optional — mock mode if absent) ───────────────────
    BANKID_CLIENT_ID: z.string().optional(),
    BANKID_CLIENT_SECRET: z.string().optional(),
    BANKID_ISSUER: z.string().url().optional(),
    BANKID_REDIRECT_URI: z.string().url().optional(),

    // ── PalmID SaaS (optional — mock mode if absent) ────────────────────────
    PALMID_API_KEY: z.string().optional(),
    PALMID_API_BASE_URL: z.string().url().optional(),
    PALMID_WEBHOOK_SECRET: z.string().optional(),

    // ── Mangopay (optional — mock mode if absent) ────────────────────────────
    MANGOPAY_CLIENT_ID: z.string().optional(),
    MANGOPAY_API_KEY: z.string().optional(),
    MANGOPAY_BASE_URL: z.string().url().optional(),
    MANGOPAY_PLATFORM_WALLET_ID: z.string().optional(),

    // ── Expo Push Notifications (optional) ───────────────────────────────────
    EXPO_ACCESS_TOKEN: z.string().optional(),
  },
  runtimeEnv: process.env,
});

// Convenience flags
export const isMockBankID = !env.BANKID_CLIENT_ID;
export const isMockPalmID = !env.PALMID_API_KEY;
export const isMockMangopay = !env.MANGOPAY_CLIENT_ID;
