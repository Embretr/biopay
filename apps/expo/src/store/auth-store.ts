import { create } from "zustand";
import { clearTokens, getTokens, saveTokens, type Tokens } from "../lib/auth";

interface AuthState {
  isAuthenticated: boolean;
  isLoading: boolean;
  userId: string | null;

  initialize: () => Promise<void>;
  setAuthenticated: (tokens: Tokens) => Promise<void>;
  logout: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  isAuthenticated: false,
  isLoading: true,
  userId: null,

  initialize: async () => {
    try {
      const tokens = await getTokens();
      set({ isAuthenticated: !!tokens, isLoading: false });
    } catch {
      set({ isAuthenticated: false, isLoading: false });
    }
  },

  setAuthenticated: async (tokens: Tokens) => {
    await saveTokens(tokens);
    set({ isAuthenticated: true });
  },

  logout: async () => {
    await clearTokens();
    set({ isAuthenticated: false, userId: null });
  },
}));
