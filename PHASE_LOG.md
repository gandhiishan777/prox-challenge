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

---

## Phase 2 — Agent core

**Status: complete.**

### Built
- `src/lib/agent/knowledge.ts` — loads the committed pack once at boot; images
  read as base64 for tool results.
- `src/lib/agent/lookups.ts` — pure deterministic lookups: duty cycle (with
  bracketing), connections/polarity, troubleshooting (with per-process cause
  filtering), settings guidance, parts, and parsers for sloppy process/voltage/
  thickness input.
- `src/lib/agent/tools.ts` — 8 in-process MCP tools, plus `describeToolCall`
  (UI activity labels) and `figureSideEffect` (so the relay can surface an image
  when the agent calls `show_figure`).
- `src/lib/agent/systemPrompt.ts` — single static string: persona, grounding
  mandate, clarification protocol, modality rules, artifact contract, connections
  quick reference, figure catalogue, full documentation.
- `src/lib/agent/run.ts` — shared config used by the web route, CLI and eval, so
  all three exercise the same agent.
- `scripts/ask.ts` — CLI harness printing the answer, the tool trace and token
  usage.

### Tested
- `vitest`: 30/30 pass (22 lookup + 8 compiler). The lookup suite pins the
  headline facts: MIG 200A/240V = 25% (2.5 min welding / 7.5 resting); off-table
  190A brackets to 115A/200A with a 25% bound and no fabricated percentage;
  TIG = DCEN with clamp POSITIVE / torch NEGATIVE; MIG and flux-cored are exact
  polarity opposites; flux-cored porosity drops the MIG-only shielding-gas causes.
- **All three challenge questions answered correctly via `npm run ask`**, each
  with the correct tool trace and page citations:
  - duty cycle -> 25%, 2.5/7.5 min, (p. 7, p. 19), 1 tool call, and volunteered
    115A as the continuous alternative.
  - flux-cored porosity -> polarity/dirty/CTWD/travel speed, explicitly noting
    that gas causes are MIG-only and do not apply; showed the porosity photo.
  - TIG polarity -> DCEN, ground clamp POSITIVE, torch NEGATIVE, (p. 24); showed
    the TIG hookup figure; added an unplug-first safety line.

### Cost characteristics (measured, not estimated)
Prompt caching is confirmed working: a warm question reports ~377k cache-read
tokens against ~3k cache-write. Cold session ~$0.80 (pays the cache write for the
~51k prefix), warm question ~$0.14. The prefix is re-read on every API call
inside the agentic loop, so cost scales with tool-call count more than with
question difficulty.

### Flag for human review
- Model ids are `claude-sonnet-5` / `claude-opus-5`. If those change, `MODEL_IDS`
  in `src/lib/agent/run.ts` is the single place to edit.

---

## Phase 3 — Artifact runtime and chat frontend

**Status: complete.**

### Built
- `src/lib/artifacts/parser.ts` — streaming parser that lifts `<antArtifact>` and
  `<options>` markup out of the model's prose. Runs server-side in the relay, so
  the client only ever receives semantic events.
- `src/lib/events.ts` — the SSE protocol plus a decoder that tolerates partial frames.
- `src/app/api/chat/route.ts` — Agent SDK to SSE bridge. Streams text deltas,
  emits tool activity, and turns a `show_figure` call into a `figure` event that
  puts the manual's own image in the transcript. Client disconnect aborts the agent.
- `src/app/api/knowledge/[...path]/route.ts` — serves pack images, with a path
  traversal guard and an image-extension allow-list.
- `src/lib/store.ts` (zustand), `src/hooks/use-chat-stream.ts`.
- Chat UI: `Transcript`, `Markdown`, `FigureCard`, `OptionChips`, `ToolActivity`,
  `Composer`, `Welcome`.
- Artifact UI: `ArtifactChip`, `ArtifactPanel` (version stepper, preview/code
  toggle, download, error card with a "Fix it" button), `CodeView`, `SvgArtifact`,
  `MermaidArtifact`, `HtmlArtifactFrame`.

### Tested
- `vitest`: 54/54 pass. The parser suite replays 7 fixtures split at **every byte
  offset** and at 7 fixed chunk sizes, asserting identical events each time.
- `npx tsc --noEmit`: clean.
- SSE relay verified end to end with curl: session, tool_start/tool_end with
  human-readable labels, streaming text deltas, a `figure` event carrying the
  right src and citation, and `done` with cost.
- Image route: 200 for a real figure; 404 for `../../.env` and for a non-image path.
- **Browser, real Chrome**: full conversation renders — streaming text, tool
  activity, the manual's TIG hookup diagram inline, correct answer with citation.
- **Artifact generation end to end**: "Build me a duty cycle calculator" produced
  a working interactive artifact. Before writing it the agent made 16 lookup calls
  to get every rated point, saying it would not guess — and the artifact carries
  page citations in its own UI.

### Problems found and fixed
1. **Parser: leading newline.** A chunk boundary immediately after the opening
   tag left the buffer empty, so the formatting newline survived into the code.
   Fixed with a deferred strip. Caught by the byte-offset suite.
