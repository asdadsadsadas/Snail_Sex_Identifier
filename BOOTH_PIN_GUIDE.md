# 🎪 Booth Pin Mode — Science-Fair Demo Guide

**Goal:** make the SAME snail always show the SAME sex/pregnancy result at your
booth — no matter how many times it's scanned.

By default, Gemini gives a slightly different answer on every scan, so the same
snail could flip between "Female" and "Male" mid-demo. **Booth pin mode** fixes
that: you pin each of your display snails to a fixed result, and the server
matches every scan against reference photos of them. On a match it returns the
pinned result in ~0.05s — **Gemini is bypassed entirely** — so results are 100%
consistent, and judges just see the app identify each snail automatically.

---

## How it works (in one paragraph)

Every scan is processed in a fixed order: **1) detect the snail → 2) booth pin
match → 3) normal AI pipeline**. If the detector finds **no snail** in the
photo, the app says **"No Snail Detected"** — a pinned result is never shown
for an empty photo. If a snail IS found, the scan is compared to your reference
photos using a **difference hash** (robust to lighting/brightness changes) on
**both** the detected snail crop *and* the full frame. A pin only fires when
both are under their thresholds (defaults crop≤10, full≤20 out of 64) — the
crop identifies the snail, the full frame confirms the same container/scene,
which stops similar-looking snails from getting confused. On a match, the
pinned sex/pregnancy is returned directly. Anything that isn't one of your
pinned snails still falls through to the normal pipeline safely.

---

## Setup (do this the night before — ~15 minutes)

### Step 1: Take reference photos of your 3 snails

With your **phone**, photograph each snail **in its booth container, in its
booth spot, under booth lighting**. The closer the reference photos are to how
you'll demo, the more bulletproof the matching. Take **4–8 photos per snail**
(a few angles, but mostly the same top-down view you'll scan).

### Step 2: Drop the photos into folders

```bash
cd snail-api-server
mkdir -p demo_pins/snail1 demo_pins/snail2 demo_pins/snail3
```

Copy each snail's photos into its folder (any filename works):

| Folder | Snail shows |
|---|---|
| `demo_pins/snail1/` | **Female / Pregnant** |
| `demo_pins/snail2/` | **Male / Not Pregnant** |
| `demo_pins/snail3/` | **Female / Not Pregnant** |

### Step 3: Set the fixed results + generate the config

Open `snail-api-server/build_demo_pins.py` and edit the **`SNAILS`** list at the
top (lines ~40–75). Each entry controls one snail:

- `folder` — the subfolder of `demo_pins/` with its photos
- `label` — display name (used in logs)
- `sex` — the **fixed** result to show (`"Male"` or `"Female"`)
- `pregnancyStatus` — the **fixed** result to show (`"Pregnant"` or `"Not Pregnant"`)
- `confidence` — the confidence % to display (fixed, looks confident)
- `morphologicalNotes` — the text shown to judges (make it sound real)

The defaults already produce the three results in the table above — if that's
what you want, you only need to tweak the notes. Then generate the config:

```bash
python build_demo_pins.py
```

You should see:

```
✅ Snail 1 → Female/Pregnant (6 reference photos)
✅ Snail 2 → Male/Not Pregnant (5 reference photos)
✅ Snail 3 → Female/Not Pregnant (7 reference photos)
🎪 Wrote demo_pins.json — 3 booth snail(s) pinned.
```

### Step 4: Verify BEFORE the fair, then restart the server

```bash
python check_demo_pins.py demo_pins/snail1/01.jpg demo_pins/snail2/01.jpg demo_pins/snail3/01.jpg
```

You want **`MATCH ✅`** for all three, ideally with a comfortable margin (e.g.
`crop ≤5` and `full ≤12` out of 64). If any photo shows **`NO MATCH ❌`**, add
more reference photos of that snail and rebuild (`python build_demo_pins.py`).

Then restart the API server so it loads the pins:

```bash
# Terminal 1 (API) — from the project root
cd snail-api-server && GEMINI_API_KEY="<your key>" ../.venv/Scripts/python.exe -m uvicorn api_server:app --reload --port 8000

# Terminal 2 (app)
npm run dev
```

Check the startup log shows `🎪 Booth pin mode ON — 3 snail(s) pinned`, and
`http://localhost:8000/health` reports `"demoPins": 3`.

---

## ✅ Verify it at the fair

1. Open the app: laptop `https://localhost:3000` · phone `https://192.168.1.5:3000`
   (accept the self-signed cert warning once)
2. Scan each snail — it should instantly show its pinned result (~0.05s)
3. Scan the same snail again — **identical result**, every time
4. `GET /health` → `"demoPins": 3` confirms pin mode is active

If a scan ever shows the normal (slow, ~3s) result instead, it means the photo
didn't match a reference — re-scan closer to how the reference photos were
taken (same angle, same distance).

---

## 🌐 Deploy booth pin mode to Render (optional — public URL for the booth)

> ✅ **Already deployed and live** — both services below are up, and the pins
> are **on**: `demo_pins.json` is committed and
> `https://snail-api-booth.onrender.com/health` reports `"demoPins": 3`.
> The only remaining step is (optionally) the Gemini key.

If you'd rather run the booth from **any phone over the internet** (no Wi-Fi
setup, real HTTPS, no cert warning — versus the LAN `https://192.168.1.x:3000`
setup), there's a dedicated Render deployment that runs booth pin mode:

| Service | URL | What it is |
|---|---|---|
| `snail-sex-identifier-booth` | `https://snail-sex-identifier-booth.onrender.com` | The app, built **real-API-backed** (no cycling), pointed at the booth API below |
| `snail-api-booth` | `https://snail-api-booth.onrender.com` | The FastAPI server with **booth pins active** (`/health` → `"demoPins": 3`) |

The reference photos **never get uploaded** — `build_demo_pins.py` bakes each
photo's difference hashes into `demo_pins.json`, so the config is
**self-contained** and the photos stay on your machine.

**Enable the pins (the services are already live — ~2 minutes, do after
Steps 3–4 above):**

```bash
# 1. drop each snail's photos into its folder, then generate the config
python build_demo_pins.py          # from snail-api-server/

# 2. commit ONLY the config — the photos stay gitignored
git add snail-api-server/demo_pins.json
git commit -m "Enable booth pins for the Render booth version"
git push                           # snail-api-booth auto-redeploys with pins on
```

**While you're in the dashboard:** set `GEMINI_API_KEY` on `snail-api-booth`
(Environment → the `sync: false` entry). It's used only for scans that don't
match a pin — without it those return `Unknown` and the app shows a mock
result. Pinned snails bypass Gemini entirely.

**At the fair:** open `https://snail-sex-identifier-booth.onrender.com` on any
phone. Scan each snail → pinned result in ~0.05s. Confirm with
`https://snail-api-booth.onrender.com/health` → `"demoPins": 3`.

> **Note:** the public `snail-sex-identifier` version still cycles (Male →
> Female → Female Pregnant) — that's intentional. The booth version is the one
> wired to the pinned API.

---

## Troubleshooting

| Symptom | Fix |
|---|---|
| `NO MATCH ❌` in `check_demo_pins.py` | Add more reference photos of that snail (same container/spot/lighting) and rebuild |
| A scan falls through to the slow Gemini result | The scan's angle/distance differs from the references — scan the way you took the reference photos, or add more angle variety to the references |
| Two snails get confused (wrong pin fires) | Take references in clearly different setups, or tighten `cropThreshold`/`fullThreshold` in `demo_pins.json` (defaults 10/20) |
| `demoPins: 0` in health | `demo_pins.json` is missing or empty — run `build_demo_pins.py` and restart the server |

---

## Files involved

| File | Purpose |
|---|---|
| `snail-api-server/build_demo_pins.py` | Turns photo folders + fixed results into `demo_pins.json` (edit the `SNAILS` list here) |
| `snail-api-server/check_demo_pins.py` | Verifies each snail matches reliably **before the fair** |
| `snail-api-server/demo_pins.json` | Generated config — **self-contained** (reference hashes baked in, no photos). Committed so the `snail-api-booth` Render service can load pins |
| `snail-api-server/demo_pins/` | Reference photo folders (gitignored, local-only — never uploaded) |
| `snail-api-server/api_server.py` | The matcher (difference hash on crop + full frame, dual thresholds) |
| `snail-api-server/README.md` | Server docs (includes a shorter version of this guide) |

> **Tip:** reference photos taken at the booth (same container, same spot, same
> lighting) match at distance ~0–5 out of 64 — a huge safety margin. Photos
> taken at home in different conditions will be less reliable, so take them at
> the venue if you can.
