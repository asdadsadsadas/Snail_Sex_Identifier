# 🐌 Snail AI — 3-Stage Training Pipeline (Google Colab)
#
#   Stage 1: DETECT the snail      → yolo11n.pt   on dataset_detection  (bounding boxes)
#   Stage 2: Classify SEX          → yolo11n-cls.pt on dataset_sex      (male/female)
#   Stage 3: Classify PREGNANCY    → yolo11n-cls.pt on dataset_pregnancy (pregnant/not_pregnant)
#
# Setup before running:
#   1. Runtime → Change runtime type → T4 GPU
#   2. Zip your datasets and upload to Google Drive:
#        zip -r dataset_detection.zip  dataset_detection/
#        zip -r dataset_sex.zip        dataset_sex/
#        zip -r dataset_pregnancy.zip  dataset_pregnancy/
#   3. Run cells in order. Stages with no data are skipped (safe to run all).
#   4. Trained models are saved with verification to: My Drive/snail_models/
#      (download them from there — see AI_TRAINING_GUIDE.md Phase 4)
#
# After training, the FastAPI server loads the three *.pt files:
#   detect snail → crop → classify sex → classify pregnancy
# (see AI_TRAINING_GUIDE.md Phase 4)

# ── Cell 1: Mount Drive, unzip datasets, install ultralytics ─────────────
from google.colab import drive
drive.mount('/content/drive')

!unzip -q "/content/drive/MyDrive/dataset_detection.zip" -d "/content/"   2>/dev/null || echo "⚠ no dataset_detection.zip"
!unzip -q "/content/drive/MyDrive/dataset_sex.zip" -d "/content/"         2>/dev/null || echo "⚠ no dataset_sex.zip"
!unzip -q "/content/drive/MyDrive/dataset_pregnancy.zip" -d "/content/"   2>/dev/null || echo "⚠ no dataset_pregnancy.zip"

!pip install ultralytics -q

import os
import shutil
from ultralytics import YOLO

# ── Save-to-Drive helper (VERIFIES the copy — no silent failures) ──
# All trained models are saved into a single folder on Drive so they're easy
# to find: My Drive/snail_models/. Every save checks the file actually landed
# and raises a loud error instead of printing "saved" and moving on.
MODELS_DIR = "/content/drive/MyDrive/snail_models"
os.makedirs(MODELS_DIR, exist_ok=True)


def save_to_drive(src: str, dest: str, label: str = "") -> None:
    """Copy a trained file to Drive and VERIFY it landed.

    Raises loudly if the source is missing or the copy didn't take effect,
    so you never think your model is saved when it isn't.
    """
    if not os.path.exists(src):
        raise FileNotFoundError(
            f"🚨 Missing training output: {src}\n"
            f"   Re-run the training cell for this stage, then re-run this cell.")
    shutil.copy2(src, dest)
    if not os.path.exists(dest) or os.path.getsize(dest) == 0:
        raise RuntimeError(
            f"🚨 Copy to Drive FAILED: {dest} not found after copying.\n"
            f"   Check that Drive is mounted (folder icon in the Files panel)"
            f" and not read-only.")
    print(f"  ✅ {label or os.path.basename(dest)} → {dest} ({os.path.getsize(dest) / 1e6:.1f} MB)")


def best_weights(candidates: list[str]) -> str:
    """Return the first existing weights file from candidate paths.

    Ultralytics output layout varies by version (project dir vs runs/detect),
    so we search instead of assuming one hardcoded path.
    """
    for p in candidates:
        if os.path.exists(p) and os.path.getsize(p) > 0:
            return p
    return ""


# Make dataset paths absolute (robust regardless of where the notebook runs)
_DET_YAML = "/content/dataset_detection/data.yaml"
if os.path.exists(_DET_YAML):
    _text = open(_DET_YAML, encoding="utf-8").read().replace(
        "path: ../dataset_detection", "path: /content/dataset_detection")
    open(_DET_YAML, "w", encoding="utf-8").write(_text)

print("✅ Ready. Folders found:", [d for d in ("dataset_detection", "dataset_sex", "dataset_pregnancy")
                                    if os.path.isdir(f"/content/{d}")])

