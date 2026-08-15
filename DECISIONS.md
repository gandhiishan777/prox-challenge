# Decisions

Running log of non-obvious choices, with the reasoning. Written as they were
made, so a reviewer can check the reasoning rather than reverse-engineer it.

---

## 1. Source documents: the fork's `files/`, not a re-download

**Context.** The working directory was empty at the start of the session (no repo,
no `files/`), so the manual was initially pulled from Harbor Freight's own site
for item 57812 as a stopgap.

**Decision.** Once the fork URL arrived, the repo was cloned and its `files/`
adopted wholesale; the downloaded copy was deleted. The fork's `owner-manual.pdf`
has a byte-identical text layer length (94,861 chars) to the Harbor Freight copy,
confirming it is the same revision — but the fork is the source of truth, and it
also carries **two documents the product page never mentions**:
`quick-start-guide.pdf` and `selection-chart.pdf`.

**Consequence.** The corpus is 3 PDFs / 51 pages, not 1 PDF / 48 pages. The two
extra documents turned out to be disproportionately valuable (see #3).

## 2. No RAG / no search tool — the whole manual lives in the system prompt

**Context.** The obvious design is a retrieval index over the manual.

**Decision.** Embed the full curated manual (~24k tokens of text layer, ~35k
after transcription) as a static system-prompt prefix, with **no** search tool.

**Why.** At this corpus size retrieval is all cost and no benefit:

- The prompt prefix is static, so it is prompt-cached. The first turn of a
  session pays the write; every later turn reads at ~10% of input price. A
  retrieval design instead appends *fresh, uncached* tokens on every question.
- Retrieval adds a round trip (~2–4 s) per question.
- Cross-referencing is an explicit grading axis ("highest amperage I can weld
  continuously on 120 V" needs the output-range spec *and* the duty-cycle table).
  A retriever has to know to run both searches; full context just reads both.
- Vocabulary mismatch ("wire keeps stopping" vs "feed motor") is a retrieval
  failure mode that simply does not exist here.

**Measured, and it moved.** The raw text layer is 23.7k tokens, but vision
transcription adds figure descriptions and spatial detail, so the assembled
document is **50.8k tokens** — just over the 50k threshold I had set myself before
measuring anything.

I kept full context anyway, and re-derived the economics rather than trusting the
guess: the prefix is cached, so a session pays ~$0.19 once and then ~$0.015 per
turn. Observed in practice: ~$0.06–0.15 per warm question. The alternative was
dropping the figure narration (33% of the corpus), but that narration is exactly
the label text that answers "which socket" — so the trim would have cost accuracy
on the question class this product exists to answer. The threshold in
`04_sectionize.py` now warns at 80k, with a note about cost between 40k and 80k.

**Escape hatch, unchanged.** Past roughly 80k tokens the design flips to
outline-in-prompt plus a `read_section` tool. That is a one-file change in
`systemPrompt.ts`.

**Residual risk.** With the manual in context, the model may answer numeric
questions from prose instead of calling the deterministic lookup tools. Mitigated
by an explicit prompt mandate plus eval assertions on tool traces.

## 3. Visual content is the whole game, and the text layer proves it

`00_inspect.py` output that shaped everything downstream:

| Document | Pages | Text layer | Implication |
|---|---|---|---|
| `owner-manual.pdf` | 48 | 94,861 chars, born-digital (InDesign) | good text, but 13 pages are vector-heavy |
| `quick-start-guide.pdf` | 2 | 576 chars | essentially all picture |
| `selection-chart.pdf` | 1 | **0 chars** | pure image — invisible to any text pipeline |

The selection chart carries the process-selection matrix *and* the fact that
aluminium requires **AC TIG** — which this DC-only machine cannot do. A text-only
pipeline would answer "what settings for TIG aluminium?" with confident nonsense.
`quick-start-guide.pdf` page 2 turned out to be the single densest page in the
corpus: all four processes' cable/polarity hookups side by side.

## 4. Figures are render-cropped, never `extract_image`d

Page 9 (wire feed mechanism) reports **0 embedded images** and page 45 (wiring
schematic) reports **26,144 vector drawings**. The figures that matter are line
art, so `page.get_images()` / `extract_image()` returns nothing usable. Every
figure is therefore cropped out of a rendered page bitmap
(`get_pixmap(dpi, clip=...)`), which works identically for vector art, photos and
mixed content, and keeps callout labels attached.

## 5. 150 DPI for committed page renders

The vision API downscales images past ~1568px on the long edge. US Letter at 150
DPI is 1275×1650 — essentially exactly that ceiling. Higher DPI is discarded by
the API; lower blurs the dense duty-cycle tables. Costs ~2.5k tokens per page
when the agent calls `view_page`. A separate 300 DPI render (gitignored) is kept
as the source for figure crops, where cropping a small region needs the headroom.

## 6. Oversized artboards are whitespace-trimmed before saving

`selection-chart.pdf` is a 2500×2500pt square whose chart occupies about the
middle third. Rendered as-is, the API's downscale would spend two thirds of the
1568px budget on blank canvas and leave the chart barely legible. Pages larger
than 1000pt are trimmed to their content bounding box first: the chart went from
2500×2500 to 2500×924, roughly **2.7× more effective resolution** on the content
that matters. This is an accuracy measure, not a file-size one.

## 7. Modern Next 16 / React 19 + sucrase, instead of pinning to React 18

**Context.** The plan called for pinning Next 14.2 / React 18.3.1, because
`react-runner` (the usual way to execute artifact code) declares peers of
`react@^16 || ^17 || ^18` and would break `npm install` against React 19.

**Decision.** Drop `react-runner` and call **sucrase** directly.

**Why.** react-runner is a thin wrapper over exactly this: transpile JSX/TS, turn
ES imports into `require` calls, capture `export default`. Verified by spike —
sucrase with `transforms: ['jsx','typescript','imports']` produces precisely the
CommonJS shape needed, in ~40 lines of our own code. That buys:

- current Next 16 + React 19 with **no stale pins and no peer conflicts**
  (`npm install` is clean, no `--legacy-peer-deps` footnote for the evaluator);
- one less dependency;
- control over module-resolution error messages, which feed the Fix-it flow.

`recharts@2.15` (rather than 3.x) is kept deliberately: it supports React 19 and
matches the API the model has the strongest priors for.

**Related:** the Agent SDK requires **zod v4**, not v3 — caught at install time.

## 8. The artifact sandbox is a standalone bundle, not a Next route

**This was the single largest course correction of the build.**

The runner is embedded as `<iframe sandbox="allow-scripts">` with
**no `allow-same-origin`**, which is what forces an opaque origin and keeps
artifact code away from the parent DOM, cookies, storage and our API.

Implemented first as a Next route (`/runner`), it never booted inside the
sandbox. Measured, in real Chrome:

| iframe sandbox | result |
|---|---|
| none | runner boots |
| `allow-scripts allow-same-origin` | runner boots |
| `allow-scripts` (opaque origin) | **never boots** |

A framework client runtime cannot start on an opaque origin — storage access
throws a `SecurityError` there, killing the hydration bootstrap before any of our
code runs.

**The tempting fix is the wrong one.** Adding `allow-same-origin` makes it work
instantly *and dissolves the entire security model*: since the runner is served
from our own origin, `allow-scripts allow-same-origin` is the documented sandbox
escape — artifact code could reach the parent document and call our API as
first-party. Chrome even warns about this combination in the console.

**Instead:** the runner is bundled by esbuild into one self-contained script
(`src/runner/entry.tsx` → `public/runner/runner.js`) served from a plain static
HTML page, with no framework runtime inside the sandbox. Strong isolation is
kept, and the entire contents of the sandbox are auditable in one file. Built
automatically via `predev`/`prebuild`, so a fresh clone still only needs
`npm install && npm run dev`.

## 9. The sandbox CSP is computed per-request in middleware

Two distinct traps, both hit and both fixed:

1. **`'self'` is meaningless on an opaque origin.** CSP `script-src 'self'`
   resolves against the *document's* origin, and an opaque origin matches
   nothing — so the policy silently blocked the runner's own scripts. The origin
   is therefore named explicitly (`request.nextUrl.origin`), which matches
   because source expressions are tested against the *resource* URL. This needs
   the request, hence middleware rather than static `headers()`.
2. **Scope it, or it takes down the app.** A first cut applied the policy to
   every route. With `default-src 'none'`, `frame-src` inherits `'none'` and the
   browser refuses to load the artifact iframe *at all* — the symptom was a
   permanently empty artifact panel plus blocked app fonts. The middleware now
   guards on the pathname explicitly rather than trusting `config.matcher` alone.

`connect-src 'none'` in production is the valuable half: the sandbox already
prevents *reading* cross-origin responses, but without this a prompt-injected
artifact could still fire no-cors beacons to exfiltrate whatever it can see.

## 10. Recharts animation is disabled at the scope layer

Charts rendered their axes, grid and reference dots but the **series line was
invisible** — reproducibly. Recharts animates series on mount by growing the
stroke from zero length; if that animation never advances (backgrounded tab,
remount mid-flight, early screenshot) the result is a zero-length path inside a
chart that otherwise looks perfectly fine. Silent wrong-looking output is the
worst failure mode for a chart whose job is to communicate a duty-cycle limit.

`isAnimationActive: false` is injected via `defaultProps` on the series
components — **not** by wrapping them, because recharts finds its children by
component identity (`findAllByType`) and a wrapper would make the series vanish
entirely. These are class components, so `defaultProps` is still honoured under
React 19. An artifact that passes the prop explicitly still wins.

## 11. Verification is done in real Chrome, not the embedded browser

The embedded browser pane does not execute scripts in sandboxed iframes at all —
verified with a minimal CSP-free page containing a single inline script, which
runs unsandboxed and stays silent sandboxed. That is an automation-environment
limitation, not a defect in the app: in real Chrome the same page boots and the
full runner completes its handshake under the strict CSP. Browser-based
verification is therefore done through Chrome. Synthetic clicks and key presses
also do not reach into the cross-origin frame, so component interactivity is
verified by driving the DOM inside the frame (native value setter + `input`
event), which confirmed the Slider updates React state correctly.

## 12. Missing transcriptions were completed by direct vision, not re-billed

The API credit ran out with 44 of 51 pages transcribed. The 7 stragglers included
the highest-value pages in the corpus (selection chart, wiring schematic, DCEP
polarity, quick-start hookups). Rather than stall, those pages were transcribed
by reading the rendered images directly in-session and writing the same
frontmatter/`[FIGURE ...]` format the script emits, so downstream stages cannot
tell the difference. `03_transcribe.py` skips existing files, so a re-run does
not overwrite them and does not re-spend credit.

**Flagged for review:** those 7 transcripts did not go through the identical
prompt path as the other 44. They are, if anything, more carefully done, but they
are the ones to spot-check first.

## 13. The sandbox was verified by attacking it, not by reading the spec

Security claims are worth what they were tested at. An artifact was written whose
only job was to escape, and it was run inside a real sandboxed frame in Chrome —
first against the dev server, then against a production build.

Production build (`npm run build && npm run start`):

| Attempt | Result |
|---|---|
| `window.origin` | `null` — confirms the opaque origin, which everything else rests on |
| `window.parent.document.title` | **BLOCKED** (SecurityError) |
| `window.parent.location.href` | **BLOCKED** (SecurityError) |
| `localStorage.setItem` | **BLOCKED** (SecurityError) |
| `sessionStorage.setItem` | **BLOCKED** (SecurityError) |
| `document.cookie` | **BLOCKED** (SecurityError) |
| `fetch('/api/chat')` | **BLOCKED** (TypeError: Failed to fetch — `connect-src 'none'`) |

**One honest caveat: in development, network access is open.** The dev CSP has to
allow `connect-src <origin> ws:` for hot reload, so an artifact running under
`npm run dev` *can* issue requests. The parent DOM, cookies and storage stay
blocked in both modes, because those come from the opaque origin rather than the
CSP. Production is the mode that matters for the deployed app, and it is closed.

Accepted and unsolved, same as claude.ai: an artifact can spin the CPU and freeze
its own frame.
