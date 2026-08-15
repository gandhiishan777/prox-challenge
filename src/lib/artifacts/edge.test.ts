import { describe, expect, it } from "vitest";

import { ArtifactStreamParser, parseComplete } from "./parser";

/**
 * Adversarial cases, separate from the main suite because these are the inputs
 * a reviewer would try to break the parser with rather than the ones the model
 * emits day to day.
 */

describe("attribute values containing markup characters", () => {
  it("does not end the tag at a '>' inside a quoted attribute", () => {
    // Plausible in this domain: "Settings for >1/4 inch plate".
    const text = `<antArtifact identifier="thick" type="text/markdown" title="Settings for >1/4 inch">body text</antArtifact>`;
    const events = parseComplete(text);

    const start = events.find((e) => e.type === "artifact_start");
    if (start?.type !== "artifact_start") throw new Error("expected start");
    expect(start.title).toBe("Settings for >1/4 inch");
    expect(start.identifier).toBe("thick");

    const delta = events.find((e) => e.type === "artifact_delta");
    if (delta?.type !== "artifact_delta") throw new Error("expected delta");
    // The attribute tail must not leak into the content.
    expect(delta.delta).toBe("body text");
    expect(delta.delta).not.toContain('">');
  });

  it("handles single-quoted attributes containing '>'", () => {
    const text = `<antArtifact identifier='a' type='text/markdown' title='x > y'>c</antArtifact>`;
    const start = parseComplete(text)[0];
    if (start.type !== "artifact_start") throw new Error("expected start");
    expect(start.title).toBe("x > y");
  });

  it("survives the same input split at every byte offset", () => {
    const text = `<antArtifact identifier="t" type="text/markdown" title="a > b">z</antArtifact>`;
    const expected = JSON.stringify(parseComplete(text));
    for (let at = 0; at <= text.length; at++) {
      const parser = new ArtifactStreamParser();
      const events = [
        ...parser.push(text.slice(0, at)),
        ...parser.push(text.slice(at)),
        ...parser.flush(),
      ];
      // Deltas may be split differently; compare the reassembled meaning.
      const merged = events.reduce<string>(
        (acc, e) => (e.type === "artifact_delta" ? acc + e.delta : acc),
        "",
      );
      expect(merged, `split at ${at}`).toBe("z");
      const start = events.find((e) => e.type === "artifact_start");
      if (start?.type !== "artifact_start") throw new Error(`no start at ${at}`);
      expect(start.title, `split at ${at}`).toBe("a > b");
      expect(expected).toBeTruthy();
    }
  });
});

describe("line endings", () => {
  it("strips CRLF formatting newlines around artifact content", () => {
    const text = `<antArtifact identifier="x" type="application/vnd.ant.code" title="T">\r\nconst a = 1;\r\n</antArtifact>`;
    const delta = parseComplete(text).find((e) => e.type === "artifact_delta");
    if (delta?.type !== "artifact_delta") throw new Error("expected delta");
    expect(delta.delta).toBe("const a = 1;");
  });

  it("CRLF content survives a split at EVERY byte offset", () => {
    // The earlier CRLF test called parseComplete only, so it passed while the
    // split-invariance property was broken: a chunk boundary landing between
    // \r and \n leaked a bare \r into the artifact's first or last line.
    // Checking one whole-string parse is not coverage of a streaming parser.
    const text = `<antArtifact identifier="x" type="application/vnd.ant.code" title="T">\r\nconst a = 1;\r\nconst b = 2;\r\n</antArtifact>`;
    for (let at = 0; at <= text.length; at++) {
      const parser = new ArtifactStreamParser();
      const events = [
        ...parser.push(text.slice(0, at)),
        ...parser.push(text.slice(at)),
        ...parser.flush(),
      ];
      const body = events.reduce<string>(
        (acc, e) => (e.type === "artifact_delta" ? acc + e.delta : acc),
        "",
      );
      expect(body, `split at ${at}`).toBe("const a = 1;\r\nconst b = 2;");
    }
  });
});

describe("markup that only looks like a tag", () => {
  it("a stray <options> in prose does not swallow the rest of the message", () => {
    // The agent's own instructions contain the literal "<options>", so it shows
    // up whenever the model explains quick replies. Previously this consumed
    // everything after it — including an artifact — and surfaced only at flush.
    const text =
      `Quick replies use the <options> block. Here is your chart:\n` +
      `<antArtifact identifier="c" type="application/vnd.ant.mermaid" title="C">graph TD; MIG-->DCEP;</antArtifact>\n` +
      `That covers it.`;
    const events = parseComplete(text);
    expect(events.some((e) => e.type === "artifact_start")).toBe(true);
    const body = events.find((e) => e.type === "artifact_delta");
    if (body?.type !== "artifact_delta") throw new Error("expected delta");
    expect(body.delta).toContain("graph TD");

    // The prose must round-trip, including the literal token.
    const prose = events
      .filter((e) => e.type === "text")
      .map((e) => (e.type === "text" ? e.text : ""))
      .join("");
    expect(prose).toContain("<options>");
    expect(prose).toContain("That covers it.");
  });

  it("requires a tag-name boundary, so <antArtifactList> is prose", () => {
    const text = `See <antArtifactList> for the full set.`;
    const events = parseComplete(text);
    expect(events.every((e) => e.type === "text")).toBe(true);
    const prose = events
      .map((e) => (e.type === "text" ? e.text : ""))
      .join("");
    expect(prose).toBe(text);
  });

  it("an unbalanced quote degrades to a mangled title, not a lost artifact", () => {
    // The fix for '>' inside quoted attributes originally left the scanner
    // stuck in quote mode forever when a closing quote was missing, which lost
    // the entire artifact rather than just its title.
    const text = `<antArtifact identifier="x" type="application/vnd.ant.react" title="Duty Cycle>\nconst a = 1;\n</antArtifact>`;
    const events = parseComplete(text);
    const start = events.find((e) => e.type === "artifact_start");
    expect(start).toBeDefined();
    const body = events.find((e) => e.type === "artifact_delta");
    if (body?.type !== "artifact_delta") throw new Error("expected delta");
    expect(body.delta).toContain("const a = 1;");
  });
});

describe("known and accepted limitation", () => {
  it("closes at the first </antArtifact>, even if the content mentions one", () => {
    // Same behaviour as claude.ai: an artifact that documents artifact syntax
    // truncates at the first close tag. Documented rather than solved, because
    // the alternative (counting nesting) misfires on ordinary prose.
    const text = `<antArtifact identifier="x" type="text/markdown" title="T">
Write </antArtifact> to close.
</antArtifact>
after`;
    const events = parseComplete(text);
    const end = events.find((e) => e.type === "artifact_end");
    expect(end).toBeDefined();
    const trailing = events.filter((e) => e.type === "text");
    expect(trailing.length).toBeGreaterThan(0);
  });
});
