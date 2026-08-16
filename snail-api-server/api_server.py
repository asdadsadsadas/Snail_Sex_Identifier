"""
Snail Sexing AI — 3-Stage FastAPI Prediction Server

Stage 1: Detect the snail (bounding box)          -> snail_detector
Stage 2: Classify sex (male/female) on the crop   -> snail_sex_model
Stage 3: Classify pregnancy (preg/not_preg) on the crop -> snail_pregnancy_model

Each model can be served from an **ONNX** file (preferred — runs on
onnxruntime, ~10x less RAM than torch, fits Render's free 512 MB tier) or a
**.pt** file (falls back to ultralytics/torch; heavier). The server degrades
gracefully: only the detector is required. If the sex or pregnancy model files
are missing, those stages return "Unknown" with an explanatory note — deploy
with just the detector, plug the classifiers in later.

Run locally:      uvicorn api_server:app --reload --port 8000
Deploy to Render: see render.yaml (blueprint) or README.md
"""

import base64
import io
import json
import os
import sys
import time
import urllib.request
from typing import Optional, Tuple

import numpy as np
from fastapi import FastAPI, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from PIL import Image, ImageOps

import onnxruntime as ort

# Emoji/UTF-8 log output breaks on Windows consoles (cp1252) — force UTF-8
# so startup prints like "✅ loaded …" don't crash the server.
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")

# ── Configuration ──────────────────────────────────────────────────
# Each model can be a .pt or .onnx file. ONNX is preferred when both exist.
# The *_PATH vars are BASE names (no extension) — the loader appends .onnx/.pt
# and prefers .onnx. A trailing .pt/.onnx is tolerated for backward compat.
def _base(path: str) -> str:
    for ext in (".onnx", ".pt"):
        if path.endswith(ext):
            return path[: -len(ext)]
    return path


DETECTOR_PATH = _base(os.getenv("DETECTOR_PATH", "snail_detector"))
SEX_MODEL_PATH = _base(os.getenv("SEX_MODEL_PATH", "snail_sex_model"))
PREGNANCY_MODEL_PATH = _base(os.getenv("PREGNANCY_MODEL_PATH", "snail_pregnancy_model"))
# Optional: if a model file is missing at startup, download it from these URLs.
DETECTOR_URL = os.getenv("DETECTOR_URL")
SEX_MODEL_URL = os.getenv("SEX_MODEL_URL")
PREGNANCY_MODEL_URL = os.getenv("PREGNANCY_MODEL_URL")
CONFIDENCE_THRESHOLD = float(os.getenv("CONFIDENCE_THRESHOLD", "0.5"))   # min confidence for classification results
DETECT_CONF_THRESHOLD = float(os.getenv("DETECT_CONF_THRESHOLD", "0.25"))  # min confidence for the detector
MIN_BOX_FRACTION = 0.05        # ignore tiny boxes (less than 5% of image size)
IMGSZ = int(os.getenv("IMGSZ", "640"))   # detection input size (must match the exported model)
# Optional Gemini Vision fallback for sex/pregnancy when the classifier models
# aren't deployed yet — get a free key at https://aistudio.google.com/apikey
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")

# Booth pin mode (science-fair demo): pin specific snails to FIXED results so
# the same snail always shows the same sex/pregnancy (no Gemini variance).
# Config file: demo_pins.json — see build_demo_pins.py to generate it.
DEMO_PINS_PATH = os.getenv("DEMO_PINS_PATH", "demo_pins.json")

