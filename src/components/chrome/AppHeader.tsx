"use client";

import * as React from "react";

import { MachineContextBar } from "./MachineContextBar";

/**
 * The masthead — the one dark band in an otherwise paper-white app.
 *
 * It carries two claims the user needs before they trust an answer: which
 * machine this is (item number and all, because Vulcan sells three welders with
 * similar names) and that the manual is actually loaded. The green dot and page
 * count are not decoration; they are the difference between "the agent read the
 * book" and "the agent is guessing".
 *
 * Row two is the machine context bar, deliberately attached to the identity
 * block rather than floated near the composer: it describes the hardware, not
 * the conversation, and it survives a new session.
 */
export function AppHeader({
  onNewSession,
  showNew,
}: {
  onNewSession: () => void;
  showNew: boolean;
}) {
  return (
    <header className="flex-shrink-0 bg-ink text-paper">
      <div className="flex h-14 items-center gap-5 px-5">
        <span
          aria-hidden
          className="block h-[26px] w-[26px] bg-rust"
          style={{ clipPath: "polygon(50% 0,100% 50%,50% 100%,0 50%)" }}
        />

        <div className="flex flex-col leading-none">
          <span className="font-display text-[15px] font-extrabold uppercase tracking-[.06em]">
            OmniPro Bench
          </span>
          <span className="mt-[3px] font-mono text-[10.5px] tracking-[.14em] text-muted-ondark">
            VULCAN OMNIPRO 220 · ITEM 57812
          </span>
        </div>

        <div className="flex-1" />

        <div className="flex items-center gap-2 font-mono text-[11px] tracking-[.08em] text-muted-ondark">
          <span aria-hidden className="h-1.5 w-1.5 bg-live" />
          <span className="whitespace-nowrap">MANUAL LOADED · 51 pp</span>
        </div>

        {showNew && (
          <button
            type="button"
            onClick={onNewSession}
            title="Start a new conversation"
            className="border border-ink-600 bg-transparent px-3 py-[7px] font-mono text-[11px] uppercase tracking-[.1em] text-paper transition-colors hover:border-rust hover:text-rust-light"
          >
            New session
          </button>
        )}
      </div>

      <MachineContextBar />
    </header>
  );
}
