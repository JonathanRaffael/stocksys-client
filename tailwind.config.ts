// tailwind.config.ts
import type { Config } from "tailwindcss"

export default {
  darkMode: "class",                 // <- WAJIB supaya class .dark berfungsi
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: { extend: {} },
  plugins: [],
} satisfies Config
