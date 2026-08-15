#!/usr/bin/env python3
"""Stage 7 — assemble knowledge/manifest.json, the index the agent boots from.

Usage:  python3 scripts/07_build_manifest.py
Output: knowledge/manifest.json
"""
import json
import sys

from common import BUILD, KNOWLEDGE, DOCS, citation


def main() -> int:
    figures = json.loads((BUILD / "figures_manifest.json").read_text())
    section_index = json.loads((BUILD / "section_index.json").read_text())

    sections: dict[str, dict] = {}
    for entry in section_index:
        s = sections.setdefault(
            entry["section"],
            {"id": entry["section"], "title": entry["section_title"], "pages": []},
        )
        s["pages"].append(entry["page_id"])

    pages = []
    for entry in section_index:
        pid = entry["page_id"]
        doc, num = pid.split("-")
        pages.append(
            {
                "id": pid,
                "doc": doc,
                "doc_title": DOCS[doc][1],
                "page": int(num),
                "citation": citation(doc, int(num)),
                "section": entry["section"],
                "image": f"pages/{pid}.png",
                "thumb": f"pages/thumbs/{pid}.jpg",
            }
        )

    manual = KNOWLEDGE / "manual_full.md"
    manifest = {
        "product": {
            "name": "Vulcan OmniPro 220 Industrial Multiprocess Welder",
            "item_numbers": ["57812", "63621"],
            "model": "VW220-OP",
            "processes": ["MIG", "Flux-Cored", "TIG", "Stick"],
        },
        "documents": [
            {"id": d, "title": t, "file": f} for d, (f, t, _) in DOCS.items()
        ],
        "counts": {
            "pages": len(pages),
            "figures": len(figures),
            "sections": len(sections),
        },
        "manual_full": {
            "file": "manual_full.md",
            "chars": manual.stat().st_size,
            "approx_tokens": manual.stat().st_size // 4,
        },
        "data_files": [
            {"id": "specs", "file": "data/specs.json", "covers": "output ratings, socket/polarity connections, process selection, capability limits"},
            {"id": "duty_cycle", "file": "data/duty_cycle.json", "covers": "rated duty cycles per process and input voltage"},
            {"id": "troubleshooting", "file": "data/troubleshooting.json", "covers": "machine faults and weld defects with causes and remedies"},
            {"id": "settings", "file": "data/settings.json", "covers": "synergic setup procedure and thickness capability"},
            {"id": "parts", "file": "data/parts.json", "covers": "parts list keyed to the assembly diagram"},
        ],
        "sections": list(sections.values()),
        "pages": pages,
        "figures": figures,
    }

    out = KNOWLEDGE / "manifest.json"
    out.write_text(json.dumps(manifest, indent=2))
    print(
        f"manifest: {len(pages)} pages, {len(figures)} figures, "
        f"{len(sections)} sections, manual ~{manifest['manual_full']['approx_tokens']:,} tokens",
        file=sys.stderr,
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
