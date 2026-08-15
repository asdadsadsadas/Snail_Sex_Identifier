# 🐌 Snail API Server — FastAPI (3-Stage Pipeline)

Serves the trained snail AI: **detect → crop → classify sex → classify pregnancy**.

```
POST /classify   multipart form field "image" -> { sex, pregnancyStatus, confidence, morphologicalNotes }
GET  /health     -> { status, detector, sexModel, pregnancyModel }
```

The server **degrades gracefully**: only the detector is required. If `snail_sex_model.pt` / `snail_pregnancy_model.pt` aren't present yet, those stages return `Unknown` with a note — deploy now with just the detector, plug the classifiers in later.

## 1. Model files

The detector weights **`snail_detector.pt` (~5 MB) are committed to the repo**, so deploys work with zero extra setup. Place any additional weights in this folder (they'll be picked up automatically):

- `snail_sex_model.pt` — train in Colab (`colab/train_snail_pipeline.py`), add when ready
- `snail_pregnancy_model.pt` — train in Colab, add when ready

Alternatively, point at a direct download URL via env vars and the server fetches them at startup:

```bash
DETECTOR_URL=https://.../snail_detector.pt
SEX_MODEL_URL=https://.../snail_sex_model.pt
PREGNANCY_MODEL_URL=https://.../snail_pregnancy_model.pt
```

## 2. Run locally

```bash
cd snail-api-server
python -m venv .venv && source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
uvicorn api_server:app --reload --port 8000
```

Test it:

```bash
curl -X POST http://localhost:8000/classify -F "image=@/path/to/snail.jpg"
curl http://localhost:8000/health
```

## 3. Deploy to Render (recommended)

The repo includes a `render.yaml` Blueprint. Either:

**Option A — Blueprint (automatic):** in Render → **New → Blueprint** → pick the GitHub repo. It reads `render.yaml` and creates the `snail-api` service automatically.

**Option B — Web Service (manual):** Render → **New → Web Service** → connect the repo → set **Root Directory: `snail-api-server`** → Python runtime → start command:

```
uvicorn api_server:app --host 0.0.0.0 --port $PORT
```

Then point the app at it (Section 4). Free tier works; the service sleeps after ~15 min idle and wakes on the next request.

## 4. Deploy to Railway (alternative)

1. Push this folder as its own GitHub repo (include `api_server.py`, `requirements.txt`, `railway.json` — `snail_detector.pt` comes along automatically)
2. Railway auto-detects the Python app; `railway.json` sets the start command + health check
3. You get a URL like `https://your-api.up.railway.app`

## 5. Connect the React app

```bash
# in the app root .env
VITE_YOLO_API_URL=https://your-api.onrender.com   # or your-api.up.railway.app
```

The app sends photos to `<url>/classify` and shows the result. Mock fallback stays active if the API is down.

## 6. 🎪 Booth pin mode (science-fair demo) — fixed results per snail

By default, Gemini gives slightly different answers on every scan — the same snail could show
"Female" one minute and "Male" the next. For a booth demo you want **each snail to always show
the same result**. Booth pin mode does that: you pin each of your 3 booth snails to a fixed
sex/pregnancy, and the server matches every scan against reference photos of them — **Gemini is
bypassed entirely on a match**, so results are 100% consistent.

**Setup (5 minutes):**

1. Create photo folders and drop **4–8 phone photos per snail** (same container/spot/lighting as
the booth):
   ```
   demo_pins/snail1/  demo_pins/snail2/  demo_pins/snail3/
   ```
2. Edit the `SNAILS` list at the top of `build_demo_pins.py` — set each snail's fixed
   `sex`, `pregnancyStatus`, `confidence`, and `morphologicalNotes`.
3. Generate the config + restart the server:
   ```bash
   python build_demo_pins.py
   # → writes demo_pins.json; restart uvicorn
   ```
4. **Verify BEFORE the fair** that each snail matches reliably:
   ```bash
   python check_demo_pins.py demo_pins/snail1/01.jpg demo_pins/snail2/01.jpg
   # expect: MATCH ✅ snail1 (crop X<=10 & full Y<=20)   ...
   ```
   If a photo shows `NO MATCH`, add more reference photos of that snail and rebuild.

**How it works:** each scan is compared to every reference photo using a difference hash
(robust to lighting/brightness) on the detected snail crop **and** the full frame. A pin only
fires when **both** are under their thresholds (defaults crop≤10, full≤20 out of 64) — the
crop identifies the snail, the full frame confirms it's the same container/scene, which stops
similar-looking snails from getting confused. The pinned result is returned — no Gemini, no
variance. `GET /health` reports `demoPins` so you can confirm it's active.

## Verify class IDs after training

YOLO orders classes alphabetically by folder name. After training the classifiers, check:

```bash
python -c "from ultralytics import YOLO; m=YOLO('snail_sex_model.pt'); print(m.names)"
```

If the IDs differ from `SEX_MAP = {0: "Female", 1: "Male"}` / `PREGNANCY_MAP = {0: "Not Pregnant", 1: "Pregnant"}`, update the maps in `api_server.py`.
