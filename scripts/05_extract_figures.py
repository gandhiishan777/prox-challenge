#!/usr/bin/env python3
"""Stage 5 — crop the figures the agent can show a user.

Figures are cropped out of *rendered page bitmaps*, never pulled with
`extract_image()`. The figures that matter most here are vector line art — the
polarity hookups, the wire feed mechanism, the wiring schematic — and those have
no embedded raster to extract at all (page 9 reports 0 embedded images; page 45
reports 26,144 vector drawings). Rendering and cropping works uniformly for
vector art, photographs and mixed content, and keeps callout labels attached to
the thing they label.

Usage:
  python3 scripts/05_extract_figures.py             # write knowledge/figures/
  python3 scripts/05_extract_figures.py --preview   # also draw crop boxes on
                                                    # page renders for eyeballing
Output:
  knowledge/figures/<id>.png, knowledge/figures/thumbs/<id>.jpg
  build/figure_previews/<page>.png   (with --preview)
"""
import argparse
import json
import sys

import fitz
from PIL import Image, ImageDraw

from common import BUILD, HIRES_DPI, KNOWLEDGE, DOCS, ROOT, page_id

SPEC_PATH = ROOT / "scripts" / "crop_spec.json"

# Crops are kept under ~1.15 megapixels so that an image block returned to the
# model is never downscaled by the API and stays roughly 500-1200 tokens.
MAX_PIXELS = 1_150_000
TRIM_THRESHOLD = 248
TRIM_PAD_PX = 10


def load_pages() -> dict:
    """page_id -> (fitz.Page, scale from PDF points to hires pixels)."""
    pages = {}
    for doc_id, (fname, _, _) in DOCS.items():
        path = ROOT / "files" / fname
        if not path.exists():
            continue
        doc = fitz.open(path)
        for i, page in enumerate(doc):
            pages[page_id(doc_id, i + 1)] = page
    return pages


def trim_whitespace(img: Image.Image) -> Image.Image:
    gray = img.convert("L")
    mask = gray.point(lambda v: 0 if v >= TRIM_THRESHOLD else 255)
    box = mask.getbbox()
    if not box:
        return img
    x0, y0, x1, y1 = box
    return img.crop(
        (
            max(0, x0 - TRIM_PAD_PX),
            max(0, y0 - TRIM_PAD_PX),
            min(img.width, x1 + TRIM_PAD_PX),
            min(img.height, y1 + TRIM_PAD_PX),
        )
    )


def render_crop(page: fitz.Page, bbox_pt, trim: bool) -> Image.Image:
    clip = fitz.Rect(*bbox_pt)
    pix = page.get_pixmap(dpi=HIRES_DPI, clip=clip)
    img = Image.frombytes("RGB", (pix.width, pix.height), pix.samples)
    if trim:
        img = trim_whitespace(img)
    if img.width * img.height > MAX_PIXELS:
        scale = (MAX_PIXELS / (img.width * img.height)) ** 0.5
        img = img.resize(
            (max(1, round(img.width * scale)), max(1, round(img.height * scale))),
            Image.LANCZOS,
        )
    return img


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--preview", action="store_true", help="draw crop boxes on pages")
    args = ap.parse_args()

    spec = json.loads(SPEC_PATH.read_text())
    content_box = spec["content_box_pt"]
    pages = load_pages()

    out_dir = KNOWLEDGE / "figures"
    thumb_dir = out_dir / "thumbs"
    out_dir.mkdir(parents=True, exist_ok=True)
    thumb_dir.mkdir(parents=True, exist_ok=True)

    manifest = []
    per_page_boxes: dict[str, list] = {}
    errors = 0

    for fig in spec["figures"]:
        pid = fig["page_id"]
        page = pages.get(pid)
        if page is None:
            print(f"  ERROR {fig['id']}: unknown page {pid}", file=sys.stderr)
            errors += 1
            continue

        if fig["mode"] == "page":
            # Clip away the repeated furniture (section tabs, footer), then trim
            # whitespace so a page that is mostly one diagram becomes a tight figure.
            if pid.startswith("om-"):
                # The section tab strip swaps sides with page parity: it sits at
                # x 0-36 on even pages and x 559-595 on odd ones. Cropping the
                # wrong side leaves a grey stripe down the middle of the figure.
                page_no = int(pid.split("-")[1])
                top, bottom = content_box[1], content_box[3]
                if page_no % 2 == 0:
                    bbox = [content_box[0] + 10, top, page.rect.width, bottom]
                else:
                    bbox = [0, top, content_box[2] - 9, bottom]
            else:
                # The other documents have their own geometry and no tab strip.
                bbox = [0, 0, page.rect.width, page.rect.height]
            bbox[2] = min(bbox[2], page.rect.width)
            bbox[3] = min(bbox[3], page.rect.height)
            trim = True
        elif fig["mode"] == "rect":
            bbox = fig["bbox_pt"]
            trim = False
        else:
            print(f"  ERROR {fig['id']}: bad mode {fig['mode']}", file=sys.stderr)
            errors += 1
            continue

        img = render_crop(page, bbox, trim)
        img.save(out_dir / f"{fig['id']}.png")

        thumb = img.copy()
        thumb.thumbnail((360, 360), Image.LANCZOS)
        thumb.convert("RGB").save(thumb_dir / f"{fig['id']}.jpg", quality=78)

        per_page_boxes.setdefault(pid, []).append((fig["id"], bbox))

        manifest.append(
            {
                "id": fig["id"],
                "page_id": pid,
                "title": fig["title"],
                "caption": fig["caption"],
                "keywords": fig["keywords"],
                "answers": fig.get("answers", []),
                "file": f"figures/{fig['id']}.png",
                "thumb": f"figures/thumbs/{fig['id']}.jpg",
                "px": [img.width, img.height],
                "bbox_pt": [round(v, 1) for v in bbox],
            }
        )
        print(f"  {fig['id']:32s} {pid}  {img.width}x{img.height}", file=sys.stderr)

    (BUILD / "figures_manifest.json").write_text(json.dumps(manifest, indent=2))

    if args.preview:
        prev_dir = BUILD / "figure_previews"
        prev_dir.mkdir(parents=True, exist_ok=True)
        for pid, boxes in per_page_boxes.items():
            page = pages[pid]
            pix = page.get_pixmap(dpi=100)
            img = Image.frombytes("RGB", (pix.width, pix.height), pix.samples)
            draw = ImageDraw.Draw(img)
            scale = 100 / 72
            for fid, bbox in boxes:
                draw.rectangle(
                    [bbox[0] * scale, bbox[1] * scale, bbox[2] * scale, bbox[3] * scale],
                    outline=(255, 0, 0),
                    width=3,
                )
                draw.text((bbox[0] * scale + 4, bbox[1] * scale + 4), fid, fill=(255, 0, 0))
            img.save(prev_dir / f"{pid}.png")
        print(f"previews in {prev_dir}", file=sys.stderr)

    print(f"\n{len(manifest)} figures written to {out_dir}")
    return 1 if errors else 0


if __name__ == "__main__":
    raise SystemExit(main())
