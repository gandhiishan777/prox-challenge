"use client";

import * as React from "react";

import type { ParentToRunner, RunnerToParent } from "@/lib/runner/protocol";

/** Enough for a legitimate re-handshake; far short of a runaway loop. */
const MAX_READY_HANDSHAKES = 4;

export interface ArtifactError {
  phase: "compile" | "execute" | "render" | "async";
  message: string;
  line?: number;
}

/**
 * Hosts artifact code in a sandboxed iframe and reports failures upward.
 *
 * `sandbox="allow-scripts"` without `allow-same-origin` is the load-bearing
 * security control: it forces the frame onto an opaque origin, so the artifact
 * cannot reach the parent document, our cookies, or our API. Because the frame
 * is cross-origin we cannot inject code by touching its DOM, hence the
 * postMessage handshake.
 *
 * The parent buffers the latest code and (re)sends it whenever the runner
 * announces readiness, which makes the handshake immune to ordering races: it
 * does not matter whether the code or the iframe is ready first.
 */
export function ReactArtifactFrame({
  code,
  onError,
  onRendered,
}: {
  code: string;
  onError?: (err: ArtifactError) => void;
  onRendered?: () => void;
}) {
  const iframeRef = React.useRef<HTMLIFrameElement>(null);
  const seqRef = React.useRef(0);
  const readyRef = React.useRef(false);
  const readyCountRef = React.useRef(0);
  // The runner bundle carries React, the compiler and the chart/icon libraries,
  // so its first load is not instant. Without this the panel is simply blank for
  // a beat and looks broken rather than busy.
  const [painted, setPainted] = React.useState(false);

  // Keep callbacks in refs so the message listener never needs re-binding.
  const onErrorRef = React.useRef(onError);
  const onRenderedRef = React.useRef(onRendered);
  onErrorRef.current = onError;
  onRenderedRef.current = onRendered;

  const send = React.useCallback((source: string) => {
    const win = iframeRef.current?.contentWindow;
    if (!win || !readyRef.current) return;
    seqRef.current += 1;
    const msg: ParentToRunner = { kind: "render", seq: seqRef.current, code: source };
    win.postMessage(msg, "*");
  }, []);

  const codeRef = React.useRef(code);
  codeRef.current = code;

  React.useEffect(() => {
    const onMessage = (event: MessageEvent<RunnerToParent>) => {
      // Authenticate by frame identity: the runner's opaque origin is the
      // literal string "null", so origin checking alone proves nothing.
      if (event.source !== iframeRef.current?.contentWindow) return;
      const data = event.data;
      if (!data || typeof data !== "object") return;

      // Artifact code shares the runner's realm, so it can post these itself.
      // Honouring "ready" unboundedly lets it drive send -> re-render ->
      // re-execute -> "ready" in a loop that wedges the parent tab. But the
      // handshake must stay idempotent: React's dev-mode double effect can
      // detach the listener across a genuine "ready", and a hard block on
      // repeats leaves the panel permanently blank when that happens. So it is
      // bounded rather than forbidden.
      if (data.kind === "ready") {
        if (readyCountRef.current >= MAX_READY_HANDSHAKES) return;
        readyCountRef.current += 1;
        readyRef.current = true;
        send(codeRef.current);
        return;
      }

      // Everything else carries the sequence number it is answering; anything
      // else is a stale frame or artifact code impersonating the runner.
      if (data.seq !== seqRef.current) return;

      if (data.kind === "error") {
        setPainted(true);
        onErrorRef.current?.({
          phase: data.phase,
          message: data.message,
          line: data.line,
        });
      } else if (data.kind === "rendered") {
        setPainted(true);
        onRenderedRef.current?.();
      }
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [send]);

  React.useEffect(() => {
    send(code);
  }, [code, send]);

  return (
    <div className="relative h-full w-full bg-white">
      <iframe
        ref={iframeRef}
        src="/runner/index.html"
        // No allow-same-origin: that is what forces the opaque origin which keeps
        // artifact code away from the parent document, our cookies, and our API.
        sandbox="allow-scripts"
        title="Artifact preview"
        className="h-full w-full border-0 bg-white"
      />
      {!painted && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-white">
          {/* Same bullet metrics as the transcript's "Reading the manual…" line:
              a pulsing square, not a spinner — a circle is the one shape this
              design never draws. */}
          <span className="flex items-center gap-[9px] font-mono text-[12px] uppercase tracking-[.1em] text-muted">
            <span
              aria-hidden="true"
              className="h-[5px] w-[5px] shrink-0 animate-pulse bg-rust"
            />
            Starting sandbox…
          </span>
        </div>
      )}
    </div>
  );
}
