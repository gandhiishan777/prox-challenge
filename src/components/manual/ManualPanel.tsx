"use client";

import * as React from "react";

import {
  MANUAL_PAGES,
  PAGES,
  PAGE_INDEX,
  pageSrc,
  pageThumb,
} from "@/lib/pages";
import { useChat } from "@/lib/store";

/**
 * The manual page viewer.
 *
 * A citation like "(p. 37)" is a claim, and a hobbyist standing at a machine has
 * no way to check it against the assistant's word alone. This panel puts the
 * actual scan one click behind the citation, and keeps every page the session
 * touched in a filmstrip — so the answer can be audited backwards, page by page,
 * without leaving the conversation.
 *
 * Page stepping stays inside one document on purpose: the quick start guide and
 * the selection chart are separate printings, and walking off the end of the
 * owner's manual into them would misrepresent where a figure came from.
 */

/** Document names, keyed by the two-letter prefix on every page id. */
const DOC_NAMES: Record<string, string> = {
  om: "Owner's Manual",
  qs: "Quick Start Guide",
  sc: "Selection Chart",
};

export function ManualPanel() {
  const page = useChat((s) => s.panel.page);
  const citedPages = useChat((s) => s.citedPages);
  const artifacts = useChat((s) => s.artifacts);
  const openManual = useChat((s) => s.openManual);
  const openArtifact = useChat((s) => s.openArtifact);
  const closePanel = useChat((s) => s.closePanel);

  const ref = page ? PAGE_INDEX.get(page) : undefined;
  const doc = ref?.doc;

  // Only pages of the same printing are reachable with ‹ ›.
  const siblings = React.useMemo(
    () => (doc ? PAGES.filter((p) => p.doc === doc) : []),
    [doc],
  );

  if (!page) return null;

  const artifactIds = Object.keys(artifacts);
  const lastArtifactId = artifactIds[artifactIds.length - 1];

  const at = siblings.findIndex((p) => p.id === page);
  const prev = at > 0 ? siblings[at - 1] : undefined;
  const next = at >= 0 ? siblings[at + 1] : undefined;

  const docName = DOC_NAMES[page.slice(0, 2)] ?? "Manual";

  // The "37 / 48" counter only means something inside the owner's manual; the
  // two short documents show their own citation instead.
  const counter =
    ref && ref.doc === "om" ? `${ref.n} / ${MANUAL_PAGES.length}` : (ref?.cite ?? "—");

  const navButton =
    "border border-line px-2 py-1 transition-colors hover:border-ink hover:text-ink " +
    "disabled:opacity-30 disabled:hover:border-line disabled:hover:text-muted";

  return (
    <section className="flex h-full min-h-0 flex-col bg-paper-manual">
      <div className="flex flex-shrink-0 items-stretch border-b border-line-mid bg-paper">
        {lastArtifactId ? (
          <button
            type="button"
            onClick={() => openArtifact(lastArtifactId)}
            className="border-0 border-b-2 border-transparent bg-transparent px-[18px] py-3.5 font-display text-[11.5px] font-bold uppercase tracking-[.14em] text-muted transition-colors hover:text-ink"
          >
            Tool
          </button>
        ) : null}

        <div className="flex items-center border-b-2 border-ink bg-paper-manual px-[18px] font-display text-[11.5px] font-bold uppercase tracking-[.14em] text-ink">
          Manual
        </div>

        <div className="flex-1" />

        <div className="flex items-center gap-2.5 px-3 font-mono text-[11px] text-muted">
          <button
            type="button"
            onClick={() => prev && openManual(prev.id)}
            disabled={!prev}
            title="Previous page"
            className={navButton}
          >
            ‹
          </button>
          <span className="text-ink">{counter}</span>
          <button
            type="button"
            onClick={() => next && openManual(next.id)}
            disabled={!next}
            title="Next page"
            className={navButton}
          >
            ›
          </button>
          <button
            type="button"
            onClick={closePanel}
            title="Close"
            className="border-0 bg-transparent text-sm text-muted transition-colors hover:text-ink"
          >
            ✕
          </button>
        </div>
      </div>

      <div className="flex flex-shrink-0 items-center gap-3 bg-ink px-4 py-2.5 text-paper">
        <span className="font-mono text-[10.5px] tracking-[.16em]">
          {`◤ ${docName.toUpperCase()}${ref ? ` · ${ref.cite.toUpperCase()}` : ""}`}
        </span>
        <div className="flex-1" />
        <span className="flex-shrink-0 font-mono text-[10.5px] tracking-[.1em] text-rust-pale">
          {citedPages.includes(page) ? "CITED IN THIS ANSWER" : "OPENED FROM THE RAIL"}
        </span>
      </div>

      <div className="flex min-h-0 flex-1 justify-center overflow-y-auto p-[22px]">
        {ref ? (
          // Keyed on the page id twice over: on the sheet so the rise animation
          // replays for each page, and on the img so the browser mounts a fresh
          // element rather than holding the previous scan on screen until the
          // new one decodes.
          <div
            key={page}
            className="h-fit w-full max-w-[520px] animate-rise border border-line-strong bg-white shadow-hard-lg"
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- manual scans are
                served from the knowledge route at unknown intrinsic sizes. */}
            <img
              key={page}
              src={pageSrc(page)}
              alt={`${docName}, ${ref.cite}`}
              className="block w-full"
            />
          </div>
        ) : (
          <p className="self-start font-mono text-[11px] tracking-[.1em] text-muted">
            {`PAGE ${page.toUpperCase()} IS NOT IN THIS MANUAL.`}
          </p>
        )}
      </div>

      <div className="flex-shrink-0 border-t border-line-mid bg-paper-rail px-4 py-3">
        <div className="mb-2.5 font-mono text-[10px] tracking-[.16em] text-muted">
          PAGES CITED IN THIS SESSION
        </div>
        {citedPages.length ? (
          <div className="flex gap-2 overflow-x-auto">
            {citedPages.map((id) => (
              <button
                key={id}
                type="button"
                onClick={() => openManual(id)}
                title={PAGE_INDEX.get(id)?.cite ?? id}
                className={`h-[68px] w-[52px] flex-shrink-0 overflow-hidden bg-white ${
                  id === page
                    ? "border-2 border-ink"
                    : "border border-line-mid transition-colors hover:border-ink"
                }`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element -- see above. */}
                <img
                  src={pageThumb(id)}
                  alt={PAGE_INDEX.get(id)?.cite ?? id}
                  className="h-full w-full object-cover object-top"
                />
              </button>
            ))}
          </div>
        ) : (
          <p className="text-[13.5px] leading-[1.5] text-muted-light">
            Citations you follow will collect here.
          </p>
        )}
      </div>
    </section>
  );
}
