"""
Verify BOOTH PIN MODE matching BEFORE the fair.

Loads demo_pins.json + the detector, then tests photos against every
pinned snail and reports the nearest match + hamming distance.

Usage:
    python check_demo_pins.py <photo1> [photo2 ...]

Each photo should print:
    MATCH ✅ <pin-id> (crop X<=10 & full Y<=20) → will show pinned result
    NO MATCH ❌ (nearest: <pin-id>)              → would fall through to Gemini

If a booth snail's own photo shows NO MATCH, add more reference photos
of it (same spot/lighting) and rebuild:  python build_demo_pins.py
"""

import os
import sys

from PIL import Image, ImageOps

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)

from api_server import DEMO_PINS_PATH, Detector, DemoPins, _dhash, _hamming  # noqa: E402


def main() -> int:
    if len(sys.argv) < 2:
        print(__doc__)
        return 1

    detector = Detector("snail_detector")
    pins = DemoPins(DEMO_PINS_PATH, detector)
    if not pins.enabled:
        print("❌ No pins loaded — run build_demo_pins.py first.")
        return 1

    print(f"Pins loaded: {len(pins.pins)} | crop≤{pins.crop_threshold} & full≤{pins.full_threshold}/64\n")
    all_ok = True
    for path in sys.argv[1:]:
        if not os.path.exists(path):
            print(f"⚠  missing: {path}")
            all_ok = False
            continue
        img = ImageOps.exif_transpose(Image.open(path)).convert("RGB")
        # replicate match() scoring against every pin
        full = _dhash(img)
        crop = None
        found = detector.detect(img)
        if found is not None:
            box, _ = found
            crop = _dhash(img.crop(tuple(int(v) for v in box)))

        best = None
        for pin in pins.pins:
            d_crop = None
            if crop is not None:
                d_crop = min((_hamming(crop, r_crop) for r_full, r_crop in pin["refs"]
                              if r_crop is not None), default=None)
            d_full = min(_hamming(full, r_full) for r_full, r_crop in pin["refs"])
            score = (d_crop if d_crop is not None else d_full) + d_full
            if best is None or score < best[0]:
                best = (score, pin, d_crop, d_full)

        score, pin, d_crop, d_full = best
        name = os.path.basename(path)
        label = pin.get("label", pin.get("id"))
        crop_ok = d_crop is None or d_crop <= pins.crop_threshold
        matched = crop_ok and d_full <= pins.full_threshold
        if matched:
            print(f"MATCH ✅ {name} → {label} ({pin['sex']}/{pin['pregnancyStatus']}) "
                  f"crop {d_crop}≤{pins.crop_threshold} & full {d_full}≤{pins.full_threshold}")
        else:
            print(f"NO MATCH ❌ {name} → nearest {label}, "
                  f"crop {d_crop}/{pins.crop_threshold}, full {d_full}/{pins.full_threshold}")
            print("            (would fall back to Gemini — add reference photos of this snail)")
            all_ok = False

    print("\n" + ("🎪 All pins match reliably — good to go!" if all_ok else
                  "⚠  Some photos don't match — add references + rebuild before the fair."))
    return 0 if all_ok else 1


if __name__ == "__main__":
    sys.exit(main())
