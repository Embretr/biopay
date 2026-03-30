import * as SecureStore from "expo-secure-store";
import * as Linking from "expo-linking";
import Constants, { ExecutionEnvironment } from "expo-constants";
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

function param(
  queryParams: Linking.QueryParams | null | undefined,
  key: string,
): string | undefined {
  const v = queryParams?.[key];
  if (v === undefined) return undefined;
  return Array.isArray(v) ? v[0] : v;
}

/** Parse tokens from a deep link URL: biopay://auth/callback?accessToken=...&refreshToken=... */
export function parseAuthDeepLink(url: string): Tokens | null {
  try {
    const parsed = Linking.parse(url);
    const accessToken = param(parsed.queryParams, "accessToken");
    const refreshToken = param(parsed.queryParams, "refreshToken");
    if (!accessToken || !refreshToken) return null;
    return { accessToken, refreshToken };
  } catch {
    return null;
  }
}

function nativeAppScheme(): string {
  const s = Constants.expoConfig?.scheme;
  if (typeof s === "string") return s;
  if (Array.isArray(s) && s[0]) return s[0];
  return "biopay";
}

/**
 * Redirect URI sent to Idura / OAuth. Must match a URI registered on the client (exact string).
 * Avoids makeRedirectUri + path, which becomes `biopay:///auth/callback` and is rejected by Idura.
 */
export function getRedirectUri(): string {
  if (Constants.executionEnvironment === ExecutionEnvironment.StoreClient) {
    return makeRedirectUri({ path: "auth/callback" });
  }
  return `${nativeAppScheme()}://auth/callback`;
}
