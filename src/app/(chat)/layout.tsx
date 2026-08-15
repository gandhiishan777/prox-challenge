import "../globals.css";

/**
 * App styling lives here rather than in the root layout so that the artifact
 * runner, which shares the root, renders against a blank canvas instead of
 * inheriting this dark theme.
 */
export default function ChatLayout({ children }: { children: React.ReactNode }) {
  return <div className="h-screen bg-steel-950 text-steel-100">{children}</div>;
}
