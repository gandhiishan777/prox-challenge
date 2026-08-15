"use client";

import * as React from "react";

/**
 * The empty state.
 *
 * This screen has one job: convince someone standing at their machine, phone in
 * a greasy hand, that this is not a generic chatbot with a welding coat of
 * paint. So the four starters are not "example questions" — each one is a
 * different capability, labelled as such, in the order a skeptic would test
 * them: pull a number out of a rated table, show the manual's own diagram,
 * diagnose a bad bead, then build a working tool. The category label carries
 * that claim; the question is just the proof.
 *
 * The spec card exists for one line on it. Everyone assumes a multiprocess
 * welder does AC TIG, and this one does not. Stating it before the first
 * question is asked is cheaper than correcting it after aluminium has been
 * bought.
 */

type Starter = { category: string; question: string };

const STARTERS: Starter[] = [
  {
    category: "READS A TABLE",
    question: "What's the duty cycle for MIG at 200 A on 240 V?",
  },
  {
    category: "SHOWS A DIAGRAM",
    question: "What polarity for TIG, and which socket takes the ground clamp?",
  },
  {
    category: "DIAGNOSES",
    question:
      "I'm getting porosity in my flux-cored welds. What should I check?",
  },
  {
    category: "BUILDS A TOOL",
    question: "Build me a duty cycle calculator for all four processes.",
  },
];

/** Value is rust when the spec is the one people get wrong. */
type Spec = { label: string; value: string; warn?: boolean };

const SPECS: Spec[] = [
  { label: "MAX OUT", value: "220 A" },
  { label: "INPUT", value: "120 / 240 V" },
  { label: "PROCESSES", value: "4" },
  { label: "AC TIG", value: "NOT CAPABLE", warn: true },
];

export function Welcome({ onPick }: { onPick: (text: string) => void }) {
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
      <div className="flex flex-1 items-center justify-center px-8 py-10">
        <div className="w-full max-w-[880px]">
          <div className="grid grid-cols-1 items-start gap-9 lg:grid-cols-[minmax(0,1fr)_260px]">
            {/* Left: the pitch, then the proof. */}
            <div>
              <p className="mb-3.5 font-mono text-[11px] tracking-[.18em] text-rust">
                SUPPORT BENCH · MIG · FLUX-CORED · TIG · STICK
              </p>

              <h1 className="mb-4 text-balance font-display text-[40px] font-extrabold leading-[.98] tracking-[-.02em] sm:text-[52px]">
                Ask the manual
                <br />
                like it can talk.
              </h1>

              <p className="mb-7 max-w-[52ch] text-pretty text-[17.5px] leading-[1.55] text-muted-body">
                Every answer is read out of the owner&apos;s manual, the quick
                start guide and the process selection chart — with the page
                cited, the manual&apos;s own diagram shown where a picture is
                faster than a paragraph, and a tool built for you when a number
                needs working out.
              </p>

              <div className="flex flex-col gap-px border-b border-t border-line bg-line">
                {STARTERS.map(({ category, question }) => (
                  <button
                    key={question}
                    type="button"
                    onClick={() => onPick(question)}
                    className="flex items-center gap-4 border-0 bg-paper px-1 py-[15px] text-left transition-colors hover:bg-white"
                  >
                    <span className="w-[118px] flex-shrink-0 font-mono text-[10.5px] tracking-[.12em] text-rust">
                      {category}
                    </span>
                    <span className="flex-1 text-[16px]">{question}</span>
                    <span className="pr-1.5 font-mono text-[13px] text-muted">
                      →
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Right: the machine, and the spec that stops the wrong question. */}
            <aside className="border border-ink bg-white shadow-hard">
              <img
                src="/product.webp"
                alt="Vulcan OmniPro 220 welder"
                className="block h-[230px] w-full object-cover object-center"
              />
              <div className="border-t border-ink p-3">
                <h2 className="mb-2 font-display text-[15px] font-extrabold uppercase tracking-[.02em]">
                  OmniPro 220
                </h2>
                <dl className="flex flex-col gap-[5px] font-mono text-[11px] text-muted-deep">
                  {SPECS.map(({ label, value, warn }) => (
                    <div key={label} className="flex justify-between">
                      <dt>{label}</dt>
                      <dd className={warn ? "text-rust" : "text-ink"}>
                        {value}
                      </dd>
                    </div>
                  ))}
                </dl>
              </div>
            </aside>
          </div>
        </div>
      </div>
    </div>
  );
}
