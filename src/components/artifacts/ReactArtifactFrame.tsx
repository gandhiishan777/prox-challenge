"use client";

import * as React from "react";

import type { ParentToRunner, RunnerToParent } from "@/lib/runner/protocol";

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

      if (data.kind === "ready") {
        readyRef.current = true;
        send(codeRef.current);
      } else if (data.kind === "error") {
        onErrorRef.current?.({
          phase: data.phase,
          message: data.message,
          line: data.line,
        });
      } else if (data.kind === "rendered") {
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
    <iframe
      ref={iframeRef}
      src="/runner/index.html"
      // No allow-same-origin: that is what forces the opaque origin which keeps
      // artifact code away from the parent document, our cookies, and our API.
      sandbox="allow-scripts"
      title="Artifact preview"
      className="h-full w-full border-0 bg-white"
    />
  );
}
