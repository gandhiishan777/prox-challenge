# Review brief

For an adversarial reviewer picking this up cold. The goal is to make the review
*targeted* rather than a generic read-through, so this is organised around where
the risk actually is, not around the file tree.

Read `DECISIONS.md` for full reasoning on any numbered decision referenced here.

---

## What this is

A multimodal support agent for the Vulcan OmniPro 220 welder, on the Claude Agent
SDK. Three PDFs (48-page owner's manual, 2-page quick start, 1-page selection
chart) are extracted at dev time into a committed knowledge pack. At runtime the
whole transcribed manual sits in a prompt-cached system prompt, eight
deterministic tools serve every number, and the UI renders the manual's own
figures plus claude.ai-style interactive artifacts in a sandboxed iframe.

---

## Review this first

Ordered by how likely I think a problem is, times how much it would matter.

### 1. The seven hand-written transcripts (`DECISIONS.md` #12)

The API credit ran out with 44 of 51 pages transcribed. The remaining seven were
transcribed by reading the rendered page images directly in-session, in the same
format the script emits: `om-14`, `om-27`, `om-40`, `om-45`, `om-47`, `qs-02`,
`sc-01`.

**Why this matters more than it sounds:** those seven are not a random tail. They
include the selection chart and the quick start guide — the two densest,
highest-value pages in the corpus — and `qs-02` is the source for three of the
four polarity entries in `specs.json`.

**How to check:** open `knowledge/pages/qs-02.png` and `knowledge/pages/sc-01.png`
next to `build/transcripts/qs-02.md` and `sc-01.md`. Verify in particular:
- TIG: ground clamp → **positive**, torch → **negative** (this is the
  counterintuitive one and it drives a challenge question)
- Flux-core is the exact reverse of MIG
- The selection chart's claim that aluminium requires **AC TIG**

Note `build/` is gitignored, so a fresh clone will not have the transcripts —
they are baked into `knowledge/manual_full.md`. Grep there instead.

### 2. Is any number reaching the user without a tool call?

This is the failure mode the whole design exists to prevent, and the one I would
attack first. The manual is in the model's context, so nothing *physically* stops
it answering from prose.

**How to check:** `npm run ask -- "<question>"` prints the tool trace. Ask
numeric questions in phrasings the eval does not cover and confirm a lookup
appears. Suggested probes:
- "roughly how long can I weld at 150 amps before it cuts out"
- "what's the max wire size for flux core again"
- "is 20 SCFH enough gas"

`eval/gold.json` asserts `must_use_tools` on the numeric cases, but the gold set
is 18 questions and the space is larger.

### 3. Duty-cycle bracketing under adversarial phrasing

The manual publishes only two rated points per process/voltage, so most real
amperages fall in a gap where **no published answer exists**. `lookupDutyCycle`
returns the bracket and names the conservative bound; the prompt forbids
presenting an interpolated number as a manual figure.

**How to check:** ask for a mid-gap amperage in a way that pressures a single
number — "just give me one number for 160 amps", "estimate it for me". A
fabricated percentage between the two rated points is a real failure. The unit
test (`lookups.test.ts`, "brackets an off-table amperage") covers the tool; it
does not cover the model's willingness to be pushed past it.

### 4. Artifact sandbox isolation — **now measured, please re-measure**

`sandbox="allow-scripts"` with **no** `allow-same-origin`, plus a per-request CSP
in `src/proxy.ts`. `DECISIONS.md` #8, #9 and #13 record the measurements.

I attacked this rather than reasoning about it. An artifact whose only job was to
escape, run inside a real sandboxed frame in Chrome against a **production build**:

| Attempt | Result |
|---|---|
| `window.origin` | `null` — the opaque origin everything rests on |
| `window.parent.document` | BLOCKED (SecurityError) |
| `window.parent.location.href` | BLOCKED (SecurityError) |
| `localStorage` / `sessionStorage` | BLOCKED (SecurityError) |
| `document.cookie` | BLOCKED (SecurityError) |
| `fetch('/api/chat')` | BLOCKED (`connect-src 'none'`) |

**Caveat worth your attention: in dev, network access is open.** The dev CSP has
to allow `connect-src <origin> ws:` for hot reload, so an artifact under
`npm run dev` *can* issue requests. The opaque-origin protections hold in both
modes; only the network differs. If you think that dev/prod split is the wrong
call, that is a fair argument to have.

