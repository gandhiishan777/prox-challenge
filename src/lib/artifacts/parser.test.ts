import { describe, expect, it } from "vitest";

import { ArtifactStreamParser, parseComplete, type ParseEvent } from "./parser";

/**
 * The parser's hard requirement is that chunk boundaries are invisible: the
 * model's text arrives split at arbitrary offsets, and a tag can be cut anywhere.
 * The central test therefore replays each fixture split at EVERY byte offset and
 * asserts the event stream is identical to parsing it in one go. That makes the
 * whole class of boundary bugs — raw XML flashing in the transcript, swallowed
 * prose, a lost closing tag — structurally unshippable rather than merely untested.
 */

/** Collapse adjacent text/delta events so differently-chunked runs compare equal. */
function normalize(events: ParseEvent[]): ParseEvent[] {
  const out: ParseEvent[] = [];
  for (const event of events) {
    const prev = out[out.length - 1];
    if (event.type === "text" && prev?.type === "text") {
      prev.text += event.text;
    } else if (
      event.type === "artifact_delta" &&
      prev?.type === "artifact_delta" &&
      prev.identifier === event.identifier
    ) {
      prev.delta += event.delta;
    } else {
      out.push({ ...event });
    }
  }
  return out.filter((e) => !(e.type === "text" && e.text === ""));
}

function parseInChunks(text: string, size: number): ParseEvent[] {
  const parser = new ArtifactStreamParser();
  const events: ParseEvent[] = [];
  for (let i = 0; i < text.length; i += size) {
    events.push(...parser.push(text.slice(i, i + size)));
  }
  events.push(...parser.flush());
  return normalize(events);
}

function parseSplitAt(text: string, at: number): ParseEvent[] {
  const parser = new ArtifactStreamParser();
  const events = [
    ...parser.push(text.slice(0, at)),
    ...parser.push(text.slice(at)),
    ...parser.flush(),
  ];
  return normalize(events);
}

const FIXTURES: Record<string, string> = {
  plainText: "Just an answer with no markup at all. 25% duty cycle (p. 7).",

  singleArtifact: `Here's a calculator you can keep.

<antArtifact identifier="duty-cycle-calculator" type="application/vnd.ant.react" title="Duty Cycle Calculator">
import React, { useState } from "react";
export default function C() {
  const [a, setA] = useState(200);
  return <div className="p-4">{a > 115 ? "25%" : "100%"}</div>;
}
</antArtifact>

Drag the slider to see rest periods.`,

  optionsBlock: `That depends on your input voltage.

<options question="Which input voltage are you running?">
<option>120V (standard household outlet)</option>
<option>240V (dryer/welder outlet)</option>
</options>`,

  twoArtifacts: `First one:
<antArtifact identifier="a" type="image/svg+xml" title="A"><svg/></antArtifact>
Second one:
<antArtifact identifier="b" type="application/vnd.ant.mermaid" title="B">graph TD; A-->B;</antArtifact>
Done.`,

  codeWithAngleBrackets: `<antArtifact identifier="cmp" type="application/vnd.ant.react" title="Cmp">
export default () => <div><span>a &lt; b</span>{[1,2].map(n => <i key={n}/>)}</div>;
</antArtifact>`,

  prosePunctuation: "Set it to <20 SCFH, not >30. Nothing here is a tag.",

  artifactWithLanguage: `<antArtifact identifier="snip" type="application/vnd.ant.code" language="python" title="Snip">
print("hello")
</antArtifact>`,
};

describe("chunk-boundary invariance", () => {
  for (const [name, text] of Object.entries(FIXTURES)) {
    it(`${name}: identical events at every split point`, () => {
      const expected = normalize(parseComplete(text));
      for (let at = 0; at <= text.length; at++) {
        expect(parseSplitAt(text, at), `split at ${at}`).toEqual(expected);
      }
    });

    it(`${name}: identical events at fixed chunk sizes`, () => {
      const expected = normalize(parseComplete(text));
      for (const size of [1, 2, 3, 5, 7, 13, 64]) {
        expect(parseInChunks(text, size), `chunk size ${size}`).toEqual(expected);
      }
    });
  }
});

