# Snail Sexing AI — Project Summary

A full-stack React + TypeScript + Vite web app for AI-powered snail sex and pregnancy classification, backed by Firebase Firestore — **plus a Flutter Android APK version** with live-camera scanning and on-device records (see 📱 below).

---

## ✅ What's Built

### The App

| Feature | Details |
|---|---|
| **Onboarding** | 3-slide intro with camera permission request, stored in localStorage |
| **Scan** | Live camera via getUserMedia, gallery upload, AI classification with loading spinner, result overlay with sex/pregnancy/confidence/morphological notes, save to Firestore |
| **Home** | Live counts (total, male/female, pregnant) from Firestore, top 3 recent logs |
| **History** | All records from Firestore with search by date, filter by sex & pregnancy status |
| **Detail** | View full record, edit sex/pregnancy with save, delete with confirmation dialog |
| **Stats** | Real male/female ratio pie chart, pregnancy trends bar chart from Firestore data |

### Backend (Firebase)

- **Firestore** — Collection `snails` stores: photo (as base64), date, gender, pregnancy status, confidence, morphological notes
- **Storage** — Skipped (no subscription needed). Photos stored as base64 directly in Firestore
- **Project**: `snail-c6aee` — connected and live

### Backend (Express + Gemini)

- **`src/server.ts`** — Express server with **Gemini Vision (`gemini-flash-latest`)** for real-time snail classification
- **`POST /classify`** — Accepts image upload, sends to Gemini, returns structured sex/pregnancy/confidence/morphological notes
- **Structured Output** — Uses Gemini's `responseSchema` for guaranteed JSON shape
- **Fallback** — App falls back to mock classification if server is unreachable
- **Dev**: `npm run dev:server` (port 3001) | **Production**: served via Render with frontend

### Showcase

| Resource | Details |
|---|---|
| **`showcase.png`** | Full-page screenshot of all 8 app screens as phone mockups (1.6MB, 2x retina) |
| **`showcase/index.html`** | Standalone HTML showcase page — open in browser to see all screens in a responsive grid |

Screens showcased: Onboarding · Home Dashboard · Scan (Live Camera, Welcome, Result) · History · Detail View · Statistics

### 📱 Android APK (Flutter)

