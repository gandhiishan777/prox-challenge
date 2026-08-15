#!/usr/bin/env python3
"""Regenerate src/lib/pages.ts from the knowledge manifest.

Run after 07_build_manifest.py if the page set changes.
"""
import json
import pathlib

ROOT = pathlib.Path(__file__).resolve().parent.parent
manifest = json.loads((ROOT / "knowledge" / "manifest.json").read_text())
rows = "\n".join(
    '  { id: "%s", doc: "%s", n: %d, cite: "%s" },'
    % (p["id"], p["doc"], p["page"], p["citation"])
    for p in manifest["pages"]
)
(ROOT / "src" / "lib" / "pages.ts").write_text(
    (ROOT / "src" / "lib" / "pages.ts").read_text().split("export const PAGES")[0]
    + "export const PAGES: PageRef[] = [\n"
    + rows
    + "\n];\n"
    + (ROOT / "src" / "lib" / "pages.ts").read_text().split("];\n", 1)[1]
)
print(f"regenerated src/lib/pages.ts ({len(manifest['pages'])} pages)")
