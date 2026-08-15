"""
Snail Sexing AI — 3-Stage FastAPI Prediction Server

Stage 1: Detect the snail (bounding box)          -> snail_detector.pt
Stage 2: Classify sex (male/female) on the crop   -> snail_sex_model.pt
Stage 3: Classify pregnancy (preg/not_preg) on the crop -> snail_pregnancy_model.pt

The server degrades gracefully: only the detector is required. If the sex or
pregnancy model files are missing, that stage returns "Unknown" with an
explanatory note instead of crashing — so you can deploy as soon as the
detector is trained and plug the classifiers in later.

Run locally:      uvicorn api_server:app --reload --port 8000
Deploy to Railway: see railway.json
"""

import io
import os
import urllib.request
from typing import Optional

from fastapi import FastAPI, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from PIL import Image, ImageOps
from ultralytics import YOLO

# ── Configuration ──────────────────────────────────────────────────
# Each model can be a .pt or .onnx file (ultralytics loads both).
DETECTOR_PATH = os.getenv("DETECTOR_PATH", "snail_detector.pt")
SEX_MODEL_PATH = os.getenv("SEX_MODEL_PATH", "snail_sex_model.pt")
PREGNANCY_MODEL_PATH = os.getenv("PREGNANCY_MODEL_PATH", "snail_pregnancy_model.pt")
# Optional: if a model file is missing at startup, download it from these URLs.
# (Useful on hosts where you can't commit weights — e.g. a direct file URL.)
DETECTOR_URL = os.getenv("DETECTOR_URL")
SEX_MODEL_URL = os.getenv("SEX_MODEL_URL")
PREGNANCY_MODEL_URL = os.getenv("PREGNANCY_MODEL_URL")
CONFIDENCE_THRESHOLD = float(os.getenv("CONFIDENCE_THRESHOLD", "0.5"))   # min confidence for classification results
DETECT_CONF_THRESHOLD = float(os.getenv("DETECT_CONF_THRESHOLD", "0.25"))  # min confidence for the detector
MIN_BOX_FRACTION = 0.05        # ignore tiny boxes (less than 5% of image size)

# ── FastAPI Setup ──────────────────────────────────────────────────
app = FastAPI(title="Snail Sexing AI API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


def _load(path: str) -> Optional[YOLO]:
    """Load a YOLO model if the file exists, else None (stage skipped)."""
    if not os.path.exists(path):
        print(f"  ⚠ {path} not found — this stage will be skipped")
        return None
    print(f"  ✅ loaded {path}")
    return YOLO(path)


def _ensure_model(path: str, url: Optional[str]) -> None:
    """Download a model at startup if the file is missing and a URL is set."""
    if os.path.exists(path) or not url:
        return
    print(f"  ⬇ {path} missing — downloading from MODEL_URL env...")
    urllib.request.urlretrieve(url, path)
    if not os.path.exists(path) or os.path.getsize(path) == 0:
        raise RuntimeError(f"🚨 Download of {url} failed — {path} is empty/missing")
    print(f"  ✅ downloaded {path} ({os.path.getsize(path) / 1e6:.1f} MB)")


# ── Load Models ────────────────────────────────────────────────────
print("Loading models...")
_ensure_model(DETECTOR_PATH, DETECTOR_URL)
_ensure_model(SEX_MODEL_PATH, SEX_MODEL_URL)
_ensure_model(PREGNANCY_MODEL_PATH, PREGNANCY_MODEL_URL)
detector = _load(DETECTOR_PATH)
sex_model = _load(SEX_MODEL_PATH)
pregnancy_model = _load(PREGNANCY_MODEL_PATH)
print("✅ Startup done. Detector:", detector is not None,
      "| Sex:", sex_model is not None, "| Pregnancy:", pregnancy_model is not None)

if detector is None:
    print("🚨 No detector model found — /classify will return 503 until "
          f"DETECTOR_PATH ({DETECTOR_PATH}) exists.")

# ── Label Mappings ─────────────────────────────────────────────────
# Note: YOLO orders classes alphabetically by folder name.
# Check after training with: print(sex_model.names)  /  print(preg_model.names)
# Adjust the mappings below based on what you see:
SEX_MAP = {0: "Female", 1: "Male"}            # <-- VERIFY THIS AFTER TRAINING
PREGNANCY_MAP = {0: "Not Pregnant", 1: "Pregnant"}  # <-- VERIFY THIS


@app.get("/health")
async def health():
    return {
        "status": "ok",
        "detector": detector is not None,
        "sexModel": sex_model is not None,
        "pregnancyModel": pregnancy_model is not None,
    }


@app.post("/classify")
async def classify(image: UploadFile = File(...)):
    # ── Read & validate image ───────────────────────────────────
    contents = await image.read()
    if not contents:
        return {"error": "Empty image upload"}, 400

    # exif_transpose: phone photos carry an EXIF rotation tag; YOLO ignores it,
    # so bake the rotation in before predicting, or the boxes/classes are wrong.
    pil_image = ImageOps.exif_transpose(Image.open(io.BytesIO(contents))).convert("RGB")

    # ── Stage 1: detect the snail ───────────────────────────────
    if detector is None:
        return {
            "sex": "Unknown",
            "pregnancyStatus": "Unknown",
            "confidence": 0,
            "morphologicalNotes": "Detector model not deployed on this server yet.",
        }, 503

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
    sex_label = "Unknown"
    sex_confidence = 0.0
    if sex_model is not None:
        sex_probs = sex_model.predict(crop, verbose=False)[0].probs
        sex_class_id = sex_probs.top1
        sex_confidence = float(sex_probs.top1conf)
        sex_label = SEX_MAP.get(sex_class_id, "Unknown")

    # ── Stage 3: classify pregnancy (females only) ─────────────
    preg_label = "Not Pregnant"
    preg_confidence = 0.0
    if sex_label == "Female" and pregnancy_model is not None:
        preg_probs = pregnancy_model.predict(crop, verbose=False)[0].probs
        preg_class_id = preg_probs.top1
        preg_confidence = float(preg_probs.top1conf)
        preg_label = PREGNANCY_MAP.get(preg_class_id, "Not Pregnant")

    # ── Generate morphological notes ────────────────────────────
    notes_parts = [f"Snail detected ({det_conf:.0%} detection confidence)."]
    if sex_label == "Unknown":
        notes_parts.append("Sex classification not available yet (sex model not deployed).")
    elif sex_confidence >= CONFIDENCE_THRESHOLD:
        notes_parts.append(f"{sex_label} morphology identified with {sex_confidence:.1%} confidence.")
    else:
        notes_parts.append("Sex classification below confidence threshold.")

    if sex_label == "Female":
        if pregnancy_model is None:
            notes_parts.append("Pregnancy classification not available yet (pregnancy model not deployed).")
        elif preg_confidence >= CONFIDENCE_THRESHOLD:
            notes_parts.append(f"Pregnancy status: {preg_label} ({preg_confidence:.1%} confidence).")
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
