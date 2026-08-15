"use client";

import * as React from "react";

import { useChat } from "@/lib/store";
import { useChatStream } from "@/hooks/use-chat-stream";
import { AppHeader } from "@/components/chrome/AppHeader";
import { ReferenceRail } from "@/components/chrome/ReferenceRail";
import { Transcript } from "@/components/chat/Transcript";
import { Composer } from "@/components/chat/Composer";
import { Welcome } from "@/components/chat/Welcome";
import { ArtifactPanel } from "@/components/artifacts/ArtifactPanel";
import { ManualPanel } from "@/components/manual/ManualPanel";

/**
 * The bench: reference rail, conversation, and a right-hand panel that holds
 * either a generated tool or the manual page behind a citation.
 *
 * The three-column arrangement is the point of the layout. Answers cite pages
 * and pull figures constantly, and in a single-column chat all of that scrolls
 * away the moment the next question is asked. Keeping references parked on the
 * left and the source page open on the right means the user can check a claim
 * without losing the thread.
 */
export default function ChatPage() {
  const messages = useChat((s) => s.messages);
  const busy = useChat((s) => s.busy);
  const model = useChat((s) => s.model);
  const setModel = useChat((s) => s.setModel);
  const panel = useChat((s) => s.panel);
  const reset = useChat((s) => s.reset);
  const openManual = useChat((s) => s.openManual);

  const { send, stop } = useChatStream();

  const started = messages.length > 0;
  const panelOpen =
    panel.open &&
    ((panel.mode === "artifact" && panel.identifier !== null) ||
      (panel.mode === "manual" && panel.page !== null));

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <AppHeader onNewSession={reset} showNew={started} />

      <div className="flex min-h-0 flex-1">
        {/* Reference rail — hidden on narrow screens, where the conversation
            needs the whole width more than the shortcuts do. */}
        <div className="hidden lg:flex">
          <ReferenceRail />
        </div>

        {/* Conversation column. Hidden on small screens while a panel is open,
            because a half-width artifact on a phone is worse than a full one. */}
        <div
          className={`min-w-0 flex-1 flex-col border-r border-line ${
            panelOpen ? "hidden lg:flex" : "flex"
          }`}
        >
          {started ? (
            <Transcript onPick={send} onOpenPage={openManual} />
          ) : (
            <Welcome onPick={send} />
          )}

          <div className="flex-shrink-0 px-8 pb-5 pt-3.5">
            <div className="mx-auto w-full max-w-[700px]">
              <Composer
                onSend={send}
                onStop={stop}
                busy={busy}
                model={model}
                onModelChange={setModel}
              />
              <p className="mt-2.5 font-mono text-[10.5px] uppercase tracking-[.06em] text-muted-light">
                Every number read from a cited page. Follow the printed safety
                instructions.
              </p>
            </div>
          </div>
        </div>

        {panelOpen && (
          <div className="flex min-h-0 w-full flex-col lg:w-[46%] lg:flex-shrink-0">
            {panel.mode === "manual" ? <ManualPanel /> : <ArtifactPanel onFix={send} />}
          </div>
        )}
      </div>
    </div>
  );
}
