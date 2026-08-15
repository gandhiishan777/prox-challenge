/**
 * Compact page index for the manual viewer.
 *
 * Generated from knowledge/manifest.json by scripts/gen_pages.py. It exists so
 * the client can navigate and label pages without shipping the whole manifest
 * (which carries every figure's bbox and keywords) into the browser bundle.
 */
export interface PageRef {
  id: string;
  doc: string;
  n: number;
  cite: string;
}

export const PAGES: PageRef[] = [
  { id: "om-01", doc: "om", n: 1, cite: "p. 1" },
  { id: "om-02", doc: "om", n: 2, cite: "p. 2" },
  { id: "om-03", doc: "om", n: 3, cite: "p. 3" },
  { id: "om-04", doc: "om", n: 4, cite: "p. 4" },
  { id: "om-05", doc: "om", n: 5, cite: "p. 5" },
  { id: "om-06", doc: "om", n: 6, cite: "p. 6" },
  { id: "om-07", doc: "om", n: 7, cite: "p. 7" },
  { id: "om-08", doc: "om", n: 8, cite: "p. 8" },
  { id: "om-09", doc: "om", n: 9, cite: "p. 9" },
  { id: "om-10", doc: "om", n: 10, cite: "p. 10" },
  { id: "om-11", doc: "om", n: 11, cite: "p. 11" },
  { id: "om-12", doc: "om", n: 12, cite: "p. 12" },
  { id: "om-13", doc: "om", n: 13, cite: "p. 13" },
  { id: "om-14", doc: "om", n: 14, cite: "p. 14" },
  { id: "om-15", doc: "om", n: 15, cite: "p. 15" },
  { id: "om-16", doc: "om", n: 16, cite: "p. 16" },
  { id: "om-17", doc: "om", n: 17, cite: "p. 17" },
  { id: "om-18", doc: "om", n: 18, cite: "p. 18" },
  { id: "om-19", doc: "om", n: 19, cite: "p. 19" },
  { id: "om-20", doc: "om", n: 20, cite: "p. 20" },
  { id: "om-21", doc: "om", n: 21, cite: "p. 21" },
  { id: "om-22", doc: "om", n: 22, cite: "p. 22" },
  { id: "om-23", doc: "om", n: 23, cite: "p. 23" },
  { id: "om-24", doc: "om", n: 24, cite: "p. 24" },
  { id: "om-25", doc: "om", n: 25, cite: "p. 25" },
  { id: "om-26", doc: "om", n: 26, cite: "p. 26" },
  { id: "om-27", doc: "om", n: 27, cite: "p. 27" },
  { id: "om-28", doc: "om", n: 28, cite: "p. 28" },
  { id: "om-29", doc: "om", n: 29, cite: "p. 29" },
  { id: "om-30", doc: "om", n: 30, cite: "p. 30" },
  { id: "om-31", doc: "om", n: 31, cite: "p. 31" },
  { id: "om-32", doc: "om", n: 32, cite: "p. 32" },
  { id: "om-33", doc: "om", n: 33, cite: "p. 33" },
  { id: "om-34", doc: "om", n: 34, cite: "p. 34" },
  { id: "om-35", doc: "om", n: 35, cite: "p. 35" },
  { id: "om-36", doc: "om", n: 36, cite: "p. 36" },
  { id: "om-37", doc: "om", n: 37, cite: "p. 37" },
  { id: "om-38", doc: "om", n: 38, cite: "p. 38" },
  { id: "om-39", doc: "om", n: 39, cite: "p. 39" },
  { id: "om-40", doc: "om", n: 40, cite: "p. 40" },
  { id: "om-41", doc: "om", n: 41, cite: "p. 41" },
  { id: "om-42", doc: "om", n: 42, cite: "p. 42" },
  { id: "om-43", doc: "om", n: 43, cite: "p. 43" },
  { id: "om-44", doc: "om", n: 44, cite: "p. 44" },
  { id: "om-45", doc: "om", n: 45, cite: "p. 45" },
  { id: "om-46", doc: "om", n: 46, cite: "p. 46" },
  { id: "om-47", doc: "om", n: 47, cite: "p. 47" },
  { id: "om-48", doc: "om", n: 48, cite: "p. 48" },
  { id: "qs-01", doc: "qs", n: 1, cite: "Quick Start p. 1" },
  { id: "qs-02", doc: "qs", n: 2, cite: "Quick Start p. 2" },
  { id: "sc-01", doc: "sc", n: 1, cite: "Selection Chart" },
];

export const PAGE_INDEX = new Map(PAGES.map((p) => [p.id, p]));

/** Pages of the owner's manual only — what the "37 / 48" counter walks. */
export const MANUAL_PAGES = PAGES.filter((p) => p.doc === "om");

export function pageSrc(id: string): string {
  return `/api/knowledge/pages/${id}.png`;
}

export function pageThumb(id: string): string {
  return `/api/knowledge/pages/thumbs/${id}.jpg`;
}
