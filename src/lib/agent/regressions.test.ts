import { describe, expect, it } from "vitest";

import {
  getSpecs,
  getWeldSettings,
  lookupDutyCycle,
  lookupTroubleshooting,
  parseThickness,
  parseVoltage,
} from "./lookups";

/**
 * Regressions from an adversarial review.
 *
 * Each of these shipped with the main suite green, which is the point: the
 * existing tests asserted the happy path, and every bug here lived just outside
 * it. They are kept separate so it stays obvious what was learned the hard way.
 */

describe("parseVoltage: digits must not concatenate", () => {
  it("reads the voltage out of a sentence instead of gluing every digit together", () => {
    // Previously stripped non-digits to "12020", which is > 160 and therefore
    // resolved to 240V — telling a user on a 120V circuit they could weld
    // continuously at a current the manual rates at 40% duty.
    const r = parseVoltage("120 VAC 20 amp circuit");
    expect(r.voltage).toBe(120);
  });

  it("refuses to choose when both voltages are mentioned", () => {
    for (const input of ["120/240", "120 or 240", "either 120 or 240"]) {
      const r = parseVoltage(input);
      expect(r.voltage, input).toBeNull();
      expect(r.note, input).toMatch(/which power cord|both/i);
    }
  });

  it("rejects voltages this machine does not take", () => {
    // Out of range entirely: 480V three-phase, or a stray small number.
    expect(parseVoltage("480").voltage).toBeNull();
    expect(parseVoltage("12").voltage).toBeNull();
    expect(parseVoltage("hello").voltage).toBeNull();
  });

  it("reads a plain typo as the voltage the user meant", () => {
    // "-120" is a typo, not a different supply. Extracting 120 is the useful
    // reading; forcing a clarifying question over a stray hyphen is not.
    expect(parseVoltage("-120").voltage).toBe(120);
  });

  it("still normalises the ordinary sloppy cases", () => {
    expect(parseVoltage(110).voltage).toBe(120);
    expect(parseVoltage("230v").voltage).toBe(240);
    expect(parseVoltage("240V").voltage).toBe(240);
  });

  it("a 120V duty-cycle question is answered against the 120V ratings", () => {
    const r = lookupDutyCycle("MIG", "120 VAC 20 amp circuit", 100);
    if ("error" in r) throw new Error(r.error);
    expect(r.input_voltage).toBe(120);
    // 40% at 100A on 120V (p. 7) — NOT the 240V continuous rating.
    expect(r.match).toBe("exact");
    expect(r.exact?.duty_cycle_pct).toBe(40);
  });
});

describe("gas flow is per process", () => {
  it("gives TIG its own figure, not the MIG one", () => {
    // Argon at the MIG rate on a TIG torch causes turbulence and breaks the
    // shield. The old code returned 20-30 SCFH for every process, citing p. 20.
    const tig = getWeldSettings("TIG", null);
    const entry = tig.gas_flow.find((g) => g.process === "TIG");
    expect(entry?.value_scfh).toEqual([10, 25]);
    expect(entry?.citation).toBe("p. 30");
  });

  it("keeps MIG at its own figure", () => {
    const mig = getWeldSettings("MIG", null);
    const entry = mig.gas_flow.find((g) => g.process === "MIG");
    expect(entry?.value_scfh).toEqual([20, 30]);
    expect(entry?.citation).toBe("p. 20");
  });

  it("reports no gas for the processes that use none", () => {
    for (const process of ["STICK", "FLUX_CORED"] as const) {
      const entry = getWeldSettings(process, null).gas_flow[0];
      expect(entry.value_scfh, process).toBeNull();
      expect(entry.note, process).toMatch(/no shielding gas/i);
    }
  });

  it("specs.gas keeps the per-process split too", () => {
    const gas = getSpecs("gas") as { flow_rate: Record<string, { value: string }> };
    expect(gas.flow_rate.TIG.value).toContain("10");
    expect(gas.flow_rate.MIG.value).toContain("20");
  });
});

