import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Garage-workbench palette: warm steel greys with the Vulcan arc-orange
        // used sparingly for emphasis and machine-facing values.
        steel: {
          50: "#f6f7f8",
          100: "#eceef0",
          200: "#d4d8dd",
          300: "#b0b7c0",
          400: "#7c8593",
          500: "#5a6373",
          600: "#454d5c",
          700: "#363d49",
          800: "#252a33",
          850: "#1d2129",
          900: "#15181e",
          950: "#0d0f13",
        },
        arc: {
          400: "#ff9d4d",
          500: "#f97316",
          600: "#e35d05",
        },
      },
      fontFamily: {
        sans: ["ui-sans-serif", "system-ui", "-apple-system", "Segoe UI", "sans-serif"],
        mono: ["ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
      },
    },
  },
  plugins: [],
};

export default config;
