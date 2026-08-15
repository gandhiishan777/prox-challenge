import {
  cite,
  citeAll,
  dutyCycle,
  parts,
  settings,
  specs,
  troubleshooting,
  type DutyCycleEntry,
  type TroubleEntry,
} from "./knowledge";

/**
 * Deterministic lookups over the curated knowledge pack.
 *
 * Every number the user is shown comes through here rather than from the
 * model's reading of the manual text. These are pure functions, so the numeric
 * core of the agent is unit-tested without an API key or a network call.
 */

export type Process = "MIG" | "FLUX_CORED" | "TIG" | "STICK";
export type Voltage = 120 | 240;

const PROCESS_WORDS: Record<string, Process> = {
  mig: "MIG",
  gmaw: "MIG",
  "solid wire": "MIG",
  flux: "FLUX_CORED",
  "flux core": "FLUX_CORED",
  "flux-core": "FLUX_CORED",
  "flux cored": "FLUX_CORED",
  "flux-cored": "FLUX_CORED",
  fcaw: "FLUX_CORED",
  "self-shielded": "FLUX_CORED",
  tig: "TIG",
  gtaw: "TIG",
  tungsten: "TIG",
  stick: "STICK",
  smaw: "STICK",
  arc: "STICK",
  electrode: "STICK",
};

/** Best-effort process detection from free text; null when genuinely unclear. */
export function parseProcess(text?: string | null): Process | null {
  if (!text) return null;
  const t = text.toLowerCase();
  // Longest keys first so "flux core" wins over a bare "arc" appearing elsewhere.
  const keys = Object.keys(PROCESS_WORDS).sort((a, b) => b.length - a.length);
  for (const key of keys) {
    if (t.includes(key)) return PROCESS_WORDS[key];
  }
  return null;
}

/** Normalize sloppy voltage input (110/115/120 -> 120, 220/230/240 -> 240). */
export function parseVoltage(input?: string | number | null): {
  voltage: Voltage | null;
  note?: string;
} {
  if (input === null || input === undefined || input === "") return { voltage: null };
  const n = typeof input === "number" ? input : parseFloat(String(input).replace(/[^\d.]/g, ""));
  if (!Number.isFinite(n)) return { voltage: null };
  if (n <= 160) {
    return n === 120
      ? { voltage: 120 }
      : { voltage: 120, note: `Treating ${n}V as the manual's 120V rating.` };
  }
  return n === 240
    ? { voltage: 240 }
    : { voltage: 240, note: `Treating ${n}V as the manual's 240V rating.` };
}

/**
 * The manual publishes duty cycles for MIG and flux-cored together under one
 * "MIG" heading, so flux-cored questions resolve onto the MIG rows.
 */
function dutyProcessKey(process: Process): { key: string; aliasNote?: string } {
  if (process === "FLUX_CORED") {
    return {
      key: "MIG",
      aliasNote:
        "The manual publishes one set of duty cycles covering both MIG and flux-cored wire welding, listed under MIG. There is no separate flux-cored rating.",
    };
  }
  return { key: process };
}

export interface DutyCycleResult {
  match: "exact" | "bracketed" | "below_continuous" | "above_range";
  process: Process;
  input_voltage: Voltage;
  requested_amps: number;
  exact?: DutyCycleEntry;
  lower?: DutyCycleEntry;
  upper?: DutyCycleEntry;
  conservative_pct?: number;
  guidance: string;
  definition: string;
  thermal_protection: string;
  pages: string[];
  citation: string;
  alias_note?: string;
  voltage_note?: string;
}

