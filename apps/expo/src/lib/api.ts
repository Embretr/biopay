import axios, { AxiosError, type InternalAxiosRequestConfig } from "axios";
import Constants from "expo-constants";
import { getTokens, saveTokens, clearTokens } from "./auth";

const API_URL =
  (Constants.expoConfig?.extra as { apiUrl?: string } | undefined)?.apiUrl ??
  "http://localhost:3001";

export const api = axios.create({
  baseURL: API_URL,
  timeout: 15_000,
  headers: { "Content-Type": "application/json" },
});

// ── Request interceptor: attach JWT ───────────────────────────────────────────
api.interceptors.request.use(async (config: InternalAxiosRequestConfig) => {
  const tokens = await getTokens();
  if (tokens?.accessToken) {
    config.headers.Authorization = `Bearer ${tokens.accessToken}`;
  }
  return config;
});

// ── Response interceptor: auto-refresh on 401 ────────────────────────────────
let isRefreshing = false;
let refreshQueue: Array<(token: string) => void> = [];

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      if (isRefreshing) {
        // Queue this request until refresh is done
        return new Promise((resolve) => {
          refreshQueue.push((token) => {
            originalRequest.headers.Authorization = `Bearer ${token}`;
            resolve(api(originalRequest));
          });
        });
      }

      isRefreshing = true;
      try {
        const tokens = await getTokens();
        if (!tokens?.refreshToken) throw new Error("No refresh token");

        const response = await axios.post<{ accessToken: string; refreshToken: string }>(
          `${API_URL}/auth/refresh`,
          { refreshToken: tokens.refreshToken },
        );

        const { accessToken, refreshToken } = response.data;
        await saveTokens({ accessToken, refreshToken });

        // Resolve queued requests
        refreshQueue.forEach((cb) => cb(accessToken));
        refreshQueue = [];

        originalRequest.headers.Authorization = `Bearer ${accessToken}`;
        return api(originalRequest);
      } catch {
        await clearTokens();
        refreshQueue = [];
        // Signal auth store to redirect to login
        // (handled by the auth store listener)
        throw error;
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  },
);

// ── Typed API methods ─────────────────────────────────────────────────────────

export interface UserProfile {
  id: string;
  email: string;
  name: string;
  phoneNumber?: string;
  kycStatus: string;
  createdAt: string;
  wallet: {
    id: string;
    balanceCents: number;
    currency: string;
  } | null;
}

export interface Transaction {
  id: string;
  amountCents: number;
  currency: string;
  type: "DEPOSIT" | "WITHDRAWAL" | "PAYMENT" | "TRANSFER";
  status: "PENDING" | "COMPLETED" | "FAILED" | "REFUNDED";
  merchantName?: string;
  terminalId?: string;
  createdAt: string;
}

export const authApi = {
  initiate: (redirectUri?: string) =>
    api.post<{ authUrl: string; state: string }>("/auth/bankid/initiate", { redirectUri }),
  refresh: (refreshToken: string) =>
    api.post<{ accessToken: string; refreshToken: string }>("/auth/refresh", { refreshToken }),
  logout: () => api.delete("/auth/logout"),
};

export const usersApi = {
  me: () => api.get<UserProfile>("/users/me"),
  registerPushToken: (token: string, platform: "ios" | "android") =>
    api.patch("/users/me/push-token", { token, platform }),
};

export const palmApi = {
  get: () => api.get<{ palmId: string; status: string; enrolledAt: string } | null>("/palm"),
  enroll: () => api.post<{ palmId: string; enrollmentToken: string }>("/palm/enroll"),
  revoke: () => api.delete("/palm"),
};

export const walletApi = {
  get: () => api.get<{ id: string; balanceCents: number; currency: string }>("/wallet"),
  deposit: (amountCents: number, idempotencyKey: string) =>
    api.post(
      "/wallet/deposit",
      { amountCents, currency: "NOK" },
      { headers: { "Idempotency-Key": idempotencyKey } },
    ),
  withdraw: (amountCents: number, bankAccountIban: string, idempotencyKey: string) =>
    api.post(
      "/wallet/withdraw",
      { amountCents, currency: "NOK", bankAccountIban },
      { headers: { "Idempotency-Key": idempotencyKey } },
    ),
};

export const transactionsApi = {
  list: (params?: { page?: number; limit?: number; type?: string; status?: string }) =>
    api.get<{ data: Transaction[]; total: number; page: number; limit: number; totalPages: number }>(
      "/transactions",
      { params },
    ),
  get: (id: string) => api.get<Transaction & { metadata: Record<string, unknown> }>(`/transactions/${id}`),
};
