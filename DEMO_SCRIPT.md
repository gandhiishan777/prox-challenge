# Demo script

A run list for a 5–7 minute walkthrough. Structured so the first 90 seconds
already show the three things the challenge grades: technical accuracy,
multimodal output, and tone.

Before recording: `npm run dev`, then ask one throwaway question so the prompt
cache is warm — otherwise the first answer takes noticeably longer and costs ~15×
more, which is a bad first impression that says nothing about the system.

---

## 0:00 — What it is (20s, over the landing screen)

> "This is a support agent for the Vulcan OmniPro 220 — a multiprocess welder from
> Harbor Freight. The manual is 48 pages, plus a quick start guide and a process
> selection chart. Nobody standing in their garage is going to read that. So:
> ask it anything, and it answers from the machine's own documentation, cites the
> page, and shows you the picture when a picture is the answer."

Point out the four starter questions and that each demonstrates a different
capability.

## 0:20 — Accuracy, and where the number came from (60s)

Click **"What's the duty cycle for MIG welding at 200A on 240V?"**

While it streams, narrate the activity line:

> "Notice it isn't answering from memory. That line is a tool call into a
> verified table — every number the user sees goes through a lookup, never
> through the model reading prose."

When the answer lands, highlight: **25%**, 2.5 min welding / 7.5 min resting,
cited **(p. 7, p. 19)**.

> "Two pages, because the rating is in the spec table and the definition of what
> a duty cycle actually means is 40 pages later. It pulled both."

**The follow-up that makes the point.** Type:

> `Can I just run it at 190 amps instead?`

> "Here's what I think is the most interesting behaviour in the whole build. The
> manual publishes exactly two rated points per process — 100% at 115 amps, 25% at
> 200. It publishes no curve between them. So 190 amps has no published answer.
> A naive agent interpolates and invents a number that reads plausibly and could
> cook the machine. This one tells you it's between the two published points and
> to plan against the conservative one."

## 1:20 — Multimodal: the manual's own figures (60s)

Click **"What polarity do I need for TIG, and which socket does the ground clamp
go in?"**

> "This is where text-only breaks down. It could describe the sockets — but the
> useful answer is the diagram."

When the figure appears:

> "That's the actual page from the manual, cropped to the figure and rendered
> inline. And the agent isn't guessing at it: the tool hands the same image back
> to the model, so it can only describe a diagram it has actually looked at."

Point at the answer: DCEN, ground clamp to **positive**.

> "Worth noting because it's counterintuitive — most people assume the ground
> clamp is the negative side. Here it isn't."

## 2:20 — Diagnosis, and knowing what *doesn't* apply (60s)

Click **"I'm getting porosity in my flux-cored welds. What should I check?"**

> "The manual's porosity list has six causes. Two of them are marked 'MIG only',
> because self-shielded flux-core doesn't use shielding gas at all."

When the answer lands, highlight that it dropped the gas causes and said so.

> "So it doesn't tell you to turn up gas you aren't running. That filtering is in
> the data, not left to the model to remember — and there's a test that fails if
> shielding gas ever shows up in a flux-core porosity answer."

The weld-defect photo appears alongside — mention it's cropped from a page with
four defects on it, so you get the one you asked about.

## 3:20 — The interactive artifact (90s)

Type: **"Build me a duty cycle calculator for all four processes."**

While the tool calls scroll past:

> "Watch the activity list — it's looking up every rated point before it writes a
> single number. It's not allowed to type a number into the artifact that it
> didn't retrieve."

When the panel opens: switch process to **TIG**, voltage to **240V**, drag the
slider.

> "This is real React, compiled in the browser and running in a sandboxed iframe.
> And notice it carries its own citations — the artifact says which page each
> number came from, same as the prose does."

Flip to the **Code** tab briefly.

> "That's the source, and you can download it."

## 4:50 — Ambiguity (40s)

Type: **"What settings should I use for 1/8 inch steel?"**

> "This one's unanswerable as asked — it depends entirely on the process. So it
> asks one question rather than guessing, and offers quick replies."

Click **MIG**.

> "And here's an honesty case I like: the manual contains no settings table at
> all. The machine computes wire speed and voltage synergically once you tell it
> the process, wire size and thickness. So instead of inventing a table, it walks
> you through the machine — and points out the settings chart is on the inside of
> your welder's door."

## 5:30 — How it's built (60s, over the README or editor)

Three points, quickly:

1. **Extraction.** "The selection chart has a zero-character text layer — it's
   pure image, and it's where the manual says aluminium needs AC TIG, which this
   DC-only machine can't do. Text extraction alone answers that question with
   confident nonsense. So every page goes through vision transcription."

2. **No RAG.** "The whole manual is in a prompt-cached system prompt. At 51 pages
   retrieval is slower, costlier and adds a failure mode — the search missing a
   section because the user said 'wire keeps stopping' and the manual said 'feed
   motor'. Warm questions run about six to fifteen cents."

3. **The sandbox.** "Artifacts run with `allow-scripts` and deliberately without
   `allow-same-origin`, so they're on an opaque origin. I tested that by writing
   an artifact whose only job was to escape: parent DOM, cookies, storage and
   network are all blocked in production."

## 6:30 — Close (30s)

Run `npm test` on camera — 59 tests, no API key needed.

> "The numeric core is tested without any API calls, so the facts are pinned:
> if someone edits the knowledge pack and MIG at 200 amps stops being 25%, that
> fails here rather than in front of somebody holding a live torch."

> "`npm run eval` grades the whole gold set — both the tool traces and the
> answers. And DECISIONS.md has every non-obvious call I made, including the ones
> I got wrong first."

---

## If you have extra time

- **The Fix-it flow.** Ask for an artifact, and if one ever errors, the panel
  shows the error with a "Fix it" button that feeds it back to the agent.
- **Opus toggle.** Switch models in the composer and re-ask a hard
  cross-reference question.
- **`npm run ask`** in the terminal — shows the tool trace inline, which makes
  the grounding visible without the UI.

## Things not to do on camera

- Don't start cold. The first question of a session pays the cache write and is
  slow and expensive.
- Don't ask for something outside the manual and present it as a win — it will
  correctly say it doesn't know, which is right but reads as a dead end on video.
