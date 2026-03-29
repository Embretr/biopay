import { SignJWT, jwtVerify, type JWTPayload } from "jose";
import type { AccessTokenPayload, RefreshTokenPayload, TokenPair } from "./types.js";

function getSecret(secret: string): Uint8Array {
  return new TextEncoder().encode(secret);
}

export async function signAccessToken(
  userId: string,
  secret: string,
): Promise<string> {
  return new SignJWT({ sub: userId, type: "access" } satisfies AccessTokenPayload & JWTPayload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("15m")
    .sign(getSecret(secret));
}

export async function signRefreshToken(
  userId: string,
  sessionId: string,
  secret: string,
): Promise<string> {
  return new SignJWT({
    sub: userId,
    sessionId,
    type: "refresh",
  } satisfies RefreshTokenPayload & JWTPayload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("30d")
    .sign(getSecret(secret));
}

export async function verifyAccessToken(
  token: string,
  secret: string,
): Promise<AccessTokenPayload> {
  const { payload } = await jwtVerify(token, getSecret(secret));
  if (payload["type"] !== "access" || !payload.sub) {
    throw new Error("Invalid access token");
  }
  return { sub: payload.sub, type: "access" };
}

export async function verifyRefreshToken(
  token: string,
  secret: string,
): Promise<RefreshTokenPayload> {
  const { payload } = await jwtVerify(token, getSecret(secret));
  if (payload["type"] !== "refresh" || !payload.sub || !payload["sessionId"]) {
    throw new Error("Invalid refresh token");
  }
  return {
    sub: payload.sub,
    sessionId: payload["sessionId"] as string,
    type: "refresh",
  };
}

export async function issueTokenPair(
  userId: string,
  sessionId: string,
  accessSecret: string,
  refreshSecret: string,
): Promise<TokenPair> {
  const [accessToken, refreshToken] = await Promise.all([
    signAccessToken(userId, accessSecret),
    signRefreshToken(userId, sessionId, refreshSecret),
  ]);
  return { accessToken, refreshToken };
}
