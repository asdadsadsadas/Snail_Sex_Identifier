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

print("✅ Ready. Folders found:", [d for d in ("dataset_detection", "dataset_sex", "dataset_pregnancy")
                                    if os.path.isdir(f"/content/{d}")])

# ── Cell 2: Stage 1 — Snail DETECTOR ─────────────────────────────────────
# Finds the snail in the photo (bounding box). Training data: dataset_detection/
if os.path.isdir("/content/dataset_detection") and os.path.exists("/content/dataset_detection/data.yaml"):
    detector = YOLO("yolo11n.pt")  # nano detection — fast, ~6MB

    detector.train(
        data="/content/dataset_detection/data.yaml",
        epochs=100,           # small dataset → longer training
        imgsz=640,            # detection default
        batch=16,             # reduce to 8 if CUDA OOM
        patience=20,          # early stop
        device="cuda",
        # ── augmentation for small datasets ──
        hsv_h=0.015, hsv_s=0.4, hsv_v=0.4,
        degrees=15, translate=0.1, scale=0.5, shear=5, fliplr=0.5,
        mosaic=1.0, mixup=0.1,
        project="snail_detector", name="det", exist_ok=True,
    )

    print("Class IDs:", detector.names)   # expect {0: 'snail'}
    detector.export(format="onnx", imgsz=640)  # optional — smaller/faster inference

    !cp /content/snail_detector/det/weights/best.pt    "/content/drive/MyDrive/snail_detector.pt"
    !cp /content/snail_detector/det/weights/best.onnx  "/content/drive/MyDrive/snail_detector.onnx"
    print("✅ Snail detector saved to Drive")
else:
    print("⏭ Skipping detector — no dataset_detection/")

# ── Cell 3: (optional) Crop classifier training images with the boxes ────
# Detector boxes let us crop each photo to the snail → cleaner classifier inputs.
# Run AFTER Cell 2 if you want classification trained on snail crops instead of full photos.
if os.path.isdir("/content/dataset_detection") and "detector" in globals():
    from PIL import Image, ImageOps
    import glob

    def crop_boxes(src_det, dst_root, splits=("train", "val")):
        for split in splits:
            for lbl in glob.glob(f"/content/{src_det}/labels/{split}/*.txt"):
                img_path = f"/content/{src_det}/images/{split}/{os.path.basename(lbl)[:-4]}.jpg"
                if not os.path.exists(img_path):
                    continue
                img = ImageOps.exif_transpose(Image.open(img_path)).convert("RGB")
                w, h = img.size
                boxes = []
                for line in open(lbl):
                    _, cx, cy, bw, bh = map(float, line.split())
                    x1 = (cx - bw / 2) * w; y1 = (cy - bh / 2) * h
                    x2 = (cx + bw / 2) * w; y2 = (cy + bh / 2) * h
                    boxes.append((x1, y1, x2, y2))
                if not boxes:
                    continue
                # crop the largest box with a 10% margin
                x1, y1, x2, y2 = max(boxes, key=lambda b: (b[2] - b[0]) * (b[3] - b[1]))
                mx, my = (x2 - x1) * 0.1, (y2 - y1) * 0.1
                crop = img.crop((max(0, x1 - mx), max(0, y1 - my), min(w, x2 + mx), min(h, y2 + my)))
                os.makedirs(f"{dst_root}/{split}/pregnant", exist_ok=True)
                crop.save(f"{dst_root}/{split}/pregnant/{os.path.basename(lbl)[:-4]}.jpg")
        print(f"✅ crops → {dst_root}")

    crop_boxes("dataset_detection", "/content/dataset_pregnancy_crops")
    !zip -r -q /content/dataset_pregnancy_crops.zip /content/dataset_pregnancy_crops
    !cp /content/dataset_pregnancy_crops.zip "/content/drive/MyDrive/"
    print("✅ cropped pregnancy dataset zipped to Drive")

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

    !cp /content/snail_sex/sex_model/weights/best.pt    "/content/drive/MyDrive/snail_sex_model.pt"
    !cp /content/snail_sex/sex_model/weights/best.onnx  "/content/drive/MyDrive/snail_sex_model.onnx"
    print("✅ Sex model saved to Drive")
else:
    print("⏭ Skipping sex classifier — no dataset_sex/ yet (needs male + female photos)")

# ── Cell 5: Stage 3 — PREGNANCY classifier (pregnant/not_pregnant) ───────
# Training data: dataset_pregnancy/train/{pregnant,not_pregnant} + val/{...}
# (today: 76 pregnant, 0 not_pregnant → collect not_pregnant photos to train)
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

    !cp /content/snail_pregnancy/pregnancy_model/weights/best.pt    "/content/drive/MyDrive/snail_pregnancy_model.pt"
    !cp /content/snail_pregnancy/pregnancy_model/weights/best.onnx  "/content/drive/MyDrive/snail_pregnancy_model.onnx"
    print("✅ Pregnancy model saved to Drive")
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
    csv_path = "/content/snail_detector/det/results.csv"
    if os.path.exists(csv_path):
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
                !cp /content/example_detection.jpg "/content/drive/MyDrive/example_detection.jpg"
                print(f"\nAnnotated example saved -> My Drive/example_detection.jpg (conf={float(confs[best]):.2f})")
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

print("\nDone! Model files are on Google Drive -> build the FastAPI server (AI_TRAINING_GUIDE.md Phase 4).")
