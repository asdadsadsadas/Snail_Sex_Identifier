# Snail Sexing AI — Project Summary

A full-stack React + TypeScript + Vite web app for AI-powered snail sex and pregnancy classification, backed by Firebase Firestore.

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

- **`src/server.ts`** — Express server with **Gemini 2.0 Flash Vision** for real-time snail classification
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
| **`scripts/organize_pregnancy_dataset.mjs`** | Maps Label Studio box labels → photos, 80/20 split, builds `dataset_detection/` (YOLO detection + `data.yaml`) and populates `dataset_pregnancy/train|val/pregnant/` |
| **`scripts/exif_fix_dataset.py`** | Bakes EXIF orientation into phone photos (Label Studio shows them rotated; YOLO/OpenCV ignores the tag → labels were misaligned) + optional 1280px resize; `--check` draws box previews |
| **`scripts/build_colab_notebook.py`** | Regenerates `colab/train_snail_pipeline.ipynb` from the `.py` source |
| **`colab/train_snail_pipeline.py` + `.ipynb`** | Ready-to-run Colab: trains detector → sex classifier → pregnancy classifier, exports `.pt` + `.onnx` to Drive, diagnostic cell (mAP, detection rate, annotated preview) |
| **`dataset_detection/`** | 🟡 **76 labeled pregnant-snail images (61 train / 15 val)**, class `snail` — EXIF-fixed, resized to 1280px. **Round-1 detector trained but not reliable — needs more photos** |
| **`dataset_pregnancy/`** | 🟡 76 pregnant images organized (train/val/pregnant); `not_pregnant` still empty — needs collecting |
| **`dataset_sex/`** | ⬜ Empty — needs male/female photo collection (see PHOTO_SESSION_GUIDE) |
| **`src/components/PullToRefresh.tsx`** | Touch gesture component for pull-to-refresh data reloading |

> 📊 **Training status (round 1):** the 3-stage pipeline (detect → sex → pregnancy) is built and the tooling is ready. A first detector was trained on the 76 labeled images after fixing a critical **EXIF-orientation bug** (62/77 photos were stored rotated; Label Studio showed them correctly but YOLO read raw pixels, so labels were misaligned). The re-trained detector **still couldn't reliably find snails** — 76 images is too few for detection to generalize. **Next: take more photos** (more snails, angles, backgrounds), re-label, re-run the organize + EXIF-fix scripts, and re-train. Sex and `not_pregnant` data still to collect.

### Source Control

- **GitHub**: https://github.com/asdadsadsadas/Snail_Sex_Identifier
- **Branch**: `master`

---

## 🚀 How to Run Locally

```bash
# Frontend (port 3000)
npm run dev

# Backend server with Gemini AI (port 3001)
npm run dev:server

# Both at once (separate terminals)
npm run dev           # Terminal 1
npm run dev:server    # Terminal 2
```

On your phone (same Wi-Fi):
```
http://192.168.1.12:3000
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

The app is deployed as a unified server (frontend + API) on Render:

- **URL**: `https://snail-sex-identifier.onrender.com`
- **Build**: `npm run build` (builds React frontend)
- **Start**: `NODE_ENV=production npx tsx src/server.ts` (serves frontend + API)
- **Config**: `railway.json` (legacy — Render configured via dashboard)

### To redeploy:

1. Push to GitHub → Render auto-deploys from `master` branch
2. Add `GEMINI_API_KEY` in Render dashboard → Environment tab (optional)
3. Render auto-builds and deploys ✅

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
| `src/lib/api.ts` | Classification API service (server → Gemini → mock fallback) |
| `src/lib/utils.ts` | Utility functions (cn, formatDate, formatConfidence) |
| `src/vite-env.d.ts` | Vite type declarations |
| `showcase.png` | Full-page showcase screenshot with all app screens |
| `showcase/index.html` | Standalone HTML showcase page (responsive grid, phone mockups) |
| `dataset_sex/` | Dataset folders for YOLO sex training (empty — photos to collect) |
| `dataset_pregnancy/` | YOLO pregnancy training folders (76 pregnant images organized) + `Female_preg_labels/` Label Studio export |
| `dataset_detection/` | YOLO detection dataset (76 snail boxes: images + labels + `data.yaml`) |
| `scripts/organize_pregnancy_dataset.mjs` | Re-runnable dataset organizer (Label Studio export → detection + classification layouts) |
| `scripts/exif_fix_dataset.py` | Bakes EXIF orientation + optional resize (required before training phone photos) |
| `scripts/build_colab_notebook.py` | Regenerates the Colab notebook from `colab/train_snail_pipeline.py` |
| `colab/train_snail_pipeline.py` | Google Colab training script for the full 3-stage pipeline |
| `colab/train_snail_pipeline.ipynb` | Same pipeline as a ready-to-open Colab notebook (File → Upload notebook) |
| `snail-api-server/` | Placeholder for custom YOLO FastAPI server |

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
| **AI (option 1)** | Gemini 2.0 Flash Vision via Express server |
| **AI (option 2)** | Custom YOLO model via FastAPI (train your own!) |
| **Deployment** | Render (unified server: frontend + API, free tier) |
| **SSL** | @vitejs/plugin-basic-ssl for HTTPS on mobile |
