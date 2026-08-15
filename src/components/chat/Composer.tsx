"use client";

import * as React from "react";
import { ArrowUp, Square } from "lucide-react";

/**
 * The input box.
 *
 * Two things matter here. First, the textarea grows with the question -- people
 * describe a bad weld in a paragraph, not a line -- but stops at a height where
 * it still leaves the transcript visible. Second, the send button turns into a
 * stop button while the agent is talking, because the most common reason to
 * touch it mid-answer is "that's not what I meant, stop".
 */

/** Grow to about eight lines, then scroll instead of eating the transcript. */
const MAX_HEIGHT = 160;

export function Composer({
  onSend,
  onStop,
  busy,
  model,
  onModelChange,
  disabled,
}: {
  onSend: (text: string) => void;
  onStop: () => void;
  busy: boolean;
  model: "sonnet" | "opus";
  onModelChange: (m: "sonnet" | "opus") => void;
  disabled?: boolean;
}) {
  const [text, setText] = React.useState("");
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);

  const resize = React.useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    // Collapse first so the measured scrollHeight reflects the content, not the
    // height we set on the previous keystroke.
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, MAX_HEIGHT)}px`;
  }, []);

  React.useEffect(() => {
    resize();
  }, [text, resize]);

  const canSend = text.trim().length > 0 && !busy && !disabled;

  const submit = React.useCallback(() => {
    const value = text.trim();
    if (!value || busy || disabled) return;
    onSend(value);
    setText("");
    // Drop the height synchronously; the effect re-measures on the next paint.
    if (textareaRef.current) textareaRef.current.style.height = "auto";
  }, [text, busy, disabled, onSend]);

  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // isComposing guards IME candidate selection, where Enter means "commit
    // this character", not "send".
    if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      submit();
    }
  };

  return (
    <div className="rounded-2xl border border-steel-800 bg-steel-900 p-2 transition-shadow focus-within:ring-2 focus-within:ring-arc-500/40">
      <textarea
        ref={textareaRef}
        rows={1}
        value={text}
        disabled={disabled}
        onChange={(event) => setText(event.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Ask about setup, settings, or a weld that's going wrong…"
        style={{ maxHeight: MAX_HEIGHT }}
        className="w-full resize-none overflow-y-auto bg-transparent px-2 py-1.5 text-[15px] leading-relaxed text-steel-100 placeholder:text-steel-500 focus:outline-none disabled:opacity-50"
      />

      <div className="mt-1 flex items-center justify-between gap-2 px-1">
        <div
          className="flex items-center rounded-full border border-steel-800 bg-steel-950 p-0.5 text-xs"
          title="Sonnet is faster and cheaper for everyday questions. Opus is for the hardest cross-referencing questions, where an answer has to be pieced together from several parts of the manual."
        >
          {(["sonnet", "opus"] as const).map((option) => (
            <button
              key={option}
              type="button"
              aria-pressed={model === option}
              onClick={() => onModelChange(option)}
              className={`rounded-full px-2.5 py-1 transition-colors ${
                model === option
                  ? "bg-steel-700 text-white"
                  : "text-steel-400 hover:text-steel-200"
              }`}
            >
              {option === "sonnet" ? "Sonnet" : "Opus"}
            </button>
          ))}
        </div>

        {busy ? (
          <button
            type="button"
            onClick={onStop}
            aria-label="Stop generating"
            title="Stop generating"
            className="flex h-8 w-8 items-center justify-center rounded-full bg-arc-500 text-white transition-colors hover:bg-arc-600"
          >
            <Square className="h-3 w-3" fill="currentColor" aria-hidden="true" />
          </button>
        ) : (
          <button
            type="button"
            onClick={submit}
            disabled={!canSend}
            aria-label="Send"
            title="Send"
            className="flex h-8 w-8 items-center justify-center rounded-full bg-arc-500 text-white transition-colors hover:bg-arc-600 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-arc-500"
          >
            <ArrowUp className="h-4 w-4" aria-hidden="true" />
          </button>
        )}
      </div>
    </div>
  );
}
