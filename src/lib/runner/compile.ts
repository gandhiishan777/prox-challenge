import { transform } from "sucrase";

/**
 * Compiles a model-authored React artifact into a renderable component.
 *
 * This is the piece that makes claude.ai-style React artifacts work in our own
 * app. The model writes idiomatic ES modules:
 *
 *   import React, { useState } from "react";
 *   import { LineChart } from "recharts";
 *   export default function Calculator() { ... }
 *
 * Sucrase rewrites that to CommonJS (`require("react")`, `exports.default = ...`)
 * and JSX to `React.createElement`. We then execute it with a `require` shim
 * that resolves only against an allow-list of modules we ship. That allow-list
 * IS the artifact's dependency surface: an import we do not provide cannot
 * resolve, so an artifact can never pull in arbitrary code.
 *
 * We use sucrase rather than react-runner (which wraps roughly this) because
 * react-runner's peer range stops at React 18, and because owning the ~40 lines
 * lets us give the model precise error messages when it imports something we
 * do not stock.
 */

export interface CompileResult {
  component?: React.ComponentType<Record<string, never>>;
  error?: { phase: "compile" | "execute"; message: string; line?: number };
}

/** Import specifiers we accept as aliases of the shadcn-style ui kit. */
const UI_PREFIXES = ["@/components/ui/", "components/ui/", "@/ui/", "./components/ui/"];

/** The machine diagram is exposed at a stable specifier, with a couple of aliases. */
const MACHINE_ALIASES = ["@/components/machine/MachineDiagram", "components/machine"];

function formatUnknownModule(name: string, available: string[]): string {
  return (
    `Module "${name}" is not available inside artifacts. ` +
    `Available imports: ${available.join(", ")}. ` +
    `Keep all data and logic inline in the component.`
  );
}

export function compileArtifact(
  source: string,
  scope: Record<string, unknown>,
): CompileResult {
  let cjs: string;
  try {
    cjs = transform(source, {
      transforms: ["jsx", "typescript", "imports"],
      jsxRuntime: "classic",
      production: true,
    }).code;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    // Sucrase reports "... (12:5)" — surface the line for the Fix-it flow.
    const line = /\((\d+):\d+\)/.exec(message)?.[1];
    return {
      error: { phase: "compile", message, line: line ? Number(line) : undefined },
    };
  }

  const moduleNames = Object.keys(scope);
  const requireShim = (name: string): unknown => {
    if (name in scope) return scope[name];

    // Any @/components/ui/* path maps onto the single ui kit object, so the
    // model can split imports across files the way shadcn projects do.
    const uiPrefix = UI_PREFIXES.find((p) => name.startsWith(p));
    if (uiPrefix && scope["@/components/ui"]) return scope["@/components/ui"];

    if (MACHINE_ALIASES.includes(name) && scope["@/components/machine"]) {
      return scope["@/components/machine"];
    }

    throw new Error(formatUnknownModule(name, moduleNames));
  };

  try {
    const module = { exports: {} as Record<string, unknown> };
    // eslint-disable-next-line no-new-func -- executing artifact code is the point;
    // isolation comes from the sandboxed opaque-origin iframe, not from the parser.
    const factory = new Function("require", "module", "exports", cjs);
    factory(requireShim, module, module.exports);

    const exported = (module.exports.default ?? module.exports) as unknown;
    if (typeof exported !== "function") {
      return {
        error: {
          phase: "execute",
          message:
            "The artifact did not export a React component. " +
            "End the file with `export default function MyComponent() { ... }`.",
        },
      };
    }
    return { component: exported as React.ComponentType<Record<string, never>> };
  } catch (err) {
    return {
      error: {
        phase: "execute",
        message: err instanceof Error ? err.message : String(err),
      },
    };
  }
}
