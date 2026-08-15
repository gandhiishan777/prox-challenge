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
 * deliberately louder than the surrounding sentences.
 */

/**
 * react-markdown emits the same `code` element for `like this` and for fenced
 * blocks, and the fence only carries a className when a language was written
 * after the backticks. Rather than guess from the className, the `pre` renderer
 * flags its subtree, so a fence with no language still styles as a block.
 */
const InsidePre = React.createContext(false);

const components: Components = {
  p: ({ children }) => <p className="mb-3 leading-relaxed">{children}</p>,

  strong: ({ children }) => <strong className="font-semibold text-white">{children}</strong>,
  em: ({ children }) => <em className="italic">{children}</em>,

  h1: ({ children }) => <h1 className="mb-2 mt-4 text-lg font-semibold text-white">{children}</h1>,
  h2: ({ children }) => <h2 className="mb-2 mt-4 text-base font-semibold text-white">{children}</h2>,
  h3: ({ children }) => (
    <h3 className="mb-2 mt-4 text-sm font-semibold text-steel-100">{children}</h3>
  ),

  ul: ({ children }) => <ul className="my-3 list-disc space-y-1 pl-5">{children}</ul>,
  ol: ({ children }) => <ol className="my-3 list-decimal space-y-1 pl-5">{children}</ol>,
  li: ({ children }) => <li className="leading-relaxed">{children}</li>,

  a: ({ href, children }) => (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="text-arc-400 underline underline-offset-2"
    >
      {children}
    </a>
  ),

  blockquote: ({ children }) => (
    <blockquote className="my-3 border-l-2 border-arc-500 pl-3 italic text-steel-300">
      {children}
    </blockquote>
  ),

  hr: () => <hr className="my-4 border-steel-800" />,

  pre: ({ children }) => (
    <InsidePre.Provider value={true}>
      <pre className="my-3 overflow-x-auto rounded-lg border border-steel-800 bg-steel-900 p-3 font-mono text-sm text-steel-200">
        {children}
      </pre>
    </InsidePre.Provider>
  ),

  code: ({ children }) => {
    const insidePre = React.useContext(InsidePre);
    if (insidePre) return <code>{children}</code>;
    return (
      <code className="rounded bg-steel-800 px-1.5 py-0.5 font-mono text-[0.85em] text-arc-400">
        {children}
      </code>
    );
  },

  // Spec tables run wide (wire size x thickness x amperage). Scroll the table,
  // never the page.
  table: ({ children }) => (
    <div className="my-3 overflow-x-auto">
      <table className="w-full border-collapse text-sm">{children}</table>
    </div>
  ),
  thead: ({ children }) => (
    <thead className="bg-steel-900 text-left text-steel-300">{children}</thead>
  ),
  th: ({ children }) => (
    <th className="border border-steel-800 px-3 py-1.5 text-left font-medium">{children}</th>
  ),
  td: ({ children }) => (
    <td className="border border-steel-800 px-3 py-1.5 align-top">{children}</td>
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