export function lookupDutyCycle(
  process: Process,
  voltageInput: string | number,
  amps: number,
): DutyCycleResult | { error: string } {
  const { voltage, note: voltage_note } = parseVoltage(voltageInput);
  if (!voltage) return { error: `Unrecognized input voltage: ${voltageInput}` };

  const { key, aliasNote } = dutyProcessKey(process);
  const rows = dutyCycle.entries
    .filter((e) => e.process === key && e.input_voltage === voltage)
    .sort((a, b) => a.amps - b.amps);

  if (!rows.length) {
    return { error: `No duty cycle data for ${process} at ${voltage}V.` };
  }

  const base = {
    process,
    input_voltage: voltage,
    requested_amps: amps,
    definition: dutyCycle.definition,
    thermal_protection: dutyCycle.thermal_protection.behavior,
    alias_note: aliasNote,
    voltage_note,
  };

  const exact = rows.find((r) => r.amps === amps);
  if (exact) {
    const pages = exact.pages;
    return {
      ...base,
      match: "exact",
      exact,
      pages,
      citation: citeAll(pages),
      guidance:
        exact.duty_cycle_pct === 100
          ? `${amps}A is a rated continuous-use point: you can weld at ${amps}A indefinitely.`
          : `${amps}A is a rated point: ${exact.duty_cycle_pct}% duty cycle, which is ${exact.welding_minutes} minutes welding then ${exact.resting_minutes} minutes resting in every 10-minute period.`,
    };
  }

  const continuous = rows.find((r) => r.duty_cycle_pct === 100);
  const maxRow = rows[rows.length - 1];

  if (continuous && amps <= continuous.amps) {
    return {
      ...base,
      match: "below_continuous",
      lower: continuous,
      conservative_pct: 100,
      pages: continuous.pages,
      citation: citeAll(continuous.pages),
      guidance: `${amps}A is at or below the ${continuous.amps}A continuous-use rating, so you can weld continuously at this current.`,
    };
  }

  if (amps > maxRow.amps) {
    return {
      ...base,
      match: "above_range",
      upper: maxRow,
      conservative_pct: maxRow.duty_cycle_pct,
      pages: maxRow.pages,
      citation: citeAll(maxRow.pages),
      guidance: `${amps}A is above the highest rated point the manual publishes for this process and input voltage (${maxRow.amps}A at ${maxRow.duty_cycle_pct}%). Check the output range before going further.`,
    };
  }

  // Between the two published points. The manual prints no derating curve, so
  // the honest answer is the bracket plus the conservative bound.
  const lower = [...rows].reverse().find((r) => r.amps < amps)!;
  const upper = rows.find((r) => r.amps > amps)!;
  return {
    ...base,
    match: "bracketed",
    lower,
    upper,
    conservative_pct: upper.duty_cycle_pct,
    pages: [...new Set([...lower.pages, ...upper.pages])],
    citation: citeAll([...lower.pages, ...upper.pages]),
    guidance:
      `The manual publishes only two rated points for this process and input voltage: ` +
      `${lower.duty_cycle_pct}% at ${lower.amps}A and ${upper.duty_cycle_pct}% at ${upper.amps}A. ` +
      `${amps}A falls between them and the manual prints no derating curve, so do not treat an interpolated number as a manual figure — ` +
      `plan against the ${upper.duty_cycle_pct}% figure (${upper.welding_minutes} min welding, ${upper.resting_minutes} min resting per 10 minutes) as the safe bound.`,
  };
}

export interface ConnectionResult {
  process: Process;
  polarity: string;
  polarity_name: string;
  electrode_lead: string;
  electrode_socket: string;
  work_clamp_socket: string;
  notes: string;
  figure_id: string;
  pages: string[];
  citation: string;
}

export function getConnections(process: Process): ConnectionResult | { error: string } {
  const c = specs.connections?.[process];
  if (!c) return { error: `No connection data for ${process}.` };
  return {
    process,
    polarity: c.polarity,
    polarity_name: c.polarity_name,
    electrode_lead: c.electrode_lead,
    electrode_socket: c.electrode_socket,
    work_clamp_socket: c.work_clamp_socket,
    notes: c.notes,
    figure_id: c.figure_id,
    pages: c.pages,
    citation: citeAll(c.pages),
  };
}

export function getAllConnections(): ConnectionResult[] {
  return (["MIG", "FLUX_CORED", "TIG", "STICK"] as Process[])
    .map((p) => getConnections(p))
    .filter((r): r is ConnectionResult => !("error" in r));
}

const STOP_WORDS = new Set([
  "the", "a", "an", "is", "are", "my", "in", "on", "of", "to", "and", "or", "it",
  "i", "im", "get", "getting", "got", "with", "for", "why", "what", "how", "when",
  "keeps", "keep", "when", "welder", "welding", "weld", "welds", "machine", "problem",
]);

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOP_WORDS.has(w));
}

export interface TroubleMatch {
  entry: TroubleEntry;
  score: number;
  causes: TroubleCauseFiltered[];
  citation: string;
  filtered_note?: string;
}

interface TroubleCauseFiltered {
  cause: string;
  remedy: string;
  page: string;
  citation: string;
}

/**
 * Scores symptom entries against free text. With ~17 entries an index would be
 * pure overhead; token overlap against the symptom plus its aliases is both
 * sufficient and inspectable.
 */
export function lookupTroubleshooting(
  query: string,
  process?: Process | null,
  limit = 3,
): TroubleMatch[] {
  const queryTokens = new Set(tokenize(query));
  if (!queryTokens.size) return [];

  const scored = troubleshooting.entries.map((entry) => {
    const haystack = tokenize(
      [entry.symptom, ...entry.aliases, ...entry.causes.map((c) => c.cause)].join(" "),
    );
    const aliasText = entry.aliases.join(" ").toLowerCase();
    let score = 0;
    for (const token of queryTokens) {
      if (haystack.includes(token)) score += 1;
      // An alias hit is a strong signal ("birdnest", "porosity").
      if (aliasText.includes(token)) score += 2;
      if (entry.symptom.toLowerCase().includes(token)) score += 1;
    }
    // Prefer entries scoped to the stated process.
    if (process && entry.applies_to.includes(process)) score += 2;
    if (process && !entry.applies_to.includes(process)) score -= 3;
    return { entry, score };
  });

  return scored
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(({ entry, score }) => {
      const applicable = process
        ? entry.causes.filter((c) => c.applies_to.includes(process))
        : entry.causes;
      const dropped = entry.causes.length - applicable.length;
      return {
        entry,
        score,
        causes: applicable.map((c) => ({
          cause: c.cause,
          remedy: c.remedy,
          page: c.page,
          citation: cite(c.page),
        })),
        citation: citeAll(applicable.map((c) => c.page)),
        filtered_note:
          dropped > 0 && process
            ? `${dropped} cause(s) that the manual marks as applying only to other processes were left out for ${process}.`
            : undefined,
      };
    });
}

