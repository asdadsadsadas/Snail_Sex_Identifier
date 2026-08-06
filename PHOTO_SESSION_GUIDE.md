# 🐌 Snail Photo Session Guide — Sexing Dataset (Filopaludina martensi)

> **Purpose:** A practical photo-taking guide for building the `dataset_sex` training dataset with a limited number of snails. Use this alongside `AI_TRAINING_GUIDE.md` (which covers labeling → training → deployment).

---

## 1. How to Verify Snail Sex (You CAN Do It Yourself)

*Filopaludina martensi* (White Wizard / trapdoor snail, family Viviparidae) has strong sexual dimorphism in its tentacles. This is the key to confident labeling — you don't have to guess:

| Feature | Male | Female |
|---|---|---|
| **Right tentacle** | **Longer, thicker, curved** — modified into a copulatory organ (penial sheath) | Slender, uniform |
| **Left tentacle** | Normal | Normal (same as right) |
| **Shell size** | Smaller | Generally **larger** (shell height, width, operculum dimensions) |

**How to check:** Look at the snail's head/tentacles (magnifying glass or zoom in on a photo). The modified right tentacle is the most reliable external feature.

> ⚠️ Do **not** label by size alone — use the tentacle test as the primary check, with size as supporting evidence.

---

## 2. How Many Photos Per Snail?

**Target: 35–40 photos per snail.**

- 15 snails × ~37 photos ≈ **550 photos total** → roughly 250–300 per class (if the split is ~even).
- Research on small datasets (YOLO fine-tuning) puts the minimum at ~50–150 images per class — this plan comfortably exceeds that.
- **More snails + more photos = better generalization.** Quality and variety matter more than raw count.

### Per-snail shot breakdown

| View | Count | What it captures |
|---|---|---|
| Top-down (90°) | 8–10 | Shell shape, coiling pattern — the primary view |
| Side profile | 6–8 | Spire height, sutures, shell convexity |
| Front (apertural) | 6–8 | Aperture shape + operculum |
| Back (abapertural) | 4–6 | Body whorl, outer shell surface |
| **Head/tentacle macro** | **6–8** | ⭐ **THE sexing feature** — both tentacles clearly visible |
| **Total** | **~35** | |

### Rules for maximum variety per snail

1. **Let it move.** Trapdoor snails clamp shut when disturbed. Once relaxed and crawling, shoot continuous bursts — movement = free variety.
2. **Vary angle** between shots (±10–15° from each view).
3. **Vary zoom** — full body shots *and* shell close-ups.
4. **Vary background** — shoot on 2–3 different surfaces (white tray, dark matte surface, clear acrylic over white).
5. **Shoot on a second day** if possible — photos from different days generalize far better than 550 in one hour.

---

## 3. Setup & Lighting

### Before the session
- **Feed 30–60 min before:** sinking algae wafers or blanched vegetables. A feeding snail fully extends its foot and head tentacles instead of clamping shut.
- **Staging tray:** shallow white dish or clear acrylic sheet over white paper, filled with **tank water** (not tap water).

### During the session
- **Acclimation:** let each snail settle **10–15 minutes** before photographing. No vibrations, gentle handling.
- **Lighting — avoid glare!** Wet shells are curved mirrors. Use **diffused window light or an LED covered with paper/tracing paper**. Never point a flash directly at the snail. Position light at ~45° or overhead.
- **Dark clothing** and turning off room lights avoids ghostly reflections in the water surface.
- **Focus:** shell fills **60–70% of the frame**; tap the screen to focus on the shell.

### File naming (critical — your label key)
Save photos as:
```
snail_01_001.jpg
snail_01_002.jpg
...
snail_15_037.jpg
```
One prefix per snail. This lets you label whole groups by snail and split train/val by snail (see below).

---

## 4. Labeling Strategy

1. **Label by snail, not by photo.** Once snail #7 is confirmed male (tentacle test), ALL ~37 of its photos are male. Per-photo guessing = noisy labels = broken model.
2. **Skip uncertain snails.** 12 confident snails beat 20 uncertain ones.
3. Move photos into the existing folder structure:

```
dataset_sex/
├── train/
│   ├── male/     snail_02_*.jpg, snail_05_*.jpg ...
│   ├── female/   snail_01_*.jpg, snail_03_*.jpg ...
└── val/
    ├── male/
    └── female/
```

---

## 5. ⚠️ Split by SNAIL, Not by Photo

Because you have few individuals, if the same snail appears in both train and val, the model **memorizes the individual snail's shell pattern** instead of learning "male vs female" — it will score high on validation yet fail on a new snail.

