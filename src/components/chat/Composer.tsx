"use client";

import * as React from "react";

import { useDictation } from "@/hooks/use-voice";

/**
 * The input box.
 *
 * Two things matter here. First, the textarea grows with the question -- people
 * describe a bad weld in a paragraph, not a line -- but stops at a height where
 * it still leaves the transcript visible. Second, the send button turns into a
 * stop button while the agent is talking, because the most common reason to
 * touch it mid-answer is "that's not what I meant, stop".
 *
 * It is drawn as a slip of white stock resting on the paper surface: hard
 * offset shadow, square corners, the controls sitting under a hairline rule so
 * the writing area stays the only thing that looks writable.
 */

/** Grow to about eight lines, then scroll instead of eating the transcript. */
const MAX_HEIGHT = 160;

/**
 * Spelled out rather than pulled from lucide: at 14px the icon set's stroke
 * geometry reads soft next to Archivo's caps, and these two marks are the only
 * ones the composer needs.
 */
function ArrowRightGlyph() {
  return (
    <svg
      width={14}
      height={14}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.5}
      aria-hidden="true"
    >
      <path d="M5 12h14" />
      <path d="m12 5 7 7-7 7" />
    </svg>
  );
}

function StopGlyph() {
  return (
    <svg width={14} height={14} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <rect x={7} y={7} width={10} height={10} />
    </svg>
  );
}

function MicGlyph() {
  return (
    <svg
      width={14}
      height={14}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.5}
      strokeLinecap="round"
      aria-hidden="true"
    >
      <path d="M12 3a3 3 0 0 1 3 3v5a3 3 0 0 1-6 0V6a3 3 0 0 1 3-3Z" />
      <path d="M6 11a6 6 0 0 0 12 0" />
      <path d="M12 17v4" />
    </svg>
  );
}

const MODEL_HINT =
  "Sonnet is faster and cheaper for everyday questions. Opus is for the hardest cross-referencing questions, where an answer has to be pieced together from several parts of the manual.";

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

  // What was typed before the mic went hot; the live transcript appends to it.
  const dictationBaseRef = React.useRef("");
  const dictation = useDictation((transcript) => {
    const base = dictationBaseRef.current;
    setText(base ? `${base} ${transcript}` : transcript);
  });
  const toggleDictation = () => {
    if (!dictation.listening) dictationBaseRef.current = text.trim();
    dictation.toggle();
  };

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
    <div className="border border-ink bg-white shadow-hard-sm">
      <div className="px-4 pb-1.5 pt-3.5">
        <textarea
          ref={textareaRef}
          rows={1}
          value={text}
          disabled={disabled}
          onChange={(event) => setText(event.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask about setup, settings, or a weld that's going wrong…"
          style={{ maxHeight: MAX_HEIGHT }}
          className="w-full resize-none overflow-y-auto bg-transparent text-[16px] leading-[1.55] text-ink outline-none placeholder:text-muted-light disabled:opacity-50"
        />
      </div>

      <div className="flex items-center justify-between gap-3 border-t border-line-hair px-3 pb-2.5 pt-2">
        <div className="flex items-center gap-0.5" title={MODEL_HINT}>
          {(["sonnet", "opus"] as const).map((option) => (
            <button
              key={option}
              type="button"
              aria-pressed={model === option}
              title={MODEL_HINT}
              onClick={() => onModelChange(option)}
              className={`px-2.5 py-[7px] font-mono text-[11px] tracking-[.08em] transition-colors ${
                model === option
                  ? "bg-ink text-paper"
                  : "bg-transparent text-muted hover:text-ink"
              }`}
            >
              {option === "sonnet" ? "SONNET" : "OPUS"}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          {dictation.supported && (
            <button
              type="button"
              onClick={toggleDictation}
              title={dictation.listening ? "Stop listening" : "Dictate your question"}
              aria-pressed={dictation.listening}
              className={`flex items-center gap-2 px-3 py-2.5 transition-colors ${
                dictation.listening
                  ? "animate-pulse bg-rust text-white"
                  : "bg-transparent text-muted hover:text-ink"
              }`}
            >
              <MicGlyph />
              {dictation.listening && (
                <span className="font-mono text-[11px] uppercase tracking-[.08em]">
                  Listening
                </span>
              )}
            </button>
          )}

        {busy ? (
          <button
            type="button"
            onClick={onStop}
            title="Stop generating"
            className="flex items-center gap-2 bg-rust px-4 py-2.5 font-display text-[12px] font-bold uppercase tracking-[.1em] text-white transition-colors hover:bg-rust-dark"
          >
            <StopGlyph />
            Stop
          </button>
        ) : (
          <button
            type="button"
            onClick={submit}
            disabled={!canSend}
            title="Send"
            className="flex items-center gap-2 bg-rust px-4 py-2.5 font-display text-[12px] font-bold uppercase tracking-[.1em] text-white transition-colors hover:bg-rust-dark disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-rust"
          >
            Ask
            <ArrowRightGlyph />
          </button>
        )}
        </div>
      </div>
    </div>
  );
}
