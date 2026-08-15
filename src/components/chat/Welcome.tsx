"use client";

import * as React from "react";
import { Flame, Gauge, Cable, Bug, Sparkles } from "lucide-react";

/**
 * The empty state.
 *
 * The starter questions are chosen to show, in one screen, that this is not a
 * text-only FAQ bot: one pulls a number out of a table, one surfaces a diagram
 * from the manual, one diagnoses a bad weld, and one builds something
 * interactive.
 */
const STARTERS = [
  {
    icon: Gauge,
    text: "What's the duty cycle for MIG welding at 200A on 240V?",
    hint: "reads the rated table",
  },
  {
    icon: Cable,
    text: "What polarity do I need for TIG, and which socket does the ground clamp go in?",
    hint: "shows the hookup diagram",
  },
  {
    icon: Bug,
    text: "I'm getting porosity in my flux-cored welds. What should I check?",
    hint: "diagnoses with photos",
  },
  {
    icon: Sparkles,
    text: "Build me a duty cycle calculator for all four processes.",
    hint: "generates an interactive tool",
  },
];

export function Welcome({ onPick }: { onPick: (text: string) => void }) {
  return (
    <div className="flex min-h-0 flex-1 items-center justify-center overflow-y-auto px-4 py-10">
      <div className="w-full max-w-2xl">
        <div className="mb-8 flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-arc-500/15 text-arc-500">
            <Flame className="h-6 w-6" />
          </span>
          <div>
            <h1 className="text-xl font-semibold text-white">OmniPro 220 Assistant</h1>
            <p className="text-sm text-steel-400">
              Vulcan multiprocess welder · MIG, flux-cored, TIG and stick · item 57812
            </p>
          </div>
        </div>

        <p className="mb-5 text-steel-300">
          Ask anything about setting the machine up or fixing a weld that is going
          wrong. Answers come from the owner&apos;s manual, quick start guide and
          selection chart, with the page cited — and with the manual&apos;s own
          diagrams and photos where a picture explains it better.
        </p>

        <div className="grid gap-2 sm:grid-cols-2">
          {STARTERS.map(({ icon: Icon, text, hint }) => (
            <button
              key={text}
              onClick={() => onPick(text)}
              className="group rounded-xl border border-steel-800 bg-steel-900 p-3 text-left transition-colors hover:border-arc-500/50 hover:bg-steel-850"
            >
              <span className="mb-1.5 flex items-center gap-2 text-xs uppercase tracking-wide text-steel-500">
                <Icon className="h-3.5 w-3.5 text-arc-500/70" />
                {hint}
              </span>
              <span className="block text-sm leading-snug text-steel-200 group-hover:text-white">
                {text}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
