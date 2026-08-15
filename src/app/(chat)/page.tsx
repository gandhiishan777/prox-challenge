"use client";

import * as React from "react";
import { Flame, PanelRightClose, RotateCcw } from "lucide-react";

import { useChat } from "@/lib/store";
import { useChatStream } from "@/hooks/use-chat-stream";
import { Transcript } from "@/components/chat/Transcript";
import { Composer } from "@/components/chat/Composer";
import { Welcome } from "@/components/chat/Welcome";
import { ArtifactPanel } from "@/components/artifacts/ArtifactPanel";

/**
 * Chat, with the artifact panel sliding in beside it.
 *
 * Two columns on a wide screen; below `lg` the panel takes over the viewport,
 * since a half-width artifact on a phone is worse than a full-screen one.
 */
export default function ChatPage() {
  const messages = useChat((s) => s.messages);
  const busy = useChat((s) => s.busy);
  const model = useChat((s) => s.model);
  const setModel = useChat((s) => s.setModel);
  const panel = useChat((s) => s.panel);
  const closePanel = useChat((s) => s.closePanel);
  const reset = useChat((s) => s.reset);
  const lastCostUsd = useChat((s) => s.lastCostUsd);

  const { send, stop } = useChatStream();
  const panelOpen = panel.open && panel.identifier !== null;

  return (
    <div className="flex h-full flex-col">
      <header className="flex shrink-0 items-center gap-3 border-b border-steel-800 px-4 py-2.5">
        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-arc-500/15 text-arc-500">
          <Flame className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-sm font-semibold text-white">
            OmniPro 220 Assistant
          </h1>
        </div>

        {lastCostUsd !== null && (
          <span
            className="hidden font-mono text-[11px] text-steel-600 sm:block"
            title="Cost of the last answer"
          >
            ${lastCostUsd.toFixed(3)}
          </span>
        )}

        {messages.length > 0 && (
          <button
            onClick={reset}
            className="flex items-center gap-1.5 rounded-lg border border-steel-800 px-2 py-1 text-xs text-steel-400 hover:border-steel-700 hover:text-steel-200"
            title="Start a new conversation"
          >
            <RotateCcw className="h-3.5 w-3.5" /> New
          </button>
        )}

        {panelOpen && (
          <button
            onClick={closePanel}
            className="rounded-lg border border-steel-800 p-1.5 text-steel-400 hover:text-steel-200 lg:hidden"
            title="Close artifact"
          >
            <PanelRightClose className="h-4 w-4" />
          </button>
        )}
      </header>

      <div
        className={`grid min-h-0 flex-1 ${
          panelOpen ? "lg:grid-cols-[minmax(0,45fr)_minmax(0,55fr)]" : "grid-cols-1"
        }`}
      >
          {/* Chat column. Hidden on small screens while an artifact is open. */}
          <div className={`flex min-h-0 flex-col ${panelOpen ? "hidden lg:flex" : "flex"}`}>
            {messages.length === 0 ? (
              <Welcome onPick={send} />
            ) : (
              <Transcript onPick={send} />
            )}

            <div className="shrink-0 px-4 pb-4">
              <div className="mx-auto w-full max-w-3xl">
                <Composer
                  onSend={send}
                  onStop={stop}
                  busy={busy}
                  model={model}
                  onModelChange={setModel}
                />
                <p className="mt-2 text-center text-[11px] text-steel-600">
                  Answers cite the manual page. Always follow the safety
                  instructions printed in the manual.
                </p>
              </div>
            </div>
          </div>

        {panelOpen && (
          <div className="min-h-0">
            <ArtifactPanel onFix={send} />
          </div>
        )}
      </div>
    </div>
  );
}
