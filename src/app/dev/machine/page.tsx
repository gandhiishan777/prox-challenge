"use client";

import * as React from "react";

import { MACHINE_MAP } from "@/lib/machine/map";
import { MachineDiagram } from "@/components/machine/MachineDiagram";

/**
 * Dev harness for the machine diagram. Lets me click each part and confirm its
 * hotspot lands on the right component before the agent can point at them.
 */
export default function DevMachinePage() {
  const views = Object.keys(MACHINE_MAP.views);
  const [view, setView] = React.useState(views[0]);
  const [highlight, setHighlight] = React.useState<string[]>([]);
  const parts = MACHINE_MAP.views[view].parts;

  return (
    <div className="min-h-screen bg-steel-950 p-6 text-steel-100">
      <h1 className="mb-4 text-lg font-semibold">Machine diagram harness</h1>
      <div className="mb-4 flex gap-2">
        {views.map((v) => (
          <button
            key={v}
            onClick={() => {
              setView(v);
              setHighlight([]);
            }}
            className={`rounded-md px-3 py-1.5 text-sm ${
              view === v ? "bg-arc-500 text-white" : "bg-steel-800 text-steel-300"
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
              className={`rounded-full border px-3 py-1 text-xs ${
                highlight.includes(p.id)
                  ? "border-arc-500 text-arc-400"
                  : "border-steel-700 text-steel-300"
              }`}
            >
              {p.label}
            </button>
          ))}
          <button
            onClick={() => setHighlight([])}
            className="rounded-full border border-steel-700 px-3 py-1 text-xs text-steel-500"
          >
            clear
          </button>
        </div>
      </div>
    </div>
  );
}