2. **Parser: trailing newline.** Symmetrically, the newline before the closing tag
   was emitted as content when the chunk broke there. Now held back until it is
   known whether content or the close tag follows.
3. **A `repl` tool executed** despite `tools: []`, which should drop all built-ins.
   A support agent has no business running code, so the dangerous built-ins are
   now also named in `disallowedTools`, which removes them from context entirely.
   Verified gone on a subsequent run.
4. **Text glued across tool calls** ("...guess at any of it.Now the second..."),
   because prose written before and after a tool call merged into one part. Tool
   calls now close the paragraph.
5. **Artifact panel looked broken on first open** — the 1.6 MB runner bundle takes
   a moment on cold load. Added a "Starting sandbox…" state until the frame reports.

### Flag for human review
- The artifact panel is a hard split below `lg`: the chat column hides while an
  artifact is open. Deliberate (a half-width artifact on a phone is worse), but
  it is the layout decision most worth a second opinion.

---

## Phase 4 — Eval

**Status: complete, with one caveat recorded below.**

### Result
Full run: **15/18 passed** (`eval/results/2026-08-15T09-00-07-706Z.json`, $2.74).

All three failures were investigated individually. **One was a real gap in the
agent; two were bad assertions of mine.** Each was fixed and re-verified:

1. **`settings-ambiguous` — real gap.** Asked for settings for 1/8" steel, the
   agent correctly asked one clarifying question, then on the follow-up said
   "There's no printed chart for this". True of the manual, but misleading: there
   IS a Settings Chart on the inside of the welder's door, which is actionable for
   someone standing at the machine. The fact was in `settings.json` but buried
   inside a longer sentence, and answers were dropping it. Fixed by surfacing
   `where_the_chart_is` as its own field in the tool result. Coverage went
   **0.50 → 0.95**.

2. **`birdnest` — bad assertion.** Gate required the word "pressure". The agent
   said "feed tension" and "Feed Tensioner knob" — which is what is actually
   printed on the machine, and better for the user. Judge scored coverage 1.00,
   tone 5. Gate replaced with `must_contain_any: ["pressure", "tension"]`.

3. **`extension-cord` — bad assertion.** Gate required the substring "not". The
   agent opened with "No — two separate no's there", refused correctly, and went
   further than the gold facts by also catching that outdoor use is prohibited
   (p. 4). A substring check on "not" was testing word choice, not correctness.
   Replaced with a refusal-phrase set plus a `must_not_contain` on affirmative
   phrasings, which is the actual requirement.

Re-run of those three after the fixes: **3/3 pass** (coverage 95%, 95%, 100%).

**Caveat, stated plainly:** the full 18-case suite has not been re-run end to end
since those fixes, because the API budget for this session was nearly exhausted
($3.49 total across eval runs). 15 cases passed unchanged and the 3 fixed ones
were each verified individually, so the expected full-suite result is 18/18 — but
that specific number has not been observed in one run. Re-running `npm run eval`
costs roughly $2.50 and would confirm it.

### Cost per case
$0.04–0.18 warm; the first case of a run pays the cache write (observed $0.76).
The artifact-generation case is the most expensive at $0.37, because the agent
makes a lookup call per rated point before writing any numbers into the artifact.

### Notable behaviours observed
- The off-table 190A case passed: no interpolated percentage was presented as a
  manual figure.
- The TIG-aluminium trap passed: the agent refused and pointed at the spool gun
  rather than inventing AC settings.
- The flux-cored porosity case passed with the MIG-only gas causes correctly
  excluded.
- Tone on `settings-ambiguous` dropped from 4 to 3 after the door-chart fix, i.e.
  the answer got slightly wordier in exchange for being more accurate. Worth
  watching if that instruction is tuned further.

---

## Phase 5 — Ship

**Status: partial. Everything that does not need the user's accounts is done.**

### Done
- `README.md` — quickstart, architecture, and the measurements behind each design
  decision.
- `DECISIONS.md` — 13 entries, including the ones that were wrong first.
- `REVIEW_BRIEF.md` — targeted brief for an adversarial reviewer, leading with
  what I am least confident about.
- `Dockerfile` + `.dockerignore` for a persistent Node host.
- Migrated `middleware.ts` → `proxy.ts` (Next 16 deprecates the old convention),
  so the evaluator does not meet a deprecation warning on first run.

### Clean-clone verification
Cloned the repo to a scratch directory and ran it as an evaluator would:

| Step | Result |
|---|---|
| `git clone` | 0s (local) |
| `npm install` | 5s, 0 vulnerabilities, no `--legacy-peer-deps` |
| `.env` present in clone? | **No** — correctly gitignored |
| knowledge pack present? | Yes, all five data files |
| `npx vitest run` | 59/59 pass |
| `npm run build` | succeeds, TypeScript clean, all routes registered |

### Adversarial pass (own review, before the independent one)
- **Sandbox attacked in a production build** — see DECISIONS #13. Parent DOM,
  cookies, storage and network all blocked. Dev-mode network access documented as
  a deliberate exception for HMR.
