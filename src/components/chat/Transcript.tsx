"use client";

import * as React from "react";
import { AlertTriangle } from "lucide-react";

import { useChat, type Message } from "@/lib/store";
import { Markdown } from "./Markdown";
import { FigureCard } from "./FigureCard";
import { OptionChips } from "./OptionChips";
import { ToolActivity } from "./ToolActivity";
import { ArtifactChip } from "../artifacts/ArtifactChip";
import { MachineDiagram } from "../machine/MachineDiagram";

/**
 * The conversation.
 *
 * Assistant messages are a sequence of parts rather than one blob of text,
 * because a single answer can interleave prose, a figure pulled from the manual,
 * an artifact card, and a set of quick replies — each rendered where it occurred.
 */
function MessageView({
  message,
  onPick,
}: {
  message: Message;
  onPick: (option: string) => void;
}) {
  const artifacts = useChat((s) => s.artifacts);
  const activeIdentifier = useChat((s) => s.panel.identifier);
  const openArtifact = useChat((s) => s.openArtifact);
  const busy = useChat((s) => s.busy);

  if (message.role === "user") {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] rounded-2xl rounded-br-md bg-steel-800 px-4 py-2.5 text-steel-100">
          {message.parts.map((part, i) =>
            part.kind === "text" ? (
              <p key={i} className="whitespace-pre-wrap leading-relaxed">
                {part.text}
              </p>
            ) : null,
          )}
        </div>
      </div>
    );
  }

  const hasContent = message.parts.length > 0;

  return (
    <div className="space-y-3">
      <ToolActivity items={message.activity} />

      {message.parts.map((part, i) => {
        switch (part.kind) {
          case "text":
            return part.text.trim() ? (
              <div key={i} className="text-steel-100">
                <Markdown>{part.text}</Markdown>
              </div>
            ) : null;

          case "figure":
            return (
              <FigureCard
                key={i}
                title={part.title}
                caption={part.caption}
                src={part.src}
                citation={part.citation}
              />
            );

          case "artifact": {
            const artifact = artifacts[part.identifier];
            if (!artifact) return null;
            return (
              <ArtifactChip
                key={i}
                artifact={artifact}
                active={activeIdentifier === part.identifier}
                onOpen={() => openArtifact(part.identifier)}
              />
            );
          }

          case "machine":
            return (
              <MachineDiagram
                key={i}
                view={part.view}
                highlight={part.highlight}
                className="max-w-lg"
              />
            );

          case "options":
            return (
              <OptionChips
                key={i}
                question={part.question}
                options={part.options}
                onPick={onPick}
                disabled={busy}
              />
            );

          default:
            return null;
        }
      })}

      {message.streaming && !hasContent && message.activity.length === 0 && (
        <p className="text-sm text-steel-500">Thinking…</p>
      )}

      {message.error && (
        <div className="flex items-start gap-2 rounded-lg border border-red-900/50 bg-red-950/40 px-3 py-2 text-sm text-red-200">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{message.error}</span>
        </div>
      )}
    </div>
  );
}

export function Transcript({ onPick }: { onPick: (option: string) => void }) {
  const messages = useChat((s) => s.messages);
  const bottomRef = React.useRef<HTMLDivElement>(null);
  const containerRef = React.useRef<HTMLDivElement>(null);
  const pinnedRef = React.useRef(true);

  // Follow the stream, but stop fighting the user if they scroll up to re-read
  // something while the answer is still coming in.
  const onScroll = () => {
    const el = containerRef.current;
    if (!el) return;
    pinnedRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
  };

  React.useEffect(() => {
    if (pinnedRef.current) {
      bottomRef.current?.scrollIntoView({ block: "end" });
    }
  }, [messages]);

  return (
    <div
      ref={containerRef}
      onScroll={onScroll}
      className="min-h-0 flex-1 space-y-6 overflow-y-auto px-4 py-6"
    >
      <div className="mx-auto w-full max-w-3xl space-y-6">
        {messages.map((message) => (
          <MessageView key={message.id} message={message} onPick={onPick} />
        ))}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
