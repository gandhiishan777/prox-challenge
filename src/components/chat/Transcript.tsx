"use client";

import * as React from "react";

import { useChat, type Message } from "@/lib/store";
import { pageIdForCite } from "@/lib/citations";
import { useSpeech } from "@/hooks/use-voice";
import { Markdown } from "./Markdown";
import { FigureCard } from "./FigureCard";
import { OptionChips } from "./OptionChips";
import { ToolActivity } from "./ToolActivity";
import { ArtifactChip } from "../artifacts/ArtifactChip";
import { MachineDiagram } from "../machine/MachineDiagram";

/**
 * The conversation.
 *
 * An assistant turn is a sequence of parts rather than one blob of text, because
 * a single answer interleaves prose, a figure lifted from the manual, a
 * generated tool and a set of quick replies — each has to render where it
 * actually occurred, not get appended at the end.
 *
 * Each answer opens with a header carrying its lookup count and the pages it
 * cited. That is the honest summary of where the answer came from, and putting
 * it above the prose means a skeptical reader can audit the claim before
 * reading it rather than after.
 */

/**
 * Citations live in the prose ("rated at 200A, see p. 34"), not as structured
 * data on the part, so the header reads them back out. The capture group is
 * there only to normalise the spelling — "p.12" and "p. 12" are one citation and
 * must not both land in the strip.
 */
const CITE = /\bQuick Start p\.\s*(\d)\b|\bSelection Chart\b|\bp\.\s*(\d{1,2})\b/g;

/** Unique page citations in the order the answer made them. */
function citationsIn(message: Message): string[] {
  const seen: string[] = [];
  for (const part of message.parts) {
    if (part.kind !== "text") continue;
    for (const match of part.text.matchAll(CITE)) {
      const tidy =
        match[1] !== undefined
          ? `Quick Start p. ${match[1]}`
          : match[2] !== undefined
            ? `p. ${match[2]}`
            : "Selection Chart";
      if (!seen.includes(tidy)) seen.push(tidy);
    }
  }
  return seen;
}

function SpeakerGlyph() {
  return (
    <svg
      width={13}
      height={13}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.5}
      strokeLinejoin="round"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <path d="M11 5 6 9H3v6h3l5 4V5Z" />
      <path d="M15.5 8.5a5 5 0 0 1 0 7" />
    </svg>
  );
}

function AnswerHeader({
  message,
  onOpenPage,
}: {
  message: Message;
  onOpenPage: (pageId: string) => void;
}) {
  const speech = useSpeech();
  const hasText = message.parts.some(
    (p) => p.kind === "text" && p.text.trim().length > 0,
  );
  // Before the first tool call or the first token there is nothing to summarise,
  // and a masthead over an empty answer is just furniture — the "Reading the
  // manual…" line carries that moment instead.
  if (message.activity.length === 0 && !hasText) return null;

  // Settled lookups only. An in-flight call is already visible as a pulsing row
  // in the trace below; counting it here would make the number tick up and then
  // read as final, which is the one thing this strip must not do.
  const lookups = message.activity.filter((a) => a.done).length;
  const cites = citationsIn(message);

  const answerText = message.parts
    .filter((p) => p.kind === "text")
    .map((p) => (p.kind === "text" ? p.text : ""))
    .join("\n");

  return (
    <div className="mb-4 flex items-center gap-2.5">
      <span className="font-display text-[11px] font-bold uppercase tracking-[.16em] text-rust">
        Answer
      </span>
      {speech.supported && !message.streaming && answerText.trim() && (
        <button
          type="button"
          onClick={() => speech.toggle(answerText)}
          title={speech.speaking ? "Stop reading" : "Read this answer aloud"}
          aria-pressed={speech.speaking}
          className={`transition-colors ${
            speech.speaking ? "text-rust" : "text-muted hover:text-ink"
          }`}
        >
          <SpeakerGlyph />
        </button>
      )}
      <span aria-hidden="true" className="h-px flex-1 bg-line" />
      {(lookups > 0 || cites.length > 0) && (
        <span className="font-mono text-[11px] text-muted">
          {lookups > 0 && `${lookups} lookup${lookups === 1 ? "" : "s"}`}
          {lookups > 0 && cites.length > 0 && " · "}
          {cites.map((cite, i) => {
            const pageId = pageIdForCite(cite);
            return (
              <React.Fragment key={cite}>
                {i > 0 && ", "}
                {pageId ? (
                  <button
                    type="button"
                    onClick={() => onOpenPage(pageId)}
                    title="Open this page of the manual"
                    className="underline decoration-dotted underline-offset-[3px] transition-colors hover:text-rust"
                  >
                    {cite}
                  </button>
                ) : (
                  cite
                )}
              </React.Fragment>
            );
          })}
        </span>
      )}
    </div>
  );
}

