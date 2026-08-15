"use client";

import * as React from "react";

/**
 * Hosts a self-contained HTML artifact.
 *
 * A `srcdoc` document inherits the CSP of the page that embeds it — and the app
 * shell deliberately has none, since a restrictive policy there would block the
 * artifact iframe itself. So unlike the React path, which is served from
 * `/runner/` and picks up the sandbox CSP from the proxy, HTML artifacts arrive
 * with no network restrictions at all. The opaque origin still blocks reads of
 * the parent document, cookies and storage, but nothing stopped an artifact from
 * beaconing out what it could see.
 *
 * The policy is therefore injected into the document itself. A `<meta>` CSP is
 * honoured by the parser as it is encountered, so it must lead the document,
 * before any script or fetch has a chance to run.
 */

/** Mirrors the production policy in src/proxy.ts, minus the origin-scoped parts. */
const ARTIFACT_CSP = [
  "default-src 'none'",
  "script-src 'unsafe-inline' 'unsafe-eval'",
  "style-src 'unsafe-inline'",
  "img-src data: blob:",
  "font-src data:",
  "connect-src 'none'",
  "form-action 'none'",
  "base-uri 'none'",
].join("; ");

const META = `<meta http-equiv="Content-Security-Policy" content="${ARTIFACT_CSP}">`;

/**
 * Put the meta tag ahead of everything the parser could act on.
 *
 * Appending it after existing content would be too late: a `<script>` earlier in
 * the document would already have run under no policy.
 */
function withCsp(html: string): string {
  const headOpen = /<head[^>]*>/i.exec(html);
  if (headOpen) {
    const at = headOpen.index + headOpen[0].length;
    return html.slice(0, at) + META + html.slice(at);
  }
  const htmlOpen = /<html[^>]*>/i.exec(html);
  if (htmlOpen) {
    const at = htmlOpen.index + htmlOpen[0].length;
    return html.slice(0, at) + `<head>${META}</head>` + html.slice(at);
  }
  const doctype = /<!doctype html>/i.exec(html);
  if (doctype) {
    const at = doctype.index + doctype[0].length;
    return html.slice(0, at) + `<head>${META}</head>` + html.slice(at);
  }
  // A bare fragment: the browser will build the head, so lead with the meta.
  return META + html;
}

export function HtmlArtifactFrame({ html }: { html: string }) {
  const doc = React.useMemo(() => withCsp(html), [html]);

  return (
    <iframe
      srcDoc={doc}
      // Must stay exactly "allow-scripts". Adding allow-same-origin alongside it
      // is a sandbox escape: the frame would then run scripts *and* share our
      // origin, letting artifact code reach into this document, our cookies, and
      // our API -- and even rewrite its own sandbox attribute.
      sandbox="allow-scripts"
      className="h-full w-full border-0 bg-white"
      title="HTML artifact"
    />
  );
}

export const __test__ = { withCsp, ARTIFACT_CSP };