**Still worth attacking yourself:** the `require` shim in `compile.ts` (can
`constructor.constructor` reach anything useful from artifact scope?), and
whether the CSP is genuinely absent on app routes — it was applied app-wide at one
point, and because `default-src 'none'` makes `frame-src` inherit `'none'`, the
browser silently refused to load the artifact iframe at all.

**Known limitation, accepted:** an artifact can still spin the CPU and freeze its
own frame. Not solved; same posture as claude.ai.

### 4b. Parser adversarial inputs — one real bug found and fixed

Attacking the parser with plausible-but-unusual input found a silent corruption:
a title containing `>` (e.g. `title="Settings for >1/4 inch"`, entirely natural
here) ended the opening tag mid-attribute, dropped the title, and spilled the
attribute tail into the artifact's source. Fixed by tracking quote state; covered
in `src/lib/artifacts/edge.test.ts`.

Also checked, and correct: CRLF content, and an artifact whose content mentions
`</antArtifact>` (truncates at the first close tag — same as claude.ai, now
documented in a test rather than left to be rediscovered).

Path traversal on `/api/knowledge` was probed live with encoded traversal,
`....//` sequences, and a sibling-directory bypass. All 404; `.env` is never
served. The guard uses `resolve() + path.sep`, which is what defeats a
`knowledge-evil` sibling.

### 5. Things I could not verify in this environment

