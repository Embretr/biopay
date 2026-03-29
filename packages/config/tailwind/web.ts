import type { Config } from "tailwindcss";

export const terminalColors = {
  bg: "#0a0a0f",
  surface: "#111118",
  border: "#1e1e2e",
  accent: "#00e5cc",
  "accent-dim": "#00b8a3",
  text: "#e2e8f0",
  muted: "#64748b",
  success: "#22c55e",
  error: "#ef4444",
  warning: "#f59e0b",
};

export const baseConfig: Partial<Config> = {
  darkMode: ["class"],
  content: [],
  theme: {
    extend: {
      colors: {
        terminal: terminalColors,
        brand: {
          DEFAULT: "#00e5cc",
          foreground: "#0a0a0f",
        },
      },
      fontFamily: {
        mono: ["JetBrains Mono", "Fira Code", "Cascadia Code", "monospace"],
        sans: ["Inter", "system-ui", "sans-serif"],
      },
    },
  },
};
