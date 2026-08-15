"use client";

import * as React from "react";

import { MACHINE_MAP } from "@/lib/machine/map";
import { MachineDiagram } from "@/components/machine/MachineDiagram";

/**
 * Dev harness for the machine diagram. Lets me toggle each part and confirm its
 * hotspot lands on the right component before the agent can point at them — a
 * highlight ring on the wrong socket would be a polarity error, so this gets
 * checked by eye rather than trusted.
 */
export default function DevMachinePage() {
  const views = Object.keys(MACHINE_MAP.views);
  const [view, setView] = React.useState(views[0]);
  const [highlight, setHighlight] = React.useState<string[]>([]);
  const parts = MACHINE_MAP.views[view].parts;

  return (
    <div className="min-h-screen bg-paper p-6 text-ink">
      <h1 className="mb-1 font-display text-lg font-extrabold uppercase tracking-[.04em]">
        Machine diagram harness
      </h1>
      <p className="mb-5 font-mono text-[11px] tracking-[.12em] text-muted">
        HOTSPOT VERIFICATION · NO API CALLS
      </p>

      <div className="mb-4 flex gap-px bg-line">
        {views.map((v) => (
          <button
            key={v}
            onClick={() => {
              setView(v);
              setHighlight([]);
            }}
            className={`px-3.5 py-2 font-mono text-[11px] tracking-[.1em] uppercase ${
              view === v ? "bg-ink text-paper" : "bg-paper text-muted hover:text-ink"
            }`}
          >
            {v}
          </button>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,520px)_1fr]">
        <MachineDiagram view={view} highlight={highlight} />

        <div className="flex flex-wrap content-start gap-2">
          {parts.map((p) => (
            <button
              key={p.id}
              onClick={() =>
                setHighlight((h) =>
                  h.includes(p.id) ? h.filter((x) => x !== p.id) : [...h, p.id],
                )
              }
              className={`border px-3 py-1.5 text-xs ${
                highlight.includes(p.id)
                  ? "border-rust bg-tint text-rust"
                  : "border-line text-muted-body hover:border-ink hover:text-ink"
              }`}
            >
              {p.label}
            </button>
          ))}
          <button
            onClick={() => setHighlight([])}
            className="border border-line px-3 py-1.5 font-mono text-xs text-muted-light hover:border-ink hover:text-ink"
          >
            clear
          </button>
        </div>
      </div>
    </div>
  );
}