# ── Cell 2: Stage 1 — Snail DETECTOR ─────────────────────────────────────
# Finds the snail in the photo (bounding box). Training data: dataset_detection/
if os.path.isdir("/content/dataset_detection") and os.path.exists("/content/dataset_detection/data.yaml"):
    detector = YOLO("yolo11n.pt")  # nano detection — ~6MB, ideal first run.
    # If mAP50 plateaus below ~0.6, re-run with YOLO("yolo11s.pt") (still T4-fast).

    detector.train(
        data="/content/dataset_detection/data.yaml",
        epochs=100,           # 579 train images → usually converges ~60-80; bump to 150 if still improving
        imgsz=640,            # snail boxes are 7-48% of the frame, so 640 is plenty (and T4-fast)
        batch=16,             # raise to 32 if CUDA allows (smoother gradients)
        patience=25,          # one class + small val → noisy curves; don't stop too early
        device="cuda",
        cache="ram",          # dataset is only ~100MB → RAM cache = much faster epochs
        # ── augmentation ──
        hsv_h=0.02, hsv_s=0.4, hsv_v=0.4,  # slight hue jitter for lighting variety
        degrees=15, translate=0.1, scale=0.5, shear=5,  # phone angle/zoom variation
        fliplr=0.5, flipud=0.5,            # top-down photos → flips harmless, double the variety
        mosaic=1.0, mixup=0.0,             # mosaic helps; mixup blends boxes → off for single class
        project="snail_detector", name="det", exist_ok=True,
    )

    print("Class IDs:", detector.names)   # expect {0: 'snail'}
    detector.export(format="onnx", imgsz=640)  # optional — smaller/faster inference

    # Find the weights wherever ultralytics wrote them (layout varies by version)
    _src = best_weights([
        "/content/snail_detector/det/weights/best.pt",
        "/content/runs/detect/snail_detector/det/weights/best.pt",
        "/content/runs/detect/train/weights/best.pt",
    ])
    if not _src:
        raise FileNotFoundError("🚨 Detector weights (best.pt) not found — check the training output above.")
    save_to_drive(_src, f"{MODELS_DIR}/snail_detector.pt", "detector .pt")
    save_to_drive(_src.replace(".pt", ".onnx"), f"{MODELS_DIR}/snail_detector.onnx", "detector .onnx")
    print("✅ Snail detector saved to Drive (verified)")
else:
    print("⏭ Skipping detector — no dataset_detection/")

# ── Cell 3: (note) Classifier crops are made LOCALLY now ────────────────
# The stage-2/3 classifiers train on the DETECTED CROP (that's what the API
# classifies), so the snail crops come from scripts/crop_snail_boxes.py on your
# machine — it cuts every box out of dataset_detection/ into dataset_labeling/,
# keeping the same train/val split. You then label those crops in Label Studio
# and organize the export with scripts/organize_classification_dataset.mjs.
# Upload the finished dataset_sex.zip / dataset_pregnancy.zip to Drive, and
# cells 4 & 5 below train the classifiers on them.
print("ℹ Snail crops are generated locally — see scripts/crop_snail_boxes.py")
print("  → dataset_labeling/ → Label Studio → organize_classification_dataset.mjs")

# ── Cell 4: Stage 2 — SEX classifier (male/female) ───────────────────────
# Training data: dataset_sex/train/{male,female} + val/{male,female}
if os.path.isdir("/content/dataset_sex") and os.path.isdir("/content/dataset_sex/train"):
    sex_model = YOLO("yolo11n-cls.pt")

    sex_model.train(
        data="/content/dataset_sex",
        epochs=100,
        imgsz=224,
        batch=32,
        patience=15,
        device="cuda",
        hsv_h=0.015, hsv_s=0.7, hsv_v=0.4,
        degrees=15, translate=0.1, scale=0.5, shear=5, fliplr=0.5,
        mixup=0.1, cutmix=0.1,
        project="snail_sex", name="sex_model", exist_ok=True,
    )

    print("Class IDs:", sex_model.names)  # verify order → fix SEX_MAP in the API server
    sex_model.export(format="onnx", imgsz=224)

    _src = best_weights([
        "/content/snail_sex/sex_model/weights/best.pt",
        "/content/runs/classify/snail_sex/sex_model/weights/best.pt",
    ])
    if not _src:
        raise FileNotFoundError("🚨 Sex model weights (best.pt) not found — check the training output above.")
    save_to_drive(_src, f"{MODELS_DIR}/snail_sex_model.pt", "sex .pt")
    save_to_drive(_src.replace(".pt", ".onnx"), f"{MODELS_DIR}/snail_sex_model.onnx", "sex .onnx")
    print("✅ Sex model saved to Drive (verified)")