**Rule:** split by snail prefix. Example: 20 snails → 15 train / 5 val, keeping both sexes in each split.

> 💡 If using `organize_dataset.py` from `AI_TRAINING_GUIDE.md`, modify it to split on the `snail_XX` prefix rather than random photo files.

---

## 6. Colab Training Settings (Small-Dataset Augmentation)

Small datasets (~300 images/class) need **aggressive but realistic augmentation**:

```python
from ultralytics import YOLO
model = YOLO("yolo11n-cls.pt")  # or yolo11s-cls.pt for better accuracy

model.train(
    data="/content/dataset_sex",
    epochs=100,              # up from 50 — small data needs longer
    imgsz=224,
    batch=32,
    patience=15,
    device="cuda",
    hsv_h=0.015,             # ── color aug (lighting variety) ──
    hsv_s=0.7,
    hsv_v=0.4,
    degrees=15,              # ── geometry aug ──
    translate=0.1,
    scale=0.5,
    shear=5,
    fliplr=0.5,              # fine — model learns tentacle SHAPE, not side
    mixup=0.1,               # ── blend aug for small datasets ──
    cutmix=0.1,
    project="snail_sex",
    name="sex_model",
    exist_ok=True,
)
```

After training:
```python
print(sex_model.names)  # verify class ID order (alphabetical by folder name)
```
Then fix `SEX_MAP` in your FastAPI server accordingly (see `AI_TRAINING_GUIDE.md`).

### Expected accuracy pitfalls
- **Background memorization:** if all male photos are on one background and females on another, the model learns the background, not the snail. Vary backgrounds across both classes.
- **Overfitting illusion:** high training accuracy + poor validation = memorization. Keep a strict train/val split *by snail*.
- **Low accuracy?** More photos, more varied lighting/backgrounds, `yolo11s-cls.pt`, more epochs, and stronger `hsv` augmentation.

---

## 7. Approach Comparison (YOLO vs Alternatives)

| Option | Effort | Cost | Notes |
|---|---|---|---|
| **Gemini (already in the app!)** | Zero | Free tier | Works **today** — the deployed app already classifies via Gemini 2.0 Flash Vision. Use as your baseline while the dataset grows. |
| **YOLO-cls fine-tune (this plan)** | Medium | Free (Colab) | Best custom/offline path at this dataset size. Fast, small (~10MB), exports to ONNX. |
| **ONNX + client-side browser** | Medium | Free | Trained YOLO exports to ONNX and can run in the browser via ONNX Runtime Web / TensorFlow.js — no server, no API cost. |
| **Fine-tune Gemini** | Low | Paid tier | Few-hundred-example fine-tuning via AI Studio; fallback if YOLO underperforms. |

**Recommendation:** keep the YOLO plan, but test Gemini now for an instant baseline, then treat YOLO as the fast/offline upgrade.

---

## 📊 Round 1 — What We Learned (pregnancy dataset, 76 photos)

Feedback from the first real labeling + training round (applies to the sex dataset too):

1. **76 images was not enough.** The detector trained but couldn't reliably find snails on unseen images. For detection, plan for **150–300 photos per class**, not 50–150.
2. **Phone EXIF orientation is a silent label-killer.** 62 of 77 photos were stored rotated (EXIF orientation 6) — Label Studio displayed them correctly, but YOLO read raw pixels, so the boxes were ~90° off. **Always run `python scripts/exif_fix_dataset.py --max-size 1280` after organizing** (it also converts iPhone MPO files to plain JPEG). Verify with `--check 4`.
3. **Variety beats volume.** A detector learns "snail in a white dish" quickly; it needs *different snails, angles, zoom levels, and backgrounds* to generalize. Spread photos across as many individuals as possible.
4. **Photographing in a fixed orientation helps**: hold the phone the same way each shot, or don't worry — the EXIF fix handles it.

## ✅ Session Checklist

- [ ] Feed snails 30–60 min before session
- [ ] Setup: white tray + tank water, diffused light, dark clothing
- [ ] One snail at a time: ~35 shots (top-down, side, front, back, **tentacle macros**)
- [ ] Name files `snail_XX_YYY.jpg` per snail
- [ ] Verify sex per snail via the right-tentacle test → log in a spreadsheet
- [ ] Move photos into `dataset_sex/train|val/male|female/` (split **by snail**)
- [ ] Run `scripts/exif_fix_dataset.py` after organizing (phone photos!)
- [ ] Train in Colab with the augmentation settings above
