# Phase log

What was built, what was tested, what passed, what to watch. Updated per commit.

---

## Phase 0 — Repo, materials, scaffold, spikes

**Status: complete.**

### Built
- Cloned the fork; adopted its git history and `files/` (3 PDFs). `.env` verified
  gitignored via `git check-ignore` **before** the first commit.
- `scripts/00_inspect.py` — characterizes the PDFs (page count, text-layer
  density, embedded-image and vector-drawing census). Warns if a corpus is
  scanned or too large for the full-context strategy.
- `scripts/01_render_pages.py` — renders all 51 pages at 150 DPI (committed),
  72 DPI thumbnails, and 300 DPI dev renders, with whitespace trimming for
  oversized artboards.
- `scripts/02_extract_text.py` — text-layer dumps used as transcription hints
  and as the QA grep target.
- `scripts/03_transcribe.py` — per-page vision transcription (tables to markdown,
  `?[...]?` uncertainty markers, `[FIGURE ... bbox ...]` proposals).
- Next 16 / React 19 / Tailwind 3 app scaffold.
- **Artifact runtime**: `compile.ts` (sucrase), `scope.ts` (module allow-list),
  `ui-kit.tsx` (34-component shadcn-lite kit), `entry.tsx` (standalone sandbox
  runner), `protocol.ts`, `ReactArtifactFrame.tsx`, CSP middleware,
  `scripts/build-runner.mjs`.
- `/dev/artifacts` fixture harness — exercises the full render path with zero
  API calls.

### Tested
- `00_inspect.py` on all 3 PDFs: 48 + 2 + 1 pages; owner's manual born-digital at
  23.7k tokens (**inside** the 50k full-context threshold); selection chart has a
  **zero-character** text layer.
- `01_render_pages.py`: 51 pages, 19.5 MB committed. Selection chart trimmed
  2500×2500 → 2500×924.
- Transcription: 51/51 pages present. Zero `?[]?` (fully unreadable) markers
  across the corpus; the only uncertainty markers are on pictogram icons, which
  is correct behaviour.
- **Spike A (artifact sandbox) — PASS, in real Chrome**: all four fixtures behave
  correctly. Duty-cycle calculator renders Card/Slider/Badge/lucide/recharts with
  correct values (25%, 2.5 min welding, 7.5 min resting); polarity table renders;
  broken fixture is caught by the error boundary and reported as
  `render: Cannot read properties of null (reading 'map')`; unknown-import
  fixture reports the module allow-list. Slider interactivity confirmed by
  driving the input inside the frame (200 → 100 updates React state).
- `vitest`: 8/8 compiler tests pass (JSX, hooks + TS, `@/components/ui/*`
  resolution, compile error with line number, unknown import rejected, unused
  unknown import tolerated, missing default export explained, host globals not
  leaked).
- `npm install` resolves clean — 0 vulnerabilities, no `--legacy-peer-deps`.

### Problems found and fixed
1. Agent SDK requires **zod v4**; had pinned v3 → install failed. Fixed.
2. Sandboxed iframe never booted the Next-route runner (opaque origin kills a
   framework client runtime). Rebuilt as a standalone esbuild bundle rather than
   weakening the sandbox. See DECISIONS.md #8.
3. CSP `'self'` is unmatchable on an opaque origin. Origin now named explicitly
   via middleware. See DECISIONS.md #9.
4. CSP was applied app-wide, so `default-src 'none'` made `frame-src` inherit
   `'none'` and blocked the artifact iframe entirely. Now path-guarded.
5. Recharts series rendered as invisible zero-length paths (mount animation
   stall). Animation disabled via `defaultProps`. See DECISIONS.md #10.

### Deviations from plan
- Next 14/React 18 pin **dropped** in favour of Next 16/React 19 + sucrase
  (DECISIONS.md #7) — better outcome than planned.
- Spike B (Agent SDK → SSE → browser) **deferred into Phase 2/3** rather than
  done standalone: the API credit was exhausted mid-phase, and the SDK wiring is
  built and exercised properly in those phases anyway.

### Flag for human review
- The 7 vision transcripts written in-session rather than by the script
  (DECISIONS.md #12) — spot-check these first.
- Runner bundle is 1.58 MB, dominated by the full lucide icon set. Fine locally;
  trim to a curated icon subset if load time ever matters.
