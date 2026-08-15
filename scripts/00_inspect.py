#!/usr/bin/env python3
"""Stage 0 — characterize the source PDF(s) before any extraction work.

Answers the questions every downstream stage depends on: is this born-digital or
scanned? Which pages are vector-heavy (schematics that must be render-cropped
rather than image-extracted)? How big is the text layer in tokens (which decides
the full-context vs. retrieval strategy for the agent)?

Usage:  python3 scripts/00_inspect.py
Output: build/inspect_report.json  (+ a human summary on stdout)
"""
import json
import pathlib
import sys

import fitz  # PyMuPDF

ROOT = pathlib.Path(__file__).resolve().parent.parent
FILES = ROOT / "files"
BUILD = ROOT / "build"

# A page with a big vector-drawing count is line art (schematic, exploded view).
# Embedded-image extraction returns nothing useful for these — they must be
# rendered and cropped. See DECISIONS.md #4.
VECTOR_HEAVY = 1000
# Below this many characters a page is effectively image-only (scanned or a
# full-bleed diagram); it needs vision transcription, not text extraction.
TEXT_SPARSE = 400


def inspect_pdf(path: pathlib.Path) -> dict:
    doc = fitz.open(path)
    pages = []
    for i, page in enumerate(doc):
        text = page.get_text()
        pages.append(
            {
                "page": i + 1,
                "chars": len(text),
                "embedded_images": len(page.get_images()),
                "vector_drawings": len(page.get_drawings()),
                "width_pt": round(page.rect.width, 1),
                "height_pt": round(page.rect.height, 1),
                "first_line": next(
                    (ln.strip() for ln in text.splitlines() if ln.strip()), ""
                )[:80],
            }
        )
    total_chars = sum(p["chars"] for p in pages)
    return {
        "file": path.name,
        "page_count": doc.page_count,
        "metadata": {k: v for k, v in doc.metadata.items() if v},
        "total_chars": total_chars,
        "approx_tokens": total_chars // 4,
        "born_digital": total_chars > 200 * doc.page_count,
        "vector_heavy_pages": [
            p["page"] for p in pages if p["vector_drawings"] >= VECTOR_HEAVY
        ],
        "image_bearing_pages": [p["page"] for p in pages if p["embedded_images"] > 0],
        "text_sparse_pages": [p["page"] for p in pages if p["chars"] < TEXT_SPARSE],
        "pages": pages,
    }


def main() -> int:
    pdfs = sorted(FILES.glob("*.pdf"))
    if not pdfs:
        print(f"ERROR: no PDFs found in {FILES}", file=sys.stderr)
        return 1

    BUILD.mkdir(exist_ok=True)
    report = {"pdfs": [inspect_pdf(p) for p in pdfs]}
    (BUILD / "inspect_report.json").write_text(json.dumps(report, indent=2))

    for pdf in report["pdfs"]:
        print(f"\n=== {pdf['file']} ===")
        print(f"  pages           : {pdf['page_count']}")
        print(f"  text layer      : {pdf['total_chars']:,} chars (~{pdf['approx_tokens']:,} tokens)")
        print(f"  born-digital    : {pdf['born_digital']}")
        print(f"  producer        : {pdf['metadata'].get('producer', '?')}")
        print(f"  vector-heavy    : {pdf['vector_heavy_pages']}")
        print(f"  has raster imgs : {pdf['image_bearing_pages']}")
        print(f"  text-sparse     : {pdf['text_sparse_pages']}")
        if not pdf["born_digital"]:
            print("  !! scanned PDF — transcription must rely fully on vision")
        if pdf["approx_tokens"] > 50_000:
            print("  !! text layer >50k tokens — switch agent to outline + read_section")

    print(f"\nwrote {BUILD / 'inspect_report.json'}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
