import "../globals.css";

/**
 * App styling lives here rather than in the root layout so that the artifact
 * runner, which is served as a static document outside the app tree, renders
 * against a blank canvas instead of inheriting this theme.
 */
export default function ChatLayout({ children }: { children: React.ReactNode }) {
  return <div className="h-screen min-h-[760px] bg-paper text-ink">{children}</div>;
}
