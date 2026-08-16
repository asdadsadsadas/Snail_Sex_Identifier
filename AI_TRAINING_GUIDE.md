# 🐌 Train Your Own Snail AI — Complete Guide

> **From photos → labeled dataset → trained YOLO model → live in your app**

This guide walks you through the entire pipeline:

1. **📸 Collect photos** (using the app itself)
2. **🏷️ Label with Label Studio** (classify male/female, pregnant/not pregnant)
3. **🎯 Train YOLO in Google Colab** (free GPU)
4. **🌐 Deploy as FastAPI API** (to Railway)
5. **🔗 Connect to your app** (one env variable)

---

## Overview: Three Stages

Your final app runs a **3-stage pipeline**: first **detect** the snail, then classify **sex**, then classify **pregnancy**.

| Stage | Model | Classes | What it does |
|---|---|---|---|
| **1. Detector** | YOLO detection | `snail` | Finds the snail's bounding box in the photo — lets the classifiers work on a clean crop, even when the snail doesn't fill the frame |
| **2. Sex model** | YOLO classification | `male`, `female` | Determines if the snail is male or female (on the detected crop) |
| **3. Pregnancy model** | YOLO classification | `pregnant`, `not_pregnant` | Determines if a female snail is gravid (on the detected crop) |

The FastAPI server runs all three in sequence: **detect → crop → classify sex → classify pregnancy** and returns the combined result.

