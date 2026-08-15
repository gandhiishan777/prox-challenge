#!/usr/bin/env python3
"""Stage 8 — QA gate over the knowledge pack.

The point of this script is to make a specific class of failure impossible to
ship: a number that the agent will present to a user, with a page citation,
that does not actually appear on that page. It checks every numeric value in
the curated data files against the transcript of the page it claims to come
from, plus structural integrity of the pack.

Exit code is non-zero on failure, so this is CI-able.

Usage:  python3 scripts/08_qa.py [--verbose]
Output: build/qa_report.md
"""
import argparse
import json
import re
import sys

from common import BUILD, KNOWLEDGE

# Values that are too common to be evidence of anything (a bare "1" appears on
# every page), or that are structural rather than transcribed measurements.
TRIVIAL = {"0", "1", "2", "3", "4", "5", "10", "100"}
NUMBER = re.compile(r"\d+(?:\.\d+)?")


def transcripts() -> dict[str, str]:
    out = {}
    for path in (BUILD / "transcripts").glob("*.md"):
        out[path.stem] = path.read_text()
    return out


def page_refs(node) -> list[str]:
    """Collect page ids declared on or under a node."""
    refs = []
    if isinstance(node, dict):
        if isinstance(node.get("page"), str):
            refs.append(node["page"])
        for key in ("pages", "source_pages"):
            v = node.get(key)
            if isinstance(v, list):
                refs += [x for x in v if isinstance(x, str)]
    return refs


def walk(node, inherited: list[str], found: list[tuple]):
    """Yield (value, pages) for every numeric leaf, carrying nearest page refs."""
    if isinstance(node, dict):
        here = page_refs(node) or inherited
        for key, value in node.items():
            if key.startswith("_") or key in ("page", "pages", "source_pages"):
                continue
            walk(value, here, found)
    elif isinstance(node, list):
        for item in node:
            walk(item, inherited, found)
    elif isinstance(node, (int, float, str)) and inherited:
        found.append((node, inherited))


FRACTION = re.compile(r"(\d+)-(\d+)/(\d+)")


def normalize(text: str) -> str:
    """Collapse the ways the same number is written across sources.

    The manual mixes conventions freely: the duty-cycle dials print
    "2-1/2 Minutes Welding" where the data file holds 2.5, and wire sizes appear
    as .030" against 0.03 in JSON. Without normalizing these, the check reports
    mismatches on values that are in fact correct, which trains a reader to
    ignore its output.
    """
    text = FRACTION.sub(
        lambda m: str(int(m.group(1)) + int(m.group(2)) / int(m.group(3))), text
    )
    for ch in (",", "\u2009", "\u00a0", "\u200a", " "):
        text = text.replace(ch, "")
    return text.replace("\u2013", "-").replace("\u2014", "-").lower()


