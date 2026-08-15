/**
 * Standalone artifact runner — the code that runs *inside* the sandbox.
 *
 * This is deliberately NOT a Next.js route. The sandbox omits
 * `allow-same-origin`, which puts the document on an opaque origin, and a
 * framework client runtime cannot boot there: storage access throws a
 * SecurityError on an opaque origin, so the hydration bootstrap dies before any
 * of our code runs. (Verified empirically: `allow-scripts` alone never reached
 * the ready handshake, while `allow-scripts allow-same-origin` did.)
 *
 * Granting allow-same-origin would have "fixed" it by dissolving the isolation
 * we are relying on — the runner is served from our own origin, so that
 * combination lets artifact code reach the parent document and our API. Instead
 * the runner is bundled into one self-contained script with no framework
 * runtime, which keeps the strong sandbox and makes the contents of the
 * sandbox auditable in one file. See DECISIONS.md #8.
 */
import * as React from "react";
import { createRoot, type Root } from "react-dom/client";

import { compileArtifact } from "../lib/runner/compile";
import { ARTIFACT_SCOPE } from "../lib/runner/scope";
import type { ParentToRunner, RunnerToParent } from "../lib/runner/protocol";

function post(msg: RunnerToParent) {
  window.parent.postMessage(msg, "*");
}

let currentSeq = 0;

class ArtifactBoundary extends React.Component<
  { seq: number; children: React.ReactNode },
  { failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: Error) {
    post({
      kind: "error",
      seq: this.props.seq,
      phase: "render",
      message: error.message,
    });
  }

  render() {
    return this.state.failed ? null : this.props.children;
  }
}

let root: Root | null = null;

function mountPoint(): Root {
  if (!root) {
    const el = document.getElementById("artifact-root");
    if (!el) throw new Error("missing #artifact-root");
    root = createRoot(el);
  }
  return root;
}

function render(seq: number, code: string) {
  currentSeq = seq;
  const result = compileArtifact(code, ARTIFACT_SCOPE);

  if (result.error) {
    post({ kind: "error", seq, ...result.error });
    mountPoint().render(null);
    return;
  }

  const Component = result.component!;
  // Remounting under a changing key guarantees the previous version's effects,
  // timers and listeners are torn down rather than leaking across versions.
  mountPoint().render(
    <ArtifactBoundary key={seq} seq={seq}>
      <Component />
    </ArtifactBoundary>,
  );
  post({ kind: "rendered", seq });
}

// Errors thrown outside React's render pass — event handlers, timers, rejected
// promises — never reach an error boundary, and in practice they are the most
// common way a generated artifact fails. Forward them explicitly.
window.addEventListener("error", (e) => {
  post({ kind: "error", seq: currentSeq, phase: "async", message: e.message });
  e.preventDefault();
});
window.addEventListener("unhandledrejection", (e) => {
  const reason = e.reason as { message?: string } | undefined;
  post({
    kind: "error",
    seq: currentSeq,
    phase: "async",
    message: String(reason?.message ?? e.reason),
  });
  e.preventDefault();
});

window.addEventListener("message", (event: MessageEvent<ParentToRunner>) => {
  // Only the embedding parent may drive this frame.
  if (event.source !== window.parent) return;
  const data = event.data;
  if (!data || data.kind !== "render" || typeof data.code !== "string") return;
  render(data.seq, data.code);
});

// The handshake is idempotent: the parent re-sends its latest code on every
// `ready`, so it does not matter whether the frame or the code arrives first.
post({ kind: "ready" });
