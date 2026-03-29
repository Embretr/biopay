import { Issuer, generators } from "openid-client";
import type { BankIDProvider, BankIDTokens, BankIDUserInfo } from "./types.js";

/**
 * Real BankID provider via Idura (eid broker).
 * Uses OpenID Connect Authorization Code flow with PKCE.
 *
 * Test environment: available immediately at https://idura.eu
 * Production: requires Bidbax client credentials (company must be Norwegian bank customer)
 */
export class RealBankIDProvider implements BankIDProvider {
  private clientId: string;
  private clientSecret: string;
  private issuer: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private _client: any = null;

  constructor(clientId: string, clientSecret: string, issuer: string) {
    this.clientId = clientId;
    this.clientSecret = clientSecret;
    this.issuer = issuer;
  }

  private async getClient() {
    if (this._client) return this._client;
    const issuer = await Issuer.discover(this.issuer);
    this._client = new issuer.Client({
      client_id: this.clientId,
      client_secret: this.clientSecret,
      response_types: ["code"],
    });
    return this._client;
  }

  initiateAuth(params: { state: string; codeChallenge: string; redirectUri: string }): string {
    // Note: client discovery is async but initiateAuth is sync.
    // In real usage, call getClient() during server startup to warm up.
    // For the URL, we construct it from known Idura parameters.
    const base = `${this.issuer}/protocol/openid-connect/auth`;
    const url = new URL(base);
    url.searchParams.set("client_id", this.clientId);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("scope", "openid profile email phone");
    url.searchParams.set("redirect_uri", params.redirectUri);
    url.searchParams.set("state", params.state);
    url.searchParams.set("code_challenge", params.codeChallenge);
    url.searchParams.set("code_challenge_method", "S256");
    url.searchParams.set("acr_values", "urn:idura:bankid:auth:level3");
    return url.toString();
  }

  async handleCallback(
    code: string,
    codeVerifier: string,
    redirectUri: string,
  ): Promise<BankIDTokens> {
    const client = await this.getClient();
    const tokenSet = await client.grant({
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri,
      code_verifier: codeVerifier,
    });

    return {
      accessToken: tokenSet.access_token!,
      idToken: tokenSet.id_token!,
      expiresIn: tokenSet.expires_in ?? 900,
    };
  }

  async getUserInfo(accessToken: string): Promise<BankIDUserInfo> {
    const client = await this.getClient();
    const userinfo = await client.userinfo(accessToken);

    return {
      sub: userinfo.sub,
      email: userinfo.email as string,
      name: userinfo.name as string,
      phoneNumber: userinfo.phone_number as string | undefined,
    };
  }
}
