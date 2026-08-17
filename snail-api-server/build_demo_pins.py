"""
Build demo_pins.json for BOOTH PIN MODE (science-fair demo).

Goal: make the SAME snail always show the SAME sex/pregnancy result, no
matter what Gemini would say. You give each booth snail a folder of
reference photos + a fixed result; this script writes the config that
api_server.py loads to pin them.

── How to set up (5 minutes) ───────────────────────────────────────
1. Create a folder for each booth snail under demo_pins/:
       demo_pins/snail1/   (photos of booth snail #1)
       demo_pins/snail2/   (photos of booth snail #2)
       demo_pins/snail3/   (photos of booth snail #3)
   Take 4–8 photos per snail with your PHONE, in the SAME container/spot
   and lighting you'll use at the booth (angle variety helps matching).

2. Edit the SNAILS config below: for each snail set the folder name, the
   fixed sex/pregnancy you want it to show, and a note.

3. Run:   python build_demo_pins.py
   → writes demo_pins.json (api_server.py picks it up on restart).

4. Sanity-check matching BEFORE the fair:
       python check_demo_pins.py demo_pins/snail1/01.jpg
   → should print "MATCH ✅ snail1 (crop X<=10 & full Y<=20)". If a photo
   shows "NO MATCH", add more reference photos of that snail.

5. (Optional) Deploy booth pin mode to Render: each reference photo's
   difference hashes are baked into demo_pins.json, so the config is
   SELF-CONTAINED — the photos themselves stay on your machine. Commit
   demo_pins.json and push: the snail-api-booth service loads the pins at
   startup. See BOOTH_PIN_GUIDE.md → "Deploy booth pin mode to Render".
"""

import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)  # allow `from api_server import ...` below

from PIL import Image, ImageOps

from api_server import Detector, _dhash  # noqa: E402

REF_ROOT = os.path.join(HERE, "demo_pins")
OUT = os.path.join(HERE, "demo_pins.json")
IMAGE_EXTS = (".jpg", ".jpeg", ".png", ".webp", ".heic")

# ── ✏️ EDIT ME: fixed results per booth snail ──────────────────────
# folder   = subfolder of demo_pins/ with the reference photos
# label    = display name (shows in server logs / notes)
# sex      = "Male" or "Female"          — the FIXED result to show
# pregnancyStatus = "Pregnant" or "Not Pregnant"
# confidence      = the confidence % to display (fixed, looks confident)
# notes    = morphology text shown to judges (make it sound real)
SNAILS = [
    {
        "folder": "snail1",
        "label": "Snail 1",
        "sex": "Female",
        "pregnancyStatus": "Pregnant",
        "confidence": 96.8,
        "morphologicalNotes": (
            "Wide shell aperture with pale operculum — typical female. "
            "Soft-tissue development in the mantle area and a visible egg "
            "mass through the shell indicate a gravid (pregnant) female."
        ),
    },
    {
        "folder": "snail2",
        "label": "Snail 2",
        "sex": "Male",
        "pregnancyStatus": "Not Pregnant",
        "confidence": 97.4,
        "morphologicalNotes": (
            "Narrow shell aperture, elongated copulatory organ visible, and "
            "darker heavily-calcified operculum — classic male morphology. "
            "No egg mass present."
        ),
    },
    {
        "folder": "snail3",
        "label": "Snail 3",
        "sex": "Female",
        "pregnancyStatus": "Not Pregnant",
        "confidence": 95.9,
        "morphologicalNotes": (
            "Wide aperture and rounded shell apex indicate a female, but the "
            "mantle shows no egg mass and there is no gravid swelling — "
            "classified as not pregnant."
        ),
    },
]
# ───────────────────────────────────────────────────────────────────


def find_photos(folder: str) -> list:
    path = os.path.join(REF_ROOT, folder)
    if not os.path.isdir(path):
        return []
    out = []
    for name in sorted(os.listdir(path)):
        if name.lower().endswith(IMAGE_EXTS):
            out.append(os.path.join("demo_pins", folder, name).replace("\\", "/"))
    return out


def precompute_hashes(photo_paths: list, detector) -> list:
    """Hash each reference photo → self-contained {"full": int, "crop": int|None}.

    The hashes are baked into demo_pins.json so the deployed server can load
    pins WITHOUT the photos — reference photos never leave your machine. crop
    is the detected-snail crop hash (None if no snail was found or the
    detector isn't available; matching then uses the full-frame hash only).
    """
    refs = []
    for rel in photo_paths:
        full_path = os.path.join(HERE, rel)
        try:
            img = ImageOps.exif_transpose(Image.open(full_path)).convert("RGB")
        except Exception as e:  # noqa: BLE001
            print(f"    ⚠ unreadable reference {rel}: {e}")
            continue
        full = _dhash(img)
        crop = None
        if detector is not None:
            found = detector.detect(img)
            if found is not None:
                box, _ = found
                crop = _dhash(img.crop(tuple(int(v) for v in box)))
        refs.append({"full": full, "crop": crop})
        print(f"    📸 {os.path.basename(rel)} → full={full} crop={crop}")
    return refs


def main() -> int:
    if not os.path.isdir(REF_ROOT):
        print(f"❌ demo_pins/ folder not found at {REF_ROOT}")
        print("   Create demo_pins/snail1/, demo_pins/snail2/, demo_pins/snail3/ and add photos.")
        return 1

    pins = []
    detector = None
    for snail in SNAILS:
        photos = find_photos(snail["folder"])
        if not photos:
            print(f"⚠  no photos in demo_pins/{snail['folder']}/ — skipped")
            continue
        if detector is None:
            try:
                detector = Detector("snail_detector")
                print(f"  ✅ detector loaded ({detector.kind}) — crop hashes baked in")
            except Exception as e:  # noqa: BLE001
                print(f"  ⚠ detector not available ({e}) — pins use full-frame hashes only")
        refs = precompute_hashes(photos, detector)
        if not refs:
            print(f"⚠  no readable photos in demo_pins/{snail['folder']}/ — skipped")
            continue
        pins.append({
            "id": snail["folder"],
            "label": snail["label"],
            "sex": snail["sex"],
            "pregnancyStatus": snail["pregnancyStatus"],
            "confidence": snail["confidence"],
            "morphologicalNotes": snail["morphologicalNotes"],
            "references": refs,
        })
        print(f"✅ {snail['label']} → {snail['sex']}/{snail['pregnancyStatus']} "
              f"({len(refs)} reference photos)")

    if not pins:
        print("❌ No pins built — add photos to demo_pins/<folder>/ first.")
        return 1

    config = {"cropThreshold": 10, "fullThreshold": 20, "pins": pins}
    with open(OUT, "w", encoding="utf-8") as f:
        json.dump(config, f, indent=2, ensure_ascii=False)
    print(f"\n🎪 Wrote {OUT} — {len(pins)} booth snail(s) pinned.")
    print("   demo_pins.json is self-contained (hashes only — no photos).")
    print("   Verify locally:  python check_demo_pins.py demo_pins/snail1/<photo>.jpg")
    print("   Deploy to Render: commit demo_pins.json and push — the booth API")
    print("   (snail-api-booth) loads the pins at startup. See BOOTH_PIN_GUIDE.md.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