else:
    print("⏭ Skipping sex classifier — no dataset_sex/ yet (needs male + female photos)")

# ── Cell 5: Stage 3 — PREGNANCY classifier (pregnant/not_pregnant) ───────
# Training data: dataset_pregnancy/train/{pregnant,not_pregnant} + val/{...}
# Built by scripts/organize_classification_dataset.mjs from the second-pass
# Label Studio export — classes come from whatever you labeled (pregnant +
# not_pregnant; the script warns if one is missing so the model isn't trained
# on a single class).
if os.path.isdir("/content/dataset_pregnancy") and os.path.isdir("/content/dataset_pregnancy/train"):
    preg_model = YOLO("yolo11n-cls.pt")

    preg_model.train(
        data="/content/dataset_pregnancy",
        epochs=100,
        imgsz=224,
        batch=32,
        patience=15,
        device="cuda",
        hsv_h=0.015, hsv_s=0.7, hsv_v=0.4,
        degrees=15, translate=0.1, scale=0.5, shear=5, fliplr=0.5,
        mixup=0.1, cutmix=0.1,
        project="snail_pregnancy", name="pregnancy_model", exist_ok=True,
    )

    print("Class IDs:", preg_model.names)
    preg_model.export(format="onnx", imgsz=224)

    _src = best_weights([
        "/content/snail_pregnancy/pregnancy_model/weights/best.pt",
        "/content/runs/classify/snail_pregnancy/pregnancy_model/weights/best.pt",
    ])
    if not _src:
        raise FileNotFoundError("🚨 Pregnancy model weights (best.pt) not found — check the training output above.")
    save_to_drive(_src, f"{MODELS_DIR}/snail_pregnancy_model.pt", "pregnancy .pt")
    save_to_drive(_src.replace(".pt", ".onnx"), f"{MODELS_DIR}/snail_pregnancy_model.onnx", "pregnancy .onnx")
    print("✅ Pregnancy model saved to Drive (verified)")
else:
    print("⏭ Skipping pregnancy classifier — no dataset_pregnancy/")

# ── Cell 6: Test & diagnose the detector ─────────────────────────────────
# Runs detection over ALL validation images so you can tell whether the
# model actually learned anything (not just one lucky/unlucky image).
import glob
import pandas as pd
from PIL import Image, ImageDraw, ImageOps


def load(path):
    """EXIF-safe image load (phone photos may carry a rotation tag)."""
    return ImageOps.exif_transpose(Image.open(path)).convert("RGB")


