import fs from "node:fs";
import path from "node:path";

/**
 * Loads the committed knowledge pack once, at module load.
 *
 * Everything here is static content produced by the extraction pipeline, so it
 * is read synchronously at boot and kept in memory: tool calls then cost no I/O,
 * and the system prompt is a single stable string, which is what lets the API
 * cache the whole prefix.
 */

export const KNOWLEDGE_DIR = path.join(process.cwd(), "knowledge");

function readJson<T>(relative: string): T {
  return JSON.parse(fs.readFileSync(path.join(KNOWLEDGE_DIR, relative), "utf8")) as T;
}

export interface DutyCycleEntry {
  process: string;
  input_voltage: number;
  amps: number;
  duty_cycle_pct: number;
  welding_minutes: number;
  resting_minutes: number;
  continuous?: boolean;
  pages: string[];
}

export interface TroubleCause {
  cause: string;
  remedy: string;
  applies_to: string[];
  page: string;
}

export interface TroubleEntry {
  id: string;
  symptom: string;
  aliases: string[];
  applies_to: string[];
  figures: string[];
  causes: TroubleCause[];
}

export interface FigureEntry {
  id: string;
  page_id: string;
  title: string;
  caption: string;
  keywords: string[];
  answers: string[];
  file: string;
  thumb: string;
  px: [number, number];
}

export interface PageEntry {
  id: string;
  doc: string;
  doc_title: string;
  page: number;
  citation: string;
  section: string;
  image: string;
  thumb: string;
}

export interface Manifest {
  product: Record<string, unknown>;
  documents: { id: string; title: string; file: string }[];
  counts: { pages: number; figures: number; sections: number };
  manual_full: { file: string; chars: number; approx_tokens: number };
  sections: { id: string; title: string; pages: string[] }[];
  pages: PageEntry[];
  figures: FigureEntry[];
}

export const manifest = readJson<Manifest>("manifest.json");
export const specs = readJson<Record<string, any>>("data/specs.json");
export const dutyCycle = readJson<{
  definition: string;
  definition_pages: string[];
  worked_example_from_manual: { text: string; page: string };
  thermal_protection: { behavior: string; what_to_do: string; pages: string[] };
  consequence_of_ignoring: { text: string; pages: string[] };
  interpolation_policy: string;
  interpolation_note: string;
  entries: DutyCycleEntry[];
  process_aliases: Record<string, string>;
}>("data/duty_cycle.json");
export const troubleshooting = readJson<{
  safety_preamble: { text: string; page: string };
  entries: TroubleEntry[];
}>("data/troubleshooting.json");
export const settings = readJson<Record<string, any>>("data/settings.json");
export const parts = readJson<{
  meta: Record<string, unknown>;
  entries: { ref_no: number; description: string; qty: number; page: string }[];
}>("data/parts.json");

export const manualFull = fs.readFileSync(
  path.join(KNOWLEDGE_DIR, "manual_full.md"),
  "utf8",
);

export const figuresById = new Map(manifest.figures.map((f) => [f.id, f]));
export const pagesById = new Map(manifest.pages.map((p) => [p.id, p]));

/** Human-facing citation for a page id, e.g. "om-07" -> "p. 7". */
export function cite(pageId: string): string {
  return pagesById.get(pageId)?.citation ?? pageId;
}

/** Render a list of page ids as a citation string, deduplicated and ordered. */
export function citeAll(pageIds: string[]): string {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const id of pageIds) {
    const c = cite(id);
    if (!seen.has(c)) {
      seen.add(c);
      out.push(c);
    }
  }
  return out.join(", ");
}

/** Read a committed image as base64 for returning in a tool result. */
export function readImageBase64(relative: string): string {
  return fs.readFileSync(path.join(KNOWLEDGE_DIR, relative)).toString("base64");
}
