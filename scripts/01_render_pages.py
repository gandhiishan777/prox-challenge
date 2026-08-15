#!/usr/bin/env python3
"""Stage 1 — rasterize every page of every source PDF.

Produces three sets of renders:
  knowledge/pages/<id>.png        150 DPI, COMMITTED. What the agent looks at
                                  when it calls view_page(), and what the UI shows.
  knowledge/pages/thumbs/<id>.jpg  72 DPI, COMMITTED. UI page strip.
  build/hires/<id>.png            300 DPI, gitignored. Source for vision
                                  transcription and figure crops.

Usage:
  python3 scripts/01_render_pages.py            # all pages
  python3 scripts/01_render_pages.py --only om  # one document
"""
import argparse
import json
import pathlib
import sys

import fitz
from PIL import Image

from common import BUILD, HIRES_DPI, KNOWLEDGE, PAGE_DPI, THUMB_DPI, DOCS, iter_docs, page_id

# The vision API downscales anything past ~1568px on the long edge, so every
# pixel a page spends on blank margin is a pixel of resolution the model does not
# get to spend on content. The selection chart is the extreme case: its artboard
# is a 2500x2500pt square whose chart occupies roughly the middle third, so
# without trimming, the chart survives downscaling at about a third of the
# resolution it deserves. Trimming whitespace before saving is therefore an
# accuracy measure, not just a size optimization. See DECISIONS.md #6.
TRIM_THRESHOLD = 248  # pixel values at/above this count as "blank"
TRIM_PAD_PX = 12
# Keep renders inside the API's per-image dimension ceiling.
MAX_EDGE_PX = 4000


def content_bbox(img: Image.Image):
    """Bounding box of non-blank content, or None if the page is uniformly blank."""
    gray = img.convert("L")
    # point() maps blank->0 so getbbox() (which finds non-zero extent) returns content.
    mask = gray.point(lambda v: 0 if v >= TRIM_THRESHOLD else 255)
    return mask.getbbox()


def save_trimmed(pix, path: pathlib.Path, trim: bool) -> tuple[int, int]:
    img = Image.frombytes("RGB", (pix.width, pix.height), pix.samples)
    if trim:
        box = content_bbox(img)
        if box:
            x0, y0, x1, y1 = box
            img = img.crop(
                (
                    max(0, x0 - TRIM_PAD_PX),
                    max(0, y0 - TRIM_PAD_PX),
                    min(img.width, x1 + TRIM_PAD_PX),
                    min(img.height, y1 + TRIM_PAD_PX),
                )
            )
    if max(img.size) > MAX_EDGE_PX:
        scale = MAX_EDGE_PX / max(img.size)
        img = img.resize(
            (round(img.width * scale), round(img.height * scale)), Image.LANCZOS
        )
    img.save(path)
    return img.size


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--only", help="restrict to one doc id (om|qs|sc)")
    args = ap.parse_args()

    pages_dir = KNOWLEDGE / "pages"
    thumbs_dir = pages_dir / "thumbs"
    hires_dir = BUILD / "hires"
    for d in (pages_dir, thumbs_dir, hires_dir):
        d.mkdir(parents=True, exist_ok=True)

    page_map = []
    for doc_id, path in iter_docs():
        if args.only and doc_id != args.only:
            continue
        doc = fitz.open(path)
        for i, page in enumerate(doc):
            n = i + 1
            pid = page_id(doc_id, n)

            # Oversized artboards (the selection chart) are trimmed to their
            # content; ordinary manual pages keep their printed margins so that
            # figure crop boxes stay in a predictable coordinate frame.
            trim = max(page.rect.width, page.rect.height) > 1000

            size = save_trimmed(page.get_pixmap(dpi=PAGE_DPI), pages_dir / f"{pid}.png", trim)
            save_trimmed(page.get_pixmap(dpi=THUMB_DPI), thumbs_dir / f"{pid}.jpg", trim)
            hires_size = save_trimmed(
                page.get_pixmap(dpi=HIRES_DPI), hires_dir / f"{pid}.png", trim
            )

            page_map.append(
                {
                    "id": pid,
                    "doc": doc_id,
                    "doc_title": DOCS[doc_id][1],
                    "page": n,
                    "source_pdf": path.name,
                    "width_pt": round(page.rect.width, 1),
                    "height_pt": round(page.rect.height, 1),
                    "render_px": list(size),
                    "hires_px": list(hires_size),
                    "trimmed": trim,
                }
            )
            print(f"  rendered {pid} {size} (hires {hires_size})", file=sys.stderr)

    (BUILD / "page_map.json").write_text(json.dumps(page_map, indent=2))

    sizes = sorted(
        ((f.stat().st_size, f.name) for f in pages_dir.glob("*.png")), reverse=True
    )
    total_mb = sum(s for s, _ in sizes) / 1e6
    print(f"\n{len(page_map)} pages rendered")
    print(f"committed page PNGs: {total_mb:.1f} MB")
    print("largest:", ", ".join(f"{n} {s/1e3:.0f}KB" for s, n in sizes[:5]))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