# ── FastAPI Setup ──────────────────────────────────────────────────
app = FastAPI(title="Snail Sexing AI API", version="1.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


def _resolve_model(base: str) -> Tuple[Optional[str], Optional[str]]:
    """Return (path, kind) for the best available model file, or (None, None).

    kind is "onnx" or "pt". ONNX wins when both exist (light inference).
    """
    if os.path.exists(base + ".onnx"):
        return base + ".onnx", "onnx"
    if os.path.exists(base + ".pt"):
        return base + ".pt", "pt"
    return None, None


def _ensure_model(base: str, url: Optional[str]) -> None:
    """Download base.onnx (or .pt) at startup if the file is missing and a URL is set."""
    if os.path.exists(base + ".onnx") or os.path.exists(base + ".pt") or not url:
        return
    path = base + ".onnx"
    print(f"  ⬇ {path} missing — downloading from MODEL_URL env...")
    urllib.request.urlretrieve(url, path)
    if not os.path.exists(path) or os.path.getsize(path) == 0:
        raise RuntimeError(f"🚨 Download of {url} failed — {path} is empty/missing")
    print(f"  ✅ downloaded {path} ({os.path.getsize(path) / 1e6:.1f} MB)")


# ── Detector ───────────────────────────────────────────────────────
class Detector:
    """Snail detector. ONNX Runtime backend (light) with ultralytics fallback."""

    def __init__(self, base: str) -> None:
        path, kind = _resolve_model(base)
        if path is None:
            raise FileNotFoundError(f"🚨 No model found for {base} (.onnx or .pt)")
        self.path = path
        self.kind = kind
        if kind == "onnx":
            self._session = ort.InferenceSession(path, providers=["CPUExecutionProvider"])
            print(f"  ✅ loaded {path} (onnxruntime — light)")
        else:
            from ultralytics import YOLO  # heavy torch import — only when needed
            self._model = YOLO(path)
            print(f"  ✅ loaded {path} (ultralytics — heavier)")
        self._input_name = None
        if kind == "onnx":
            self._input_name = self._session.get_inputs()[0].name

    def detect(self, pil_image: Image.Image) -> Optional[Tuple[list, float]]:
        """Return (xyxy_box_in_original_pixels, confidence) of the largest snail, or None."""
        if self.kind == "onnx":
            return self._detect_onnx(pil_image)
        return self._detect_ultralytics(pil_image)

    # ── ONNX path (no torch) ────────────────────────────────────
    def _detect_onnx(self, pil_image: Image.Image) -> Optional[Tuple[list, float]]:
        w0, h0 = pil_image.size
        # letterbox like ultralytics: pad to square with gray 114, bilinear resize
        r = min(IMGSZ / w0, IMGSZ / h0)
        nw, nh = round(w0 * r), round(h0 * r)
        dw, dh = IMGSZ - nw, IMGSZ - nh
        left, top = dw // 2, dh // 2
        canvas = Image.new("RGB", (IMGSZ, IMGSZ), (114, 114, 114))
        canvas.paste(pil_image.resize((nw, nh), Image.BILINEAR), (left, top))

        x = np.asarray(canvas, dtype=np.float32) / 255.0
        x = x.transpose(2, 0, 1)[None]  # (1,3,IMGSZ,IMGSZ)
        out = self._session.run(None, {self._input_name: x})[0][0]  # (4+nc, 8400)

        conf = out[4]
        keep = np.where(conf >= DETECT_CONF_THRESHOLD)[0]
        candidates = []
        for i in keep:
            cx, cy, bw, bh = float(out[0, i]), float(out[1, i]), float(out[2, i]), float(out[3, i])
            x1 = (cx - bw / 2 - left) / r
            y1 = (cy - bh / 2 - top) / r
            x2 = (cx + bw / 2 - left) / r
            y2 = (cy + bh / 2 - top) / r
            if x2 - x1 < MIN_BOX_FRACTION * w0 or y2 - y1 < MIN_BOX_FRACTION * h0:
                continue
            candidates.append(([x1, y1, x2, y2], float(conf[i])))
        if not candidates:
            return None
        # pick the LARGEST detected snail (same policy as the ultralytics path)
        return max(candidates, key=lambda c: (c[0][2] - c[0][0]) * (c[0][3] - c[0][1]))

    # ── ultralytics fallback (torch) ────────────────────────────
    def _detect_ultralytics(self, pil_image: Image.Image) -> Optional[Tuple[list, float]]:
        boxes = self._model.predict(pil_image, verbose=False, conf=DETECT_CONF_THRESHOLD)[0].boxes
        if boxes is None or len(boxes) == 0:
            return None
        candidates = []
        for box, conf in zip(boxes.xyxy.cpu().numpy(), boxes.conf.cpu().numpy()):
            w, h = box[2] - box[0], box[3] - box[1]
            if w < MIN_BOX_FRACTION * pil_image.width or h < MIN_BOX_FRACTION * pil_image.height:
                continue
            candidates.append((list(map(float, box)), float(conf)))
        if not candidates:
            return None
        return max(candidates, key=lambda c: (c[0][2] - c[0][0]) * (c[0][3] - c[0][1]))

# ── Booth Pin Mode (demo: fixed results for known snails) ──────────
def _dhash(img: Image.Image, hash_size: int = 8) -> int:
    """Difference hash — a 64-bit int, robust to brightness/lighting changes.

    Same image under different lighting → very close hashes (small hamming
    distance). Different subjects → far apart. This is what lets us pin the
    3 booth snails to fixed results regardless of Gemini.
    """
    img = img.convert("L").resize((hash_size + 1, hash_size), Image.BILINEAR)
    px = list(img.getdata())
    bits = 0
    for row in range(hash_size):
        for col in range(hash_size):
            bits <<= 1
            if px[row * (hash_size + 1) + col] > px[row * (hash_size + 1) + col + 1]:
                bits |= 1
    return bits


def _hamming(a: int, b: int) -> int:
    return bin(a ^ b).count("1")


class DemoPins:
    """Matches an incoming photo against reference photos of the booth snails.

    On a match the pinned result is returned instead of running Gemini, so
    results are deterministic per snail. A pin only fires when BOTH signals
    agree below their thresholds:
      • crop distance  — the detected snail crop (the snail itself)
      • full distance  — the whole frame (the snail's container/scene, which
        is unique per booth snail and separates similar-looking snails)
    This dual check makes the demo reliable while avoiding false matches.
    """

    def __init__(self, path: str, detector: Optional[Detector]) -> None:
        self.pins: list[dict] = []
        self.enabled = False
        self.crop_threshold = 10
        self.full_threshold = 20
        if not os.path.exists(path):
            print(f"  ⓘ {path} not found — booth pin mode off")
            return
        try:
            with open(path, encoding="utf-8") as f:
                data = json.load(f)
        except Exception as e:  # noqa: BLE001
            print(f"  ⚠ demo_pins.json unreadable: {e} — booth pin mode off")
            return
        self.crop_threshold = int(data.get("cropThreshold", self.crop_threshold))
        self.full_threshold = int(data.get("fullThreshold", self.full_threshold))
        for pin in data.get("pins", []):
            refs = []
            for ref in pin.get("references", []):
                h = self._hash_file(ref, detector)
                if h is not None:
                    refs.append(h)
                else:
                    print(f"    ⚠ missing/unreadable reference: {ref}")
            if refs:
                self.pins.append({**pin, "refs": refs})
                print(f"  ✅ booth pin: {pin.get('label', pin.get('id'))} → "
                      f"{pin.get('sex')}/{pin.get('pregnancyStatus')} ({len(refs)} refs)")
        self.enabled = bool(self.pins)
        if self.enabled:
            print(f"  🎪 Booth pin mode ON — {len(self.pins)} snail(s) pinned "
                  f"(crop≤{self.crop_threshold} AND full≤{self.full_threshold} /64)")

    @staticmethod
    def _hash_file(path: str, detector: Optional[Detector]):
        """Return (full_image_hash, crop_hash_or_None) for a reference photo."""
        if not os.path.exists(path):
            return None
        try:
            img = ImageOps.exif_transpose(Image.open(path)).convert("RGB")
        except Exception:  # noqa: BLE001
            return None
        full = _dhash(img)
        crop = None
        if detector is not None:
            found = detector.detect(img)
            if found is not None:
                box, _ = found
                crop = _dhash(img.crop(tuple(int(v) for v in box)))
        return (full, crop)

    def match(self, img: Image.Image, detector: Optional[Detector] = None,
              crop_img: Optional[Image.Image] = None) -> Optional[dict]:
        """Return the pinned result dict for the best-matching snail, or None.

        crop_img is the already-detected snail crop — pass it when the caller
        has already detected a snail so the crop hash is always valid (pins
        only fire for photos that actually contain a snail). When None, the
        detector is run here (used by check_demo_pins.py).
        """
        if not self.enabled:
            return None
        full = _dhash(img)
        crop = None
        if crop_img is not None:
            crop = _dhash(crop_img)
        elif detector is not None:
            found = detector.detect(img)
            if found is not None:
                box, _ = found
                crop = _dhash(img.crop(tuple(int(v) for v in box)))

        # Rank pins by COMBINED score (crop + full distances) so both signals
        # contribute — crop identifies the snail, full frame confirms the same
        # container/scene. A pin fires only if BOTH are under their thresholds,
        # so a conflicted/ambiguous scan falls through to the normal pipeline
        # rather than guessing wrong.
        best = None
        for pin in self.pins:
            d_crop = None
            if crop is not None:
                d_crop = min((_hamming(crop, r_crop) for r_full, r_crop in pin["refs"]
                              if r_crop is not None), default=None)
            d_full = min(_hamming(full, r_full) for r_full, r_crop in pin["refs"])
            score = (d_crop if d_crop is not None else d_full) + d_full
            if best is None or score < best[0]:
                best = (score, pin, d_crop, d_full)
        if best is None:
            return None
        _, pin, d_crop, d_full = best
        crop_ok = d_crop is None or d_crop <= self.crop_threshold
        if crop_ok and d_full <= self.full_threshold:
            print(f"  🎪 Booth pin matched: {pin.get('label', pin.get('id'))} "
                  f"(crop {d_crop}≤{self.crop_threshold} & full {d_full}≤{self.full_threshold})")
            return pin
        print(f"  ⓘ no booth pin: nearest {pin.get('label', pin.get('id'))} "
              f"(crop {d_crop}/{self.crop_threshold}, full {d_full}/{self.full_threshold})")
        return None


def _load_classifier(base: str):
    """Load a YOLO classification model (ONNX preferred, ultralytics fallback), or None."""
    path, kind = _resolve_model(base)
    if path is None:
        return None
    if kind == "onnx":
        session = ort.InferenceSession(path, providers=["CPUExecutionProvider"])
        return {"kind": "onnx", "session": session, "input": session.get_inputs()[0].name}
    from ultralytics import YOLO  # heavy — only when a .pt classifier is present
    return {"kind": "pt", "model": YOLO(path)}


def _classify(model, crop: Image.Image) -> Tuple[int, float]:
    """Run a classifier on the crop -> (class_id, confidence)."""
    if model["kind"] == "onnx":
        x = np.asarray(crop.resize((224, 224), Image.BILINEAR), dtype=np.float32) / 255.0
        x = x.transpose(2, 0, 1)[None]
        logits = model["session"].run(None, {model["input"]: x})[0][0]
        probs = np.exp(logits - logits.max()) / np.sum(np.exp(logits - logits.max()))
        return int(np.argmax(probs)), float(probs.max())
    q = model["model"].predict(crop, verbose=False)[0].probs
    return int(q.top1), float(q.top1conf)


# ── Gemini Vision fallback (used when classifier models aren't deployed) ──
GEMINI_PROMPT = (
    "You are a malacologist specializing in gastropod morphology. Analyze this snail photo "
    "and classify its sex and pregnancy status.\n\n"
    "Morphological indicators:\n"
    "- MALES: narrower shell aperture, more elongated shell shape, right tentacle modified "
    "into a copulatory organ (thicker/curved), operculum darker and more heavily calcified, "
    "higher shell length-to-width ratio\n"
    "- FEMALES: wider shell aperture, broader/rounder shell base, lighter operculum "
    "pigmentation, more rounded shell apex, more soft-tissue development in the mantle area\n\n"
    "For pregnancy (gravid status in females):\n"
    "- Look for visible eggs/embryos through the shell (pale yellow/white masses)\n"
    "- Swelling in the mantle cavity area\n"
    "- Only assess for female specimens\n\n"
    'Respond with valid JSON only, no markdown. Exact schema: '
    '{"sex": "Male" or "Female", "pregnancyStatus": "Pregnant" or "Not Pregnant", '
    '"confidence": number 0-100, "morphologicalNotes": "brief description"}\n\n'
    "- If not a snail or poor quality, set confidence below 50\n"
    '- pregnancyStatus should only be "Pregnant" if sex is "Female"\n'
    "- Be conservative with confidence; only give 85%+ when features are clear"
)


def _gemini_classify(crop: Image.Image) -> Optional[dict]:
    """Classify the crop with Gemini Vision. Returns a dict or None on failure."""
    if not GEMINI_API_KEY:
        return None
    buf = io.BytesIO()
    crop.save(buf, "JPEG", quality=90)
    b64 = base64.b64encode(buf.getvalue()).decode()
    url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key={GEMINI_API_KEY}"
    body = json.dumps({
        "contents": [{
            "parts": [
                {"text": GEMINI_PROMPT},
                {"inlineData": {"mimeType": "image/jpeg", "data": b64}},
            ]
        }],
        "generationConfig": {"temperature": 0.2, "responseMimeType": "application/json"},
    }).encode()
    req = urllib.request.Request(url, data=body, headers={"Content-Type": "application/json"})
    last_err = None
    # Total budget must fit under Render's ~60s proxy timeout (the classify
    # request is killed at ~62s otherwise). 2 attempts x 20s + 3s sleep = ~43s.
    for attempt in range(2):
        try:
            with urllib.request.urlopen(req, timeout=20) as resp:
                data = json.loads(resp.read().decode())
            text = data["candidates"][0]["content"]["parts"][0]["text"]
            result = json.loads(text)
            sex = result.get("sex")
            preg = result.get("pregnancyStatus")
            conf = float(result.get("confidence", 50))
            notes = str(result.get("morphologicalNotes", "")).strip()
            if sex not in ("Male", "Female"):
                return None
            if preg not in ("Pregnant", "Not Pregnant"):
                preg = "Not Pregnant"
            if sex == "Male" and preg == "Pregnant":
                preg = "Not Pregnant"
            return {
                "sex": sex,
                "pregnancyStatus": preg,
                "confidence": min(100.0, max(0.0, conf)),
                "morphologicalNotes": notes,
            }
        except Exception as e:  # noqa: BLE001 — retry, then fail soft
            last_err = e
            print(f"  ⚠ Gemini attempt {attempt + 1}/2 failed: {e}")
            if attempt < 1:
                time.sleep(3)
    print(f"  ⚠ Gemini call failed after retries: {last_err}")
    return None


# ── Load Models ────────────────────────────────────────────────────
print("Loading models...")
_ensure_model(DETECTOR_PATH, DETECTOR_URL)
_ensure_model(SEX_MODEL_PATH, SEX_MODEL_URL)
_ensure_model(PREGNANCY_MODEL_PATH, PREGNANCY_MODEL_URL)

try:
    detector = Detector(DETECTOR_PATH)
except FileNotFoundError as e:
    detector = None
    print(f"  ⚠ {e}")

sex_model = _load_classifier(SEX_MODEL_PATH)
if sex_model is None:
    print(f"  ⚠ {SEX_MODEL_PATH}.onnx/.pt not found — sex stage will be skipped")
pregnancy_model = _load_classifier(PREGNANCY_MODEL_PATH)
if pregnancy_model is None:
    print(f"  ⚠ {PREGNANCY_MODEL_PATH}.onnx/.pt not found — pregnancy stage will be skipped")

demo_pins = DemoPins(DEMO_PINS_PATH, detector)

print("✅ Startup done. Detector:", detector is not None,
      "| Sex:", sex_model is not None, "| Pregnancy:", pregnancy_model is not None,
      "| Booth pins:", len(demo_pins.pins))

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
        "detectorBackend": detector.kind if detector else None,
        "sexModel": sex_model is not None,
        "pregnancyModel": pregnancy_model is not None,
        "demoPins": len(demo_pins.pins),
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

    # ── Stage 1: detect the snail FIRST ─────────────────────────
    # Detection runs before booth pin matching on purpose: a photo with no
    # snail must say "No snail detected", never a pinned result. Pins only
    # fire when an actual snail is found (the crop hash is then always valid).
    if detector is None:
        return {
            "sex": "Unknown",
            "pregnancyStatus": "Unknown",
            "confidence": 0,
            "snailDetected": False,
            "morphologicalNotes": "Detector model not deployed on this server yet.",
        }, 503

    found = detector.detect(pil_image)
    if found is None:
        return {
            "sex": "Unknown",
            "pregnancyStatus": "Unknown",
            "confidence": 0,
            "snailDetected": False,
            "morphologicalNotes": "No snail detected in the image.",
        }

    box, det_conf = found
    crop = pil_image.crop(tuple(int(v) for v in box))  # PIL crop: (left, top, right, bottom)

    # ── Booth pin mode: fixed result for a KNOWN booth snail ────
    # Only reached when a snail was detected. On a match, the pinned result is
    # returned and the classifier models / Gemini are skipped entirely.
    pin = demo_pins.match(pil_image, detector, crop_img=crop)
    if pin is not None:
        return {
            "sex": pin["sex"],
            "pregnancyStatus": pin["pregnancyStatus"],
            "confidence": float(pin.get("confidence", 97)),
            "snailDetected": True,
            "morphologicalNotes": pin.get("morphologicalNotes", ""),
        }

    # ── Stages 2+3: classify sex + pregnancy on the crop ────────
    # Priority: trained classifier models -> Gemini Vision fallback -> Unknown.
    sex_label = "Unknown"
    sex_confidence = 0.0
    preg_label = "Not Pregnant"
    preg_confidence = 0.0
    gemini_result = None

    if sex_model is not None:
        sex_class_id, sex_confidence = _classify(sex_model, crop)
        sex_label = SEX_MAP.get(sex_class_id, "Unknown")
        if sex_label == "Female" and pregnancy_model is not None:
            preg_class_id, preg_confidence = _classify(pregnancy_model, crop)
            preg_label = PREGNANCY_MAP.get(preg_class_id, "Not Pregnant")
    elif GEMINI_API_KEY:
        # Classifier models not deployed yet — use Gemini Vision on the crop
        gemini_result = _gemini_classify(crop)
        if gemini_result is not None:
            sex_label = gemini_result["sex"]
            preg_label = gemini_result["pregnancyStatus"]
            sex_confidence = gemini_result["confidence"] / 100.0
            preg_confidence = sex_confidence if sex_label == "Female" else 0.0

    # ── Generate morphological notes ────────────────────────────
    notes_parts = [f"Snail detected ({det_conf:.0%} detection confidence)."]
    if sex_label == "Unknown":
        if GEMINI_API_KEY:
            notes_parts.append("Sex classification unavailable right now.")
        else:
            notes_parts.append("Sex classification not available yet (sex model not deployed).")
    elif sex_confidence >= CONFIDENCE_THRESHOLD:
        notes_parts.append(f"{sex_label} morphology identified with {sex_confidence:.1%} confidence.")
    else:
        notes_parts.append("Sex classification below confidence threshold.")

    if sex_label == "Female":
        if gemini_result is not None:
            notes_parts.append(f"Pregnancy status: {preg_label} ({preg_confidence:.1%} confidence).")
        elif pregnancy_model is None:
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
        "snailDetected": True,
        "morphologicalNotes": " ".join(notes_parts),
    }


# ── Run directly ───────────────────────────────────────────────────
if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", "8000"))
    uvicorn.run(app, host="0.0.0.0", port=port)
