import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { MACHINE_MAP, MACHINE_VIEWS, allParts } from "./map";

/**
 * Guards the hotspot map the same way the QA gate guards the curated numbers:
 * a coordinate that drifts out of range, a duplicate id, or a missing image
 * would put a highlight ring on the wrong part — or nothing — and that is
 * exactly the kind of silently-wrong output this project is built to avoid.
 */
const KNOWLEDGE = path.join(process.cwd(), "knowledge");

describe("machine map integrity", () => {
  it("has views with images that exist and matching pixel dims", () => {
    expect(MACHINE_VIEWS.length).toBeGreaterThan(0);
    for (const id of MACHINE_VIEWS) {
      const view = MACHINE_MAP.views[id];
      const img = path.join(KNOWLEDGE, view.image);
      expect(fs.existsSync(img), `${view.image} exists`).toBe(true);
      expect(view.px).toHaveLength(2);
      expect(view.px[0]).toBeGreaterThan(0);
      expect(view.px[1]).toBeGreaterThan(0);
      expect(view.page, `${id} cites a page`).toMatch(/^om-\d\d$/);
    }
  });

  it("has unique part ids within each view", () => {
    for (const id of MACHINE_VIEWS) {
      const ids = MACHINE_MAP.views[id].parts.map((p) => p.id);
      expect(new Set(ids).size, `${id} ids unique`).toBe(ids.length);
    }
  });

  it("keeps every hotspot inside the image", () => {
    for (const { view, part } of allParts()) {
      const where = `${view}/${part.id}`;
      if (part.shape === "circle") {
        expect(part.cx, where).toBeGreaterThanOrEqual(0);
        expect(part.cx, where).toBeLessThanOrEqual(1);
        expect(part.cy, where).toBeGreaterThanOrEqual(0);
        expect(part.cy, where).toBeLessThanOrEqual(1);
        // The marker must not spill off the left or right edge.
        expect((part.cx ?? 0) - (part.r ?? 0), where).toBeGreaterThanOrEqual(-0.02);
        expect((part.cx ?? 0) + (part.r ?? 0), where).toBeLessThanOrEqual(1.02);
      } else {
        expect(part.x, where).toBeGreaterThanOrEqual(0);
        expect(part.y, where).toBeGreaterThanOrEqual(0);
        expect((part.x ?? 0) + (part.w ?? 0), where).toBeLessThanOrEqual(1.02);
        expect((part.y ?? 0) + (part.h ?? 0), where).toBeLessThanOrEqual(1.02);
      }
    }
  });

  it("gives every part a label, keywords and a note for the agent to match on", () => {
    for (const { view, part } of allParts()) {
      const where = `${view}/${part.id}`;
      expect(part.label, where).toBeTruthy();
      expect(part.note, where).toBeTruthy();
      expect(part.keywords.length, where).toBeGreaterThan(0);
    }
  });
});
