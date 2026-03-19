import type { Config } from "tailwindcss";

export default {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-geist-sans)"],
        mono: ["var(--font-geist-mono)"],
      },
      colors: {
        base: "#09090b",
        surface: "#0c0c0f",
        elevated: "#131316",
        "elevated-hover": "#1a1a1f",
        accent: {
          DEFAULT: "#818cf8",
          dim: "#6366f1",
          glow: "rgba(99, 102, 241, 0.15)",
        },
        border: {
          subtle: "rgba(255, 255, 255, 0.06)",
          default: "rgba(255, 255, 255, 0.08)",
          focus: "rgba(99, 102, 241, 0.5)",
        },
        txt: {
          primary: "#fafafa",
          secondary: "#a1a1aa",
          tertiary: "#52525b",
        },
      },
      animation: {
        "fade-in-up": "fade-in-up 0.3s ease-out",
      },
    },
  },
  plugins: [],
} satisfies Config;