function MessageView({
  message,
  onPick,
  onOpenPage,
}: {
  message: Message;
  onPick: (option: string) => void;
  onOpenPage: (pageId: string) => void;
}) {
  const artifacts = useChat((s) => s.artifacts);
  const activeIdentifier = useChat((s) => s.panel.identifier);
  const openArtifact = useChat((s) => s.openArtifact);
  const busy = useChat((s) => s.busy);

  if (message.role === "user") {
    return (
      <div className="flex justify-end">
        <div className="max-w-[80%] bg-ink px-4 py-3 text-[15.5px] leading-[1.5] text-paper">
          {message.parts.map((part, i) =>
            part.kind === "text" ? (
              <p key={i} className="whitespace-pre-wrap">
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
    <div>
      <AnswerHeader message={message} onOpenPage={onOpenPage} />
      <ToolActivity items={message.activity} />

      {/* No wrapper spacing here on purpose: every part already carries its own
          vertical rhythm (Markdown sets paragraph margins, FigureCard its plate
          margins, OptionChips its lead-in). A `space-y-*` on this container
          would out-specify all of them and flatten a figure's breathing room to
          a hairline. Consecutive text parts cannot occur — the store appends
          into the trailing text part — so nothing is left unspaced. */}
      {message.parts.map((part, i) => {
        switch (part.kind) {
          case "text":
            return part.text.trim() ? (
              <Markdown key={i} onOpenPage={onOpenPage}>
                {part.text}
              </Markdown>
            ) : null;

          case "figure":
            return (
              <FigureCard
                key={i}
                title={part.title}
                caption={part.caption}
                src={part.src}
                citation={part.citation}
                onOpenPage={() => onOpenPage(part.pageId)}
              />
            );

          case "machine":
            return (
              <MachineDiagram
                key={i}
                view={part.view}
                highlight={part.highlight}
                className="my-6 max-w-lg"
              />
            );

          case "artifact": {
            const artifact = artifacts[part.identifier];
            if (!artifact) return null;
            return (
              <div key={i} className="my-5">
                <ArtifactChip
                  artifact={artifact}
                  active={activeIdentifier === part.identifier}
                  onOpen={() => openArtifact(part.identifier)}
                />
              </div>
            );
          }

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
        // Same bullet metrics as the trace rows below, so this line reads as the
        // first entry of the log rather than as a different kind of thing.
        <p className="flex items-center gap-[9px] font-mono text-[12px] uppercase tracking-[.1em] text-muted">
          <span
            aria-hidden="true"
            className="h-[5px] w-[5px] shrink-0 animate-pulse bg-rust"
          />
          Reading the manual…
        </p>
      )}

      {message.error && (
        <div className="mt-4 border border-rust bg-tint px-3.5 py-2.5 text-[14px] text-rust-dark">
          {message.error}
        </div>
      )}
    </div>
  );
}

export function Transcript({
  onPick,
  onOpenPage,
}: {
  onPick: (option: string) => void;
  onOpenPage: (pageId: string) => void;
}) {
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
      className="min-h-0 flex-1 overflow-y-auto px-8 pb-2 pt-7"
    >
      <div className="mx-auto flex w-full max-w-[700px] flex-col gap-7">
        {messages.map((message) => (
          <MessageView
            key={message.id}
            message={message}
            onPick={onPick}
            onOpenPage={onOpenPage}
          />
        ))}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
