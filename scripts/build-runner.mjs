/**
 * Bundles the sandboxed artifact runner into a single self-contained script.
 *
 * The runner cannot use Next's client runtime (see src/runner/entry.tsx for
 * why), so it ships as one plain <script> containing React, the compiler, and
 * the module allow-list that artifacts import from.
 *
 * Runs automatically via the `predev` / `prebuild` npm hooks, so a fresh clone
 * still only needs `npm install && npm run dev`.
 */
import { build } from "esbuild";
import { statSync } from "node:fs";

const outfile = "public/runner/runner.js";

await build({
  entryPoints: ["src/runner/entry.tsx"],
  bundle: true,
  outfile,
  format: "iife",
  platform: "browser",
  target: ["es2020"],
  minify: true,
  sourcemap: false,
  jsx: "automatic",
  define: { "process.env.NODE_ENV": '"production"' },
  logLevel: "warning",
});

const kb = (statSync(outfile).size / 1024).toFixed(0);
console.log(`built ${outfile} (${kb} KB)`);
