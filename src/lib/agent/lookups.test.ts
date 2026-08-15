import { describe, expect, it } from "vitest";

import {
  getAllConnections,
  getConnections,
  getWeldSettings,
  lookupDutyCycle,
  lookupPart,
  lookupTroubleshooting,
  parseProcess,
  parseThickness,
  parseVoltage,
} from "./lookups";

/**
 * The numeric core of the agent, tested without an API key.
 *
 * These assertions encode what the manual actually says, so if a future edit to
 * the knowledge pack changes an answer, it fails here rather than in front of a
 * user standing at a live welder.
 */

describe("duty cycle", () => {
  it("answers the headline question: MIG at 200A on 240V is 25%", () => {
    const r = lookupDutyCycle("MIG", 240, 200);
    expect("error" in r).toBe(false);
    if ("error" in r) return;
    expect(r.match).toBe("exact");
    expect(r.exact?.duty_cycle_pct).toBe(25);
    expect(r.exact?.welding_minutes).toBe(2.5);
    expect(r.exact?.resting_minutes).toBe(7.5);
    expect(r.citation).toContain("p. 7");
  });

  it("reports continuous use below the 100% point", () => {
    const r = lookupDutyCycle("MIG", 240, 110);
    if ("error" in r) throw new Error(r.error);
    expect(r.match).toBe("below_continuous");
    expect(r.conservative_pct).toBe(100);
    expect(r.guidance).toMatch(/continuous/i);
  });

  it("brackets an off-table amperage instead of interpolating", () => {
    const r = lookupDutyCycle("MIG", 240, 190);
    if ("error" in r) throw new Error(r.error);
    expect(r.match).toBe("bracketed");
    expect(r.lower?.amps).toBe(115);
    expect(r.upper?.amps).toBe(200);
    // The safe bound is the higher-amperage row, not an average.
    expect(r.conservative_pct).toBe(25);
    expect(r.guidance).toMatch(/no derating curve/i);
    // It must not produce a fabricated percentage between 25 and 100.
    expect(r.guidance).not.toMatch(/\b(4[0-9]|5[0-9]|6[0-9]|7[0-9]|8[0-9]|9[0-9])%/);
  });

  it("flags amperage above the published range", () => {
    const r = lookupDutyCycle("MIG", 240, 260);
    if ("error" in r) throw new Error(r.error);
    expect(r.match).toBe("above_range");
  });

  it("maps flux-cored onto the MIG rows and says so", () => {
    const r = lookupDutyCycle("FLUX_CORED", 240, 200);
    if ("error" in r) throw new Error(r.error);
    expect(r.exact?.duty_cycle_pct).toBe(25);
    expect(r.alias_note).toMatch(/flux-cored/i);
  });

  it("covers TIG and stick on both input voltages", () => {
    const tig240 = lookupDutyCycle("TIG", 240, 175);
    const tig120 = lookupDutyCycle("TIG", 120, 125);
    const stick240 = lookupDutyCycle("STICK", 240, 175);
    const stick120 = lookupDutyCycle("STICK", 120, 80);
    if ("error" in tig240 || "error" in tig120) throw new Error("tig lookup failed");
    if ("error" in stick240 || "error" in stick120) throw new Error("stick lookup failed");
    expect(tig240.exact?.duty_cycle_pct).toBe(30);
    expect(tig120.exact?.duty_cycle_pct).toBe(40);
    expect(stick240.exact?.duty_cycle_pct).toBe(25);
    expect(stick120.exact?.duty_cycle_pct).toBe(40);
  });

  it("tolerates sloppy voltage input", () => {
    const r = lookupDutyCycle("MIG", "230v", 200);
    if ("error" in r) throw new Error(r.error);
    expect(r.input_voltage).toBe(240);
    expect(r.voltage_note).toMatch(/240/);
  });
});

