import type { Config } from "tailwindcss";

/**
 * "OmniPro Bench" design system.
 *
 * Warm paper and ink rather than a dark UI: the manual's own pages are printed
 * black-on-white line art, and a dark chrome made every figure look like a hole
 * punched in the page. Paper stock lets the manual sit in the layout instead of
 * fighting it.
 *
 * Values are taken verbatim from the design file so a reviewer can diff them.
 */
const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Surfaces, lightest to deepest.
        paper: {
          DEFAULT: "#f4f1ec", // app surface
          deep: "#e8e4dc", // body behind the app
          rail: "#eae6de", // reference rail, bench panel
          manual: "#dfd9cf", // manual viewer backdrop
          card: "#f8f6f1", // inset cards inside white
        },
        // Near-black through to the header's raised bars.
        ink: {
          DEFAULT: "#14120f",
          800: "#1e1a15",
          700: "#2c2720",
          600: "#3a352c",
        },
        // The arc. Rust rather than safety-orange — it has to hold up against
        // paper without glowing.
        rust: {
          DEFAULT: "#c24000",
          dark: "#8f2f00", // hover on light
          light: "#ff8a4d", // on ink
          pale: "#ffb283", // metadata on ink
        },
        line: {
          DEFAULT: "#ddd7cb",
          soft: "#e6e1d6",
          mid: "#cdc5b8",
          strong: "#b9b1a2",
          hair: "#eae5da",
        },
        muted: {
          DEFAULT: "#8b8579",
          dark: "#6f6a5d",
          deep: "#5d584d",
          light: "#9a9284",
          body: "#4a463d",
          ondark: "#8d8779",
          faint: "#a49d8f",
        },
        // Generated-artifact tint: the one place the UI admits something was
        // written by the model rather than printed in the manual.
        tint: {
          DEFAULT: "#fdf6ef",
          hover: "#fbeee2",
          chip: "#f6e6d6",
          border: "#e0a877",
          rule: "#eccfb5",
        },
        live: "#7bb661",
      },
      fontFamily: {
        display: ["var(--font-archivo)", "system-ui", "sans-serif"],
        sans: ["var(--font-plex-sans)", "system-ui", "sans-serif"],
        mono: ["var(--font-plex-mono)", "ui-monospace", "monospace"],
      },
      boxShadow: {
        // Hard offset shadows, no blur — the design's signature. Reads as
        // printed matter rather than as a floating surface.
        hard: "6px 6px 0 #e0dacd",
        "hard-sm": "4px 4px 0 #e0dacd",
        "hard-lg": "8px 8px 0 rgba(20,18,15,.10)",
      },
      keyframes: {
        pulse: {
          "0%,100%": { opacity: "1" },
          "50%": { opacity: ".25" },
        },
        rise: {
          from: { opacity: "0", transform: "translateY(8px)" },
          to: { opacity: "1", transform: "none" },
        },
      },
      animation: {
        pulse: "pulse 1.1s ease-in-out infinite",
        rise: "rise .28s ease-out",
      },
    },
  },
  plugins: [],
};

export default config;
