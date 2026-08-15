/**
 * Streaming parser for artifact and quick-reply markup in the assistant's text.
 *
 * The model emits claude.ai-style artifacts inline in its prose:
 *
 *   Here's a calculator.
 *   <antArtifact identifier="duty-cycle" type="application/vnd.ant.react" title="...">
 *   ...code...
 *   </antArtifact>
 *   Drag the slider to see the rest periods.
 *
 * and quick replies as:
 *
 *   <options question="Which process?"><option>MIG</option>...</options>
 *
 * Text arrives in deltas split at arbitrary byte offsets, so a tag can be cut
 * anywhere — `<antArtif` / `act identifier="x` / `" type=...>`. The parser holds
 * back any buffer suffix that could still turn into an opening tag, which is what
 * stops raw XML flashing in the transcript mid-stream.
 *
 * It runs server-side, inside the SSE relay, so the client only ever receives
 * clean semantic events and there is one implementation to test.
 */

export type ParseEvent =
  | { type: "text"; text: string }
  | {
      type: "artifact_start";
      identifier: string;
      artifactType: string;
      title: string;
      language: string | null;
    }
  | { type: "artifact_delta"; identifier: string; delta: string }
  | { type: "artifact_end"; identifier: string; complete: boolean }
  | { type: "options"; question: string; options: string[] };

const ARTIFACT_OPEN = "<antArtifact";
const ARTIFACT_CLOSE = "</antArtifact>";
const OPTIONS_OPEN = "<options";
const OPTIONS_CLOSE = "</options>";

/**
 * Index of the next real opening tag: `token` followed by whitespace or `>`.
 * Returns -1 if absent, or if the only candidate is a prefix still being
 * streamed (which the hold-back logic will keep buffered).
 */
function findTagStart(buffer: string, token: string): number {
  let from = 0;
  for (;;) {
    const at = buffer.indexOf(token, from);
    if (at === -1) return -1;
    const next = buffer[at + token.length];
    // Undefined means the tag name is cut by the chunk boundary; treat it as a
    // match so the caller waits for the rest rather than emitting a partial tag.
    if (next === undefined || next === ">" || /\s/.test(next)) return at;
    from = at + 1;
  }
}

/** Longest suffix of `buffer` that is a proper prefix of any of `tokens`. */
function heldBackLength(buffer: string, tokens: string[]): number {
  let longest = 0;
  for (const token of tokens) {
    const max = Math.min(buffer.length, token.length - 1);
    for (let len = max; len > longest; len--) {
      if (buffer.endsWith(token.slice(0, len))) {
        longest = len;
        break;
      }
    }
  }
  return longest;
}

/**
 * Index of the `>` that ends the tag, skipping any that sit inside a quoted
 * attribute value. Returns -1 if the tag is still incomplete.
 *
 * Naively taking the first `>` corrupts titles silently: `title="Settings for
 * >1/4 inch"` would end the tag mid-attribute, drop the title, and spill the
 * remainder (`1/4 inch">`) into the artifact's content. That is a plausible
 * title in this domain, and the failure produces no error at all.
 */
function findTagEnd(buffer: string): number {
  let quote: '"' | "'" | null = null;
  // Remembered in case the quote turns out never to close.
  let firstQuotedGt = -1;
  for (let i = 0; i < buffer.length; i++) {
    const ch = buffer[i];
    // An opening tag never spans a line. Treating a newline as the hard
    // boundary means an unbalanced quote degrades to "first '>' wins" — a
    // mangled title — instead of leaving the scanner stuck in quote mode
    // forever, which loses the artifact entirely.
    if (ch === "\n") return firstQuotedGt;
    if (quote) {
      if (ch === quote) quote = null;
      else if (ch === ">" && firstQuotedGt === -1) firstQuotedGt = i;
    } else if (ch === '"' || ch === "'") {
      quote = ch;
    } else if (ch === ">") {
      return i;
    }
  }
  return -1;
}

function parseAttributes(tag: string): Record<string, string> {
  const attrs: Record<string, string> = {};
  const re = /(\w+)\s*=\s*("([^"]*)"|'([^']*)')/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(tag))) {
    attrs[m[1]] = m[3] ?? m[4] ?? "";
  }
  return attrs;
}

