import { createHash, randomBytes } from "crypto";
import type { BankIDProvider, BankIDTokens, BankIDUserInfo } from "./types.js";

/**
 * Mock BankID provider for development.
 * Replaces the real OIDC/PKCE flow with a simple HTML form.
 *
 * Flow:
 *   1. initiateAuth() → returns URL pointing to GET /auth/bankid/mock-login?state=<state>
 *   2. User fills in email + name on the mock login page
 *   3. Form POSTs to /auth/bankid/mock-callback with { email, name, state }
 *   4. Mock callback returns fake tokens
 */
export class MockBankIDProvider implements BankIDProvider {
  initiateAuth(params: { state: string; codeChallenge: string; redirectUri: string }): string {
    // Point to our own mock login page — no external calls
    const url = new URL("http://localhost:3001/auth/bankid/mock-login");
    url.searchParams.set("state", params.state);
    url.searchParams.set("redirect_uri", params.redirectUri);
    return url.toString();
  }

  async handleCallback(
    code: string,
    _codeVerifier: string,
    _redirectUri: string,
  ): Promise<BankIDTokens> {
    // code is base64-encoded JSON { email, name }
    const decoded = Buffer.from(code, "base64url").toString("utf-8");
    const { email, name } = JSON.parse(decoded) as { email: string; name: string };

    // Generate a stable sub from email
    const sub = "mock_" + createHash("sha256").update(email).digest("hex").slice(0, 16);

    // Create a fake access token that embeds userinfo (for getUserInfo)
    const payload = { sub, email, name, type: "mock_access" };
    const fakeAccessToken = Buffer.from(JSON.stringify(payload)).toString("base64url");
    const fakeIdToken = fakeAccessToken; // same for mock

    return {
      accessToken: fakeAccessToken,
      idToken: fakeIdToken,
      expiresIn: 900,
    };
  }

  async getUserInfo(accessToken: string): Promise<BankIDUserInfo> {
    const decoded = Buffer.from(accessToken, "base64url").toString("utf-8");
    const payload = JSON.parse(decoded) as {
      sub: string;
      email: string;
      name: string;
    };
    return {
      sub: payload.sub,
      email: payload.email,
      name: payload.name,
    };
  }

  /** Generates a mock authorization code from email + name */
  static generateCode(email: string, name: string): string {
    return Buffer.from(JSON.stringify({ email, name })).toString("base64url");
  }
}
