"use client";

import * as React from "react";
import { AlertTriangle, ChevronLeft, ChevronRight, Download, Wrench, X } from "lucide-react";

import { ARTIFACT_TYPES, artifactKindLabel } from "@/lib/artifacts/types";
import { useChat } from "@/lib/store";
import { ReactArtifactFrame, type ArtifactError } from "./ReactArtifactFrame";
import { CodeView } from "./CodeView";
import { SvgArtifact } from "./SvgArtifact";
import { MermaidArtifact } from "./MermaidArtifact";
import { HtmlArtifactFrame } from "./HtmlArtifactFrame";

/**
 * The side panel that runs an artifact.
 *
 * Version handling is the interesting part: when the model reuses an
 * identifier it means "update this artifact", so versions stack up and the user
 * can step back through them. Each rendered version gets a fresh iframe (via
 * `key`), which guarantees the previous version's timers and listeners are gone
 * rather than leaking into the next one.
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

  return (
    <section className="flex h-full min-h-0 flex-col border-l border-steel-800 bg-steel-900">
      <header className="flex items-center gap-2 border-b border-steel-800 px-3 py-2">
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-sm font-medium text-steel-100">{artifact.title}</h2>
          <p className="text-xs text-steel-500">
            {artifactKindLabel(artifact.type, artifact.language)}
            {!version.complete && " · incomplete"}
          </p>
        </div>

        {artifact.versions.length > 1 && (
          <div className="flex items-center gap-1 rounded-lg border border-steel-800 px-1">
            <button
              onClick={() => setVersion(Math.max(0, versionIndex - 1))}
              disabled={versionIndex === 0}
              className="p-1 text-steel-400 disabled:opacity-30 hover:text-steel-100"
              title="Previous version"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="font-mono text-xs text-steel-400">v{versionIndex + 1}</span>
            <button
              onClick={() =>
                setVersion(Math.min(artifact.versions.length - 1, versionIndex + 1))
              }
              disabled={versionIndex >= artifact.versions.length - 1}
              className="p-1 text-steel-400 disabled:opacity-30 hover:text-steel-100"
              title="Next version"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        )}

        <div className="flex rounded-lg border border-steel-800 p-0.5 text-xs">
          {(["preview", "code"] as const).map((view) => (
            <button
              key={view}
              onClick={() => setView(view)}
              className={`rounded-md px-2 py-1 capitalize transition-colors ${
                (view === "code") === showCode
                  ? "bg-steel-700 text-white"
                  : "text-steel-400 hover:text-steel-200"
              }`}
            >
              {view}
            </button>
          ))}
        </div>

        <button
          onClick={download}
          className="p-1.5 text-steel-400 hover:text-steel-100"
          title="Download"
        >
          <Download className="h-4 w-4" />
        </button>
        <button
          onClick={closePanel}
          className="p-1.5 text-steel-400 hover:text-steel-100"
          title="Close"
        >
          <X className="h-4 w-4" />
        </button>
      </header>

      {error && (
        <div className="flex items-start gap-2 border-b border-red-900/50 bg-red-950/40 px-3 py-2">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-400" />
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium text-red-300">
              {error.phase} error{error.line ? ` (line ${error.line})` : ""}
            </p>
            <p className="break-words font-mono text-[11px] text-red-200/80">
              {error.message}
            </p>
          </div>
          <button
            onClick={requestFix}
            className="flex shrink-0 items-center gap-1 rounded-md bg-red-900/60 px-2 py-1 text-xs text-red-100 hover:bg-red-900"
          >
            <Wrench className="h-3 w-3" /> Fix it
          </button>
        </div>
      )}

      <div className="min-h-0 flex-1 overflow-hidden">
        {showCode ? (
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
        )}
      </div>
    </section>
  );
}