- **The embedded browser pane does not execute scripts in sandboxed iframes at
  all** (`DECISIONS.md` #11). Verified with a minimal CSP-free page with one
  inline script: silent sandboxed, fine unsandboxed. Everything browser-facing was
  therefore verified in **real Chrome**. If you review in a different harness and
  the artifact panel appears dead, check this before assuming a bug.
- **Synthetic clicks and key presses do not reach into the cross-origin frame**,
  so artifact interactivity was verified by driving the DOM inside the frame
  (native value setter + `input` event), which confirmed the Slider updates React
  state. A human should still click a generated calculator once.
- **No deploy has been run.** `Dockerfile` is written but never built or pushed.

---

## Non-obvious decisions worth auditing

| Decision | Summary | Where |
|---|---|---|
| No RAG | Whole manual in a prompt-cached system prompt. Retrieval is slower, costlier and adds vocabulary-mismatch failures at 51 pages. Fallback documented. | #2 |
| Vision transcription for every page | The selection chart has a **zero-character** text layer and carries the AC-TIG-for-aluminium fact. Text-only extraction answers that question wrong. | #3 |
| Render-crop, never `extract_image` | Page 9 has 0 embedded images; page 45 has 26,144 vector drawings. The figures that matter are line art. | #4 |
| 150 DPI page renders | The vision API downscales past ~1568px; 150 DPI on Letter lands there. More is discarded, less blurs tables. | #5 |
| Trim oversized artboards | Selection chart 2500×2500 → 2500×924, ~2.7× more usable resolution after downscale. An accuracy measure. | #6 |
| sucrase, not react-runner | react-runner peers cap at React 18; writing the ~40-line compiler allows current Next 16 / React 19 with a clean `npm install`. | #7 |
| Standalone sandbox bundle | A framework client runtime cannot boot on an opaque origin. Rebuilt rather than weakening the sandbox. | #8 |
| Per-request CSP in middleware | `'self'` is unmatchable on an opaque origin, so the origin is named explicitly. Path-guarded. | #9 |
| Recharts animation off | A stalled mount animation renders series as invisible zero-length paths inside a chart that otherwise looks fine. | #10 |

---

## Judgement calls made under uncertainty

Flagged honestly rather than presented as settled:

1. **Prompt size.** The transcribed corpus is ~51k tokens, above the 50k threshold
   I set myself before measuring. I kept full context and re-derived the
   economics (cache write once per session, then ~10% reads) rather than trimming.
   The alternative — dropping the verbose figure narration, ~33% of the corpus —
   would cut cost but lose the label text that answers "which socket" without a
   tool call. **Reasonable people could go the other way.**

2. **`disallowedTools` as belt-and-braces.** A harness-provided `repl` tool
   executed despite `tools: []`, which the SDK documents as dropping all
   built-ins. I added an explicit denylist rather than investigating the SDK
   internals. It works (verified: the tool no longer appears), but I do not have a
   root cause, and the denylist is a fixed list that could go stale.

3. **The mobile layout is a hard split.** Below `lg`, opening an artifact hides
   the chat entirely. I think a half-width artifact on a phone is worse, but this
   is the layout decision most worth a second opinion.

4. **Troubleshooting search is token overlap, not an index.** With ~17 symptom
   entries an index is overhead. It is tuned by hand (alias hits score double).
   Unusual phrasing may miss; `lookupTroubleshooting` returning nothing is
   handled (the agent is told to say so rather than guess), but the recall
   ceiling is untested beyond the eval cases.

5. **The runner bundle is 1.58 MB**, dominated by the full lucide icon set. Fine
   locally, first-load latency on a cold deploy is unmeasured. Mitigated with a
   "Starting sandbox…" state rather than by trimming icons.

6. **`maxTurns: 12`.** The duty-cycle-calculator request used 16 tool calls in one
   turn and completed, but a broader "build me everything" request could plausibly
   hit the ceiling. I have not found the boundary.

---

## Phase status

| Phase | Status | Evidence |
|---|---|---|
| 0 — repo, scaffold, sandbox spike | **pass** | 4 fixtures render/fail correctly in real Chrome; clean `npm install`, no legacy peer deps |
| 1 — knowledge pack | **pass** | 51/51 pages transcribed, 0 unreadable markers; 26 figures; `08_qa.py` 0 failures / 0 warnings across 183 numeric tokens |
| 2 — agent core | **pass** | all three challenge questions correct with correct tool traces and citations |
| 3 — artifact runtime + frontend | **pass** | SSE verified by curl; figure + generated calculator verified in real Chrome |
| 4 — eval | **pass, with a caveat** | 15/18 on the full run; all 3 failures investigated (1 real gap fixed, 2 flawed assertions corrected) and re-verified 3/3. **The full suite has not been re-run end to end since.** |
| 5 — docs, deploy config | **partial** | README, DECISIONS, PHASE_LOG, this file, Dockerfile written; clean-clone verified (clone + install + production build + 59 tests). **Not deployed. No video.** |

Across the whole repo: **59/59 unit tests**, `npx tsc --noEmit` clean, production
build succeeds from a fresh clone.

Phase 0's Spike B (SDK → SSE → browser) was folded into Phases 2–3 rather than
done standalone, because the API credit was exhausted mid-phase. It is covered:
the SSE path is verified by curl and in the browser.

---

## Reproducing the results

```bash
npm install
cp .env.example .env      # add ANTHROPIC_API_KEY
npm test                  # 59 unit tests, no API key needed, ~0.5s

python3 scripts/08_qa.py  # knowledge pack integrity, no API key needed

npm run dev               # then http://localhost:3000

# the three challenge questions, with tool traces
npm run ask -- "What's the duty cycle for MIG welding at 200A on 240V?"
npm run ask -- "I'm getting porosity in my flux-cored welds. What should I check?"
npm run ask -- "What polarity setup do I need for TIG welding? Which socket does the ground clamp go in?"

npm run eval                        # full gold set (~$2)
npm run eval -- --only tig-polarity # single case
```

Eval output lands in `eval/results/<timestamp>.json` with the full answer text,
tool trace, and per-gate results for every case, so runs can be diffed.

To rebuild the knowledge pack from the PDFs (not needed to run the app):

```bash
./scripts/run_pipeline.sh   # stage 3 needs ANTHROPIC_API_KEY, ~$2
```

---

## Where the bodies are buried

Bugs found and fixed during the build, listed because each one is a place a
regression could reappear:

1. Parser leaked the newline **after** the opening tag into artifact code when a
   chunk boundary fell there.
2. Parser leaked the newline **before** the closing tag, symmetrically.
   (Both caught by the byte-offset suite; both invisible in normal testing.)
3. CSP applied app-wide made `frame-src` inherit `'none'`, blocking the artifact
   iframe entirely — the symptom was an empty panel, not an error.
4. `script-src 'self'` is unmatchable from an opaque origin, so the sandbox never
   booted.
5. Recharts series rendered as invisible zero-length paths.
6. `zod` v3 pinned against an SDK that requires v4 — broke `npm install`.
7. An item number (`63621`) taken from the product page rather than the manual,
   and a receptacle spec attributed to the wrong page. **Both caught by the QA
   gate, not by review** — which is the argument for keeping that gate in CI.
