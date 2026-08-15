/**
 * The event protocol between the chat API route and the browser.
 *
 * The server does all the parsing — artifact tags and quick-reply blocks are
 * extracted from the model's text before it leaves the server — so the client is
 * a pure renderer that never sees raw markup.
 */
export type AgentEvent =
  | { type: "session"; sessionId: string }
  | { type: "text"; delta: string }
  | {
      type: "artifact_start";
      identifier: string;
      artifactType: string;
      title: string;
      language: string | null;
    }
  | { type: "artifact_delta"; identifier: string; delta: string }
  | { type: "artifact_end"; identifier: string; complete: boolean }
  | { type: "options"; question: string; options: string[] }
  | { type: "tool_start"; id: string; label: string }
  | { type: "tool_end"; id: string }
  | {
      type: "figure";
      figureId: string;
      title: string;
      caption: string;
      src: string;
      citation: string;
      /** Source page, so the viewer can open the whole sheet behind the crop. */
      pageId: string;
    }
  | {
      type: "machine";
      view: string;
      highlight: string[];
      title: string;
      citation: string;
    }
  | { type: "error"; message: string }
  | { type: "done"; costUsd?: number };

export function encodeEvent(event: AgentEvent): string {
  return `data: ${JSON.stringify(event)}\n\n`;
}

/** Parse an SSE body into events, tolerating partial frames across reads. */
export class SseDecoder {
  private buffer = "";

  push(chunk: string): AgentEvent[] {
    this.buffer += chunk;
    const events: AgentEvent[] = [];
    let index: number;
    while ((index = this.buffer.indexOf("\n\n")) !== -1) {
      const frame = this.buffer.slice(0, index);
      this.buffer = this.buffer.slice(index + 2);
      for (const line of frame.split("\n")) {
        if (!line.startsWith("data: ")) continue;
        try {
          events.push(JSON.parse(line.slice(6)) as AgentEvent);
        } catch {
          // A malformed frame is dropped rather than killing the stream.
        }
      }
    }
    return events;
  }
}