describe("connections and polarity", () => {
  it("answers the TIG question: torch negative, ground clamp positive", () => {
    const r = getConnections("TIG");
    if ("error" in r) throw new Error(r.error);
    expect(r.polarity).toBe("DCEN");
    expect(r.electrode_socket).toContain("NEGATIVE");
    expect(r.work_clamp_socket).toContain("POSITIVE");
    expect(r.figure_id).toBe("polarity-tig");
  });

  it("has MIG and flux-cored as exact opposites", () => {
    const mig = getConnections("MIG");
    const flux = getConnections("FLUX_CORED");
    if ("error" in mig || "error" in flux) throw new Error("lookup failed");
    expect(mig.polarity).toBe("DCEP");
    expect(flux.polarity).toBe("DCEN");
    expect(mig.electrode_socket).not.toBe(flux.electrode_socket);
    expect(mig.work_clamp_socket).not.toBe(flux.work_clamp_socket);
  });

  it("gives stick DCEP with the holder positive", () => {
    const r = getConnections("STICK");
    if ("error" in r) throw new Error(r.error);
    expect(r.polarity).toBe("DCEP");
    expect(r.electrode_socket).toContain("POSITIVE");
  });

  it("covers all four processes with citations", () => {
    const all = getAllConnections();
    expect(all).toHaveLength(4);
    for (const c of all) {
      expect(c.citation).toBeTruthy();
      expect(c.figure_id).toBeTruthy();
    }
  });
});

describe("troubleshooting", () => {
  it("finds porosity and drops gas causes for flux-cored", () => {
    const matches = lookupTroubleshooting("porosity in my flux core welds", "FLUX_CORED");
    expect(matches.length).toBeGreaterThan(0);
    const top = matches[0];
    expect(top.entry.id).toBe("porosity-wire");

    const causeText = top.causes.map((c) => c.cause.toLowerCase()).join(" | ");
    // Polarity and dirty material apply to flux-cored...
    expect(causeText).toMatch(/polarity/);
    expect(causeText).toMatch(/dirty/);
    // ...but the shielding-gas causes are marked MIG only in the manual.
    expect(causeText).not.toMatch(/shielding gas/);
    expect(top.filtered_note).toMatch(/left out/i);
  });

  it("keeps shielding gas causes for MIG", () => {
    const matches = lookupTroubleshooting("porosity", "MIG");
    const causeText = matches[0].causes.map((c) => c.cause.toLowerCase()).join(" | ");
    expect(causeText).toMatch(/shielding gas/);
  });

  it("matches colloquial phrasing via aliases", () => {
    expect(lookupTroubleshooting("birdnest at the feeder")[0].entry.id).toBe("birdnest");
    expect(lookupTroubleshooting("blowing holes in thin sheet")[0].entry.id).toMatch(
      /burn-through/,
    );
  });

  it("returns nothing for an unrelated query rather than a bad guess", () => {
    expect(lookupTroubleshooting("how do I make coffee")).toHaveLength(0);
  });

  it("attaches a page citation to every cause", () => {
    for (const match of lookupTroubleshooting("wire stops during welding", "MIG")) {
      for (const cause of match.causes) {
        expect(cause.citation).toMatch(/^p\. \d+$|Quick Start|Selection Chart/);
      }
    }
  });
});

describe("weld settings", () => {
  it("states plainly that the manual has no settings table", () => {
    const g = getWeldSettings("MIG", "1/8");
    expect(g.no_printed_table).toMatch(/no chart|does not publish|no chart of/i);
    expect(g.procedure.length).toBeGreaterThan(3);
    expect(g.implication).toMatch(/do not state numbers|synergic/i);
  });

  it("reports thickness capability for the stated process", () => {
    const g = getWeldSettings("MIG", "1/8");
    expect(g.thickness_capability.MIG.range).toContain("3/8");
    expect(g.in_range?.verdict).toContain("22 Gauge");
  });
});

describe("parsers", () => {
  it("detects processes from natural phrasing", () => {
    expect(parseProcess("I'm running flux core wire")).toBe("FLUX_CORED");
    expect(parseProcess("doing some tig on stainless")).toBe("TIG");
    expect(parseProcess("stick welding a gate")).toBe("STICK");
    expect(parseProcess("mig welding")).toBe("MIG");
    expect(parseProcess("welding something")).toBeNull();
  });

  it("normalizes voltages", () => {
    expect(parseVoltage(110).voltage).toBe(120);
    expect(parseVoltage("240V").voltage).toBe(240);
    expect(parseVoltage("220").voltage).toBe(240);
    expect(parseVoltage(null).voltage).toBeNull();
  });

  it("parses thickness in fractions, decimals and gauge", () => {
    expect(parseThickness("1/8").inches).toBeCloseTo(0.125);
    expect(parseThickness('0.25"').inches).toBeCloseTo(0.25);
    expect(parseThickness("11 gauge").label).toBe("11 Ga");
  });
});

describe("parts", () => {
  it("finds a part by reference number and by description", () => {
    expect(lookupPart("61")[0].description).toMatch(/power cord/i);
    expect(lookupPart("fan").length).toBeGreaterThan(0);
  });
});
