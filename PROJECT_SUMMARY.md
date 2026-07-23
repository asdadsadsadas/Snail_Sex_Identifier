# Snail Sexing AI — Project Summary

A full-stack React + TypeScript + Vite web app for AI-powered snail sex and pregnancy classification, backed by Firebase Firestore.

---

## ✅ What's Built

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
- **Storage** — Skipped (no subscription needed). Photos stored as base64 directly in Firestore
- **Project**: `snail-c6aee` — connected and live

### Source Control

- **GitHub**: https://github.com/asdadsadsadas/Snail_Sex_Identifier
- **Branch**: `master`

---

## 🚀 How to Run Locally

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

## 🌐 Railway Deployment (in progress)

The project has been prepared for Railway deployment:

- **Build command**: `npm run build`
- **Start command**: `serve dist -l 3000`
- **Dependency**: `serve` package installed

### To finish deploying:

1. In Railway dashboard → **Settings** tab, verify:
   - **Build Command**: `npm run build`
   - **Start Command**: `npx serve dist -l 3000`
2. Check **Deployments** tab for any build errors
3. Once green ✅, share the generated URL with anyone

---

## 🧠 Roadmap: Making the Real AI Model

### 1. Collect snail photos 📸

Best practices:
- **Top-down (90°) angle** — most important
- Plain white/light grey background
- Bright, diffused natural light
- Snail resting, slightly exposed
- Shell fills ~60-70% of the frame
- **Goal: 200+ photos per class**

### 2. Label & organize 🏷️

```
dataset_sex/train/male/
dataset_sex/train/female/
dataset_pregnancy/train/pregnant/
dataset_pregnancy/train/not_pregnant/
```
Plus `val/` folders with ~20% of images.

### 3. Train YOLO model 🎯

```bash
pip install ultralytics
yolo classify train model=yolo11n-cls.pt data=./dataset_sex epochs=50 imgsz=224
yolo classify train model=yolo11n-cls.pt data=./dataset_pregnancy epochs=50 imgsz=224
```

### 4. Deploy as API 🌐

Create a FastAPI server loading your trained models, deploy to Railway or Render.

### 5. Connect the app 🔗

Set `VITE_YOLO_API_URL=https://your-api.railway.app/classify`

The app will automatically switch from mock to real predictions.

---

## 📁 Project Structure

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
| `PROJECT_SUMMARY.md` | This file — full project overview |
