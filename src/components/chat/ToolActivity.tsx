"use client";

import * as React from "react";
import { Check, Loader2 } from "lucide-react";

/**
 * The agent's "what I'm doing right now" line.
 *
 * Lookups against the manual take a couple of seconds, and silence in that gap
 * reads as a hang. This says enough to keep the user waiting ("Checking duty
 * cycle for MIG at 200A on 240V") and no more -- monospace, small, dimmed. If
 * it ever competes with the answer for attention, it has failed.
 */
export function ToolActivity({
  items,
}: {
  items: { id: string; label: string; done: boolean }[];
}) {
  if (items.length === 0) return null;

  return (
    <ul className="my-1.5 space-y-1">
      {items.map((item) => (
        <li
          key={item.id}
          className={`flex items-center gap-2 font-mono text-xs text-steel-400 ${
            item.done ? "opacity-60" : ""
          }`}
        >
          {item.done ? (
            <Check className="h-3 w-3 shrink-0 text-steel-500" aria-hidden="true" />
          ) : (
            <Loader2 className="h-3 w-3 shrink-0 animate-spin text-arc-500" aria-hidden="true" />
          )}
          <span className="truncate">{item.label}</span>
        </li>
      ))}
    </ul>
  );
}
