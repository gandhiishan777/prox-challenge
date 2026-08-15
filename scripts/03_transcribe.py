#!/usr/bin/env python3
"""Stage 3 — vision transcription of every page.

This is where the manual's *visual* content becomes text the agent can reason
over: the selection chart (which has a zero-character text layer), the polarity
hookup diagrams, the weld-diagnosis photos, the settings tables.

One vision call per page. The page image is authoritative; the extracted text
layer is supplied only as a spelling hint. Each call also proposes figure
bounding boxes, which seed the human-curated crop spec in stage 5.

Cost: ~51 pages x ~4k tokens in / ~1.5k out on Sonnet is roughly $2 per pass.

Usage:
  python3 scripts/03_transcribe.py                 # all pages, skips existing
  python3 scripts/03_transcribe.py --force         # re-transcribe everything
  python3 scripts/03_transcribe.py --pages om-07,om-13
Output: build/transcripts/<page_id>.md
"""
import argparse
import base64
import concurrent.futures
import os
import pathlib
import sys
import time

import anthropic
from dotenv import load_dotenv

from common import BUILD, ROOT, DOCS, iter_docs, page_id

load_dotenv(ROOT / ".env")

MODEL = "claude-sonnet-5"
MAX_WORKERS = 6

SYSTEM = """You transcribe pages from a welding machine owner's manual into faithful \
Markdown. Downstream, an AI support agent answers user questions using ONLY your \
transcription, so fidelity matters more than polish. A wrong number here becomes a \
wrong answer that could damage a machine or injure someone.

RULES

1. Transcribe EXACTLY what is printed. Never infer, complete, correct, or normalize a \
value you cannot clearly read. Do not convert units. Keep column headers verbatim.

2. TABLES are the highest-stakes content. Render every table as a GitHub Markdown \
table, preserving row and column order exactly. If a table has merged/spanning cells \
(common in spec tables where one label covers a 120V and a 240V column), repeat the \
value in each cell it applies to rather than dropping it, and note the span in an \
HTML comment. Preserve footnote markers.

3. UNCERTAINTY. If a character or cell is ambiguous, write ?[your best guess]?. If it \
is genuinely unreadable, write ?[]?. These markers are machine-checked later, so use \
them honestly rather than guessing silently.

4. WARNINGS and safety notices: transcribe verbatim, prefixed with "> **WARNING:**" \
(or CAUTION/NOTICE/DANGER as printed).

5. FIGURES, DIAGRAMS, PHOTOS. For each distinct visual element, emit a line:
   [FIGURE slug | bbox: x0,y0,x1,y1 | caption]
   - slug: short kebab-case id, e.g. wire-feed-mechanism, polarity-dcen, weld-porosity
   - bbox: the tight bounding box AROUND THE WHOLE FIGURE INCLUDING ITS CALLOUT LABELS \
and caption, in normalized 0-1000 coordinates measured from the TOP-LEFT of the page \
(x0,y0 = top-left corner; x1,y1 = bottom-right corner).
   - caption: one sentence describing what it shows and what question it answers.
   Then, beneath that line, transcribe every label, callout, and piece of text inside \
the figure as a bulleted list, and describe the spatial relationships that a reader \
would need in order to act on it (e.g. "the cable from the torch runs to the socket \
marked (-) on the lower left of the front panel"). A blind reader must be able to \
follow the diagram from your description alone.

6. Structure the page with the headings actually printed on it. Begin the file with \
YAML frontmatter:
---
page_id: <given>
title: <the main heading printed on the page, or a short description>
section: <the manual section this page belongs to, if evident>
content_types: [prose|table|figure|photo|procedure|warning|schematic|parts_list]
---

7. Ignore repeated page furniture (the "For technical questions, please call..." \
footer, the vertical section tabs printed down the right margin, the page number).

Output ONLY the transcription. No preamble, no commentary."""

USER_TEMPLATE = """This is page {page} of the "{doc_title}" for the Vulcan OmniPro 220 \
multiprocess welder (Harbor Freight item 57812).

Its page_id is `{pid}`.

For spelling reference only, here is the raw text layer extracted programmatically \
from this page. Its reading order may be scrambled and it omits anything drawn as \
vector art, so where it disagrees with the image, THE IMAGE WINS:

<text_layer>
{text_layer}
</text_layer>

Transcribe the page."""


def transcribe_one(client, pid: str, doc_id: str, n: int, force: bool) -> tuple[str, str]:
    out_path = BUILD / "transcripts" / f"{pid}.md"
    if out_path.exists() and not force:
        return pid, "skipped"

    img_path = BUILD / "hires" / f"{pid}.png"
    if not img_path.exists():
        return pid, "ERROR: no render (run 01_render_pages.py)"

    text_layer = (BUILD / "text" / f"{pid}.txt").read_text() if (
        BUILD / "text" / f"{pid}.txt"
    ).exists() else ""
    if not text_layer.strip():
        text_layer = "(this page has no extractable text layer — it is entirely image/vector content)"

    img_b64 = base64.standard_b64encode(img_path.read_bytes()).decode()

    for attempt in range(4):
        try:
            resp = client.messages.create(
                model=MODEL,
                max_tokens=8000,
                system=SYSTEM,
                messages=[
                    {
                        "role": "user",
                        "content": [
                            {
                                "type": "image",
                                "source": {
                                    "type": "base64",
                                    "media_type": "image/png",
                                    "data": img_b64,
                                },
                            },
                            {
                                "type": "text",
                                "text": USER_TEMPLATE.format(
                                    page=n,
                                    doc_title=DOCS[doc_id][1],
                                    pid=pid,
                                    text_layer=text_layer[:6000],
                                ),
                            },
                        ],
                    }
                ],
            )
            out_path.write_text(resp.content[0].text)
            return pid, f"ok ({resp.usage.output_tokens} out)"
        except Exception as e:  # noqa: BLE001 - retry any API failure
            if attempt == 3:
                return pid, f"ERROR: {e}"
            time.sleep(2**attempt)
    return pid, "ERROR: unreachable"


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--force", action="store_true", help="re-transcribe existing pages")
    ap.add_argument("--pages", help="comma-separated page ids, e.g. om-07,sc-01")
    args = ap.parse_args()

    if not os.environ.get("ANTHROPIC_API_KEY"):
        print("ERROR: ANTHROPIC_API_KEY not set (expected in .env)", file=sys.stderr)
        return 1

    (BUILD / "transcripts").mkdir(parents=True, exist_ok=True)
    client = anthropic.Anthropic()

    wanted = set(args.pages.split(",")) if args.pages else None
    jobs = []
    for doc_id, path in iter_docs():
        import fitz

        for i in range(fitz.open(path).page_count):
            pid = page_id(doc_id, i + 1)
            if wanted is None or pid in wanted:
                jobs.append((pid, doc_id, i + 1))

    print(f"transcribing {len(jobs)} pages with {MODEL}...", file=sys.stderr)
    errors = 0
    with concurrent.futures.ThreadPoolExecutor(max_workers=MAX_WORKERS) as pool:
        futures = [
            pool.submit(transcribe_one, client, pid, doc_id, n, args.force)
            for pid, doc_id, n in jobs
        ]
        for fut in concurrent.futures.as_completed(futures):
            pid, status = fut.result()
            if status.startswith("ERROR"):
                errors += 1
            print(f"  {pid}: {status}", file=sys.stderr)

    print(f"\ndone. {errors} errors.", file=sys.stderr)
    return 1 if errors else 0


if __name__ == "__main__":
    raise SystemExit(main())
