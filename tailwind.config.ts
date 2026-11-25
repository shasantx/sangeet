import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}"
  ],
  theme: {
    extend: {
      colors: {
        encore: {
          black: "#07080c",
          shell: "var(--background-shell)",
          base: "var(--background-base)",
          highlight: "var(--background-highlight)",
          press: "var(--background-press)",
          elevated: "var(--background-elevated-base)",
          "elevated-highlight": "var(--background-elevated-highlight)",
          "elevated-press": "var(--background-elevated-press)",
          tinted: "var(--background-tinted-base)",
          "tinted-highlight": "var(--background-tinted-highlight)",
          "tinted-press": "var(--background-tinted-press)",
          text: "var(--text-base)",
          subdued: "var(--text-subdued)",
          muted: "var(--text-muted)",
          accent: "var(--essential-bright-accent)",
          mint: "var(--accent-mint)",
          "on-accent": "var(--accent-foreground)",
          "accent-hover": "var(--accent-hover)",
          "accent-press": "var(--accent-press)",
          negative: "var(--text-negative)",
          warning: "var(--text-warning)",
          positive: "var(--text-positive)",
          announcement: "var(--text-announcement)",
          divider: "var(--decorative-subdued)",
          hairline: "var(--hairline)",
          hover: "var(--surface-hover)",
          rail: "var(--track-rail)"
        }
      },
      borderRadius: {
        panel: "14px",
        card: "14px",
        control: "10px",
        encore: "var(--encore-corner-radius-base)",
        "encore-lg": "var(--encore-corner-radius-larger)"
      },
      fontFamily: {
        sans: [
          "var(--font-sans)",
          "system-ui",
          "-apple-system",
          "BlinkMacSystemFont",
          "Segoe UI",
          "sans-serif"
        ],
        mono: [
          "var(--font-sans)",
          "system-ui",
          "-apple-system",
          "BlinkMacSystemFont",
          "Segoe UI",
          "sans-serif"
        ]
      },
      transitionTimingFunction: {
        studio: "cubic-bezier(0.22, 1, 0.36, 1)"
      }
    }
  },
  plugins: []
};

export default config;