type State = "text" | "artifact_tag" | "artifact_body" | "options_tag" | "options_body";

export class ArtifactStreamParser {
  private buffer = "";
  private state: State = "text";
  private identifier = "";
  private optionsQuestion = "";
  /**
   * The model always starts artifact content on the line after the opening tag,
   * so that newline is formatting rather than content. It cannot simply be
   * stripped when the tag is parsed: if the chunk boundary falls immediately
   * after `>`, the buffer is empty at that moment and the newline arrives in the
   * next chunk. The strip is therefore deferred until content actually shows up.
   */
  private stripLeadingNewline = false;
  /** The opening tag text, kept so a bail-out can re-emit prose verbatim. */
  private openingTag = "";
  /** Guards against a runaway "tag" that is really just prose containing a `<`. */
  private static readonly MAX_TAG_LENGTH = 4096;

  push(chunk: string): ParseEvent[] {
    this.buffer += chunk;
    return this.drain(false);
  }

  /** Flush at end of stream; unterminated constructs degrade rather than vanish. */
  flush(): ParseEvent[] {
    const events = this.drain(true);
    if (this.state === "artifact_body") {
      // Truncated mid-artifact (max tokens, abort). Emit what we have and mark
      // it incomplete so the UI can offer a repair rather than showing nothing.
      if (this.buffer) {
        events.push({ type: "artifact_delta", identifier: this.identifier, delta: this.buffer });
      }
      events.push({ type: "artifact_end", identifier: this.identifier, complete: false });
    } else if (this.buffer) {
      // A dangling partial tag is just text as far as the reader is concerned.
      events.push({ type: "text", text: this.buffer });
    }
    this.buffer = "";
    this.state = "text";
    return events;
  }