> 📊 **Training status (round 2):** the round-1 dataset (76 photos) was scrapped. The full **724-photo batch** (`all_snail/`) is labeled (`labels_snail/` export) and organized into a fresh `dataset_detection/` (724 images, 579 train / 145 val, class `snail`, EXIF-baked + 1280px). **✅ Detector trained and verified** (100% detection rate on val, mean IoU 0.747) — `snail_detector.pt`/`.onnx` are on Google Drive. **✅ FastAPI server built** (`snail-api-server/`, Phase 4 below — the code in this guide is what it's based on). **Next: download the weights into `snail-api-server/`, deploy, set `VITE_YOLO_API_URL`, then label the same photos for sex/pregnancy (a second Label Studio pass) to train the stage-2/3 classifiers.**

---

## Phase 1: Collect Photos 📸

### Use the App to Take Photos

Open your app on your phone and take snail photos through the **Scan** screen. Even though classification is still mock, the app saves photos to Firestore.

**Best practices for snail photos:**

- **Top-down (90°) angle** — most important for accurate classification
- Plain white or light grey background
- Bright, diffused natural light (avoid harsh shadows)
- Snail should be resting, slightly exposed from shell
- Shell fills ~**60–70%** of the frame
- **Goal: 200+ photos per class** (200 male, 200 female)

> 💡 **Pro tip:** Export all photos from Firestore. You can write a quick script or manually download them from the Firebase Console > Firestore > `snails` collection.

---

## Phase 2: Label with Label Studio 🏷️

Label Studio is a free, open-source labeling tool. You can run it locally or use the cloud version.

### Option A: Run Label Studio Locally (Free)

```bash
# Install Label Studio
pip install label-studio

# Start it
label-studio start
```

Then open `http://localhost:8080` in your browser.

### Option B: Use Label Studio Cloud

Go to [labelstud.io](https://labelstud.io) and sign up for a free account.

---

### Create Two Labeling Projects

#### Project 1: Snail Sex Classification

1. Click **Create Project** → name it `Snail Sex`
2. Under **Labeling Setup**, choose **Image Classification**
3. Replace the default XML with:

```xml
<View>
  <Image name="image" value="$image"/>
  <Choices name="sex" toName="image" showInline="true" required="true">
    <Choice value="Male"/>
    <Choice value="Female"/>
  </Choices>
  <TextArea name="notes" toName="image" 
            placeholder="Optional: Morphological notes (aperture width, operculum color, tentacle shape...)"
            rows="2" maxSubmissions="1"/>
</View>
```

4. Click **Save**

#### Project 2: Snail Pregnancy Classification

1. Create another project called `Snail Pregnancy`
2. Same setup but with these choices:

```xml
<View>
  <Image name="image" value="$image"/>
  <Choices name="pregnancy" toName="image" showInline="true" required="true">
    <Choice value="Pregnant"/>
    <Choice value="Not Pregnant"/>
  </Choices>
</View>
```

---

### Import & Label

1. Go to **Import** → upload all your snail photos
2. Click **Label All Tasks**
3. For each photo, click **Male** or **Female** (and optionally add morphological notes)
4. Click **Submit** to save and move to the next image
5. Repeat for the pregnancy project (only for female snails)

> ⏱️ **Time estimate:** ~5–10 seconds per image → ~30 minutes for 200 images

### Export Labels

1. Go to **Export** → choose **JSON** format
2. Download the JSON file — it contains all image filenames with their labels

---

### Organize into YOLO Folder Structure

Create a Python script (`organize_dataset.py`) to convert the export into YOLO-compatible folders:

```python
import json, shutil, os
from glob import glob
from sklearn.model_selection import train_test_split

# ── Configuration ──────────────────────────────────────────────────
PHOTO_DIR = "path/to/your/photos"      # folder with all photos
EXPORT_JSON = "path/to/export.json"    # Label Studio JSON export
OUTPUT_DIR = "dataset_sex"             # where train/val folders go
TEST_SIZE = 0.2                         # 20% for validation

# ── Load labels ───────────────────────────────────────────────────
with open(EXPORT_JSON) as f:
    tasks = json.load(f)

# Build mapping: filename → class
labels = {}
for task in tasks:
    filename = os.path.basename(task["data"]["image"])
    sex = task["annotations"][0]["result"][0]["value"]["choices"][0]
    labels[filename] = sex.lower()  # "male" or "female"

# ── Split into train/val ──────────────────────────────────────────
files = list(labels.keys())
train_files, val_files = train_test_split(files, test_size=TEST_SIZE, random_state=42)

# ── Create folders & copy images ──────────────────────────────────
for split_name, split_files in [("train", train_files), ("val", val_files)]:
    for cls in ["male", "female"]:
        os.makedirs(f"{OUTPUT_DIR}/{split_name}/{cls}", exist_ok=True)

    for fname in split_files:
        cls = labels[fname]
        src = f"{PHOTO_DIR}/{fname}"
        dst = f"{OUTPUT_DIR}/{split_name}/{cls}/{fname}"
        if os.path.exists(src):
            shutil.copy2(src, dst)

print(f"✅ Dataset created at {OUTPUT_DIR}/")
print(f"   Train: {len(train_files)} images")
print(f"   Val:   {len(val_files)} images")
```

Run it:

```bash
pip install scikit-learn
python organize_dataset.py
```

Repeat for the pregnancy dataset (output folder: `dataset_pregnancy`).

### Snail Detector Dataset (bounding boxes)

The detector needs **bounding boxes**, not just class labels. If you labeled images in Label Studio with boxes (like the `labels_snail` export), organize them with the included script:

```bash
# Defaults: all_snail/ photos + labels_snail/ export (the round-2 724-photo set)
node scripts/organize_pregnancy_dataset.mjs

# Or point at any other photos + export:
node scripts/organize_pregnancy_dataset.mjs \
  --images path/to/photos \
  --labels <label_studio_export>/labels \
  --classes <label_studio_export>/classes.txt
```

The script matches each Label Studio box to its photo by filename (any naming works — `snail (5).JPG` ↔ `0c3ab12d-snail_5.txt`), splits 80/20 with a fixed seed, and builds **all three datasets at once**: every box becomes class 0 `snail` for detection, and images whose box class is a pregnancy label (`preg`, `not_preg`) land in `dataset_pregnancy/`, while `male`/`female` labels land in `dataset_sex/`.

```
dataset_detection/              # ← YOLO detection dataset (class 0 = snail)
├── images/train/
├── images/val/
├── labels/train/  (matching .txt boxes)
├── labels/val/
└── data.yaml                   # ultralytics config
```

### ⚠️ Fix phone-photo orientation (important! — best done BEFORE labeling)

Phone photos often store pixels in landscape with an EXIF rotation tag (the camera was held portrait). Label Studio displays them **rotated correctly**, so your boxes are relative to the rotated image — but YOLO/OpenCV reads the **raw pixels** and ignores the tag. Result: boxes point at the wrong place and the model can't learn (symptom: training runs, but the detector finds nothing).

**Best workflow — bake the rotation into a new photo batch BEFORE labeling** (so the boxes you draw in Label Studio match the training pixels exactly, and nothing needs fixing afterward):

```bash
python scripts/exif_fix_dataset.py --src-dir all_snail/raw_photos --out-dir dataset_labeling --max-size 1280
# → drag dataset_labeling/ into Label Studio and label
```

If you labeled first (old workflow), fix the organized datasets in place and verify:

```bash
python scripts/exif_fix_dataset.py --max-size 1280
python scripts/exif_fix_dataset.py --check 4   # optional: draw boxes on 4 previews to eyeball
```

Then zip: `zip -r dataset_detection.zip dataset_detection/` (≈17MB with resize).

**Your folder structure will look like:**

```
dataset_sex/
├── train/
│   ├── male/     (160+ photos)
│   ├── female/   (160+ photos)
└── val/
    ├── male/     (40+ photos)
    ├── female/   (40+ photos)

dataset_pregnancy/
├── train/
│   ├── pregnant/      (80+ photos)
│   ├── not_pregnant/  (80+ photos)
└── val/
    ├── pregnant/      (20+ photos)
    ├── not_pregnant/  (20+ photos)

dataset_detection/
├── images/train|val/           # snail photos
├── labels/train|val/           # YOLO boxes (class 0 = snail)
└── data.yaml
```

### Second Label Studio pass — sex & pregnancy (classifiers) 🐌✂️

The stage-2/3 classifiers run on the **detected snail crop** (the API crops the box before classifying), so they should be trained on **crops, not full photos**. Now that the detector dataset exists, generate one crop per labeled snail with the included script (it uses the round-2 boxes, largest box + 10% margin — same as the Colab pipeline):

```bash
python scripts/crop_snail_boxes.py
# → dataset_labeling/train/ (579 crops) + dataset_labeling/val/ (145 crops)
#   (the detector's train/val split carries over, so classifier val = detector val)
```

Then label the crops in Label Studio (image classification project — no boxes needed):

```xml
<View>
  <Image name="image" value="$image"/>
  <Choices name="sex" toName="image" showInline="true" required="false">
    <Choice value="Male"/>
    <Choice value="Female"/>
  </Choices>
  <Choices name="pregnancy" toName="image" showInline="true" required="false">
    <Choice value="Pregnant"/>
    <Choice value="Not Pregnant"/>
  </Choices>
</View>
```

Drag `dataset_labeling/` into the project, label each crop (sex for all; pregnancy optional for males), export as **JSON**, then organize with the second-pass script:

```bash
# Two exports (or one combined export with --export):
node scripts/organize_classification_dataset.mjs \
  --sex-export export_sex.json --preg-export export_preg.json
# → dataset_sex/ (train|val / male|female) + dataset_pregnancy/ (train|val / pregnant|not_pregnant)
```

The script routes each crop by its label value (Male/Female/Pregnant/Not Pregnant — any case), keeps the train/val split from the folder the crop came from, and warns if a class is missing (e.g. no `not_pregnant` photos yet).

---

## Phase 3: Train YOLO in Google Colab 🎯

### Step 1: Upload Dataset to Google Drive

1. Zip the datasets you have ready:
   ```bash
   zip -r dataset_sex.zip dataset_sex/
   zip -r dataset_pregnancy.zip dataset_pregnancy/
   zip -r dataset_detection.zip dataset_detection/
   ```
2. Upload the `.zip` files to your Google Drive
3. Open [Google Colab](https://colab.research.google.com)
4. **Recommended:** use the ready-made **`colab/train_snail_pipeline.ipynb`** — in Colab click **File → Upload notebook** and select it (cells are already split, T4 GPU pre-set). Alternatively create a **new notebook** and paste the cells from `colab/train_snail_pipeline.py` (each `# ── Cell N:` block is one cell). If you only have the `.py` on Drive, you can also run `%run train_snail_pipeline.py` in a cell.
5. Set runtime: **Runtime → Change runtime type → T4 GPU**

### Step 2: Mount Drive & Unzip

```python
from google.colab import drive
drive.mount('/content/drive')

# Unzip datasets
!unzip -q "/content/drive/MyDrive/dataset_sex.zip" -d "/content/"
!unzip -q "/content/drive/MyDrive/dataset_pregnancy.zip" -d "/content/"
!unzip -q "/content/drive/MyDrive/dataset_detection.zip" -d "/content/"
```

### Step 3: Install Ultralytics

```python
!pip install ultralytics -q
```

### Step 4: Train the Snail Detector (detection)

Trains on `dataset_detection/` — this model finds the snail's bounding box in the photo.

```python
from ultralytics import YOLO

model = YOLO("yolo11n.pt")  # nano detection model

results = model.train(
    data="/content/dataset_detection/data.yaml",
    epochs=100,
    imgsz=640,
    batch=16,               # reduce to 8 if you get CUDA OOM errors
    patience=20,
    device="cuda",
    # augmentation for small datasets
    hsv_h=0.015, hsv_s=0.4, hsv_v=0.4,
    degrees=15, translate=0.1, scale=0.5, shear=5, fliplr=0.5,
    mosaic=1.0, mixup=0.1,
    project="snail_detector",
    name="det",
    exist_ok=True,
)

# The best model is saved at:
# /content/snail_detector/det/weights/best.pt
print("✅ Detector trained!", model.names)  # expect {0: 'snail'}
```

### Step 5: Train Sex Classification Model

```python
from ultralytics import YOLO

# Load pre-trained model (transfer learning)
model = YOLO("yolo11n-cls.pt")  # nano — fastest, ~10MB
# Or use yolo11s-cls.pt for better accuracy (~20MB)

# Train
results = model.train(
    data="/content/dataset_sex",
    epochs=100,         # small dataset → train longer
    imgsz=224,          # standard classification size
    batch=32,           # reduce if you get CUDA OOM errors
    patience=15,        # stop if no improvement for 15 epochs
    device="cuda",      # use GPU
    hsv_h=0.015, hsv_s=0.7, hsv_v=0.4,   # augmentation for small datasets
    degrees=15, translate=0.1, scale=0.5, shear=5, fliplr=0.5,
    mixup=0.1, cutmix=0.1,
    project="snail_sex",
    name="sex_model",
    exist_ok=True,
)

# The best model is saved at:
# /content/snail_sex/sex_model/weights/best.pt
print("✅ Sex model trained!")
```

### Step 6: Train Pregnancy Classification Model

```python
model2 = YOLO("yolo11n-cls.pt")

results2 = model2.train(
    data="/content/dataset_pregnancy",
    epochs=100,
    imgsz=224,
    batch=32,
    patience=15,
    device="cuda",
    hsv_h=0.015, hsv_s=0.7, hsv_v=0.4,
    degrees=15, translate=0.1, scale=0.5, shear=5, fliplr=0.5,
    mixup=0.1, cutmix=0.1,
    project="snail_pregnancy",
    name="pregnancy_model",
    exist_ok=True,
)

# Saved at: /content/snail_pregnancy/pregnancy_model/weights/best.pt
print("✅ Pregnancy model trained!")
```

### Step 7: Download Trained Weights

> The recommended path is to run `colab/train_snail_pipeline.ipynb` — its `save_to_drive()` helper copies each model into **`My Drive/snail_models/`** and **verifies the file actually landed** (it raises a loud error instead of printing "saved" when the copy silently fails, e.g. Drive not mounted). Manual version below for reference:

```python
# Copy to Drive for persistence
!mkdir -p "/content/drive/MyDrive/snail_models"
!cp /content/snail_detector/det/weights/best.pt       "/content/drive/MyDrive/snail_models/snail_detector.pt"
!cp /content/snail_sex/sex_model/weights/best.pt      "/content/drive/MyDrive/snail_models/snail_sex_model.pt"
!cp /content/snail_pregnancy/pregnancy_model/weights/best.pt "/content/drive/MyDrive/snail_models/snail_pregnancy_model.pt"

# Also export to ONNX for faster inference
from ultralytics import YOLO

YOLO("/content/snail_detector/det/weights/best.pt").export(format="onnx")
YOLO("/content/snail_sex/sex_model/weights/best.pt").export(format="onnx")
YOLO("/content/snail_pregnancy/pregnancy_model/weights/best.pt").export(format="onnx")

!cp /content/snail_detector/det/weights/best.onnx        "/content/drive/MyDrive/snail_models/"
!cp /content/snail_sex/sex_model/weights/best.onnx       "/content/drive/MyDrive/snail_models/"
!cp /content/snail_pregnancy/pregnancy_model/weights/best.onnx "/content/drive/MyDrive/snail_models/"

# VERIFY each file actually landed — never trust the copy silently:
import os
for f in ["snail_detector", "snail_sex_model", "snail_pregnancy_model"]:
    for ext in ["pt", "onnx"]:
        p = f"/content/drive/MyDrive/snail_models/{f}.{ext}"
        assert os.path.exists(p) and os.path.getsize(p) > 0, f"🚨 MISSING: {p}"
        print(f"✅ {os.path.basename(p)} ({os.path.getsize(p)/1e6:.1f} MB)")

print("✅ All models saved to Google Drive -> My Drive/snail_models/")
```

> ⏱️ **Training time:** ~15 minutes per model (100 epochs on T4 GPU)

### Step 8: Test Your Model (Optional)

```python
from ultralytics import YOLO
from PIL import Image

# Load trained model
model = YOLO("/content/snail_sex/sex_model/weights/best.pt")

# Test on a validation image
results = model("/content/dataset_sex/val/male/snail_001.jpg")

# Get predictions
probs = results[0].probs
top_class = results[0].names[probs.top1]
confidence = float(probs.top1conf)

print(f"Predicted: {top_class} ({confidence:.1%} confidence)")
```

---

## Phase 4: Deploy as FastAPI API 🌐

### Create the API Server

Create a file called `api_server.py` — a **3-stage server**: detect the snail, crop it, then classify sex and pregnancy on the crop:

```python
"""
Snail Sexing AI — 3-Stage FastAPI Prediction Server

Stage 1: Detect the snail (bounding box)
Stage 2: Classify sex (male/female) on the crop
Stage 3: Classify pregnancy (pregnant/not_pregnant) on the crop

Run locally:  uvicorn api_server:app --reload --port 8000
Deploy to Railway: see railway.json
"""

import io
import os
from fastapi import FastAPI, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from PIL import Image, ImageOps
from ultralytics import YOLO

# ── Configuration ──────────────────────────────────────────────────
DETECTOR_PATH = os.getenv("DETECTOR_PATH", "snail_detector.pt")
SEX_MODEL_PATH = os.getenv("SEX_MODEL_PATH", "snail_sex_model.pt")
PREGNANCY_MODEL_PATH = os.getenv("PREGNANCY_MODEL_PATH", "snail_pregnancy_model.pt")
CONFIDENCE_THRESHOLD = 0.5     # min confidence for classification results
DETECT_CONF_THRESHOLD = 0.25   # min confidence for the detector
MIN_BOX_FRACTION = 0.05        # ignore tiny boxes (less than 5% of image size)

# ── FastAPI Setup ──────────────────────────────────────────────────
app = FastAPI(title="Snail Sexing AI API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Load Models ────────────────────────────────────────────────────
print("Loading models...")
detector = YOLO(DETECTOR_PATH)
sex_model = YOLO(SEX_MODEL_PATH)
pregnancy_model = YOLO(PREGNANCY_MODEL_PATH)
print("✅ Models loaded!")

# ── Label Mappings ─────────────────────────────────────────────────
# Note: YOLO orders classes alphabetically by folder name.
# Check after training with: print(sex_model.names)  /  print(preg_model.names)
# Adjust the mappings below based on what you see:
SEX_MAP = {0: "Female", 1: "Male"}          # <-- VERIFY THIS AFTER TRAINING
PREGNANCY_MAP = {0: "Not Pregnant", 1: "Pregnant"}  # <-- VERIFY THIS


@app.get("/health")
async def health():
    return {"status": "ok"}


@app.post("/classify")
async def classify(image: UploadFile = File(...)):
    # ── Read & validate image ───────────────────────────────────
    contents = await image.read()
    # exif_transpose: phone photos carry an EXIF rotation tag; YOLO ignores it,
    # so bake the rotation in before predicting, or the boxes/classes are wrong.
    pil_image = ImageOps.exif_transpose(Image.open(io.BytesIO(contents))).convert("RGB")

    # ── Stage 1: detect the snail ───────────────────────────────
    det_results = detector.predict(pil_image, verbose=False, conf=DETECT_CONF_THRESHOLD)
    boxes = det_results[0].boxes
    best_box = None
    if boxes is not None and len(boxes) > 0:
        candidates = []
        for box, conf in zip(boxes.xyxy.cpu().numpy(), boxes.conf.cpu().numpy()):
            w, h = box[2] - box[0], box[3] - box[1]
            if w < MIN_BOX_FRACTION * pil_image.width or h < MIN_BOX_FRACTION * pil_image.height:
                continue
            candidates.append((box, float(conf)))
        if candidates:
            # pick the LARGEST detected snail
            best_box = max(candidates, key=lambda c: (c[0][2] - c[0][0]) * (c[0][3] - c[0][1]))

    if best_box is None:
        return {
            "sex": "Unknown",
            "pregnancyStatus": "Unknown",
            "confidence": 0,
            "morphologicalNotes": "No snail detected in the image.",
        }

    box, det_conf = best_box
    crop = pil_image.crop(tuple(int(v) for v in box))  # PIL crop: (left, top, right, bottom)

    # ── Stage 2: classify sex on the crop ──────────────────────
    sex_probs = sex_model.predict(crop, verbose=False)[0].probs
    sex_class_id = sex_probs.top1
    sex_confidence = float(sex_probs.top1conf)
    sex_label = SEX_MAP.get(sex_class_id, "Unknown")

    # ── Stage 3: classify pregnancy (females only) ─────────────
    preg_label = "Not Pregnant"
    preg_confidence = 0.0
    if sex_label == "Female":
        preg_probs = pregnancy_model.predict(crop, verbose=False)[0].probs
        preg_class_id = preg_probs.top1
        preg_confidence = float(preg_probs.top1conf)
        preg_label = PREGNANCY_MAP.get(preg_class_id, "Not Pregnant")

    # ── Generate morphological notes ────────────────────────────
    notes_parts = [f"Snail detected ({det_conf:.0%} detection confidence)."]
    if sex_confidence >= CONFIDENCE_THRESHOLD:
        notes_parts.append(
            f"{sex_label} morphology identified with {sex_confidence:.1%} confidence."
        )
    else:
        notes_parts.append("Sex classification below confidence threshold.")

    if sex_label == "Female":
        if preg_confidence >= CONFIDENCE_THRESHOLD:
            notes_parts.append(
                f"Pregnancy status: {preg_label} ({preg_confidence:.1%} confidence)."
            )
        else:
            notes_parts.append("Pregnancy classification below confidence threshold.")

    # ── Combined confidence ─────────────────────────────────────
    combined_confidence = round(max(sex_confidence, det_conf) * 100, 1)

    # ── Return result matching the app's expected format ────────
    return {
        "sex": sex_label,
        "pregnancyStatus": preg_label,
        "confidence": combined_confidence,
        "morphologicalNotes": " ".join(notes_parts),
    }


# ── Run directly ───────────────────────────────────────────────────
if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", "8000"))
    uvicorn.run(app, host="0.0.0.0", port=port)
```

### Create requirements.txt

```
fastapi==0.115.0
uvicorn==0.30.0
python-multipart==0.0.12
ultralytics==8.3.0
Pillow==11.0.0
```

### Test Locally

```bash
# Install deps
pip install -r requirements.txt

# Place your three model files in the same directory
# (snail_detector.pt, snail_sex_model.pt, snail_pregnancy_model.pt)

# Run the server
uvicorn api_server:app --reload --port 8000

# Test it
curl -X POST http://localhost:8000/classify \
  -F "image=@test_snail.jpg"
```

Expected response:

```json
{
  "sex": "Male",
  "pregnancyStatus": "Not Pregnant",
  "confidence": 96.3,
  "morphologicalNotes": "Snail detected (98% detection confidence). Male morphology identified with 96.3% confidence."
}
```

### Deploy to Railway

1. Create a GitHub repo for your FastAPI server with:
   - `api_server.py`
   - `requirements.txt`
   - `railway.json` (see below)
   - Your three `.pt` model files (`snail_detector.pt`, `snail_sex_model.pt`, `snail_pregnancy_model.pt`)

2. Create `railway.json`:

```json
{
  "$schema": "https://railway.app/railway.schema.json",
  "build": {
    "builder": "NIXPACKS"
  },
  "deploy": {
    "startCommand": "uvicorn api_server:app --host 0.0.0.0 --port $PORT",
    "healthcheckPath": "/health",
    "restartPolicyType": "ON_FAILURE",
    "restartPolicyMaxRetries": 3
  }
}
```

3. Push to GitHub
4. Go to [Railway](https://railway.app) → **New Project** → **Deploy from GitHub repo**
5. Railway auto-detects the Python app and installs deps
6. Once deployed, you get a URL like `https://your-api.up.railway.app`

---

## Phase 5: Connect to Your App 🔗

### Set the API URL

The app already has the correct API interface. Just set one environment variable:

```bash
# In your .env file (for local dev)
VITE_YOLO_API_URL=https://your-api.up.railway.app

# Or in Railway dashboard → Variables
# No env var needed — the app defaults to http://localhost:3001
```

That's it! The app will:

1. ✅ Send photos to `https://your-api.up.railway.app/classify`
2. ✅ Receive the classification result
3. ✅ Display it in the UI with confidence and notes
4. ✅ Save to Firestore as before

The **mock fallback** is still there — if the API is down, it falls back automatically.

---

## Project Structure Summary

Your final folder should look like:

```
snail-sexing-ai/                  # ← Frontend (React app — you have this)
├── src/
│   ├── lib/api.ts                # ← Already configured for VITE_YOLO_API_URL
│   └── ...

snail-ai-server/                  # ← New — FastAPI server
├── api_server.py                 # 3-stage prediction server (detect → sex → pregnancy)
├── requirements.txt              # Python dependencies
├── railway.json                  # Railway deployment config
├── snail_detector.pt             # Trained detector (finds the snail box)
├── snail_sex_model.pt            # Trained sex model
├── snail_pregnancy_model.pt      # Trained pregnancy model
└── ...
```

---

## Troubleshooting

### Issue: "Detector trains but finds no snail / boxes look rotated"
This is the classic **EXIF orientation trap**: Label Studio showed your photos rotated correctly, but YOLO read the raw pixels (ignoring the EXIF tag), so the labels were rotated away from the snail. Fix:
```bash
python scripts/exif_fix_dataset.py --max-size 1280   # bakes rotation into the pixels
zip -r dataset_detection.zip dataset_detection/      # re-zip, re-upload to Drive
```
Then re-train (Cell 2). Also run the same fix on any future phone-photo batch.

### Issue: "Detector still can't find snails after the EXIF fix"
The EXIF fix aligns the labels, but **76 images is simply too few for detection** to generalize (detection needs far more data than classification). What helps most, in order:
1. **Collect more photos** — target **150–300 per class** (more snails, more angles, varied backgrounds; don't repeat the same snail/setup). This is the real fix.
2. Check the diagnostic cell (Cell 6): if `mAP50` is above ~0.3 but detection is patchy, try `conf=0.05` in production or add more epochs.
3. Try a bigger model: `yolo11s.pt` instead of `yolo11n.pt`.
4. Reduce augmentation that hurts small data: `mosaic=0.5, mixup=0.0` if overfitting.

### Issue: "YOLO class IDs don't match"
The class order depends on folder name alphabetical order. After training, check:
```python
print(sex_model.names)  # Shows {0: 'female', 1: 'male'} or similar
```
Then update `SEX_MAP` in `api_server.py` accordingly.

### Issue: "Model file too large for Git"
Use **Git LFS** or download models at runtime:
```python
import requests
MODEL_URL = os.getenv("MODEL_URL")
if not os.path.exists("model.pt"):
    r = requests.get(MODEL_URL)
    with open("model.pt", "wb") as f:
        f.write(r.content)
```

### Issue: "CUDA out of memory" in Colab
Reduce batch size: `batch=16` or `batch=8`

### Issue: "Low accuracy"
- Collect more photos (aim for 300+ per class)
- Use `yolo11s-cls.pt` instead of `yolo11n-cls.pt`
- Train for more epochs: `epochs=100`
- Use data augmentation: add `hsv_h=0.015, hsv_s=0.4, degrees=10` to `model.train()`

---

## Quick Reference

```bash
# 1. Label images
label-studio start                          # → http://localhost:8080

# 2. Organize dataset
python organize_dataset.py                       # classification splits
node scripts/organize_pregnancy_dataset.mjs      # detection boxes → dataset_detection/
python scripts/crop_snail_boxes.py               # second pass: snail crops → dataset_labeling/
node scripts/organize_classification_dataset.mjs # second pass: LS JSON export → dataset_sex/ + dataset_pregnancy/

# 3. Train in Colab
#    -> Set runtime to T4 GPU
#    -> Run colab/train_snail_pipeline.py (detector → sex → pregnancy)

# 4. Run API locally
pip install -r requirements.txt
uvicorn api_server:app --reload --port 8000

# 5. Deploy to Railway
git push                                    # Railway auto-deploys

# 6. Connect app
# Set: VITE_YOLO_API_URL=https://your-api.up.railway.app
```

---

## What the App Expects (API Contract)

Your FastAPI server's `/classify` endpoint must return JSON matching this shape:

```typescript
interface ClassificationResult {
  sex: "Male" | "Female";
  pregnancyStatus: "Pregnant" | "Not Pregnant";
  confidence: number;        // 0–100
  morphologicalNotes: string;
}
```

The `api_server.py` above already produces this exact format — no changes needed on the frontend side.

---

**You're all set! 🐌✨ Start collecting snail photos and train your own custom AI!**
