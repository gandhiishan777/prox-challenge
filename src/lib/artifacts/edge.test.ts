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
