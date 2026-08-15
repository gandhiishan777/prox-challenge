"use client";

import * as React from "react";

/**
 * Renders mermaid flowcharts -- mostly troubleshooting trees ("porosity in the
 * bead" branching down to gas flow, contact tip, base metal prep).
 *
 * Mermaid is a heavy dependency, so it is imported on first use rather than
 * bundled into the initial load. The important behaviour here is the failure
 * path: the agent streams these in, so most of the time the parser is being
 * handed an unfinished diagram. That must show as a quiet error with the source
 * underneath, never as a thrown exception that takes the panel with it.
 *
 * The theme is "neutral" rather than "dark" because these land on paper stock;
 * a dark diagram reads as a hole punched in the page.
 */
export function MermaidArtifact({ code, id }: { code: string; id: string }) {
  const [svg, setSvg] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    const renderId = `m-${id}`;

    void (async () => {
      try {
        const mermaid = (await import("mermaid")).default;
        if (cancelled) return;

        mermaid.initialize({
          startOnLoad: false,
          securityLevel: "strict",
          theme: "neutral",
        });
        const { svg: rendered } = await mermaid.render(renderId, code);
        if (cancelled) return;

        setSvg(rendered);
        setError(null);
      } catch (err) {
        if (cancelled) return;
        setSvg("");
        setError(err instanceof Error ? err.message : String(err));
        // A failed parse leaves mermaid's scratch node parked in the document;
        // without this, a diagram that fails on every delta litters the DOM.
        document.getElementById(renderId)?.remove();
        document.getElementById(`d${renderId}`)?.remove();
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [code, id]);

  if (error) {
    return (
      <div className="w-full overflow-auto">
        <p className="mb-2.5 font-mono text-[11px] uppercase tracking-[.12em] text-rust-dark">
          Diagram failed to render: {error}
        </p>
        <pre className="overflow-x-auto border border-line bg-paper-card p-3 font-mono text-[11.5px] leading-relaxed text-muted-body">
          {code}
        </pre>
      </div>
    );
  }

  return (
    <div className="flex w-full items-center justify-center overflow-auto">
      <div
        className="border border-line-mid bg-white p-4 [&_svg]:h-auto [&_svg]:max-w-full"
        dangerouslySetInnerHTML={{ __html: svg }}
      />
    </div>
  );
}
