#!/usr/bin/env python3
"""
Crop each labeled snail out of the detection dataset for the SECOND labeling pass.

The stage-2/3 classifiers run on the DETECTED CROP — the API crops the snail
box before classifying sex/pregnancy — so the classifier training data should
be snail crops too, not full photos. This script uses the round-2 detection
boxes (dataset_detection/) to cut every snail out of its photo (largest box,
+10% margin, same as the Colab pipeline) into a labeling folder:

    dataset_labeling/
    ├── train/snail_1.jpg   ...   (579 crops)
    └── val/snail_5.jpg     ...   (145 crops)

The train/val split is carried over from dataset_detection/, so the classifier
validation set is the same photos the detector was validated on — a consistent
end-to-end evaluation (nothing the models saw during training).

Next steps after cropping:
    1. Drag dataset_labeling/ into Label Studio (image classification project,
       choices Male/Female and Pregnant/Not Pregnant — see AI_TRAINING_GUIDE.md).
    2. Export the labels as JSON and run scripts/organize_classification_dataset.mjs
       to build dataset_sex/ and dataset_pregnancy/.

Usage:
    python scripts/crop_snail_boxes.py                              # defaults below
    python scripts/crop_snail_boxes.py --src-dir dataset_detection --out-dir dataset_labeling
"""

import argparse
import os
import sys
from glob import glob

from PIL import Image, ImageOps

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)

# Emoji/UTF-8 output breaks on Windows consoles (cp1252) — force UTF-8.
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

MARGIN = 0.10  # 10% margin around the box, matching the Colab crop_boxes()


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    p.add_argument(
        "--src-dir",
        default=os.path.join(ROOT, "dataset_detection"),
        help="Detection dataset root with images/{train,val} and labels/{train,val} (default: dataset_detection/)",
    )
    p.add_argument(
        "--out-dir",
        default=os.path.join(ROOT, "dataset_labeling"),
        help="Folder to write the snail crops into (default: dataset_labeling/)",
    )
    return p.parse_args()


def crop_largest_box(img: Image.Image, lbl_path: str) -> Image.Image | None:
    """Crop the largest box from a YOLO label file, with a 10% margin."""
    w, h = img.size
    boxes = []
    with open(lbl_path, encoding="utf-8") as f:
        for line in f:
            parts = line.strip().split()
            if len(parts) != 5:
                continue
            try:
                _, cx, cy, bw, bh = map(float, parts)
            except ValueError:
                continue
            x1 = (cx - bw / 2) * w
            y1 = (cy - bh / 2) * h
            x2 = (cx + bw / 2) * w
            y2 = (cy + bh / 2) * h
            boxes.append((x1, y1, x2, y2))
    if not boxes:
        return None
    x1, y1, x2, y2 = max(boxes, key=lambda b: (b[2] - b[0]) * (b[3] - b[1]))
    mx, my = (x2 - x1) * MARGIN, (y2 - y1) * MARGIN
    return img.crop((max(0, x1 - mx), max(0, y1 - my), min(w, x2 + mx), min(h, y2 + my)))


def main() -> None:
    args = parse_args()
    src, out = args.src_dir, args.out_dir

    total = 0
    per_split: dict[str, int] = {}
    for split in ("train", "val"):
        img_dir = os.path.join(src, "images", split)
        lbl_dir = os.path.join(src, "labels", split)
        if not os.path.isdir(lbl_dir):
            print(f"⚠ no labels/{split}/ in {src} — skipping")
            continue
        out_split = os.path.join(out, split)
        os.makedirs(out_split, exist_ok=True)
        count = 0
        for lbl in sorted(glob(os.path.join(lbl_dir, "*.txt"))):
            stem = os.path.splitext(os.path.basename(lbl))[0]
            img_path = os.path.join(img_dir, f"{stem}.jpg")
            if not os.path.exists(img_path):
                print(f"⚠ missing image for {os.path.basename(lbl)} — skipped")
                continue
            img = ImageOps.exif_transpose(Image.open(img_path)).convert("RGB")
            crop = crop_largest_box(img, lbl)
            if crop is None:
                print(f"⚠ no valid boxes in {os.path.basename(lbl)} — skipped")
                continue
            crop.save(os.path.join(out_split, f"{stem}.jpg"), "JPEG", quality=95)
            count += 1
        per_split[split] = count
        total += count

    print(f"\n✅ Snail crops → {out}")
    for split in ("train", "val"):
        print(f"  {split}: {per_split.get(split, 0)}")
    print(f"  total: {total}")
    print("\n  Next: drag this folder into Label Studio, label sex + pregnancy,")
    print("  then: node scripts/organize_classification_dataset.mjs")


if __name__ == "__main__":
    sys.exit(main())
