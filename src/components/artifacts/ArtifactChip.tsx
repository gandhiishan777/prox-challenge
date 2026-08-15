"use client";

import * as React from "react";
import { Code2, LayoutGrid, GitBranch, Image as ImageIcon, FileText, Loader2 } from "lucide-react";

import { ARTIFACT_TYPES, artifactKindLabel, type Artifact } from "@/lib/artifacts/types";

/**
 * The inline card in the transcript that stands in for an artifact.
 *
 * The artifact itself renders in the side panel; this is the handle in the
 * conversation, so it has to say what the thing is and whether it is ready.
 */
function iconFor(type: string) {
  switch (type) {
    case ARTIFACT_TYPES.react:
      return LayoutGrid;
    case ARTIFACT_TYPES.mermaid:
      return GitBranch;
    case ARTIFACT_TYPES.svg:
      return ImageIcon;
    case ARTIFACT_TYPES.markdown:
      return FileText;
    default:
      return Code2;
  }
}

export function ArtifactChip({
  artifact,
  active,
  onOpen,
}: {
  artifact: Artifact;
  active: boolean;
  onOpen: () => void;
}) {
  const Icon = iconFor(artifact.type);
  const version = artifact.versions.length;
  const streaming = artifact.streaming;

  return (
    <button
      onClick={onOpen}
      className={`group flex w-full items-center gap-3 rounded-xl border p-3 text-left transition-colors ${
        active
          ? "border-arc-500/60 bg-steel-850"
          : "border-steel-800 bg-steel-900 hover:border-steel-700"
      }`}
    >
      <span
        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
          streaming ? "bg-arc-500/15 text-arc-400" : "bg-steel-800 text-steel-300"
        }`}
      >
        {streaming ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Icon className="h-4 w-4" />
        )}
      </span>

      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium text-steel-100">
          {artifact.title}
        </span>
        <span className="block text-xs text-steel-400">
          {streaming
            ? "Building…"
            : `${artifactKindLabel(artifact.type, artifact.language)}${
                version > 1 ? ` · v${version}` : ""
              } · click to open`}
        </span>
      </span>
    </button>
  );
}
