"use client";

import * as React from "react";

/**
 * Renders the agent's hand-drawn SVG (hookup diagrams, polarity, gun trigger
 * wiring) into the page.
 *
 * The markup is model output going straight into the document, so it is
 * sanitized first. DOMPurify is pulled in from an effect rather than imported
 * at the top of the module on purpose: evaluated without a DOM it hands back a
 * stub with no `sanitize` method at all, so a top-level import would blow up
 * the moment this component was server-rendered. Waiting for mount also means
 * the server and the first client render agree on empty, so injecting markup
 * never fights hydration.
 */
export function SvgArtifact({ code }: { code: string }) {
  const [sanitized, setSanitized] = React.useState("");

  React.useEffect(() => {
    if (typeof window === "undefined") return;

    let cancelled = false;
    void (async () => {
      const DOMPurify = (await import("dompurify")).default;
      if (cancelled) return;
      setSanitized(
        DOMPurify.sanitize(code, { USE_PROFILES: { svg: true, svgFilters: true } }),
      );
    })();

    return () => {
      cancelled = true;
    };
  }, [code]);

  return (
    <div className="flex h-full w-full items-center justify-center overflow-auto bg-steel-950 p-4">
      {/* The agent draws dark-on-light, so the panel is white regardless of theme. */}
      <div
        className="rounded-xl bg-white p-4 [&_svg]:h-auto [&_svg]:max-w-full"
        dangerouslySetInnerHTML={{ __html: sanitized }}
      />
    </div>
  );
}
