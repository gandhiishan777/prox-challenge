"use client";

import * as React from "react";

/**
 * A figure lifted straight out of the OmniPro manual, framed like a plate in a
 * printed book.
 *
 * The crop is only ever a fragment of a page, so the frame has to make its
 * provenance obvious: the ink bar names the source before the eye reaches the
 * drawing, and the whole image is a button because the first thing a hobbyist
 * wants after seeing a diagram is the page it came from — the surrounding
 * warnings and torque figures are usually the part that matters.
 */
export function FigureCard({
  title,
  caption,
  src,
  citation,
  onOpenPage,
}: {
  title: string;
  caption: string;
  src: string;
  citation: string;
  onOpenPage?: () => void;
}) {
  return (
    <figure className="my-6 border border-ink bg-white shadow-hard">
      <div className="flex items-center justify-between gap-3 bg-ink px-3 py-[7px] text-paper">
        <span className="font-mono text-[10.5px] tracking-[.16em]">◤ FROM THE MANUAL</span>
        <span className="truncate font-mono text-[10.5px] tracking-[.1em] text-rust-pale">
          {`${citation} · ${title}`.toUpperCase()}
        </span>
      </div>

      <button
        type="button"
        onClick={() => onOpenPage?.()}
        className="block w-full bg-white px-3.5 pb-1.5 pt-3.5"
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- manual scans are
            served from the knowledge route at unknown intrinsic sizes. */}
        <img src={src} alt={title} className="block max-h-[300px] w-full object-contain" />
      </button>

      <figcaption className="flex justify-between gap-4 border-t border-line-hair px-3.5 pb-3 pt-2.5 text-[13px] leading-[1.5] text-muted-deep">
        <span>{caption}</span>
        {onOpenPage ? (
          <button
            type="button"
            onClick={onOpenPage}
            className="flex-shrink-0 self-start border border-[#e0d4c4] bg-transparent px-2 py-[5px] font-mono text-[10.5px] tracking-[.1em] text-rust hover:border-rust"
          >
            OPEN PAGE
          </button>
        ) : null}
      </figcaption>
    </figure>
  );
}
