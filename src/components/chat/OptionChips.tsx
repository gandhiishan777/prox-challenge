"use client";

import * as React from "react";

/**
 * Quick replies for the agent's one clarifying question.
 *
 * The user is standing at the machine, probably in gloves, so answering "which
 * gas are you running?" should be a thumb-sized target rather than a typed
 * sentence. The question itself becomes the micro-label above the row — it is
 * already short and imperative, so setting it as a caption instead of a
 * sentence keeps the chips, not the prose, as the thing being read.
 *
 * Chips stay visible after a pick (the transcript is a record of what was
 * asked) but go inert via `disabled` once the turn has moved on.
 */
export function OptionChips({
  question,
  options,
  onPick,
  disabled,
}: {
  question: string;
  options: string[];
  onPick: (option: string) => void;
  disabled?: boolean;
}) {
  return (
    <div className="mt-6">
      <p className="mb-2.5 font-mono text-[11px] uppercase tracking-[.12em] text-muted">
        {question.trim() || "Narrow it down"}
      </p>
      <div className="flex flex-wrap gap-2">
        {options.map((option) => (
          <button
            key={option}
            type="button"
            disabled={disabled}
            onClick={() => onPick(option)}
            className={`border border-ink bg-transparent px-3.5 py-[9px] text-[14px] text-ink transition-colors ${
              disabled
                ? "cursor-not-allowed opacity-50"
                : "hover:bg-ink hover:text-paper"
            }`}
          >
            {option}
          </button>
        ))}
      </div>
    </div>
  );
}
