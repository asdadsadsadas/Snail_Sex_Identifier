# Snail Sexing AI — Project Summary

## ✅ What's Built

A full-stack React + TypeScript + Vite web app for AI-powered snail sex and pregnancy classification, backed by Firebase Firestore.

---

### The App

| Feature | Details |
|---|---|
| **Onboarding** | 3-slide intro with camera permission request, stored in localStorage |
| **Scan** | Live camera via getUserMedia, gallery upload, mock YOLO classification with loading spinner, result overlay with sex/pregnancy/confidence/morphological notes |
| **Home** | Live counts (total, male/female, pregnant) from Firestore, top 3 recent logs |
| **History** | All records from Firestore with search by date, filter by sex & pregnancy status |
| **Detail** | View full record, edit sex/pregnancy with save, delete with confirmation dialog |
| **Stats** | Real male/female ratio pie chart, pregnancy trends bar chart from Firestore data |

### Backend (Firebase)

- **Firestore** — Collection `snails` stores: photo (as base64), date, gender, pregnancy status, confidence, morphological notes
- **Storage** — Skipped (would require payment). Photos stored directly in Firestore as base64 data URLs
- **Firebase Config**: Project `snail-c6aee` is connected and live

---

## 🧠 How to Train Your Real YOLO Model

### 1. Collect snail photos

Best practices:
- **Top-down (90°) angle** — most important rule
- Plain white/light grey background
- Bright, diffused natural light (avoid direct flash)
- Snail resting, slightly exposed — not fully retracted or fully crawling
- Shell fills ~60-70% of the frame
- At least 800x800 resolution

**Goal: 200+ photos per class** (100 minimum)

### 2. Label & organize

Simplest approach — just use folders:
```
dataset_sex/
├── train/
│   ├── male/
│   └── female/
└── val/
    ├── male/
    └── female/

dataset_pregnancy/
├── train/
│   ├── pregnant/
│   └── not_pregnant/
└── val/
    ├── pregnant/
    └── not_pregnant/
```

**Recommended tools:**
- **Label Studio** (free, local) — `pip install label-studio`
- **Roboflow** (free for 1000 images) — web-based

### 3. Train the model

```bash
pip install ultralytics

# Train sex classifier
yolo classify train model=yolo11n-cls.pt data=./dataset_sex epochs=50 imgsz=224

# Train pregnancy classifier
yolo classify train model=yolo11n-cls.pt data=./dataset_pregnancy epochs=50 imgsz=224
```

### 4. Deploy as an API

Create a FastAPI server that loads your trained models and exposes a /classify endpoint. Host for free on Railway or Render.

### 5. Connect the app

Set the environment variable:
```
VITE_YOLO_API_URL=https://your-api.railway.app/classify
```

The app will automatically switch from mock to real predictions.

---

## 📁 Files Overview

| File | Purpose |
|---|---|
| `src/App.tsx` | Main app with screen routing and Firestore data loading |
| `src/screens/OnboardingScreen.tsx` | 3-slide onboarding flow |
| `src/screens/ScanScreen.tsx` | Camera, gallery, classification, result overlay, save |
| `src/screens/HomeScreen.tsx` | Live Firestore counts, recent logs |
| `src/screens/HistoryScreen.tsx` | Search + filter, Firestore-powered list |
| `src/screens/DetailScreen.tsx` | Edit/delete with confirmation |
| `src/screens/StatsScreen.tsx` | Real pie/bar charts from Firestore |
| `src/lib/firebase.ts` | Firebase config + all CRUD operations |
| `src/lib/api.ts` | YOLO API service with mock fallback |
| `src/types.ts` | TypeScript type definitions |

---

## 🚀 How to Run

```bash
npm install
npm run dev          # → http://localhost:3000
```

On your phone (same Wi-Fi):
```
http://192.168.1.12:3000
```

### Reset onboarding (see it again)

In browser DevTools console:
```js
localStorage.removeItem('snail_sexing_onboarding_done')
```

---

## 📝 Latest Updates

- Firebase Firestore connected (project: `snail-c6aee`)
- Photos stored as base64 in Firestore (no paid Storage needed)
- Mock YOLO classifier in place (swap for real API later)
- Onboarding screen with camera permission request