- **Parser attacked with unusual-but-plausible input** — found and fixed silent
  corruption when an attribute value contains `>`. Added `edge.test.ts`.
- **Path traversal probed live** — encoded traversal, `....//` sequences and a
  sibling-directory bypass all 404; `.env` never served.
- **Dependency audit** — every non-builtin import is declared in `package.json`.
- **`HtmlArtifactFrame`** confirmed `sandbox="allow-scripts"` with no
  `allow-same-origin`.

### Not done — needs the user
- **Deploy.** Dockerfile is written but has never been built or pushed; hosting
  needs the user's Railway/Render account.
- **Video walkthrough.** Needs the user.
- **Full eval re-run** after the Phase 4 fixes (~$2.50 of API budget).

---

## Phase 6 — Independent adversarial review, and the fixes

An independent reviewer was pointed at the finished system with instructions to
attack it. It returned 2 critical, 9 high and 13 medium findings. The critical
two were the exact failure this architecture is built to prevent — **a wrong
number in front of the user with a citation attached** — and neither was caught
by 59 passing tests, the numeric QA gate, or my own adversarial pass.

### Critical, both fixed and regression-tested

**C-1 · `parseVoltage` concatenated digits.** `"120 VAC 20 amp circuit"` stripped
to `"12020"`, which is greater than 160 and so resolved to **240V**. A user on a
120V circuit asking about 100A was told they could weld **continuously**; the
manual rates that point at **40% duty** (p. 7). Reachable directly from the model,
since the tool schema accepts a free string. Now matches voltage tokens, rejects
out-of-range values, and returns null on `"120/240"` so the agent asks which cord
is plugged in.

**C-2 · Gas flow was MIG-only, served for every process.** `20–30 SCFH` citing
p. 20 was returned for TIG and stick as well. TIG is **10–25 SCFH (p. 30)**;
stick and flux-cored use **no gas** (p. 32, Selection Chart). Argon at the MIG
rate on a TIG torch causes turbulence and breaks the shield. **The QA gate could
not have caught this** — the number does appear on the page it cites, just not
for that process. That is a real limitation of `08_qa.py` worth remembering.

### High, fixed
- **CSP named the wrong origin.** It used the origin Next sees, not the one the
  browser used. Behind any reverse proxy — Railway, Render, Fly, i.e. every real
  deployment — the runner's own scripts would be blocked and the artifact panel
  would sit on "Starting sandbox…" forever while chat kept working. Invisible on
  localhost. Verified fixed by replaying `X-Forwarded-Host`.
- **`text/html` artifacts had no CSP at all**, because a `srcdoc` document
  inherits from the embedding page and the app shell deliberately has none. The
  isolation half held (opaque origin) but the network half did not. The policy is
  now injected into the document itself, ahead of any script.
- **`conservative_pct` was an over-estimate above the rated range.** At 220A —
  the machine's published max — it reported 25%, when the true figure must be
  lower. Now omitted there and named `max_published_pct`; the bracketed case
  states the bound as an explicit `Math.min` rather than relying on duty cycle
  happening to decrease with amperage.
- **Troubleshooting returned confident nonsense.** The process bonus was applied
  before the relevance filter, so "how do I make coffee" with process=MIG
  returned three matches. Separately, entries whose causes were all filtered out
  were returned with an empty `causes` array and no citation — the shape most
  likely to make the model fill the gap from prose. Both fixed.
- **The polarity table was quotable from the system prompt**, behind a soft "call
  the tool anyway" note. That made the project's central claim — grounding is
  mechanical, not an instruction — false for its highest-traffic question class.
  Replaced with a pointer.
- **Parser:** a lone `\r` broke split-invariance; a stray `<options>` in prose
  swallowed the rest of the message including any artifact; tag matching had no
  name boundary; and **my own `>` fix had regressed** into losing whole artifacts
  on an unbalanced quote.
- **`parser.flush()` was not on every exit path**, so an aborted stream left an
  artifact streaming forever.

### What this says about the test suite
Every one of these shipped green. The tests asserted the happy path; the bugs
lived just outside it. Two specific traps worth noting:
- `lookups.test.ts`'s "returns nothing for an unrelated query" passed **only
  because it omitted the process argument** — while production always passes it.
- The CRLF test called `parseComplete` only, never replaying at every offset, so
  it read as coverage while the invariance property was broken.

19 regression tests added (`regressions.test.ts`, plus additions to
`edge.test.ts`). **78/78 pass.**

### Not fixed, recorded instead
Medium and low findings not addressed are listed in REVIEW_BRIEF.md so they are
not lost: `parseThickness` treating millimetres as inches, SVG/mermaid artifacts
rendering in the parent origin behind a sanitizer rather than in the sandbox,
`08_qa.py` false-greening on a fresh clone (it globs a gitignored directory),
`--env-file` making the friendly key-missing errors unreachable, and several
troubleshooting entries that drop printed causes from om-43/om-44.
