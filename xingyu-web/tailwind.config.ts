import type { Config } from "tailwindcss";
import animate from "tailwindcss-animate";

// Brand palette + semantic tokens are sourced from docs/design-system/MASTER.md.
// All colors are semanticized in src/styles/tokens.css; components reference the
// semantic CSS variables (--background, --foreground, --primary, --accent, ...),
// never raw hex values.
//
// 2026-10-03 additions, all backed by tokens.css:
//   accent.strong  gold as TEXT (4.72:1 on cream — the raw accent measures 2.01:1
//                  and is therefore fill-only: buttons, badges, active nav pills)
//   accent.soft    gold wash for panels and active states
//   accent.line    gold hairline borders
//   surface-sunken one step below --card: chips, inset blocks, table headers
//   foreground-soft secondary headings that must not compete with navy
export default {
  darkMode: ["class"],
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        "foreground-soft": "hsl(var(--foreground-soft))",
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
          strong: "hsl(var(--accent-strong))",
          soft: "hsl(var(--accent-soft))",
          line: "hsl(var(--accent-line))",
        },
        "surface-sunken": "hsl(var(--surface-sunken))",
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      fontFamily: {
        sans: [
          "ui-sans-serif",
          "system-ui",
          "-apple-system",
          "Segoe UI",
          "PingFang SC",
          "Hiragino Sans GB",
          "Microsoft YaHei UI",
          "Microsoft YaHei",
          "Source Han Sans SC",
          "Noto Sans SC",
          "sans-serif",
        ],
      },
      fontSize: {
        display: [
          "var(--text-display)",
          {
            lineHeight: "1.25",
            letterSpacing: "-0.022em",
          },
        ],
        title: [
          "var(--text-title)",
          {
            lineHeight: "1.4",
            letterSpacing: "-0.012em",
          },
        ],
        card: [
          "var(--text-card)",
          {
            lineHeight: "1.45",
          },
        ],
        meta: [
          "var(--text-meta)",
          {
            lineHeight: "1.5",
          },
        ],
      },
      maxWidth: {
        shell: "var(--shell-max-width)",
      },
      keyframes: {
        "sheet-in": {
          from: {
            opacity: "0",
            transform: "translateY(-4px)",
          },
          to: {
            opacity: "1",
            transform: "translateY(0)",
          },
        },
        "accordion-down": {
          from: {
            height: "0",
          },
          to: {
            height: "var(--radix-accordion-content-height)",
          },
        },
        "accordion-up": {
          from: {
            height: "var(--radix-accordion-content-height)",
          },
          to: {
            height: "0",
          },
        },
      },
      animation: {
        "sheet-in": "sheet-in 140ms ease-out",
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
      },
    },
  },
  plugins: [animate],
} satisfies Config;
