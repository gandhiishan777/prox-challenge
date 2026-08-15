/**
 * postMessage contract between the chat app (parent) and the sandboxed artifact
 * runner (iframe).
 *
 * The runner lives on an opaque origin, so `event.origin` is the string "null"
 * and messages must be posted with targetOrigin "*". That is safe here because
 * the payload is non-secret artifact source code, and the parent authenticates
 * inbound messages by comparing `event.source` against the iframe's
 * contentWindow rather than trusting the origin.
 */

export type ParentToRunner = {
  kind: "render";
  seq: number;
  code: string;
};

export type RunnerToParent =
  | { kind: "ready" }
  | { kind: "rendered"; seq: number }
  | {
      kind: "error";
      seq: number;
      phase: "compile" | "execute" | "render" | "async";
      message: string;
      line?: number;
    };

export const RUNNER_ORIGIN = "*";
