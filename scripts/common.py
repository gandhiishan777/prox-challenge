"""Shared helpers for the extraction pipeline.

Page identity across the three source documents
-----------------------------------------------
The three PDFs are addressed with a short document prefix plus the page number
*as printed on the page*, e.g. `om-07`, `qs-01`, `sc-01`. Two reasons this beats
one continuous 1..51 numbering:

  * The owner's manual prints "Page 7" on page 7, so a citation of "(p. 7)" sends
    the user to the right sheet of paper. Continuous numbering would drift.
  * The agent must be able to say *which document* it is citing, since the quick
    start guide and selection chart are separate physical inserts.
"""
import pathlib

ROOT = pathlib.Path(__file__).resolve().parent.parent
FILES = ROOT / "files"
BUILD = ROOT / "build"
KNOWLEDGE = ROOT / "knowledge"

# doc_id -> (filename, human title, short citation label)
DOCS = {
    "om": ("owner-manual.pdf", "Owner's Manual & Safety Instructions", "p. {n}"),
    "qs": ("quick-start-guide.pdf", "Quick Start Guide", "Quick Start p. {n}"),
    "sc": ("selection-chart.pdf", "Welding Process Selection Chart", "Selection Chart"),
}

# Committed page renders. 150 DPI on US Letter is 1275x1650 px; the Anthropic API
# downscales anything over 1568px on the long edge, so 150 DPI lands essentially
# at the API's own ceiling — more DPI would be discarded, less would blur the
# dense duty-cycle and settings tables. ~2.5k tokens per page when the agent
# calls view_page. See DECISIONS.md #5.
PAGE_DPI = 150
# Dev-only renders used for vision transcription and as the source for figure
# crops. Higher so crops of small regions stay sharp after cropping.
HIRES_DPI = 300
THUMB_DPI = 72


def page_id(doc: str, n: int) -> str:
    return f"{doc}-{n:02d}"


def citation(doc: str, n: int) -> str:
    return DOCS[doc][2].format(n=n)


def iter_docs():
    """Yield (doc_id, pathlib.Path) for each source PDF that exists."""
    for doc_id, (fname, _, _) in DOCS.items():
        path = FILES / fname
        if path.exists():
            yield doc_id, path
