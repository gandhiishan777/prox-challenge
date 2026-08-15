#!/usr/bin/env python3
"""Stage 4 — stitch page transcripts into the document the agent reads.

Produces one continuous `manual_full.md` with `<!-- page: om-07 -->` markers, so
that when the agent quotes something it can cite the page it came from, and
per-section files for the fallback path (if the corpus ever grows past what fits
comfortably in a system prompt, the agent switches to reading sections on demand).

Section boundaries come from the manual's own printed table of contents.

Usage:  python3 scripts/04_sectionize.py
Output: knowledge/manual_full.md, knowledge/sections/*.md
"""
import json
import re
import sys

from common import BUILD, KNOWLEDGE, DOCS, page_id

# From the printed table of contents on page 2: (start page, id, title).
SECTIONS = [
    (1, "cover", "Cover and Product Overview"),
    (2, "safety", "Safety"),
    (7, "specifications", "Specifications"),
    (8, "controls", "Controls"),
    (10, "mig-flux-cored", "MIG / Flux-Cored Wire Welding"),
    (24, "tig-stick", "TIG / Stick Welding"),
    (34, "welding-tips", "Welding Tips and Weld Diagnosis"),
    (41, "maintenance", "Maintenance and Troubleshooting"),
    (46, "parts", "Parts List and Diagram"),
    (48, "warranty", "Warranty"),
]

FENCE = re.compile(r"^```(?:markdown)?\s*$")


def clean(text: str) -> str:
    """Strip the frontmatter and any stray code fence the transcriber added."""
    lines = text.splitlines()
    out, in_fm = [], False
    for i, line in enumerate(lines):
        if FENCE.match(line.strip()):
            continue
        if line.strip() == "---" and i < 4 and not in_fm:
            in_fm = True
            continue
        if in_fm:
            if line.strip() == "---":
                in_fm = False
            continue
        out.append(line)
    return "\n".join(out).strip()


def section_for(page_no: int) -> tuple[str, str]:
    current = SECTIONS[0]
    for start, sid, title in SECTIONS:
        if page_no >= start:
            current = (start, sid, title)
    return current[1], current[2]


def main() -> int:
    tdir = BUILD / "transcripts"
    sections_dir = KNOWLEDGE / "sections"
    sections_dir.mkdir(parents=True, exist_ok=True)

    full: list[str] = []
    by_section: dict[str, list[str]] = {}
    index = []

    full.append(
        "# Vulcan OmniPro 220 — Complete Documentation\n\n"
        "Transcribed from the owner's manual, quick start guide and welding process "
        "selection chart. `<!-- page: xx-NN -->` markers give the source page for "
        "every passage: `om-NN` is page NN of the owner's manual, `qs-NN` the quick "
        "start guide, `sc-01` the selection chart.\n"
    )

    for doc_id, (_, doc_title, _) in DOCS.items():
        pages = sorted(tdir.glob(f"{doc_id}-*.md"))
        if not pages:
            continue
        if doc_id != "om":
            full.append(f"\n\n---\n\n# {doc_title}\n")
        for path in pages:
            pid = path.stem
            page_no = int(pid.split("-")[1])
            body = clean(path.read_text())
            if not body:
                continue
            block = f"\n<!-- page: {pid} -->\n\n{body}\n"
            full.append(block)

            if doc_id == "om":
                sid, stitle = section_for(page_no)
            else:
                sid, stitle = doc_id, doc_title
            by_section.setdefault(sid, []).append(block)
            index.append({"page_id": pid, "section": sid, "section_title": stitle})

    (KNOWLEDGE / "manual_full.md").write_text("\n".join(full))

    written = []
    for start, sid, title in SECTIONS + [("", "qs", "Quick Start Guide"), ("", "sc", "Welding Process Selection Chart")]:
        blocks = by_section.get(sid)
        if not blocks:
            continue
        pages = [e["page_id"] for e in index if e["section"] == sid]
        header = (
            f"---\nid: {sid}\ntitle: {title}\npages: [{', '.join(pages)}]\n---\n\n# {title}\n"
        )
        (sections_dir / f"{sid}.md").write_text(header + "\n".join(blocks))
        written.append((sid, len(pages)))

    (BUILD / "section_index.json").write_text(json.dumps(index, indent=2))

    chars = (KNOWLEDGE / "manual_full.md").stat().st_size
    print(f"manual_full.md: {chars:,} chars (~{chars // 4:,} tokens)", file=sys.stderr)
    for sid, n in written:
        print(f"  {sid:18s} {n} pages", file=sys.stderr)
    # The prompt prefix is static, so it is prompt-cached: a session pays the
    # cache write once (~$0.19 at 50k tokens on Sonnet) and then reads at ~10% of
    # input price per turn. That stays cheaper than a retrieval design, which
    # appends uncached tokens on every single question — so the practical ceiling
    # is much higher than the corpus size, and only a genuinely large corpus
    # should push the agent onto section-on-demand reads.
    tokens = chars // 4
    if tokens > 80_000:
        print(
            f"\n!! {tokens:,} tokens — too large to hold in the prompt comfortably;"
            " switch the agent to section-on-demand reads",
            file=sys.stderr,
        )
    elif tokens > 40_000:
        print(
            f"\nnote: {tokens:,} tokens in the prompt prefix"
            f" (~${tokens * 3.75 / 1e6:.2f} cache write per session,"
            f" ~${tokens * 0.30 / 1e6:.3f} per cached turn)",
            file=sys.stderr,
        )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