def numeric_variants(token: str) -> list[str]:
    """Spellings of the same quantity that should all count as a match."""
    out = {token}
    if "." in token:
        stripped = token.lstrip("0") or token
        out.update({stripped, stripped.rstrip("0"), token.rstrip("0"), stripped + "0"})
    try:
        value = float(token)
        if value.is_integer():
            out.add(str(int(value)))
    except ValueError:
        pass
    return [v for v in out if v and v not in {".", "0", ""}]


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--verbose", action="store_true")
    args = ap.parse_args()

    BUILD.mkdir(parents=True, exist_ok=True)

    tx = transcripts()
    # Without this the script false-greens on a fresh clone: `build/` is
    # gitignored, pathlib.glob on a missing directory returns empty rather than
    # raising, and every transcript-grounded assertion would pass vacuously —
    # printing "0 failures" on exactly the gate meant to prove the numbers are
    # grounded. A gate that cannot fail is worse than no gate.
    if not tx:
        print(
            "ERROR: no transcripts in build/transcripts/.\n"
            "This check compares curated data against the transcribed pages, which are\n"
            "an intermediate build artifact and are not committed. Regenerate them with\n"
            "  ./scripts/run_pipeline.sh   (stage 3 needs ANTHROPIC_API_KEY)\n"
            "To verify the committed pack without an API key, use 09_verify_facts.py,\n"
            "which reads knowledge/manual_full.md instead.",
            file=sys.stderr,
        )
        return 1

    tx_norm = {k: normalize(v) for k, v in tx.items()}
    report: list[str] = ["# Knowledge pack QA\n"]
    failures: list[str] = []
    warnings: list[str] = []

    # ---- 1. structural completeness -------------------------------------
    manifest_path = KNOWLEDGE / "manifest.json"
    if not manifest_path.exists():
        print("ERROR: manifest.json missing — run 07_build_manifest.py", file=sys.stderr)
        return 1
    manifest = json.loads(manifest_path.read_text())

    missing_pages = [
        p["id"] for p in manifest["pages"] if not (KNOWLEDGE / p["image"]).exists()
    ]
    missing_figs = [
        f["id"] for f in manifest["figures"] if not (KNOWLEDGE / f["file"]).exists()
    ]
    no_transcript = [p["id"] for p in manifest["pages"] if p["id"] not in tx]

    if missing_pages:
        failures.append(f"page renders missing: {missing_pages}")
    if missing_figs:
        failures.append(f"figure files missing: {missing_figs}")
    if no_transcript:
        failures.append(f"pages with no transcript: {no_transcript}")

    report.append(
        f"- pages: {len(manifest['pages'])} (renders ok: {not missing_pages})\n"
        f"- figures: {len(manifest['figures'])} (files ok: {not missing_figs})\n"
        f"- transcripts: {len(tx)}\n"
    )

    # ---- 2. unreadable cells --------------------------------------------
    unreadable = {pid: t.count("?[]?") for pid, t in tx.items() if "?[]?" in t}
    if unreadable:
        failures.append(f"transcripts contain fully unreadable cells: {unreadable}")
    uncertain = {pid: len(re.findall(r"\?\[[^\]]+\]\?", t)) for pid, t in tx.items()}
    uncertain = {k: v for k, v in uncertain.items() if v}
    report.append(
        f"- unreadable `?[]?` markers: {sum(unreadable.values()) if unreadable else 0}\n"
        f"- uncertain `?[guess]?` markers: {sum(uncertain.values())} "
        f"across {len(uncertain)} pages\n"
    )

    # ---- 3. every curated number traces back to its cited page ----------
    checked = 0
    for data_path in sorted((KNOWLEDGE / "data").glob("*.json")):
        data = json.loads(data_path.read_text())
        meta = data.get("meta", {})
        if not meta.get("verified_by_human"):
            failures.append(f"{data_path.name}: meta.verified_by_human is not true")

        found: list[tuple] = []
        walk(data, [], found)

        misses = []
        for value, pages in found:
            for token in NUMBER.findall(str(value)):
                if token in TRIVIAL or len(token) < 2:
                    continue
                checked += 1
                hay = " ".join(tx_norm.get(p, "") for p in pages)
                if not hay:
                    misses.append((token, pages, "cited page has no transcript"))
                elif not any(normalize(v) in hay for v in numeric_variants(token)):
                    misses.append((token, pages, "not found on cited page"))

        if misses:
            uniq = sorted({(m[0], tuple(m[1]), m[2]) for m in misses})
            for token, pages, why in uniq:
                warnings.append(f"{data_path.name}: '{token}' {why} ({', '.join(pages)})")
        report.append(f"- {data_path.name}: {len(found)} leaves, {len(set(m[0] for m in misses))} unmatched numbers\n")

    report.append(f"\n- numeric tokens checked against source transcripts: {checked}\n")

    # ---- 4. figure references resolve ------------------------------------
    fig_ids = {f["id"] for f in manifest["figures"]}
    for data_path in sorted((KNOWLEDGE / "data").glob("*.json")):
        blob = data_path.read_text()
        for ref in re.findall(r'"figure_id"\s*:\s*"([^"]+)"', blob):
            if ref not in fig_ids:
                failures.append(f"{data_path.name}: unknown figure_id '{ref}'")
        for ref in re.findall(r'"figures"\s*:\s*\[([^\]]*)\]', blob):
            for fid in re.findall(r'"([^"]+)"', ref):
                if fid not in fig_ids:
                    failures.append(f"{data_path.name}: unknown figure '{fid}'")

    page_ids = {p["id"] for p in manifest["pages"]}
    for fig in manifest["figures"]:
        if fig["page_id"] not in page_ids:
            failures.append(f"figure {fig['id']} references unknown page {fig['page_id']}")

    # ---- report ----------------------------------------------------------
    if warnings:
        report.append("\n## Warnings (numbers not literally present on the cited page)\n")
        report += [f"- {w}\n" for w in warnings]
    if failures:
        report.append("\n## Failures\n")
        report += [f"- {f}\n" for f in failures]

    (BUILD / "qa_report.md").write_text("".join(report))
    print("".join(report) if args.verbose else f"wrote {BUILD / 'qa_report.md'}")
    print(f"\n{len(failures)} failures, {len(warnings)} warnings")
    for f in failures:
        print(f"  FAIL {f}")
    if args.verbose:
        for w in warnings[:40]:
            print(f"  warn {w}")
    return 1 if failures else 0


if __name__ == "__main__":
    raise SystemExit(main())
