"use client";

import * as React from "react";

/**
 * Hosts a self-contained HTML artifact.
 *
 * Unlike the React artifacts, this needs no handshake -- the document is
 * complete, so `srcDoc` is enough.
 */
export function HtmlArtifactFrame({ html }: { html: string }) {
  return (
    <iframe
      srcDoc={html}
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
