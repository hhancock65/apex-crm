import tailwindcssAnimate from "tailwindcss-animate"
import type { Config } from "tailwindcss"

export default {
  darkMode: ["class"],
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        // Apex brand palette — apex-teal is CSS-var-backed (falls back to
        // the default hex when the var is unset) so partner white-labeling
        // (useApplyWhiteLabelStyles) can override it at runtime without
        // touching any component that already uses bg-apex-teal/
        // text-apex-teal/border-apex-teal classes. apex-navy is left as a
        // plain hex — the spec calls for "simple," and the sidebar's dark
        // navy background reads fine under any partner accent color, so
        // only the one accent color that's actually used for CTAs/
        // highlights throughout the app needs to be swappable.
        "apex-navy": "#1B2A4A",
        "apex-navy-light": "#243357",
        "apex-teal": "var(--apex-teal, #2E86AB)",
        "apex-surface": "#F8FAFC",
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
        "highlight-flash": {
          "0%": { backgroundColor: "hsl(200 63% 42% / 0.18)" },
          "100%": { backgroundColor: "transparent" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "highlight-flash": "highlight-flash 2.5s ease-out",
      },
    },
  },
  plugins: [tailwindcssAnimate],
} satisfies Config