describe("duty cycle bounds", () => {
  it("does not present the maximum published figure as a safe bound above the range", () => {
    // 220A is the machine's published max output for MIG on 240V, above the
    // highest rated point (200A at 25%). The true duty cycle there must be
    // BELOW 25%, so reporting 25% as `conservative_pct` was an over-estimate.
    const r = lookupDutyCycle("MIG", 240, 220);
    if ("error" in r) throw new Error(r.error);
    expect(r.match).toBe("above_range");
    expect(r.conservative_pct).toBeUndefined();
    expect(r.max_published_pct).toBe(25);
    expect(r.guidance).toMatch(/lower than/i);
  });

  it("the bracketed bound is the minimum of the two rated points, structurally", () => {
    for (const [process, voltage, amps] of [
      ["MIG", 240, 190],
      ["MIG", 120, 90],
      ["TIG", 240, 150],
      ["STICK", 240, 140],
    ] as const) {
      const r = lookupDutyCycle(process, voltage, amps);
      if ("error" in r) throw new Error(r.error);
      expect(r.match, `${process}/${voltage}`).toBe("bracketed");
      expect(r.conservative_pct, `${process}/${voltage}`).toBe(
        Math.min(r.lower!.duty_cycle_pct, r.upper!.duty_cycle_pct),
      );
    }
  });
});

describe("troubleshooting relevance", () => {
  it("does not manufacture matches from the process alone", () => {
    // The process bonus used to be added before the relevance filter, so any
    // entry for the stated process scored above zero and an unrelated question
    // came back with three confident troubleshooting matches.
    expect(lookupTroubleshooting("how do I make coffee", "MIG")).toHaveLength(0);
    expect(lookupTroubleshooting("what colour is the machine", "TIG")).toHaveLength(0);
  });

  it("still finds a real symptom when the process is stated", () => {
    expect(lookupTroubleshooting("birdnest at the feeder", "MIG")[0].entry.id).toBe(
      "birdnest",
    );
    expect(lookupTroubleshooting("porosity", "MIG")[0].entry.id).toBe("porosity-wire");
  });

  it("never returns a match with no applicable causes", () => {
    // An entry whose causes were all filtered out by process is not an answer,
    // and handing the model an empty causes array with no citation is the shape
    // most likely to make it fill the gap from the manual prose in its context.
    const processes = ["MIG", "FLUX_CORED", "TIG", "STICK"] as const;
    const queries = [
      "porosity", "spatter", "birdnest", "wire stops", "burn through",
      "crooked bead", "no power", "weak arc", "unstable arc", "slag",
      "wavy bead", "holes in the weld", "wire not feeding", "display dark",
    ];
    for (const process of processes) {
      for (const query of queries) {
        for (const match of lookupTroubleshooting(query, process)) {
          expect(match.causes.length, `${query} / ${process}`).toBeGreaterThan(0);
          expect(match.citation, `${query} / ${process}`).not.toBe("");
        }
      }
    }
  });
});

describe("parseThickness: units and compound fractions", () => {
  it("converts metric instead of reading it as inches", () => {
    // "10mm" through the bare-number branch became 10 INCHES — a ~25× error
    // that a capability verdict then presented with a citation attached.
    expect(parseThickness("10mm").inches).toBeCloseTo(0.394, 3);
    expect(parseThickness("10 mm steel").inches).toBeCloseTo(0.394, 3);
    expect(parseThickness("1.2cm").inches).toBeCloseTo(0.472, 3);
    expect(parseThickness("10mm").label).toContain("mm");
  });

  it("sums compound fractions instead of keeping only the fraction", () => {
    // "1 1/2 inch" parsed as 0.5" — a third of the stated thickness,
    // silently accepted.
    expect(parseThickness("1 1/2 inch").inches).toBe(1.5);
    expect(parseThickness("1-1/2 in").inches).toBe(1.5);
    expect(parseThickness("2 3/8").inches).toBe(2.375);
  });

  it("does not read the 'ga' in 'galvanized' as a gauge", () => {
    // "3/8 galvanized" returned "8 Ga" — wrong kind of unit entirely.
    const r = parseThickness("3/8 galvanized");
    expect(r.inches).toBe(0.375);
    expect(r.label).toBe('3/8"');
  });

  it("still parses the ordinary cases", () => {
    expect(parseThickness("1/8").inches).toBe(0.125);
    expect(parseThickness("0.125").inches).toBe(0.125);
    expect(parseThickness("11 gauge").label).toBe("11 Ga");
    expect(parseThickness("24 ga").label).toBe("24 Ga");
    expect(parseThickness(null).inches).toBeNull();
  });
});
