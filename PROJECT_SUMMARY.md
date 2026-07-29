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
- **Dev**: `npm run dev:server` (port 3001) | **Production**: served via Railway with frontend

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

### AI Training Pipeline

| Resource | Details |
|---|---|
| **`AI_TRAINING_GUIDE.md`** | Full end-to-end guide: Label Studio → YOLO in Colab → FastAPI → connect to app |
| **`dataset_sex/`** | Blank folder structure for sex classification dataset (male/female, train/val) |
| **`dataset_pregnancy/`** | Blank folder structure for pregnancy dataset (pregnant/not_pregnant, train/val) |
| **`snail-api-server/`** | Placeholder for your FastAPI YOLO server |

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

## 🌐 Railway Deployment

The project deploys as a unified server (frontend + API):

- **Build**: `npm run build` (builds React frontend)
- **Start**: `NODE_ENV=production npx tsx src/server.ts` (serves frontend + API)
- **Config**: `railway.json`

### To deploy:

1. Push to GitHub
2. Connect repo to Railway
3. Add `GEMINI_API_KEY` environment variable in Railway dashboard (optional)
4. Railway auto-deploys ✅

---

## 🧠 Training Your Own YOLO Model

For full step-by-step instructions, see **`AI_TRAINING_GUIDE.md`**.

### Quick overview:

| Step | What to do |
|---|---|
| **1. 📸 Collect** | Take snail photos using the app (top-down, white background, good light) |
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
| `dataset_sex/` | Blank dataset folders for YOLO sex training |
| `dataset_pregnancy/` | Blank dataset folders for YOLO pregnancy training |
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
| **Deployment** | Railway (unified server: frontend + API) |
| **SSL** | @vitejs/plugin-basic-ssl for HTTPS on mobile |