describe("artifact extraction", () => {
  it("separates prose from artifact content", () => {
    const events = normalize(parseComplete(FIXTURES.singleArtifact));
    const kinds = events.map((e) => e.type);
    expect(kinds).toEqual([
      "text",
      "artifact_start",
      "artifact_delta",
      "artifact_end",
      "text",
    ]);

    const start = events[1];
    if (start.type !== "artifact_start") throw new Error("expected start");
    expect(start.identifier).toBe("duty-cycle-calculator");
    expect(start.artifactType).toBe("application/vnd.ant.react");
    expect(start.title).toBe("Duty Cycle Calculator");

    const body = events[2];
    if (body.type !== "artifact_delta") throw new Error("expected delta");
    expect(body.delta).toContain("useState");
    // The tag itself must never leak into either the code or the prose.
    expect(body.delta).not.toContain("antArtifact");
    const trailing = events[4];
    if (trailing.type !== "text") throw new Error("expected text");
    expect(trailing.text).toContain("Drag the slider");
    expect(trailing.text).not.toContain("antArtifact");
  });

  it("never leaks tag markup into the transcript text", () => {
    for (const text of Object.values(FIXTURES)) {
      for (const event of parseComplete(text)) {
        if (event.type === "text") {
          expect(event.text).not.toContain("<antArtifact");
          expect(event.text).not.toContain("</antArtifact>");
          expect(event.text).not.toContain("<options ");
        }
      }
    }
  });

  it("keeps JSX angle brackets inside the artifact body", () => {
    const events = normalize(parseComplete(FIXTURES.codeWithAngleBrackets));
    const body = events.find((e) => e.type === "artifact_delta");
    if (body?.type !== "artifact_delta") throw new Error("expected delta");
    expect(body.delta).toContain("<div><span>");
    expect(body.delta).toContain("map(n => <i key={n}/>)");
  });

  it("handles multiple artifacts in one message", () => {
    const events = normalize(parseComplete(FIXTURES.twoArtifacts));
    const ids = events
      .filter((e) => e.type === "artifact_start")
      .map((e) => (e.type === "artifact_start" ? e.identifier : ""));
    expect(ids).toEqual(["a", "b"]);
  });

  it("captures the language attribute for code artifacts", () => {
    const start = parseComplete(FIXTURES.artifactWithLanguage)[0];
    if (start.type !== "artifact_start") throw new Error("expected start");
    expect(start.language).toBe("python");
  });

  it("leaves ordinary angle brackets in prose alone", () => {
    const events = normalize(parseComplete(FIXTURES.prosePunctuation));
    expect(events).toHaveLength(1);
    expect(events[0].type).toBe("text");
  });
});

describe("quick replies", () => {
  it("extracts the question and its options", () => {
    const events = normalize(parseComplete(FIXTURES.optionsBlock));
    const options = events.find((e) => e.type === "options");
    if (options?.type !== "options") throw new Error("expected options");
    expect(options.question).toBe("Which input voltage are you running?");
    expect(options.options).toEqual([
      "120V (standard household outlet)",
      "240V (dryer/welder outlet)",
    ]);
  });
});

describe("degradation on truncated output", () => {
  it("marks an unterminated artifact incomplete instead of dropping it", () => {
    const parser = new ArtifactStreamParser();
    const events = [
      ...parser.push(
        `<antArtifact identifier="x" type="application/vnd.ant.react" title="X">\nconst a = 1;`,
      ),
      ...parser.flush(),
    ];
    const end = events.find((e) => e.type === "artifact_end");
    if (end?.type !== "artifact_end") throw new Error("expected end");
    expect(end.complete).toBe(false);
    const delta = events.find((e) => e.type === "artifact_delta");
    if (delta?.type !== "artifact_delta") throw new Error("expected delta");
    expect(delta.delta).toContain("const a = 1;");
  });

  it("emits a half-written opening tag as text rather than swallowing it", () => {
    const parser = new ArtifactStreamParser();
    const events = [...parser.push("Answer. <antArtifact identifi"), ...parser.flush()];
    const text = events
      .filter((e) => e.type === "text")
      .map((e) => (e.type === "text" ? e.text : ""))
      .join("");
    expect(text).toContain("Answer.");
  });

  it("recovers when a stray '<' is just prose", () => {
    const parser = new ArtifactStreamParser();
    const long = "x".repeat(5000);
    const events = [...parser.push(`<options ${long}`), ...parser.flush()];
    expect(events.some((e) => e.type === "text")).toBe(true);
  });
});
