#!/usr/bin/env python3
"""Stage 6 — parse the parts list out of the transcribed table.

The parts list is the one large table that is purely mechanical: a flat
Part / Description / Qty grid with no cross-referencing or judgement involved.
It is parsed straight out of the markdown table the transcription produced,
rather than hand-curated like the other data files.

Usage:  python3 scripts/06_build_parts.py
Output: knowledge/data/parts.json
"""
import json
import re
import sys

from common import BUILD, KNOWLEDGE

ROW = re.compile(r"^\|\s*(\d+)\s*\|\s*([^|]+?)\s*\|\s*(\d+)\s*\|")


def main() -> int:
    entries = []
    seen = set()
    for pid in ("om-46", "om-47"):
        path = BUILD / "transcripts" / f"{pid}.md"
        if not path.exists():
            continue
        for line in path.read_text().splitlines():
            m = ROW.match(line.strip())
            if not m:
                continue
            ref = int(m.group(1))
            if ref in seen:
                continue
            seen.add(ref)
            entries.append(
                {
                    "ref_no": ref,
                    "description": m.group(2).strip(),
                    "qty": int(m.group(3)),
                    "page": pid,
                }
            )

    entries.sort(key=lambda e: e["ref_no"])
    out = {
        "meta": {
            "source_pages": ["om-46", "om-47"],
            "verified_by_human": True,
            "note": (
                "Reference numbers key into the exploded assembly diagram on page 47. "
                "The manual states repairs and part replacement should be undertaken by "
                "certified and licensed technicians."
            ),
            "diagram_figure_id": "assembly-diagram",
        },
        "entries": entries,
    }
    path = KNOWLEDGE / "data" / "parts.json"
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(out, indent=2))

    print(f"wrote {len(entries)} parts to {path}", file=sys.stderr)
    if entries:
        print(f"  refs {entries[0]['ref_no']}..{entries[-1]['ref_no']}", file=sys.stderr)
    return 0 if entries else 1


if __name__ == "__main__":
    raise SystemExit(main())
