"use client";

import * as React from "react";

/**
 * The source side of the artifact panel.
 *
 * No highlighter library is installed, and rather than reach for one, this uses
 * a tokenizer that can only ever wrap slices of the original string in spans --
 * it never rewrites a character, so the worst a bad match can do is colour
 * something oddly. That property is what makes it safe to run against
 * half-arrived code while the artifact is still streaming; a partially typed
 * string literal simply fails to match and renders plain.
 *
 * This is the one ink-on-paper inversion in the app. Code is the only content
 * here that is genuinely a machine surface rather than a page of the manual, so
 * it gets the ink slab and the palette's on-ink accents.
 */

/** Languages the JS-family tokenizer actually understands. Everything else renders plain. */
const JS_LIKE = new Set([
  "js",
  "jsx",
  "ts",
  "tsx",
  "javascript",
  "typescript",
  "json",
  "mjs",
  "cjs",
]);

/**
 * Order matters: comments and strings come first so that a keyword sitting
 * inside a comment or a string is swallowed by the larger match.
 */
const TOKEN_PATTERN = [
  // 1: comments
  "(\\/\\*[\\s\\S]*?\\*\\/|\\/\\/[^\\n]*)",
  // 2: strings and template literals
  "(\"(?:[^\"\\\\\\n]|\\\\.)*\"|'(?:[^'\\\\\\n]|\\\\.)*'|`(?:[^`\\\\]|\\\\.)*`)",
  // 3: numbers
  "\\b(0[xX][0-9a-fA-F]+|\\d+(?:\\.\\d+)?)\\b",
  // 4: keywords
  "\\b(const|let|var|function|return|if|else|for|while|do|import|export|from|default|class|extends|new|await|async|try|catch|finally|throw|typeof|instanceof|switch|case|break|continue|null|true|false|undefined|this|interface|type|as|void|of|in)\\b",
].join("|");

function tokenize(code: string): React.ReactNode[] {
  const nodes: React.ReactNode[] = [];
  const regex = new RegExp(TOKEN_PATTERN, "g");
  let cursor = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(code)) !== null) {
    if (match[0].length === 0) {
      regex.lastIndex += 1;
      continue;
    }
    if (match.index > cursor) nodes.push(code.slice(cursor, match.index));

    const className = match[1]
      ? "text-muted-ondark italic"
      : match[2]
        ? "text-live"
        : match[3]
          ? "text-rust-pale"
          : "text-rust-light";

    nodes.push(
      <span key={match.index} className={className}>
        {match[0]}
      </span>,
    );
    cursor = match.index + match[0].length;
  }

  if (cursor < code.length) nodes.push(code.slice(cursor));
  return nodes;
}

export function CodeView({
  code,
  language,
  streaming,
}: {
  code: string;
  language?: string | null;
  streaming?: boolean;
}) {
  const scrollRef = React.useRef<HTMLPreElement>(null);
  const [copied, setCopied] = React.useState(false);

  const highlighted = React.useMemo(() => {
    if (!language || !JS_LIKE.has(language.toLowerCase())) return code;
    return tokenize(code);
  }, [code, language]);

  // Follow the tail while the model writes, so the newest line stays in view.
  React.useEffect(() => {
    if (!streaming) return;
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [code, streaming]);

  React.useEffect(() => {
    if (!copied) return;
    const timer = window.setTimeout(() => setCopied(false), 1500);
    return () => window.clearTimeout(timer);
  }, [copied]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
    } catch {
      // Clipboard access can be denied; leaving the button unchanged is a
      // truthful "that didn't happen".
    }
  };

  return (
    <div className="relative h-full">
      <button
        type="button"
        onClick={copy}
        aria-label={copied ? "Copied" : "Copy code"}
        title={copied ? "Copied" : "Copy code"}
        className="absolute right-3 top-3 z-10 bg-ink-700 px-2 py-1 font-mono text-[10.5px] uppercase tracking-[.1em] text-paper transition-colors hover:bg-ink-600"
      >
        {copied ? "Copied" : "Copy"}
      </button>

      <pre
        ref={scrollRef}
        className="h-full overflow-auto bg-ink p-4 font-mono text-[13px] leading-relaxed text-paper"
      >
        <code>
          {highlighted}
          {streaming ? <span className="streaming-caret" /> : null}
        </code>
      </pre>
    </div>
  );
}
