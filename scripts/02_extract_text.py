#!/usr/bin/env python3
"""Stage 2 — dump the PDF text layer.

The text layer is a *hint* for the vision transcription pass and a grep target
for QA (stage 8 checks that every curated number appears in the source). It is
deliberately not the primary transcript: PDF text extraction linearizes
multi-column tables in reading order that does not match the visual grid, which
is exactly how duty-cycle matrices get silently scrambled.

Usage:  python3 scripts/02_extract_text.py
Output: build/text/<page_id>.txt
"""
import sys

import fitz

from common import BUILD, iter_docs, page_id


def main() -> int:
    out = BUILD / "text"
    out.mkdir(parents=True, exist_ok=True)

    total = 0
    for doc_id, path in iter_docs():
        doc = fitz.open(path)
        for i, page in enumerate(doc):
            pid = page_id(doc_id, i + 1)
            text = page.get_text()
            (out / f"{pid}.txt").write_text(text)
            total += len(text)

    print(f"wrote text dumps to {out} ({total:,} chars)", file=sys.stderr)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
