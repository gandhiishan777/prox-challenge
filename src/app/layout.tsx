/**
 * Root layout is intentionally bare — it imports no stylesheet.
 *
 * The artifact runner at /runner shares this root, and it must render against a
 * blank canvas rather than inheriting the chat app's dark theme. App styling is
 * therefore applied one level down, in the (chat) route group.
 */
export const metadata = {
  title: "OmniPro 220 Assistant",
  description:
    "Multimodal support agent for the Vulcan OmniPro 220 multiprocess welder.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body style={{ margin: 0 }}>{children}</body>
    </html>
  );
}