if "detector" in globals():
    # 1) Training metrics from the last run — did it learn?
    csv_path = next((p for p in (
        "/content/snail_detector/det/results.csv",
        "/content/runs/detect/snail_detector/det/results.csv",
        "/content/runs/detect/train/results.csv",
    ) if os.path.exists(p)), "")
    if csv_path:
        last = pd.read_csv(csv_path).iloc[-1]
        print("Last epoch:  mAP50 = %.3f   mAP50-95 = %.3f" % (
            last["metrics/mAP50(B)"], last["metrics/mAP50-95(B)"]))
        print("             precision = %.3f   recall = %.3f" % (
            last["metrics/precision(B)"], last["metrics/recall(B)"]))
        print("  (mAP50 > 0.5 solid | 0.2-0.5 weak but usable | < 0.2 needs more data)")

    # 2) Detection rate over ALL val images at a few thresholds
    val_imgs = sorted(glob.glob("/content/dataset_detection/images/val/*.jpg"))
    print(f"\nDetection rate on {len(val_imgs)} val images:")
    for conf in (0.25, 0.1, 0.05):
        hits = 0
        for p in val_imgs:
            r = detector.predict(load(p), verbose=False, conf=conf)[0]
            if r.boxes is not None and len(r.boxes) > 0:
                hits += 1
        print(f"  conf={conf:.2f}: {hits}/{len(val_imgs)} ({hits / max(1, len(val_imgs)):.0%})")

    # 2.5) Mean IoU vs ground truth — does the box actually HUG the snail?
    # (predict() returns boxes in original image pixels, so we compare directly
    # with the normalized labels scaled back up.)
    def iou_xyxy(a, b):
        x1, y1 = max(a[0], b[0]), max(a[1], b[1])
        x2, y2 = min(a[2], b[2]), min(a[3], b[3])
        inter = max(0.0, x2 - x1) * max(0.0, y2 - y1)
        ua = (a[2] - a[0]) * (a[3] - a[1]) + (b[2] - b[0]) * (b[3] - b[1]) - inter
        return inter / ua if ua > 0 else 0.0

    ious = []
    for lbl in sorted(glob.glob("/content/dataset_detection/labels/val/*.txt")):
        img = load(f"/content/dataset_detection/images/val/{os.path.basename(lbl)[:-4]}.jpg")
        W, H = img.size
        gt = []
        for line in open(lbl):
            _, cx, cy, bw, bh = map(float, line.split())
            gt.append(((cx - bw / 2) * W, (cy - bh / 2) * H, (cx + bw / 2) * W, (cy + bh / 2) * H))
        r = detector.predict(img, verbose=False, conf=0.25)[0]
        if r.boxes is None or len(r.boxes) == 0:
            ious.append(0.0)  # missed the snail entirely
            continue
        best_gt = max(gt, key=lambda b: (b[2] - b[0]) * (b[3] - b[1]))
        xyxy = r.boxes.xyxy.cpu().numpy()
        ious.append(max(iou_xyxy(p, best_gt) for p in xyxy))
    mean_iou = sum(ious) / len(ious) if ious else 0.0
    print(f"Val IoU (conf=0.25): mean = {mean_iou:.3f}  "
          f"(> 0.6 boxes hug the snails | 0.3-0.6 roughly right | < 0.3 misaligned → check EXIF fix)")

    # 3) Save one annotated example to Drive so you can eyeball the box
    if val_imgs:
        for p in val_imgs:
            img = load(p)
            r = detector.predict(img, verbose=False, conf=0.05)[0]
            if r.boxes is not None and len(r.boxes) > 0:
                xyxy = r.boxes.xyxy.cpu().numpy()
                confs = r.boxes.conf.cpu().numpy()
                # draw the LARGEST detected box for a representative preview
                best = max(range(len(xyxy)),
                           key=lambda i: (xyxy[i][2] - xyxy[i][0]) * (xyxy[i][3] - xyxy[i][1]))
                x1, y1, x2, y2 = map(int, xyxy[best])
                ImageDraw.Draw(img).rectangle([x1, y1, x2, y2], outline="lime", width=8)
                img.save("/content/example_detection.jpg", "JPEG", quality=92)
                save_to_drive("/content/example_detection.jpg",
                              f"{MODELS_DIR}/example_detection.jpg", "example preview")
                print(f"\nAnnotated example saved -> {MODELS_DIR}/example_detection.jpg (conf={float(confs[best]):.2f})")
                break
        else:
            print("\nNo snail found in ANY val image - model didn't learn. See AI_TRAINING_GUIDE.md troubleshooting.")

    # 4) Full pipeline on the first image where a snail IS detected
    for p in val_imgs:
        img = load(p)
        r = detector.predict(img, verbose=False, conf=0.25)[0]
        if r.boxes is not None and len(r.boxes) > 0:
            x1, y1, x2, y2 = map(int, r.boxes.xyxy[0].tolist())
            crop = img.crop((x1, y1, x2, y2))
            print(f"\nPipeline on {os.path.basename(p)}  box={(x1, y1, x2, y2)}")
            if "sex_model" in globals():
                q = sex_model.predict(crop, verbose=False)[0].probs
                print(f"  Sex        -> {sex_model.names[q.top1]} ({float(q.top1conf):.0%})")
            if "preg_model" in globals():
                q = preg_model.predict(crop, verbose=False)[0].probs
                print(f"  Pregnancy  -> {preg_model.names[q.top1]} ({float(q.top1conf):.0%})")
            break

print("\nDone! Model files are in Google Drive -> My Drive/snail_models/ "
      "(verified copies). Download them and build the FastAPI server "
      "(AI_TRAINING_GUIDE.md Phase 4).")
