import { Archivo, IBM_Plex_Mono, IBM_Plex_Sans } from "next/font/google";

/**
 * Root layout is intentionally bare — it imports no stylesheet.
 *
 * Fonts are loaded through next/font, which downloads and self-hosts them at
 * build time. That matters here for the same reason the Tailwind build is
 * vendored: the app must render identically with no network, and a webfont that
 * fails to load would silently fall back and change every measurement in a
 * design built on tight tracking.
 */
const archivo = Archivo({
  subsets: ["latin"],
  weight: ["500", "600", "700", "800"],
  variable: "--font-archivo",
  display: "swap",
});

const plexSans = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-plex-sans",
  display: "swap",
});

const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-plex-mono",
  display: "swap",
});

export const metadata = {
  title: "OmniPro Bench",
  description:
    "Support bench for the Vulcan OmniPro 220 multiprocess welder — every answer read out of the manual, with the page cited.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${archivo.variable} ${plexSans.variable} ${plexMono.variable}`}
    >
      <body style={{ margin: 0 }}>{children}</body>
    </html>
  );
}
