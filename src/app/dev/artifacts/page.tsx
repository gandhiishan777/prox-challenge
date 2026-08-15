"use client";

import * as React from "react";

import { FIXTURES } from "@/lib/artifacts/fixtures";
import { ReactArtifactFrame, type ArtifactError } from "@/components/artifacts/ReactArtifactFrame";

/**
 * Development harness for the artifact runtime.
 *
 * Renders hand-written fixtures through the exact production path (sandboxed
 * iframe, sucrase compile, module allow-list) so the renderer can be built and
 * regression-tested without spending API credit. Not linked from the app.
 */
export default function DevArtifactsPage() {
  const [active, setActive] = React.useState(FIXTURES[0]);
  const [error, setError] = React.useState<ArtifactError | null>(null);
  const [rendered, setRendered] = React.useState(false);

  React.useEffect(() => {
    setError(null);
    setRendered(false);
  }, [active]);

  return (
    <div className="flex h-screen flex-col bg-paper text-ink">
      <header className="flex items-center gap-3 border-b border-line px-4 py-3">
        <span className="font-display text-sm font-extrabold uppercase tracking-[.04em]">
          Artifact runtime harness
        </span>
        <span className="font-mono text-[11px] tracking-[.1em] text-muted">
          FIXTURES → SANDBOX · NO API CALLS
        </span>
      </header>

      <div className="flex min-h-0 flex-1">
        <nav className="w-64 shrink-0 space-y-px border-r border-line p-3">
          {FIXTURES.map((f) => (
            <button
              key={f.id}
              onClick={() => setActive(f)}
              className={`block w-full px-3 py-2 text-left text-sm ${
                active.id === f.id
                  ? "bg-ink text-paper"
                  : "text-muted-body hover:bg-paper-rail hover:text-ink"
              }`}
            >
              {f.title}
            </button>
          ))}
        </nav>

        <main className="flex min-h-0 flex-1 flex-col">
          <div className="flex items-center gap-3 border-b border-line px-4 py-2 font-mono text-[11px]">
            <span className={rendered ? "text-emerald-600" : "text-muted"}>
              {rendered ? "● rendered" : "○ waiting"}
            </span>
            {error && (
              <span className="text-red-400">
                {error.phase}: {error.message.slice(0, 120)}
              </span>
            )}
          </div>
          <div className="min-h-0 flex-1 bg-white">
            <ReactArtifactFrame
              key={active.id}
              code={active.code}
              onError={setError}
              onRendered={() => setRendered(true)}
            />
          </div>
        </main>
      </div>
    </div>
  );
}
