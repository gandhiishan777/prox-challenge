"use client";

import * as React from "react";

import { artifactKindLabel, type Artifact } from "@/lib/artifacts/types";

/**
 * The handle in the transcript that stands in for an artifact rendered in the
 * bench panel.
 *
 * Everything else in this app is quoting a printed manual, so a model-authored
 * checklist sitting in the same column is a genuine hazard — someone could
 * follow it believing Vulcan wrote it. The warm tint, the dashed rule and the
 * vertical GENERATED spine exist to make that distinction readable at a glance
 * from arm's length, which is where the user actually is. The border goes solid
 * when the artifact is the one currently open, so "generated" and "active" stay
 * separate signals.
 */
export function ArtifactChip({
  artifact,
  active,
  onOpen,
}: {
  artifact: Artifact;
  active: boolean;
  onOpen: () => void;
}) {
  const streaming = artifact.streaming;

  return (
    <button
      onClick={onOpen}
      className={`flex w-full items-center gap-3.5 border bg-tint px-4 py-3.5 text-left hover:bg-tint-hover ${
        active ? "border-solid border-rust" : "border-dashed border-rust"
      }`}
    >
      <span
        className="font-mono text-[10.5px] tracking-[.14em] text-rust"
        style={{ writingMode: "vertical-rl", transform: "rotate(180deg)" }}
      >
        GENERATED
      </span>

      <span className="w-px self-stretch bg-tint-rule" />

      <span className="min-w-0 flex-1">
        <span className="mb-0.5 block truncate font-display text-[15.5px] font-bold">
          {artifact.title}
        </span>
        <span className="block font-mono text-[11.5px] text-[#8b7f70]">
          {streaming
            ? "Building…"
            : `${artifactKindLabel(artifact.type, artifact.language)} · v${
                artifact.versions.length
              } · open in bench →`}
        </span>
      </span>

      {streaming ? null : <span className="font-mono text-[11px] text-rust">OPEN</span>}
    </button>
  );
}