export interface PartMatch {
  ref_no: number;
  description: string;
  qty: number;
  citation: string;
}

export function lookupPart(query: string, limit = 8): PartMatch[] {
  const asNumber = parseInt(query.trim(), 10);
  const byNumber = Number.isFinite(asNumber)
    ? parts.entries.filter((p) => p.ref_no === asNumber)
    : [];
  const tokens = tokenize(query);
  const byText = parts.entries.filter((p) =>
    tokens.some((t) => p.description.toLowerCase().includes(t)),
  );
  const merged = [...byNumber, ...byText.filter((p) => !byNumber.includes(p))];
  return merged.slice(0, limit).map((p) => ({
    ref_no: p.ref_no,
    description: p.description,
    qty: p.qty,
    citation: cite(p.page),
  }));
}

/** Parse a thickness expression into inches where possible. */
export function parseThickness(input?: string | null): {
  inches: number | null;
  label: string | null;
} {
  if (!input) return { inches: null, label: null };
  const text = input.trim().toLowerCase();

  const gauge = /(\d+)\s*(?:ga|gauge)/.exec(text);
  if (gauge) return { inches: null, label: `${gauge[1]} Ga` };

  const fraction = /(\d+)\s*\/\s*(\d+)/.exec(text);
  if (fraction) {
    const value = parseInt(fraction[1], 10) / parseInt(fraction[2], 10);
    return { inches: value, label: `${fraction[1]}/${fraction[2]}"` };
  }

  const decimal = /(\d*\.?\d+)/.exec(text);
  if (decimal) {
    const value = parseFloat(decimal[1]);
    return { inches: value, label: `${decimal[1]}"` };
  }
  return { inches: null, label: null };
}

export interface SettingsGuidance {
  no_printed_table: string;
  where_the_chart_is: string;
  implication: string;
  procedure: { step: number; text: string; citation: string }[];
  navigation_note: string;
  example: Record<string, unknown>;
  gas_flow_scfh: number[];
  thickness_capability: Record<string, { range: string; citation: string }>;
  in_range?: { process: string; verdict: string };
  figure_id: string;
  citation: string;
}

/**
 * There is no settings table in the manual to look up, so this returns the
 * synergic procedure plus an explicit statement of that absence — the tool
 * exists specifically to stop the model inventing voltage/wire-speed numbers.
 */
export function getWeldSettings(
  process?: Process | null,
  thickness?: string | null,
): SettingsGuidance {
  const capability: Record<string, { range: string; citation: string }> = {};
  for (const [key, value] of Object.entries(settings.thickness_capability)) {
    if (key.startsWith("_")) continue;
    const v = value as { range: string; page: string };
    capability[key] = { range: v.range, citation: cite(v.page) };
  }

  let in_range: { process: string; verdict: string } | undefined;
  const parsed = parseThickness(thickness);
  if (process && capability[process] && (parsed.inches || parsed.label)) {
    in_range = {
      process,
      verdict: `${process} is rated for ${capability[process].range} (${capability[process].citation}). Compare against the ${parsed.label ?? thickness} you described.`,
    };
  }

  return {
    no_printed_table: settings.no_printed_settings_table.fact,
    // Surfaced as its own field rather than left inside the longer explanation:
    // "the manual has no table" reads as a dead end, when in fact the user has a
    // chart on the machine in front of them. Answers were dropping that pointer.
    where_the_chart_is:
      "A printed Settings Chart is on the INSIDE OF THE WELDER'S DOOR. Tell the user to open the wire compartment and read it — it is the chart the manual refers to for gas type and settings. Always mention this when discussing settings.",
    implication: settings.no_printed_settings_table.implication,
    procedure: settings.synergic_procedure.steps.map(
      (s: { step: number; text: string; page: string }) => ({
        step: s.step,
        text: s.text,
        citation: cite(s.page),
      }),
    ),
    navigation_note: settings.synergic_procedure.navigation_note,
    example: settings.example_screen_from_manual,
    gas_flow_scfh: settings.gas_flow.value_scfh,
    thickness_capability: capability,
    in_range,
    figure_id: settings.synergic_procedure.figure_id,
    citation: citeAll(settings.no_printed_settings_table.pages),
  };
}

export function getSpecs(topic?: string): Record<string, unknown> {
  if (!topic || topic === "all") return specs;
  const key = topic.toLowerCase();
  const map: Record<string, unknown> = {
    output: specs.output,
    connections: specs.connections,
    polarity: specs.connections,
    limits: specs.capability_limits,
    capability: specs.capability_limits,
    selection: specs.process_selection,
    process: specs.process_selection,
    comparison: specs.mig_vs_fluxcored,
    gas: specs.gas,
    product: specs.product,
  };
  return (map[key] as Record<string, unknown>) ?? specs;
}
