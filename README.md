# OmniPro 220 Assistant

A multimodal support agent for the **Vulcan OmniPro 220** multiprocess welder
(Harbor Freight item 57812), built on the **Claude Agent SDK**.

It answers from the machine's own documentation, cites the page, and — when a
picture explains it better than a paragraph — shows you the manual's actual
diagram, or builds you something you can use.

---

## Run it

```bash
npm install
cp .env.example .env      # add your ANTHROPIC_API_KEY
npm run dev               # http://localhost:3000
```

That is the whole setup. The knowledge pack is committed, so there is no
extraction step, no vector database, and no build service to stand up.

Other commands:

```bash
npm run ask -- "What's the duty cycle for MIG at 200A on 240V?"   # CLI, prints the tool trace
npm test                                                          # 54 unit tests, no API key needed
npm run eval                                                      # graded gold set
```

---

## What it does

Three questions, three different shapes of answer:

| Question | What comes back |
|---|---|
| "What's the duty cycle for MIG at 200A on 240V?" | **25%** — 2.5 min welding, 7.5 min resting, cited to p. 7 and p. 19, retrieved by a lookup tool rather than recalled |
| "What polarity for TIG? Which socket for the ground clamp?" | DCEN, ground clamp to **positive**, torch to **negative** — plus the manual's own hookup diagram rendered inline |
| "Build me a duty cycle calculator" | A working interactive artifact, running in a sandbox, whose numbers came from 16 lookup calls and which carries its page citations |

---

## How it works

```
files/*.pdf ──► extraction pipeline (python, dev-time only) ──► knowledge/ (committed)
                                                                    │
                                       ┌────────────────────────────┤
                                       ▼                            ▼
                            system prompt (static,           8 deterministic
                            prompt-cached)                   lookup tools
                                       │                            │
                                       └────────► Agent SDK ◄───────┘
                                                     │
                                          SSE relay (parses artifacts
                                          out of the model's prose)
                                                     │
                                    ┌────────────────┴────────────────┐
                                    ▼                                 ▼
                            chat transcript                  sandboxed iframe
                            (text, figures, chips)           (artifact runtime)
```

### 1. Knowledge extraction

The corpus is three PDFs — a 48-page owner's manual, a 2-page quick start guide,
and a one-page welding process selection chart. The first thing the pipeline does
is measure them, because that decides everything downstream:

| Document | Pages | Text layer |
|---|---|---|
| `owner-manual.pdf` | 48 | 94,861 chars (born-digital) |
| `quick-start-guide.pdf` | 2 | 576 chars |
| `selection-chart.pdf` | 1 | **0 chars** |

The selection chart has **no text at all**. It is a pure image — and it is where
the manual says that aluminium requires **AC TIG**, which this DC-only machine
cannot do. A text-only pipeline answers "what settings for TIG aluminium?" with
confident nonsense. That single measurement is why every page goes through vision
transcription rather than text extraction.

The stages (`scripts/00`–`08`, re-runnable via `scripts/run_pipeline.sh`):

1. **Inspect** — page counts, text density, and a vector-drawing census.
2. **Render** — every page at 150 DPI, which is where the vision API's downscale
   ceiling sits; more DPI is discarded, less blurs the duty-cycle tables.
   Oversized artboards are trimmed to their content first — the selection chart
   went from 2500×2500 to 2500×924, roughly **2.7× more usable resolution**.
3. **Text layer** — kept as a spelling hint and as the QA grep target, never as
   the primary transcript. PDF extraction linearizes multi-column tables in an
   order that does not match the printed grid, which is exactly how a duty-cycle
   matrix gets silently scrambled.
4. **Transcribe** — one vision call per page. Tables become markdown tables,
   uncertain characters are marked `?[guess]?`, and every figure is described in
   enough detail that a blind reader could follow the diagram.
5. **Sectionize** — stitched into one document with `<!-- page: om-07 -->`
   markers, so citations survive.
