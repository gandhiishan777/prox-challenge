"use client";

import * as React from "react";

import { useChat, type Pull } from "@/lib/store";

/**
 * The reference rail: a running index of what this session actually pulled up.
 *
 * Someone standing at the welder asks four questions in a row, and the figure
 * they need again is now three answers back up the transcript. Scrolling a chat
 * log to find a picture is the wrong motion when you have a torch in one hand,
 * so every figure and every generated tool also lands here as a fixed target.
 * Newest first, because the thing you just looked at is the thing you look at
 * again.
 *
 * Figures and artifacts are drawn differently on purpose -- printed manual
 * pages get a thumbnail and a hard ink edge, model-written tools get the dashed
 * tint treatment. The rail should never let the two be confused at a glance.
 */
export function ReferenceRail() {
  // Subscribed field by field: the rail must not re-render on every artifact
  // code delta just because it read a slice of the same store.
  const pulls = useChat((s) => s.pulls);
  const lookups = useChat((s) => s.lookups);
  const figureCount = useChat((s) => s.figureCount);
  const sessionCostUsd = useChat((s) => s.sessionCostUsd);
  const openArtifact = useChat((s) => s.openArtifact);
  const openManual = useChat((s) => s.openManual);

  const newestFirst = React.useMemo(() => [...pulls].reverse(), [pulls]);

  const stats: [string, string][] = [
    ["Lookups", String(lookups)],
    ["Figures", String(figureCount)],
    ["Cost", `$${sessionCostUsd.toFixed(3)}`],
  ];

  return (
    <aside className="flex min-h-0 w-[212px] flex-shrink-0 flex-col overflow-y-auto border-r border-line bg-paper-rail py-[18px]">
      <h2 className="mb-3 px-4 font-mono text-[10px] tracking-[.16em] text-muted">
        PULLED THIS SESSION
      </h2>

      {newestFirst.length === 0 ? (
        <p className="px-4 text-[13px] leading-normal text-muted-light">
          Figures and tools you pull up land here, so you can get back to them
          without scrolling the conversation.
        </p>
      ) : (
        <ul className="flex flex-col gap-2 px-3">
          {newestFirst.map((pull) => (
            <li key={`${pull.kind}:${pull.id}`}>
              {pull.kind === "figure" ? (
                <FigurePull pull={pull} onOpen={openManual} />
              ) : (
                <ArtifactPull pull={pull} onOpen={openArtifact} />
              )}
            </li>
          ))}
        </ul>
      )}

      <div className="flex-1" />

      <div className="mt-5 border-t border-line px-4 pt-4">
        <div className="mb-2.5 font-mono text-[10px] tracking-[.16em] text-muted">
          SESSION
        </div>
        {stats.map(([label, value]) => (
          <div key={label} className="flex justify-between font-mono text-[11px] text-muted">
            <span>{label}</span>
            <span className="text-ink">{value}</span>
          </div>
        ))}
      </div>
    </aside>
  );
}

/** A manual figure. Clicking it reopens the page it was scanned from. */
function FigurePull({ pull, onOpen }: { pull: Pull; onOpen: (pageId: string) => void }) {
  const pageId = pull.pageId;
  return (
    <button
      type="button"
      onClick={pageId ? () => onOpen(pageId) : undefined}
      className="flex w-full items-center gap-2.5 border border-l-2 border-line border-l-ink bg-paper p-2 text-left hover:bg-white"
    >
      <span className="h-[38px] w-[38px] flex-shrink-0 overflow-hidden border border-line-soft bg-white">
        {/* eslint-disable-next-line @next/next/no-img-element -- manual scans come
            from the knowledge route at unknown intrinsic sizes. */}
        <img src={pull.thumb} alt="" className="h-full w-full object-cover" />
      </span>
      <span className="min-w-0">
        <span className="block truncate font-display text-[12.5px] font-bold uppercase tracking-[.03em]">
          {pull.title}
        </span>
        {pull.citation ? (
          <span className="block font-mono text-[10px] text-muted">
            {`MANUAL ${pull.citation}`.toUpperCase()}
          </span>
        ) : null}
      </span>
    </button>
  );
}

/** A tool the model wrote. Tinted and dashed so it never passes for print. */
function ArtifactPull({ pull, onOpen }: { pull: Pull; onOpen: (id: string) => void }) {
  return (
    <button
      type="button"
      onClick={() => onOpen(pull.id)}
      className="flex w-full items-center gap-2.5 border border-l-2 border-dashed border-tint-border border-l-rust bg-tint p-2 text-left hover:bg-tint-hover"
    >
      <span className="flex h-[38px] w-[38px] flex-shrink-0 items-center justify-center bg-tint-chip font-mono text-[10px] text-rust">
        TOOL
      </span>
      <span className="min-w-0">
        <span className="block truncate font-display text-[12.5px] font-bold uppercase tracking-[.03em]">
          {pull.title}
        </span>
        <span className="block font-mono text-[10px] text-muted">GENERATED</span>
      </span>
    </button>
  );
}