  private drain(final: boolean): ParseEvent[] {
    const events: ParseEvent[] = [];

    for (;;) {
      if (this.state === "text") {
        // The tag name must be followed by whitespace or '>', so that
        // "<antArtifactList>" or "<optionsomething>" appearing in prose is text
        // rather than an opening tag that swallows the rest of the message.
        const artifactAt = findTagStart(this.buffer, ARTIFACT_OPEN);
        const optionsAt = findTagStart(this.buffer, OPTIONS_OPEN);
        const at =
          artifactAt === -1 ? optionsAt : optionsAt === -1 ? artifactAt : Math.min(artifactAt, optionsAt);

        if (at === -1) {
          // Hold back anything that might still become an opening tag.
          const hold = final ? 0 : heldBackLength(this.buffer, [ARTIFACT_OPEN, OPTIONS_OPEN]);
          const emit = this.buffer.slice(0, this.buffer.length - hold);
          if (emit) events.push({ type: "text", text: emit });
          this.buffer = this.buffer.slice(this.buffer.length - hold);
          return events;
        }

        if (at > 0) events.push({ type: "text", text: this.buffer.slice(0, at) });
        this.buffer = this.buffer.slice(at);
        this.state = at === artifactAt && artifactAt !== -1 ? "artifact_tag" : "options_tag";
        continue;
      }

      if (this.state === "artifact_tag" || this.state === "options_tag") {
        const close = findTagEnd(this.buffer);
        if (close === -1) {
          if (this.buffer.length > ArtifactStreamParser.MAX_TAG_LENGTH || final) {
            // Not actually a tag. Treat it as prose so nothing is swallowed.
            events.push({ type: "text", text: this.buffer });
            this.buffer = "";
            this.state = "text";
            return events;
          }
          return events;
        }

        const tag = this.buffer.slice(0, close + 1);
        const attrs = parseAttributes(tag);
        this.buffer = this.buffer.slice(close + 1);

        if (this.state === "artifact_tag") {
          this.identifier = attrs.identifier || "artifact";
          events.push({
            type: "artifact_start",
            identifier: this.identifier,
            artifactType: attrs.type || "application/vnd.ant.code",
            title: attrs.title || "Artifact",
            language: attrs.language ?? null,
          });
          this.stripLeadingNewline = true;
          this.state = "artifact_body";
        } else {
          this.optionsQuestion = attrs.question || "";
          this.openingTag = tag;
          this.state = "options_body";
        }
        continue;
      }

      if (this.state === "artifact_body") {
        if (this.stripLeadingNewline && this.buffer.length > 0) {
          if (this.buffer.startsWith("\r\n")) {
            this.buffer = this.buffer.slice(2);
            this.stripLeadingNewline = false;
          } else if (this.buffer === "\r" && !final) {
            // Could be the first half of a CRLF. Wait for the next chunk rather
            // than committing, or the \r leaks into the artifact's first line.
            return events;
          } else if (this.buffer.startsWith("\n") || this.buffer.startsWith("\r")) {
            this.buffer = this.buffer.slice(1);
            this.stripLeadingNewline = false;
          } else {
            this.stripLeadingNewline = false;
          }
        }
        const end = this.buffer.indexOf(ARTIFACT_CLOSE);
        if (end === -1) {
          let hold = final ? 0 : heldBackLength(this.buffer, [ARTIFACT_CLOSE]);
          // A trailing newline may be the formatting break before the closing
          // tag, which is not part of the content. Hold it until we know: if
          // more content follows it goes out with the next delta, and if the
          // close tag follows it is dropped. Without this, the same artifact
          // gains a trailing blank line purely because of where a chunk landed.
          if (!final) {
            const kept = this.buffer.slice(0, this.buffer.length - hold);
            // A lone \r must be held too: it may be the first half of the CRLF
            // that precedes the closing tag. Holding only "\n" and "\r\n" let a
            // bare \r escape into artifact content when a chunk split the pair.
            if (kept.endsWith("\r\n")) hold += 2;
            else if (kept.endsWith("\n") || kept.endsWith("\r")) hold += 1;
          }
          const emit = this.buffer.slice(0, this.buffer.length - hold);
          if (emit) {
            events.push({ type: "artifact_delta", identifier: this.identifier, delta: emit });
          }
          this.buffer = this.buffer.slice(this.buffer.length - hold);
          return events;
        }

        let body = this.buffer.slice(0, end);
        if (body.endsWith("\r\n")) body = body.slice(0, -2);
        else if (body.endsWith("\n")) body = body.slice(0, -1);
        if (body) {
          events.push({ type: "artifact_delta", identifier: this.identifier, delta: body });
        }
        events.push({ type: "artifact_end", identifier: this.identifier, complete: true });
        this.buffer = this.buffer.slice(end + ARTIFACT_CLOSE.length);
        this.state = "text";
        continue;
      }

      if (this.state === "options_body") {
        // An artifact tag can never occur inside a quick-reply block, so its
        // presence proves the "<options>" we are sitting in was prose. Bail out
        // immediately and reprocess from the opening tag, rather than waiting
        // for a close tag that will never arrive and swallowing the artifact.
        const strayArtifact = findTagStart(this.buffer, ARTIFACT_OPEN);
        if (strayArtifact !== -1) {
          events.push({ type: "text", text: this.openingTag });
          this.openingTag = "";
          this.state = "text";
          continue;
        }

        const end = this.buffer.indexOf(OPTIONS_CLOSE);
        if (end === -1) {
          // The agent's own instructions contain the literal string "<options>",
          // so it appears in prose whenever the model explains quick replies.
          // Without a bail-out, one such mention swallows everything after it —
          // including any artifact — and only surfaces at end of stream.
          if (final || this.buffer.length > ArtifactStreamParser.MAX_TAG_LENGTH) {
            events.push({ type: "text", text: this.openingTag + this.buffer });
            this.buffer = "";
            this.openingTag = "";
            this.state = "text";
            continue;
          }
          return events;
        }
        const body = this.buffer.slice(0, end);
        const options = [...body.matchAll(/<option>([\s\S]*?)<\/option>/g)].map((m) =>
          m[1].trim(),
        );
        if (options.length) {
          events.push({ type: "options", question: this.optionsQuestion, options });
        } else {
          // A matched pair with no <option> children is prose, not a control.
          events.push({ type: "text", text: this.openingTag + body + OPTIONS_CLOSE });
        }
        this.openingTag = "";
        this.buffer = this.buffer.slice(end + OPTIONS_CLOSE.length);
        this.state = "text";
        continue;
      }

      return events;
    }
  }
}

/** Convenience for non-streaming input (transcript rehydration, tests). */
export function parseComplete(text: string): ParseEvent[] {
  const parser = new ArtifactStreamParser();
  return [...parser.push(text), ...parser.flush()];
}