6. **Figures** — 26 crops. See below.
7. **Curate** — the numbers the agent is allowed to state, as JSON.
8. **QA gate** — every numeric value checked against the page it claims to cite.

### 2. Figures are cropped from renders, never extracted

Page 9 (the wire feed mechanism) reports **zero embedded images**. Page 45 (the
wiring schematic) reports **26,144 vector drawings**. The figures that matter here
are line art, so `extract_image()` returns nothing useful. Everything is cropped
out of a rendered bitmap instead, which works identically for vector art,
photographs and mixed content, and keeps callout labels attached.

Pages that *are* one labelled diagram get cropped whole and whitespace-trimmed.
Pages holding several independent answers get split at their printed heading
positions — so asking about porosity surfaces the porosity band alone, not a sheet
with four other defects on it. Crop boxes are parity-aware, because the section
tab strip swaps sides between odd and even pages.

`scripts/crop_spec.json` is the reproducibility record: re-running stage 5 against
it regenerates `knowledge/figures/` exactly.

### 3. No RAG — and why

The whole manual sits in the system prompt. There is no retrieval step and no
vector store.

At this corpus size retrieval is all cost and no benefit. The prompt prefix is
static, so it is **prompt-cached**: a session pays the cache write once, then reads
at roughly a tenth of input price per turn. A retrieval design instead appends
*uncached* tokens on every question, and adds a round trip. It also introduces a
failure mode that simply does not exist here — vocabulary mismatch, where "wire
keeps stopping" fails to retrieve the section headed "feed motor".

Cross-referencing is an explicit grading axis for this challenge ("the highest
amperage I can weld at continuously on 120V" needs the output range *and* the duty
cycle table). A retriever has to know to run both searches. Full context just
reads both.

Measured: **~$0.06–0.15 per warm question**, ~$0.80 on the first question of a
cold session. `00_inspect.py` warns if a future corpus outgrows this approach, and
the fallback (outline in prompt, sections read on demand) is a one-file change.

### 4. Every number comes from a tool, not from reading

The manual is in the model's context, which makes it tempting to answer numeric
questions from prose. The system prompt forbids it, and eight deterministic tools
back that up. They read human-verified JSON where each value has been checked
against the page it is printed on.

Three of those tools encode a specific piece of judgement:

**Duty cycle brackets, it does not interpolate.** The manual publishes only *two*
rated points per process and input voltage — the maximum-output point and the 100%
continuous point — with no derating curve between them. So most real questions
("can I run 190A?") land in the gap. The tool returns both bracketing rows and
names the higher-amperage duty cycle as the bound, rather than inventing a number
on a curve that was never printed.

**Troubleshooting filters by process.** The manual marks several porosity and
spatter causes "(MIG only)", because self-shielded flux-cored welding uses no gas.
Asking about flux-core porosity must not return "increase your gas flow". The tool
drops those causes and says it did.

**Weld settings answer with a procedure, because there is no table.** The manual
publishes no wire-speed/voltage chart. The machine computes those synergically once
you enter process, wire diameter and thickness, and the printed chart lives on the
inside of the welder's door. `settings.json` states that absence explicitly, so the
agent walks the user through setup instead of fabricating a lookup table.

### 5. Multimodal, in three registers

- **The manual's own figures.** `show_figure` both displays an image to the user
  *and* returns it to the model, so the agent never describes a diagram it has not
  looked at. `view_page` lets it read a full page when it needs to check detail.
- **Drawn diagrams.** SVG artifacts for hookups the manual does not illustrate.
- **Interactive artifacts.** Calculators, flowcharts, configurators.

### 6. Artifacts, reverse-engineered

The model emits artifacts the way claude.ai does — inline in its prose:

```
<antArtifact identifier="duty-cycle-calculator" type="application/vnd.ant.react" title="Duty Cycle Calculator">
```

Matching that contract exactly is the point: the model has strong priors for it, so
well-formed artifacts come almost free and the work is in rendering them.

