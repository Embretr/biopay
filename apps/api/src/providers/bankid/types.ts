export interface BankIDUserInfo {
  sub: string;
  email: string;
  name: string;
  phoneNumber?: string;
}

export interface BankIDTokens {
  accessToken: string;
  idToken: string;
  expiresIn: number;
}

export interface BankIDProvider {
  /** Returns the authorization URL to redirect the user to */
  initiateAuth(params: {
    state: string;
    codeChallenge: string;
    redirectUri: string;
  }): string;
  /** Exchange authorization code for tokens */
  handleCallback(
    code: string,
    codeVerifier: string,
    redirectUri: string,
  ): Promise<BankIDTokens>;
  /** Fetch user info from the access token or /userinfo endpoint */
  getUserInfo(accessToken: string): Promise<BankIDUserInfo>;
}
