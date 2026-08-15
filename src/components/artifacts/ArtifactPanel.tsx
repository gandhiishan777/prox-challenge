"use client";

import * as React from "react";
import { Download } from "lucide-react";

import { ARTIFACT_TYPES, artifactKindLabel } from "@/lib/artifacts/types";
import { useChat } from "@/lib/store";
import { ReactArtifactFrame, type ArtifactError } from "./ReactArtifactFrame";
import { CodeView } from "./CodeView";
import { SvgArtifact } from "./SvgArtifact";
import { MermaidArtifact } from "./MermaidArtifact";
import { HtmlArtifactFrame } from "./HtmlArtifactFrame";

/**
 * The bench panel that runs an artifact.
 *
 * Version handling is the interesting part: when the model reuses an
 * identifier it means "update this artifact", so versions stack up and the user
 * can step back through them. Each rendered version gets a fresh iframe (via
 * `key`), which guarantees the previous version's timers and listeners are gone
 * rather than leaking into the next one.
 *
 * The chrome is deliberately quiet and printed-looking, but it never lets the
 * user forget this pane is model-authored while the rest of the app quotes a
 * real manual — hence the standing GENERATED mark in the meta row rather than a
 * badge that only appears sometimes.
 */
export function ArtifactPanel({ onFix }: { onFix: (prompt: string) => void }) {
  const panel = useChat((s) => s.panel);
  const artifact = useChat((s) =>
    s.panel.identifier ? s.artifacts[s.panel.identifier] : undefined,
  );
  const setView = useChat((s) => s.setView);
  const setVersion = useChat((s) => s.setVersion);
  const closePanel = useChat((s) => s.closePanel);

  const [error, setError] = React.useState<ArtifactError | null>(null);

  const versionIndex = Math.min(panel.version, (artifact?.versions.length ?? 1) - 1);
  const version = artifact?.versions[versionIndex];

  // A new version is a fresh attempt; clear any failure from the previous one.
  React.useEffect(() => {
    setError(null);
  }, [artifact?.identifier, versionIndex]);

  if (!artifact || !version) return null;

  const isReact = artifact.type === ARTIFACT_TYPES.react;
  const showCode = panel.view === "code" || !version.complete;
  // Figures we draw ourselves get mounted on paper, so they read as a plate on
  // a page. Everything else owns its whole surface edge to edge: React and HTML
  // are iframes, and the code view is an ink slab that would look stranded
  // floating inside a white card.
  const onPaper =
    !showCode &&
    (artifact.type === ARTIFACT_TYPES.svg || artifact.type === ARTIFACT_TYPES.mermaid);

  const download = () => {
    const ext =
      artifact.type === ARTIFACT_TYPES.svg
        ? "svg"
        : artifact.type === ARTIFACT_TYPES.html
          ? "html"
          : artifact.type === ARTIFACT_TYPES.markdown
            ? "md"
            : artifact.type === ARTIFACT_TYPES.mermaid
              ? "mmd"
              : artifact.language ?? "jsx";
    const blob = new Blob([version.code], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${artifact.identifier}.${ext}`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const requestFix = () => {
    if (!error) return;
    onFix(
      `The "${artifact.title}" artifact (identifier ${artifact.identifier}) failed with a ${error.phase} error: ${error.message}` +
        (error.line ? ` at line ${error.line}` : "") +
        `. Fix it and re-emit the complete artifact with the same identifier.`,
    );
  };

  const rendered = showCode ? (
    <CodeView
      code={version.code}
      language={artifact.language}
      streaming={artifact.streaming}
    />
  ) : isReact ? (
    <ReactArtifactFrame
      key={`${artifact.identifier}-${versionIndex}`}
      code={version.code}
      onError={setError}
    />
  ) : artifact.type === ARTIFACT_TYPES.html ? (
    <HtmlArtifactFrame html={version.code} />
  ) : artifact.type === ARTIFACT_TYPES.svg ? (
    <SvgArtifact code={version.code} />
  ) : artifact.type === ARTIFACT_TYPES.mermaid ? (
    <MermaidArtifact code={version.code} id={`${artifact.identifier}-${versionIndex}`} />
  ) : (
    <CodeView code={version.code} language={artifact.language} />
  );

  return (
    <section className="flex h-full min-h-0 flex-col border-l border-line bg-paper-rail">
      <header className="flex flex-shrink-0 items-stretch border-b border-line bg-paper">
        <div className="flex items-center border-b-2 border-rust bg-paper-rail px-[18px] font-display text-[11.5px] font-bold uppercase tracking-[.14em] text-ink">
          Tool
        </div>

        <div className="flex min-w-0 flex-1 flex-col justify-center px-3.5 py-2">
          <h2 className="truncate font-display text-[13.5px] font-bold leading-tight text-ink">
            {artifact.title}
          </h2>
          <p className="truncate font-mono text-[10px] uppercase tracking-[.12em] text-muted">
            {artifactKindLabel(artifact.type, artifact.language)}
            {!version.complete && " · incomplete"}
          </p>
        </div>

        <div className="flex flex-shrink-0 items-center gap-px self-center border border-line">
          {(["preview", "code"] as const).map((view) => (
            <button
              key={view}
              onClick={() => setView(view)}
              className={`px-2.5 py-1.5 font-mono text-[11px] uppercase tracking-[.1em] transition-colors ${
                (view === "code") === showCode
                  ? "bg-ink text-paper"
                  : "text-muted hover:text-ink"
              }`}
            >
              {view}
            </button>
          ))}
        </div>

        <div className="flex flex-shrink-0 items-center gap-3.5 px-3 font-mono text-[11px] text-muted">
          {artifact.versions.length > 1 ? (
            <span className="flex items-center gap-1.5 border border-line px-2 py-1">
              <button
                onClick={() => setVersion(Math.max(0, versionIndex - 1))}
                disabled={versionIndex === 0}
                className="text-muted transition-colors hover:text-ink disabled:opacity-30 disabled:hover:text-muted"
                title="Previous version"
              >
                ‹
              </button>
              <span className="text-ink">v{versionIndex + 1}</span>
              <button
                onClick={() =>
                  setVersion(Math.min(artifact.versions.length - 1, versionIndex + 1))
                }
                disabled={versionIndex >= artifact.versions.length - 1}
                className="text-muted transition-colors hover:text-ink disabled:opacity-30 disabled:hover:text-muted"
                title="Next version"
              >
                ›
              </button>
            </span>
          ) : (
            <span>v{versionIndex + 1}</span>
          )}

          <span className="tracking-[.14em] text-rust">GENERATED</span>

          <button
            onClick={download}
            className="text-muted transition-colors hover:text-ink"
            title="Download"
            aria-label="Download"
          >
            <Download className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
          <button
            onClick={closePanel}
            className="text-[13px] leading-none text-muted transition-colors hover:text-ink"
            title="Close"
            aria-label="Close"
          >
            ✕
          </button>
        </div>
      </header>

      {error && (
        <div className="flex flex-shrink-0 items-start gap-3 border-b border-tint-border bg-tint px-3 py-2.5">
          <div className="min-w-0 flex-1">
            <p className="font-mono text-[11px] uppercase tracking-[.12em] text-rust-dark">
              {error.phase} error{error.line ? ` (line ${error.line})` : ""}
            </p>
            <p className="mt-1 break-words font-mono text-[11px] leading-snug text-muted-deep">
              {error.message}
            </p>
          </div>
          <button
            onClick={requestFix}
            className="flex-shrink-0 bg-rust px-2.5 py-1.5 font-mono text-[11px] uppercase tracking-[.1em] text-white transition-colors hover:bg-rust-dark"
          >
            Fix it
          </button>
        </div>
      )}

      <div className="min-h-0 flex-1 overflow-hidden">
        {onPaper ? (
          <div className="h-full overflow-auto bg-paper-rail p-6">
            {/* A plate on the page: white stock, hairline keyline, like a
                figure printed in the manual it sits next to. */}
            <div className="animate-rise border border-line-mid bg-white p-6">
              {rendered}
            </div>
          </div>
        ) : (
          rendered
        )}
      </div>
    </section>
  );
}