**Parsing.** Text arrives in deltas split at arbitrary byte offsets, so a tag can be
cut anywhere (`<antArtif` / `act identifier="x`). The parser holds back any buffer
suffix that could still become a tag, which is what stops raw XML flashing in the
transcript. It runs server-side, so the browser only ever sees semantic events.

It is tested by replaying each fixture split at **every byte offset** and asserting
the events are identical to parsing it whole. That found two real bugs — the
newline after the opening tag and the one before the closing tag both leaked into
artifact content depending on where a chunk landed.

**Execution.** Artifact code is compiled with **sucrase** (JSX and TypeScript to
`React.createElement`, ES imports to interceptable `require` calls) and run against
a module allow-list: react, recharts, lucide-react, and a hand-written 34-component
shadcn-lite kit. An import we do not stock cannot resolve, so an artifact can never
pull in arbitrary code.

**Isolation.** It runs in an iframe with `sandbox="allow-scripts"` and deliberately
**no `allow-same-origin`**, which puts it on an opaque origin: no access to the
parent DOM, no cookies, no storage, no credentialed requests to our own API. A CSP
additionally denies it network access, so a prompt-injected artifact cannot exfiltrate
what it can see.

Getting that right required rebuilding the runner as a standalone bundle: a
framework client runtime *cannot boot* on an opaque origin (storage access throws
there). The tempting fix — adding `allow-same-origin` — is the documented sandbox
escape, and was rejected. `DECISIONS.md` #8 and #9 have the measurements.

---

## Layout

```
files/                     the three source PDFs
scripts/                   extraction pipeline (python) + CLI harness
  crop_spec.json           curated figure catalogue — the reproducibility record
knowledge/                 COMMITTED output: manifest, transcription, pages, figures, data
src/lib/agent/             lookups (pure, unit-tested), tools, system prompt
src/lib/artifacts/         streaming parser
src/lib/runner/            artifact compiler, module allow-list, ui kit
src/runner/entry.tsx       what runs *inside* the sandbox
src/app/api/chat/          Agent SDK to SSE bridge
eval/                      gold set + graded runner
```

---

## Testing

`npm test` — 54 unit tests, no API key required:

- **Lookups (22)** pin the headline facts. MIG at 200A/240V is 25%. 190A brackets
  to 115A/200A with a 25% bound and no fabricated percentage. TIG is DCEN with the
  clamp positive. MIG and flux-cored are exact polarity opposites. Flux-cored
  porosity drops the MIG-only gas causes.
- **Parser (24)** — byte-offset invariance, described above.
- **Compiler (8)** — JSX, hooks, `@/components/ui/*` resolution, unknown imports
  rejected with a useful message, host globals not leaked into artifact scope.

`python3 scripts/08_qa.py` re-checks the knowledge pack: every numeric value in the
curated data must appear on the page it cites. It earned its keep during the build
by catching an item number taken from the product page rather than the manual, and
a receptacle spec attributed to the wrong page.

`npm run eval` grades the gold set twice over: programmatic gates on the tool trace
and answer text (did it call the lookup? did it show the figure? did it avoid the
hallucination trap?) plus an LLM judge for fact coverage and tone.

---

## Further reading

- **`DECISIONS.md`** — every non-obvious choice and why, including the ones that
  were wrong first.
- **`PHASE_LOG.md`** — what was built and tested at each stage, with the bugs found.
- **`REVIEW_BRIEF.md`** — a targeted brief for reviewing this work, including what
  I am least confident about.

---

## Deploying

The Agent SDK spawns a subprocess and holds a streaming connection open for the
length of an answer, so this wants a **persistent Node host** (Railway, Render,
Fly) rather than a serverless function. A `Dockerfile` is included.

```bash
# Railway
railway init && railway up
# then set ANTHROPIC_API_KEY in the project's variables
```

Set `ANTHROPIC_API_KEY` in the host's environment. Nothing else is required — the
knowledge pack ships in the image, and `prebuild` bundles the artifact runner.

> Not yet deployed. The Dockerfile has been written but never built or pushed.
