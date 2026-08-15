"use client";

import * as React from "react";

/**
 * The agent's tool trace — the audit trail behind every number it quotes.
 *
 * Rendered as a monospace call list hanging off a rule, because the point is
 * "these values were looked up, not recalled." A spinner would say only that
 * something is happening; a log says what was asked and of what. Squares rather
 * than dots, since a circle is the one shape this design never draws.
 *
 * The argument section of a label is dimmed so the eye lands on the verb first
 * and can drop into the parameters only if it cares.
 */
export function ToolActivity({
  items,
}: {
  items: { id: string; label: string; done: boolean }[];
}) {
  if (items.length === 0) return null;

  return (
    <ul className="mb-[22px] flex flex-col gap-[7px] border-l-2 border-line pl-4">
      {items.map((item) => {
        // Split on the FIRST paren only — labels like "Checking duty cycle
        // (MIG, 200A, 240V)" have one argument section, and slicing rather than
        // matching guarantees no character is dropped on the odd label that
        // nests or never closes its parens.
        const cut = item.label.indexOf("(");
        const head = cut === -1 ? item.label : item.label.slice(0, cut);
        const args = cut === -1 ? "" : item.label.slice(cut);

        return (
          <li
            key={item.id}
            className="flex items-center gap-[9px] font-mono text-[11.5px]"
          >
            <span
              aria-hidden="true"
              className={`h-[5px] w-[5px] shrink-0 ${
                item.done ? "bg-muted" : "animate-pulse bg-rust"
              }`}
            />
            <span className={item.done ? "text-muted-dark" : "text-ink"}>
              {head}
              {args ? <span className="text-muted-faint">{args}</span> : null}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
