"use client";

import * as React from "react";

/**
 * Quick replies for the agent's one clarifying question.
 *
 * The user is standing at the machine, probably in gloves, so the answer to
 * "which gas are you running?" should be a thumb-sized target rather than a
 * typed sentence. Chips stay visible after a pick (the transcript is a record
 * of what was asked) but go inert via `disabled` once the turn has moved on.
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
    <div className="my-2">
      <p className="mb-2 text-sm text-steel-300">{question}</p>
      <div className="flex flex-wrap gap-2">
        {options.map((option) => (
          <button
            key={option}
            type="button"
            disabled={disabled}
            onClick={() => onPick(option)}
            className={`rounded-full border border-steel-700 bg-steel-850 px-3 py-1.5 text-sm transition-colors ${
              disabled
                ? "cursor-not-allowed opacity-50"
                : "hover:border-arc-500 hover:text-arc-400"
            }`}
          >
            {option}
          </button>
        ))}
      </div>
    </div>
  );
}
