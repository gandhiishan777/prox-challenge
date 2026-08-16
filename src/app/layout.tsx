import localFont from "next/font/local";

/**
 * Root layout is intentionally bare — it imports no stylesheet.
 *
 * Fonts are vendored into src/fonts (latin subsets, OFL-licensed) and loaded
 * with next/font/local. They were next/font/google until the Railway build
 * failed on it: that loader downloads from fonts.gstatic.com DURING next build,
 * and Google 404'd the pinned URLs — so the build's success depended on a third
 * party at exactly the moment of deploy. Committing ~175 KB of woff2 removes
 * the network from the build entirely, for the same reason the Tailwind build
 * is vendored: the app must render identically with no network, and a font that
 * fails to load would silently change every measurement in a design built on
 * tight tracking.
 */
const archivo = localFont({
  src: [
    { path: "../fonts/archivo-500.woff2", weight: "500", style: "normal" },
    { path: "../fonts/archivo-600.woff2", weight: "600", style: "normal" },
    { path: "../fonts/archivo-700.woff2", weight: "700", style: "normal" },
    { path: "../fonts/archivo-800.woff2", weight: "800", style: "normal" },
  ],
  variable: "--font-archivo",
  display: "swap",
});

const plexSans = localFont({
  src: [
    { path: "../fonts/plex-sans-400.woff2", weight: "400", style: "normal" },
    { path: "../fonts/plex-sans-500.woff2", weight: "500", style: "normal" },
    { path: "../fonts/plex-sans-600.woff2", weight: "600", style: "normal" },
  ],
  variable: "--font-plex-sans",
  display: "swap",
});

const plexMono = localFont({
  src: [
    { path: "../fonts/plex-mono-400.woff2", weight: "400", style: "normal" },
    { path: "../fonts/plex-mono-500.woff2", weight: "500", style: "normal" },
    { path: "../fonts/plex-mono-600.woff2", weight: "600", style: "normal" },
  ],
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
