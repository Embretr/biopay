import * as SecureStore from "expo-secure-store";
import * as Linking from "expo-linking";
import { makeRedirectUri } from "expo-auth-session";

const ACCESS_TOKEN_KEY = "biopay_access_token";
const REFRESH_TOKEN_KEY = "biopay_refresh_token";

export interface Tokens {
  accessToken: string;
  refreshToken: string;
}

export async function saveTokens(tokens: Tokens): Promise<void> {
  await Promise.all([
    SecureStore.setItemAsync(ACCESS_TOKEN_KEY, tokens.accessToken),
    SecureStore.setItemAsync(REFRESH_TOKEN_KEY, tokens.refreshToken),
  ]);
}

export async function getTokens(): Promise<Tokens | null> {
  const [accessToken, refreshToken] = await Promise.all([
    SecureStore.getItemAsync(ACCESS_TOKEN_KEY),
    SecureStore.getItemAsync(REFRESH_TOKEN_KEY),
  ]);

  if (!accessToken || !refreshToken) return null;
  return { accessToken, refreshToken };
}

export async function clearTokens(): Promise<void> {
  await Promise.all([
    SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY),
    SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY),
  ]);
}

export async function hasTokens(): Promise<boolean> {
  const tokens = await getTokens();
  return tokens !== null;
}

/** Parse tokens from a deep link URL: biopay://auth/callback?accessToken=...&refreshToken=... */
export function parseAuthDeepLink(url: string): Tokens | null {
  try {
    const parsed = Linking.parse(url);
    const { accessToken, refreshToken } = parsed.queryParams as Record<string, string>;
    if (!accessToken || !refreshToken) return null;
    return { accessToken, refreshToken };
  } catch {
    return null;
  }
}

/** Returns the deep link redirect URI for BankID callback */
export function getRedirectUri(): string {
  return makeRedirectUri({ scheme: "biopay", path: "auth/callback" });
}
