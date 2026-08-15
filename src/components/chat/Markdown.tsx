"use client";

import * as React from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";

/**
 * Assistant prose renderer.
 *
 * Every element is styled by hand rather than through a typography plugin,
 * partly because the plugin is not installed and partly because this text is
 * read at arm's length by someone holding a welding torch. The things they act
 * on -- bolded dial values, inline settings, quoted manual warnings -- are
 * deliberately louder than the surrounding sentences, and the type is set at
 * manual-page size rather than chat size for the same reason.
 */

/**
 * react-markdown emits the same `code` element for `like this` and for fenced
 * blocks, and the fence only carries a className when a language was written
 * after the backticks. Rather than guess from the className, the `pre` renderer
 * flags its subtree, so a fence with no language still styles as a block.
 */
const InsidePre = React.createContext(false);

const components: Components = {
  p: ({ children }) => (
    <p className="mb-3.5 text-[17px] leading-[1.6] text-ink text-pretty">{children}</p>
  ),

  // The agent bolds the numbers you actually dial in. Display face, heaviest
  // weight the family has at this size -- it should catch the eye from a step
  // back at the machine.
  strong: ({ children }) => (
    <strong className="font-display font-bold text-ink">{children}</strong>
  ),
  em: ({ children }) => <em className="italic">{children}</em>,

  h1: ({ children }) => (
    <h1 className="mb-2 mt-5 font-display text-[24px] font-extrabold tracking-[-.01em] text-ink">
      {children}
    </h1>
  ),
  h2: ({ children }) => (
    <h2 className="mb-2 mt-5 font-display text-[20px] font-extrabold tracking-[-.01em] text-ink">
      {children}
    </h2>
  ),
  h3: ({ children }) => (
    <h3 className="mb-2 mt-5 font-display text-[17px] font-extrabold tracking-[-.01em] text-ink">
      {children}
    </h3>
  ),

  ul: ({ children }) => (
    <ul className="my-3.5 list-disc space-y-1.5 pl-5 text-[16px] leading-[1.55] text-ink">
      {children}
    </ul>
  ),
  ol: ({ children }) => (
    <ol className="my-3.5 list-decimal space-y-1.5 pl-5 text-[16px] leading-[1.55] text-ink">
      {children}
    </ol>
  ),
  li: ({ children }) => <li className="leading-[1.55]">{children}</li>,

  a: ({ href, children }) => (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="text-rust underline underline-offset-2"
    >
      {children}
    </a>
  ),

  // The agent quotes the manual's printed WARNING blocks this way, so it has to
  // read as lifted text rather than as the agent's own voice.
  blockquote: ({ children }) => (
    <blockquote className="my-4 border-l-2 border-rust pl-3.5 italic text-muted-deep">
      {children}
    </blockquote>
  ),

  hr: () => <hr className="my-5 border-line" />,

  pre: ({ children }) => (
    <InsidePre.Provider value={true}>
      <pre className="my-4 overflow-x-auto bg-ink p-3.5 font-mono text-[13px] leading-[1.5] text-paper">
        {children}
      </pre>
    </InsidePre.Provider>
  ),

  code: ({ children }) => {
    const insidePre = React.useContext(InsidePre);
    if (insidePre) return <code>{children}</code>;
    return (
      <code className="bg-paper-rail px-1.5 py-0.5 font-mono text-[.85em] text-rust-dark">
        {children}
      </code>
    );
  },

  // Spec tables run wide (wire size x thickness x amperage). Scroll the table,
  // never the page.
  table: ({ children }) => (
    <div className="my-4 overflow-x-auto">
      <table className="w-full border-collapse">{children}</table>
    </div>
  ),
  thead: ({ children }) => (
    <thead className="bg-paper-rail text-left font-mono text-[11px] uppercase tracking-[.1em] text-muted-dark">
      {children}
    </thead>
  ),
  th: ({ children }) => (
    <th className="border border-line px-3 py-1.5 text-left font-normal">{children}</th>
  ),
  td: ({ children }) => (
    <td className="border border-line px-3 py-1.5 align-top text-[14.5px] text-ink">
      {children}
    </td>
  ),
};

export function Markdown({ children }: { children: string }) {
  return (
    <div className="[&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {children}
      </ReactMarkdown>
    </div>
  );
}
