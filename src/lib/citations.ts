import { PAGES } from "./pages";

/**
 * Citations in prose ("(p. 7)", "Quick Start p. 2", "Selection Chart") are the
 * audit trail, so they must be openable, not just readable. This rewrites them
 * in the markdown source into `[p. 7](#page-om-07)` links; the renderer turns
 * any `#page-` link into a button that opens the manual panel at that page.
 *
 * Done as a source transform rather than a remark plugin because the grammar is
 * three fixed patterns over plain text — a plugin would be more machinery to
 * test for the same output.
 */

const BY_CITE = new Map(PAGES.map((p) => [p.cite, p.id]));

/** "p. 7" → "om-07", "Quick Start p. 2" → "qs-02", "Selection Chart" → "sc-01". */
export function pageIdForCite(cite: string): string | null {
  return BY_CITE.get(cite.trim()) ?? null;
}

const PAGE_LINK = /^#page-([a-z]{2}-\d{2})$/;

/** The page id inside a `#page-…` href, or null for ordinary links. */
export function pageIdFromHref(href?: string): string | null {
  if (!href) return null;
  return PAGE_LINK.exec(href)?.[1] ?? null;
}

/**
 * Longest citations first, so the bare `p. N` pass never fires inside a longer
 * form it belongs to. Each pattern refuses to match text that is already link
 * label (`[` lookbehind), which makes the transform safe to apply to text that
 * has been through it before.
 */
export function linkifyCitations(markdown: string): string {
  let out = markdown.replace(
    /(?<!\[)\bQuick Start (?:Guide )?p\.\s*(\d)\b/g,
    (match, n: string) => {
      const id = `qs-0${n}`;
      return BY_CITE.get(`Quick Start p. ${n}`) ? `[${match}](#page-${id})` : match;
    },
  );
  out = out.replace(/(?<!\[)\bSelection Chart\b/g, (match) =>
    BY_CITE.get("Selection Chart") ? `[${match}](#page-sc-01)` : match,
  );
  out = out.replace(
    /(?<!\[)(?<!Quick Start )(?<!Guide )\bp\.\s*(\d{1,2})\b/g,
    (match, n: string) => {
      const id = `om-${n.padStart(2, "0")}`;
      return BY_CITE.get(`p. ${parseInt(n, 10)}`) ? `[${match}](#page-${id})` : match;
    },
  );
  return out;
}
