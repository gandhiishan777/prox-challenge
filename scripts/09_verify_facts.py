#!/usr/bin/env python3
"""Stage 9 — semantic fact check against the assembled manual.

`08_qa.py` verifies every *number* in the curated data appears on the page it
cites. That misses the other half of the risk: claims like "the ground clamp goes
in the POSITIVE socket for TIG" contain no distinctive number, so a transposition
there would pass the numeric gate silently — and get somebody's polarity backwards.

This checks the specific load-bearing claims, phrased as the manual phrases them,
against `knowledge/manual_full.md`. It needs no API key and runs in a second.

Usage:  python3 scripts/09_verify_facts.py
"""
import re
import sys

from common import KNOWLEDGE

# (label, page id, [phrases that must appear on that page])
FACTS = [
    # Duty cycle — the headline numbers, per process and input voltage.
    ("MIG 240V: 25% at 200A", "om-07", ["25%", "200"]),
    ("MIG 240V: 100% at 115A", "om-07", ["100%", "115"]),
    ("MIG 120V: 40% at 100A", "om-07", ["40%", "100"]),
    ("TIG 240V: 30% at 175A", "om-07", ["30%", "175"]),
    ("TIG 120V: 40% at 125A", "om-07", ["40%", "125"]),
    ("STICK 240V: 25% at 175A", "om-07", ["25%", "175"]),
    ("STICK 120V: 40% at 80A", "om-07", ["40%", "80"]),
    # Polarity and sockets — no distinctive numbers, so invisible to the numeric gate.
    ("TIG: ground clamp into POSITIVE", "om-24", ["Ground Clamp Cable", "Positive Socket"]),
    ("TIG: torch into NEGATIVE", "om-24", ["TIG Torch Cable", "Negative Socket"]),
    ("Stick: electrode holder into POSITIVE", "om-27", ["Electrode Holder Cable", "Positive Socket"]),
    ("Stick: ground clamp into NEGATIVE", "om-27", ["Ground Clamp Cable", "Negative Socket"]),
    ("MIG is DCEP", "om-14", ["DCEP"]),
    ("MIG: wire feed power into POSITIVE", "om-14", ["Positive"]),
    ("Flux-cored is DCEN", "om-13", ["DCEN"]),
    # Capability limits — these prevent confidently wrong answers.
    ("Aluminium needs AC TIG", "sc-01", ["AC TIG"]),
    ("This machine's TIG materials exclude aluminium", "om-07", ["Chrome Moly"]),
    ("No extension cord", "om-42", ["extension cord"]),
    # Consumables and gas.
    ("Flux-cored wire up to 0.045", "om-07", ["0.045"]),
    ("Solid wire from 0.025", "om-07", ["0.025"]),
    ("Gas flow 20-30 SCFH", "om-20", ["20-30"]),
    ("Wire speed 50-500 IPM", "om-07", ["50", "500"]),
]


def page_text(manual: str, page_id: str) -> str:
    match = re.search(
        rf"<!-- page: {re.escape(page_id)} -->(.*?)(?=<!-- page: |\Z)", manual, re.S
    )
    return match.group(1) if match else ""


def main() -> int:
    manual_path = KNOWLEDGE / "manual_full.md"
    if not manual_path.exists():
        print("ERROR: knowledge/manual_full.md missing — run 04_sectionize.py", file=sys.stderr)
        return 1
    manual = manual_path.read_text()

    failures = []
    for label, page_id, phrases in FACTS:
        text = page_text(manual, page_id).lower()
        if not text:
            failures.append(f"{label}: page {page_id} not found in manual_full.md")
            continue
        missing = [p for p in phrases if p.lower() not in text]
        status = "ok  " if not missing else "FAIL"
        print(f"  {status} {label}  ({page_id})" + (f"  missing={missing}" if missing else ""))
        if missing:
            failures.append(f"{label} ({page_id}): missing {missing}")

    print(f"\n{len(FACTS) - len(failures)}/{len(FACTS)} facts confirmed on their cited page")
    for f in failures:
        print(f"  FAIL {f}", file=sys.stderr)
    return 1 if failures else 0


if __name__ == "__main__":
    raise SystemExit(main())
