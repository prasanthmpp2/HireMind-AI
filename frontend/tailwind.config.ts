import type { Config } from "tailwindcss";

export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Manrope", "ui-sans-serif", "system-ui"],
        serif: ["Source Serif 4", "ui-serif", "Georgia"]
      },
      boxShadow: {
        glow: "0 25px 60px rgba(15, 23, 42, 0.18)"
      }
    }
  },
  plugins: []
} satisfies Config;
