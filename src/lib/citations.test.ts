import { describe, expect, it } from "vitest";

import { linkifyCitations, pageIdForCite, pageIdFromHref } from "./citations";

describe("linkifyCitations", () => {
  it("links owner's-manual citations", () => {
    expect(linkifyCitations("rated 25% (p. 7, p. 19).")).toBe(
      "rated 25% ([p. 7](#page-om-07), [p. 19](#page-om-19)).",
    );
    expect(linkifyCitations("see p.34 for parts")).toBe(
      "see [p.34](#page-om-34) for parts",
    );
  });

  it("links the quick start guide as its own document, not as om pages", () => {
    expect(linkifyCitations("hookups are on Quick Start p. 2.")).toBe(
      "hookups are on [Quick Start p. 2](#page-qs-02).",
    );
    // The inner "p. 2" must NOT additionally become om-02.
    expect(linkifyCitations("Quick Start p. 2")).not.toContain("om-02");
  });

  it("links the selection chart", () => {
    expect(linkifyCitations("aluminium needs AC TIG (Selection Chart).")).toBe(
      "aluminium needs AC TIG ([Selection Chart](#page-sc-01)).",
    );
  });

  it("leaves page numbers the manual does not have", () => {
    // 49–99 are not pages; "p. 0" is not a citation.
    expect(linkifyCitations("see p. 49")).toBe("see p. 49");
    expect(linkifyCitations("see p. 0")).toBe("see p. 0");
  });

  it("leaves ordinary prose alone", () => {
    const plain = "Set wire speed with the right knob. No citations here.";
    expect(linkifyCitations(plain)).toBe(plain);
  });

  it("is stable when applied twice", () => {
    const once = linkifyCitations("25% (p. 7) and Quick Start p. 2 and Selection Chart");
    expect(linkifyCitations(once)).toBe(once);
  });
});

describe("pageIdForCite / pageIdFromHref", () => {
  it("maps the three citation shapes to page ids", () => {
    expect(pageIdForCite("p. 7")).toBe("om-07");
    expect(pageIdForCite("Quick Start p. 2")).toBe("qs-02");
    expect(pageIdForCite("Selection Chart")).toBe("sc-01");
    expect(pageIdForCite("p. 99")).toBeNull();
  });

  it("reads page ids out of #page- hrefs only", () => {
    expect(pageIdFromHref("#page-om-07")).toBe("om-07");
    expect(pageIdFromHref("https://example.com")).toBeNull();
    expect(pageIdFromHref(undefined)).toBeNull();
  });
});
