#!/usr/bin/env python3
"""
Bake EXIF orientation into dataset images so the pixels match your labels.

WHY THIS IS NEEDED
------------------
Phone photos are often stored with the pixels in landscape but an EXIF
"Orientation" tag (6 = rotate 90°, 3 = 180°) that tells viewers how to
display them. Label Studio (and every image viewer) applies that rotation,
so when you drew bounding boxes you drew them on the ROTATED image.

YOLO/Ultralytics loads images with OpenCV, which IGNORES the EXIF tag and
reads the raw pixels. So for any photo with orientation != 1, the training
boxes point at the wrong place — the detector cannot learn from them.

THIS SCRIPT
-----------
Rewrites every image with ImageOps.exif_transpose() so the pixels become the
rotated version you actually labeled, and strips the EXIF orientation tag.
After this, raw pixels == what Label Studio showed you, and the .txt labels
are correct. Safe to re-run: already-correct images are skipped (with
--max-size, images that need resizing are re-encoded, others are skipped).

Usage:
    python scripts/exif_fix_dataset.py                 # fix all dataset images
    python scripts/exif_fix_dataset.py --max-size 1280 # also resize (max side) — smaller
                                                       #   upload, faster training. Boxes are
                                                       #   normalized, so labels stay correct.
    python scripts/exif_fix_dataset.py --check 5       # also save 5 box-overlay previews
                                                       #   into scripts/box_previews/ for eyeballing
"""

import argparse
import glob
import os
import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageOps

ROOT = Path(__file__).resolve().parent.parent

# Image folders to fix (labels live next to them, matching basenames)
TARGET_DIRS = [
    ROOT / "dataset_detection" / "images" / "train",
    ROOT / "dataset_detection" / "images" / "val",
    ROOT / "dataset_pregnancy" / "train" / "pregnant",
    ROOT / "dataset_pregnancy" / "val" / "pregnant",
]

LABEL_ROOT = ROOT / "dataset_detection" / "labels"  # for preview overlays
JPEG_QUALITY = 92


def fix_image(path: Path, max_size: int = 0) -> tuple[str, bool]:
    """Returns (outcome, changed). Rewrites the image with EXIF baked in."""
    img = Image.open(path)
    # iPhone cameras often save as MPO (Multi Picture Object — a JPEG wrapper
    # for Live Photos). PIL reads its first frame; treat it as JPEG here.
    if img.format not in ("JPEG", "MPO"):
        return f"SKIP (not {img.format})", False

    orientation = img.getexif().get(274, 1)
    # The orientation tag is the authoritative signal (some Pillow versions
    # return a new image object from exif_transpose even when no rotation
    # is needed, so we can't rely on object identity).
    rotated = orientation not in (1, None)
    transposed = ImageOps.exif_transpose(img)
    orig_size = transposed.size

    # Resize so the longest side is at most max_size (labels are normalized,
    # so resizing never invalidates the boxes). Detection training runs at
    # imgsz=640 anyway, so 1280px is far more than enough resolution.
    if max_size and max(transposed.size) > max_size:
        transposed.thumbnail((max_size, max_size), Image.LANCZOS)

    resized = transposed.size != orig_size
    convert_mpo = img.format == "MPO"

    if not rotated and not resized and not convert_mpo:
        return f"OK (already normal, orientation={orientation})", False

    # Re-encode as a plain JPEG WITHOUT the EXIF orientation tag, so nothing
    # rotates it again — also converts MPO into a plain JPEG for OpenCV.
    transposed.save(path, "JPEG", quality=JPEG_QUALITY)
    if rotated:
        reason = f"FIXED orientation {orientation}"
    elif resized:
        reason = "RESIZED"
    else:
        reason = "CONVERTED MPO"
    return f"{reason} -> {transposed.size}", True


def draw_preview(img_path: Path, label_path: Path, out_path: Path) -> None:
    """Draw the YOLO box from label_path onto img_path and save to out_path."""
    img = Image.open(img_path).convert("RGB")
    w, h = img.size
    draw = ImageDraw.Draw(img)
    with open(label_path, encoding="utf-8") as f:
        for line in f:
            parts = line.split()
            if len(parts) != 5:
                continue
            _, cx, cy, bw, bh = map(float, parts)
            x1 = int((cx - bw / 2) * w)
            y1 = int((cy - bh / 2) * h)
            x2 = int((cx + bw / 2) * w)
            y2 = int((cy + bh / 2) * h)
            draw.rectangle([x1, y1, x2, y2], outline="lime", width=6)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    img.save(out_path, "JPEG", quality=JPEG_QUALITY)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check", type=int, default=0, metavar="N",
                        help="save N box-overlay previews into scripts/box_previews/")
    parser.add_argument("--max-size", type=int, default=0, metavar="PX",
                        help="resize images so the longest side is at most PX (default: no resize)")
    args = parser.parse_args()

    images = []
    for d in TARGET_DIRS:
        if d.exists():
            images.extend(glob.glob(str(d / "*.jpg")) + glob.glob(str(d / "*.jpeg")))
    if not images:
        print("[ERR] No dataset images found. Run scripts/organize_pregnancy_dataset.mjs first.")
        sys.exit(1)

    changed = 0
    for p in sorted(images):
        outcome, did_change = fix_image(Path(p), max_size=args.max_size)
        if did_change:
            changed += 1
            print(f"  {outcome:55s} {Path(p).name}")
    print(f"[OK] {len(images)} images scanned, {changed} rewritten.")

    if args.check > 0:
        # pick examples from val first, then train
        previews = []
        for d in (TARGET_DIRS[1], TARGET_DIRS[0]):  # val, train
            if not d.exists():
                continue
            for p in sorted(glob.glob(str(d / "*.jpg"))):
                label = LABEL_ROOT / "val" if "val" in str(d) else LABEL_ROOT / "train"
                lp = label / (Path(p).stem + ".txt")
                if lp.exists():
                    previews.append((Path(p), lp))
                if len(previews) >= args.check:
                    break
            if len(previews) >= args.check:
                break
        out_dir = ROOT / "scripts" / "box_previews"
        for img_path, label_path in previews:
            out = out_dir / img_path.name
            draw_preview(img_path, label_path, out)
            print(f"  preview: {out}")
        print(f"[OK] {len(previews)} previews in {out_dir} - open them and check the green box hugs the snail.")


if __name__ == "__main__":
    main()