| Resource | Details |
|---|---|
| **`snail_apk/`** | 🟢 Complete **Flutter port of the app** — live-camera scanning (custom viewfinder + torch toggle), gallery upload, on-device records, all 6 screens (Onboarding · Home · Scan · History · Detail · Stats). Package `com.snailsexing.snail_sexing_app`, custom snail-shell launcher icon, CAMERA + INTERNET permissions only. Build: `flutter build apk --release` → `snail_apk/build/app/outputs/flutter-apk/app-release.apk` (or `--split-per-abi` for smaller per-arch APKs) |
| **`snail-sexing-app.apk`** | Built release APK (~57 MB) copied to the repo root for convenience — **not committed** (see `*.apk` in `.gitignore`; rebuild from source instead) |
| **Classification API** | Same contract as the web app — multipart POST `/classify` to `https://snail-api.onrender.com` by default. `--dart-define=API_URL=http://<LAN-IP>:8000` for the local FastAPI server; `--dart-define=CYCLE_MODE=true` for the rotating booth demo (no server needed). Booth pins work automatically when the server has `demo_pins.json` |
| **Storage** | **On-device** — records saved as a JSON list in shared_preferences (photo compressed to ~480px JPEG base64, mirroring the web app's `compressImage`). No Firebase needed, works offline |
| **Fallback** | Server unreachable → mock classification (same behavior as the web app); "No Snail Detected" shown when the server reports no snail |
| **Tests** | `flutter test` — 3 widget smoke tests (onboarding gate, home render, tab navigation) all pass |
| **`snail_apk/README.md`** | Build + `--dart-define` config reference |

---

### Key Improvements

| Change | Benefit |
|---|---|
| **`compressImage()` utility** | Reduces photo size before Firestore storage (default 480px, 0.6 quality) — saves space & bandwidth |
| **Server-side Firestore aggregation** | Count queries use `getCountFromServer()` — no document fetching, dramatically faster stats |
| **ScanScreen redesign** | Dark UI with viewfinder overlay, torch toggle, camera denied fallback, smooth results panel |
| **Basic SSL plugin** | Self-signed HTTPS for `getUserMedia` on mobile devices (required by mobile browsers) |
| **Smart API URL resolution** | Automatically appends `/classify` to base URLs — supports both full and partial env config |
| **Showcase page** | All screens documented in a single HTML showcase + screenshot for README/gallery |
| **PullToRefresh component** | Gesture-based pull-to-refresh on Home and History screens — swipe down to reload data |
| **Removed unused playwright dependency** | Eliminated Railway build failure caused by playwright's native browser binaries |
| **Deployed on Render** | Successfully deployed full-stack app (frontend + API) on Render's free tier

### AI Training Pipeline (3-Stage: Detect → Sex → Pregnancy)

| Resource | Details |
|---|---|
| **`AI_TRAINING_GUIDE.md`** | Full end-to-end guide: Label Studio → YOLO in Colab → FastAPI → connect to app. Updated for the **3-stage pipeline**: a snail **detector** first, then sex + pregnancy classifiers on the detected crop |
| **`PHOTO_SESSION_GUIDE.md`** | Photo-taking plan for building the dataset: photos per snail (35–40), angles, lighting, sex verification via tentacles, snail-based train/val split, small-dataset Colab settings |
| **`BOOTH_PIN_GUIDE.md`** | 🎪 Step-by-step setup for **booth pin mode** at the science fair: reference photos → folders → `build_demo_pins.py` → `check_demo_pins.py` → restart, plus fair-day verification and troubleshooting |
| **`CYCLE_MODE_GUIDE.md`** | 🌀 How to run and customize the **cycle demo version** (`npm run dev:cycle`): the Male → Female → Female Pregnant rotating result loop, no server needed |
| **`scripts/organize_pregnancy_dataset.mjs`** | Re-runnable organizer: matches **any Label Studio YOLO export** to its photos, 80/20 split (seed 42), builds `dataset_detection/` (class 0 = snail) + routes class names into `dataset_pregnancy/` (preg/not_preg) and `dataset_sex/` (male/female) |
| **`scripts/crop_snail_boxes.py`** | ✂️ Second-pass prep: crops every labeled snail out of `dataset_detection/` (largest box + 10% margin) into `dataset_labeling/train|val/` — classifier training inputs are the **detected crops**, and the detector's split carries over so classifier val = detector val. **✅ Ran: 724 crops (579 train / 145 val)** |
| **`scripts/organize_classification_dataset.mjs`** | Second-pass organizer: converts the Label Studio **classification JSON export** (Male/Female, Pregnant/Not Pregnant) into `dataset_sex/` + `dataset_pregnancy/`, inheriting the train/val split from the crop folders, warns on missing classes |
| **`scripts/exif_fix_dataset.py`** | Bakes EXIF orientation into phone photos (Label Studio shows them rotated; YOLO/OpenCV ignores the tag → labels were misaligned) + optional 1280px resize; `--check` draws box previews; **`--src-dir/--out-dir` mode** preps raw photo batches for Label Studio **before** labeling |
| **`scripts/build_colab_notebook.py`** | Regenerates `colab/train_snail_pipeline.ipynb` from the `.py` source |
| **`colab/train_snail_pipeline.py` + `.ipynb`** | Ready-to-run Colab: trains detector → sex classifier → pregnancy classifier, exports `.pt` + `.onnx` to Drive, diagnostic cell (mAP, detection rate, annotated preview) |
| **`all_snail/`** | 🟢 **724 raw snail photos** (1.7 GB iPhone MPO) — the round-2 photo source, labeled in Label Studio |
| **`labels_snail/`** | 🟢 **Label Studio YOLO export** for all 724 photos (single class `Snail`, one box per snail) + `labels_snail.zip` archive |
| **`dataset_detection/`** | 🟢 **724 labeled images (579 train / 145 val)**, class `snail`, EXIF-baked + resized to 1280px (previews in `scripts/box_previews/`) |
| **Trained detector** | ✅ **`snail_detector.pt` + `snail_detector.onnx`** trained in Colab from the round-2 dataset (yolo11n, tuned hyperparameters), copied into `snail-api-server/` and **committed to git** (~5 MB `.pt` + ~10 MB `.onnx`). Results below |
| **`dataset_pregnancy/` + `dataset_sex/`** | ⬜ Not built yet — sex/pregnancy labels to be collected in a later labeling pass |
| **`snail-api-server/`** | 🟢 **FastAPI 3-stage prediction server** (`api_server.py`, `requirements.txt`, `README.md`) — detect → crop → sex → pregnancy. **Detector runs on ONNX Runtime** (~50–80 MB RAM, ~10× lighter than torch — required for Render's 512 MB free tier). **Gemini Vision fallback**: when the sex/pregnancy classifiers aren't deployed, the crop is classified by Gemini (`gemini-flash-latest`) instead of returning Unknown. **🎪 Booth pin mode**: optional `demo_pins.json` pins specific snails to fixed results via reference-photo matching (see below). Degrades gracefully at every stage |
| **`scripts/build_demo_pins.py` + `check_demo_pins.py`** (in `snail-api-server/`) | 🎪 **Booth pin mode tooling** — `build_demo_pins.py` turns reference-photo folders (`demo_pins/snail1|2|3/`) + fixed results into a **self-contained `demo_pins.json`** (hashes baked in — photos stay local); `check_demo_pins.py` verifies each snail matches reliably **before the fair** (`MATCH ✅` / `NO MATCH ❌`) |
| **`src/components/PullToRefresh.tsx`** | Touch gesture component for pull-to-refresh data reloading |

> 📊 **Training status (round 2):** round-1 datasets (76 photos) were **scrapped**. The full 724-photo batch (`all_snail/`) was labeled in Label Studio with one snail box each (`labels_snail/` export) and organized into a fresh **detection dataset** (724 images, 579 train / 145 val, class `snail`, EXIF-baked + 1280px). **✅ Detector trained in Colab — verified working**: 100% detection rate on all 145 val images (conf 0.25/0.10/0.05), **mean val IoU 0.747** (boxes hug the snails — the round-1 EXIF misalignment is gone).
>
> **✅ Deployed & live:** the FastAPI server (`snail-api-server/`) is deployed as a **separate Render service** (`snail-api`, `https://snail-api.onrender.com`, via `render.yaml` blueprint). Two bugs were found and fixed along the way: (1) **torch OOM on Render's 512 MB free tier** — first `/classify` crashed the instance → 502; fixed by switching the detector to **ONNX Runtime** (identical weights, ~10× lighter, verified 20/20 val detections + 0.817 mean IoU vs the `.pt` model); (2) **detector silently not loading** — `render.yaml` set `DETECTOR_PATH=snail_detector.pt` while the code treated it as a base name (searching `snail_detector.pt.onnx`); fixed by stripping trailing extensions + dropping the env var. **Gemini Vision fallback active**: with `GEMINI_API_KEY` set, sex/pregnancy come from Gemini (`gemini-flash-latest` — the 2.0 models are retired) on the detected crop, so the app returns **real classifications today** instead of Unknown. The frontend (`https://snail-sex-identifier.onrender.com`) points at the API via `VITE_YOLO_API_URL`.
>
> **🎪 Science-fair demo runs locally** (no free-tier sleep/restarts): FastAPI on `:8000` + `npm run dev` on `:3000` (HTTPS). A **Vite proxy** (`/classify`, `/health` → `localhost:8000`) lets phones use the API same-origin — no mixed-content blocking. `.env` has `VITE_YOLO_API_URL=https://192.168.1.5:3000` + the Gemini key. Verified: real detections with Female/Male classifications in ~3–27s.
>
> **🎪 Cycle demo version (`npm run dev:cycle`):** the no-server booth demo — every scan shows the **next** result in the loop **Male → Female → Female Pregnant → back to Male**, regardless of what the camera sees (even empty photos advance the cycle). Deterministic, instant (~0.9s fake scan), works offline — perfect for a hands-on demo where visitors scan repeatedly. The loop is defined in `src/lib/api.ts` (`cycleStates`) and enabled via `VITE_CYCLE_MODE` (set in `.env.cycle`). **The production build cycles too** (`build` = `vite build --mode cycle`), so the deployed Render version rotates results on every scan — flip `VITE_CYCLE_MODE=false` in Render's Environment tab to go back to real detections. See **`CYCLE_MODE_GUIDE.md`** for the full how-to.
>
> **🎪 Booth pin mode (deterministic results per snail):** Gemini gives a slightly different answer on every scan, so the same snail could flip between Female/Male. For the booth, the 3 display snails are **pinned to fixed results**: drop 4–8 phone reference photos of each into `demo_pins/snail1|2|3/`, set each snail's fixed sex/pregnancy in `build_demo_pins.py`'s `SNAILS` list, run `python build_demo_pins.py`, then verify with `python check_demo_pins.py <photo>`. **Flow per scan: detect the snail first — no snail in the photo returns "No Snail Detected" (never a pinned result); if a snail IS found, the scan is matched with a difference hash on both the detected crop AND the full frame** (dual thresholds crop≤10 / full≤20 of 64 — the crop identifies the snail, the full frame confirms the same container/scene, so similar snails don't get confused). On a match it returns the pinned result in ~0.05s, **bypassing Gemini entirely** — same snail, same result, every time. Verified: all 3 pinned snails return their fixed results instantly, a rotated/brightened 'fresh scan' still matches correctly, and unpinned photos fall through to the normal pipeline safely. `GET /health` reports `demoPins`; the reference **photos** are gitignored (local-only), while `demo_pins.json` is **self-contained** (hashes baked in by `build_demo_pins.py`) and committed so the **`snail-api-booth` Render service** can load pins — see the Render Deployment section below.
>
> **Next: second Label Studio pass** — the snail crops are ready in `dataset_labeling/` (724 crops, 579 train / 145 val, generated by `scripts/crop_snail_boxes.py`). Drag that folder into Label Studio, label sex (Male/Female) + pregnancy (Pregnant/Not Pregnant), export JSON, run `scripts/organize_classification_dataset.mjs` → train the stage-2/3 classifiers in Colab → drop `snail_sex_model.onnx` / `snail_pregnancy_model.onnx` into `snail-api-server/` (the server upgrades automatically, Gemini fallback retired).

### Source Control

- **GitHub**: https://github.com/asdadsadsadas/Snail_Sex_Identifier
- **Branch**: `master`

---

## 🚀 How to Run Locally

### YOLO + Gemini stack (science-fair demo — recommended)

```bash
# Terminal 1 — FastAPI YOLO server (port 8000)
cd snail-api-server && GEMINI_API_KEY="<your key>" ../.venv/Scripts/python.exe -m uvicorn api_server:app --reload --port 8000

# Terminal 2 — the app (port 3000, HTTPS via self-signed SSL for camera)
npm run dev
```

The app calls the API through Vite's dev proxy (`/classify` → `localhost:8000`) so phones aren't blocked by mixed content. `.env` should contain `VITE_YOLO_API_URL=https://<your-LAN-IP>:3000` (or `https://localhost:3000` for desktop) and `GEMINI_API_KEY`.

On your phone (same Wi-Fi):
```
https://192.168.1.5:3000   (accept the self-signed cert warning once)
```

### Cycle demo version (no server needed)

```bash
npm run dev:cycle      # same app, but every scan shows Male → Female → Female Pregnant in rotation
```

Works fully offline — the app never calls the API. `npm run build:cycle` produces a static `dist/` with the cycle baked in. (The local `.env`'s `VITE_CYCLE_MODE` flag controls whether plain `npm run dev` also cycles — set it to `false` to make the main version call the FastAPI server again.)

### Legacy Express + Gemini backend (port 3001)

```bash
npm run dev           # Terminal 1
npm run dev:server    # Terminal 2
```

### Setup Gemini (optional — mock works without it)

1. Get a free API key: https://aistudio.google.com/apikey
2. Copy `.env.example` to `.env` and add your key
3. Start the server: `npm run dev:server`
4. The app will use real AI classification instead of mock

### Reset onboarding (see it again)

```js
localStorage.removeItem('snail_sexing_onboarding_done')
```

---

## 🌐 Render Deployment (Live ✅)

The app runs as **two services** on Render's free tier, both auto-deploying from `master`:

### 1. Frontend — `snail-sex-identifier`

- **URL**: `https://snail-sex-identifier.onrender.com`
- **Build**: `npm run build` (builds React frontend)
- **Start**: `NODE_ENV=production npx tsx src/server.ts` (serves frontend + API)
- **Config**: `railway.json` (legacy — Render configured via dashboard)
- **Env**: `VITE_YOLO_API_URL=https://snail-api.onrender.com` (baked into the bundle)
- **🌀 Cycles too**: the `build` script runs `vite build --mode cycle` (`.env.cycle` is committed), so **the deployed version rotates scan results** Male → Female → Female Pregnant like the local demo — no API calls on scan. To deploy the real API-backed version again, set `VITE_CYCLE_MODE=false` in Render's Environment tab (overrides the build) or revert the `build` script to plain `vite build`

### 2. YOLO API — `snail-api`

- **URL**: `https://snail-api.onrender.com` (`/health`, `/classify`)
- **Config**: `render.yaml` blueprint at repo root (Root Directory: `snail-api-server`, start: `uvicorn api_server:app --host 0.0.0.0 --port $PORT`)
- **Weights**: `snail_detector.pt` + `.onnx` committed to git (un-ignored in `snail-api-server/.gitignore`)
- **Detector**: ONNX Runtime (~50–80 MB RAM — fits the 512 MB free tier)
- **Env**: `GEMINI_API_KEY` set in Render's Environment tab (not in git) → Gemini Vision fallback for sex/pregnancy

### 3. 🎪 Booth-pin version (science-fair demo)

**✅ Deployed and live** — two extra services in the same `render.yaml`
blueprint: a second API with booth pin mode and a second frontend wired to it:

- **`snail-api-booth`** (`https://snail-api-booth.onrender.com`) — the same FastAPI server, but booth pin mode is **active once `demo_pins.json` is committed**. The config is self-contained: `build_demo_pins.py` bakes each reference photo's difference hashes into the JSON, so the reference photos **never get uploaded** (they stay gitignored locally). Verified live: `/health` → `detector: true` (ONNX), and a real full-photo scan returns `snailDetected: true`.
- **`snail-sex-identifier-booth`** (`https://snail-sex-identifier-booth.onrender.com`) — the app built **real-API-backed** (`npm run build:real` = `vite build --mode real`, `VITE_CYCLE_MODE=false` from `.env.real`) and pointed at the booth API via `VITE_YOLO_API_URL`. The public `snail-sex-identifier` still cycles; this booth version is the one wired to the pinned API. Build gotcha fixed: Render builds with `NODE_ENV=production` (skips devDependencies where `vite`/`tsx` live), so the build command is `npm install --include=dev && npm run build:real`.

**Current status:** both services deployed; **pins off** until `demo_pins.json` is committed (add 4–8 reference photos per snail to `demo_pins/snail1|2|3/` → `python build_demo_pins.py` → commit → push). `GEMINI_API_KEY` on `snail-api-booth` is **not set yet** — add it in Render's dashboard so non-pinned scans get real sex/pregnancy instead of a mock result. Full walkthrough in **`BOOTH_PIN_GUIDE.md`**.

### To redeploy:

1. Push to GitHub → all services auto-deploy from `master` (frontend + API, plus both booth services via blueprint sync)
2. **Known free-tier quirks**: the API spins down after ~15 min idle (first request takes ~30–60s to wake) and Render may restart free instances at any time — occasional 502s on `/classify` are infra flakiness, not app bugs (the code fails soft to `Unknown`). **For an all-day demo, run locally instead** (see below).

---

## 🧠 Training Your Own YOLO Model

For full step-by-step instructions, see **`AI_TRAINING_GUIDE.md`**.

### Quick overview:

| Step | What to do |
|---|---|
| **1. 📸 Collect** | Take snail photos with your phone's camera app (top-down, white background, good light) — full resolution is better for training |
| **2. 🏷️ Label** | Use Label Studio to classify male/female and pregnant/not pregnant |
| **3. 🎯 Train** | Train YOLO11n-cls in Google Colab (free GPU) — two models: sex + pregnancy |
| **4. 🌐 Deploy** | Create a FastAPI server, deploy to Railway |
| **5. 🔗 Connect** | Set `VITE_YOLO_API_URL=https://your-api.up.railway.app` |

### Dataset structure (ready to use):

```
dataset_sex/
├── train/male/        ← add male photos here
├── train/female/      ← add female photos here
├── val/male/
└── val/female/

dataset_pregnancy/
├── train/pregnant/
├── train/not_pregnant/
├── val/pregnant/
└── val/not_pregnant/

snail-api-server/       ← FastAPI server files go here
```

---

## 📁 Project Structure

| File | Purpose |
|---|---|
| `package.json` | Project config, scripts, dependencies |
| `tsconfig.json` | TypeScript configuration |
| `vite.config.ts` | Vite build config with React + Tailwind |
| `index.html` | App entry HTML |
| `railway.json` | Railway deployment config |
| `.env.example` | Environment variable template (Gemini API key) |
| `.gitignore` | Git ignore rules |
| `AI_TRAINING_GUIDE.md` | Full guide: train YOLO model from scratch |
| `PHOTO_SESSION_GUIDE.md` | Photo session plan: per-snail photo counts, angles, lighting, sexing verification, dataset split |
| `PROJECT_SUMMARY.md` | This file — full project overview |
| `src/server.ts` | Express backend server with Gemini Vision API |
| `src/App.tsx` | Main app with screen routing and Firestore data loading |
| `src/main.tsx` | React root mount point |
| `src/index.css` | Tailwind CSS v4 import |
| `src/types.ts` | TypeScript type definitions |
| `src/screens/OnboardingScreen.tsx` | 3-slide onboarding flow |
| `src/screens/ScanScreen.tsx` | Camera, gallery, classification, result overlay, save |
| `src/screens/HomeScreen.tsx` | Live Firestore counts, recent logs |
| `src/screens/HistoryScreen.tsx` | Search + filter, Firestore-powered list |
| `src/screens/DetailScreen.tsx` | View, edit, delete records with confirmation |
| `src/screens/StatsScreen.tsx` | Pie/bar charts from Firestore via Recharts |
| `src/components/BottomNav.tsx` | Bottom tab navigation (Home, Scan, History, Stats) |
| `src/lib/firebase.ts` | Firebase config + all CRUD operations |
| `src/lib/api.ts` | Classification API service (server → Gemini → mock fallback) + **cycle mode** (`VITE_CYCLE_MODE=true`): rotates scan results Male → Female → Female Pregnant without a server |
| `.env.cycle` | Cycle-demo config (`VITE_CYCLE_MODE=true`) — run with `npm run dev:cycle` (dev) or `npm run build:cycle` (static build) |
| `src/lib/utils.ts` | Utility functions (cn, formatDate, formatConfidence) |
| `src/vite-env.d.ts` | Vite type declarations |
| `showcase.png` | Full-page showcase screenshot with all app screens |
| `showcase/index.html` | Standalone HTML showcase page (responsive grid, phone mockups) |
| `all_snail/` | 724 raw snail photos (source — keep as originals) |
| `labels_snail/` + `labels_snail.zip` | Label Studio YOLO export (724 labels, class `Snail`) |
| `dataset_detection/` | 🟢 YOLO detection dataset (724 images: 579 train / 145 val, class `snail`, EXIF-baked, 1280px) |
| `dataset_labeling/` | 🟢 **724 snail crops** (579 train / 145 val) ready for the second Label Studio pass — generated by `scripts/crop_snail_boxes.py` from the detection boxes (gitignored, regenerable) |
| `dataset_pregnancy/` + `dataset_sex/` | ⬜ Not built yet — built by `scripts/organize_classification_dataset.mjs` from the second-pass Label Studio export |
| **`scripts/organize_pregnancy_dataset.mjs`** | Re-runnable dataset organizer (matches any Label Studio YOLO export → detection + classification layouts) |
| **`scripts/exif_fix_dataset.py`** | Bakes EXIF orientation + optional resize (required before training phone photos); `--src-dir/--out-dir` preps new batches for Label Studio |
| `scripts/build_colab_notebook.py` | Regenerates the Colab notebook from `colab/train_snail_pipeline.py` |
| `colab/train_snail_pipeline.py` | Google Colab training script for the full 3-stage pipeline |
| `colab/train_snail_pipeline.ipynb` | Same pipeline as a ready-to-open Colab notebook (File → Upload notebook) |
| `snail-api-server/` | 🟢 **FastAPI 3-stage server** — `api_server.py` (detect via **ONNX Runtime** → crop → sex/pregnancy via trained models, **Gemini Vision fallback**, or **booth pins**; graceful degradation), `requirements.txt`, `README.md`, `.gitignore` (commits `.pt`/`.onnx` weights) |
| `snail-api-server/build_demo_pins.py` + `check_demo_pins.py` | 🎪 Booth pin mode: generate `demo_pins.json` from reference photos + verify matching before the fair (`demo_pins.json` + `demo_pins/` photos are gitignored) |
| `render.yaml` | Render blueprint — defines `snail-api` + **`snail-api-booth`** (booth-pin API) + **`snail-sex-identifier-booth`** (real-API frontend for the booth) |
| `snail_apk/` | 🟢 **Flutter Android app** — the APK version (see the 📱 section above). `flutter analyze` clean, `flutter test` green |

---

## 🛠 Tech Stack

| Layer | Tech |
|---|---|
| **Frontend** | React 19 + TypeScript + Vite 6 |
| **Styling** | Tailwind CSS v4 |
| **Icons** | Lucide React |
| **Animations** | Motion (former Framer Motion) |
| **Charts** | Recharts |
| **Database** | Firebase Firestore |
| **AI (option 1)** | Gemini Vision (`gemini-flash-latest`) via Express server **or** as the FastAPI fallback |
| **AI (option 2)** | Custom YOLO model via FastAPI (train your own!) — detector runs on **ONNX Runtime** |
| **Deployment** | Render (free tier) — `snail-sex-identifier` frontend + `snail-api` FastAPI service (`render.yaml`) |
| **SSL** | @vitejs/plugin-basic-ssl for HTTPS on mobile |
| **Mobile** | Flutter 3.47 (Dart) — Android APK: `camera`, `image_picker`, `shared_preferences`, `http`, `fl_chart`, `intl`, `image` |
