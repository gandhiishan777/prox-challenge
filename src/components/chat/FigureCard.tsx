"use client";

import * as React from "react";
import { Maximize2 } from "lucide-react";

/**
 * A figure lifted straight out of the OmniPro manual.
 *
 * These are scans of printed pages, so the image sits on white no matter how
 * dark the rest of the app is -- on a dark panel the paper margins read as a
 * rendering bug. The citation rides along as a badge because a hobbyist about
 * to change a setting should be able to check the claim against their own copy
 * of the manual, and clicking through opens the full-size scan.
 */
export function FigureCard({
  title,
  caption,
  src,
  citation,
}: {
  title: string;
  caption: string;
  src: string;
  citation: string;
}) {
  return (
    <figure className="overflow-hidden rounded-xl border border-steel-800 bg-steel-900">
      <a href={src} target="_blank" rel="noreferrer" className="group relative block bg-white">
        {/* eslint-disable-next-line @next/next/no-img-element -- manual scans are
            served from the knowledge route at unknown intrinsic sizes. */}
        <img src={src} alt={title} className="max-h-[420px] w-full object-contain" />
        <span className="pointer-events-none absolute right-2 top-2 rounded-md bg-steel-950/70 p-1.5 text-steel-100 opacity-0 transition-opacity group-hover:opacity-100">
          <Maximize2 className="h-3.5 w-3.5" aria-hidden="true" />
        </span>
      </a>

      <figcaption className="space-y-1 border-t border-steel-800 px-3 py-2">
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-sm font-medium text-steel-100">{title}</span>
          <span className="shrink-0 rounded bg-steel-800 px-1.5 py-0.5 font-mono text-[11px] text-arc-400">
            {citation}
          </span>
        </div>
        <p className="text-xs text-steel-400">{caption}</p>
      </figcaption>
    </figure>
  );
}
