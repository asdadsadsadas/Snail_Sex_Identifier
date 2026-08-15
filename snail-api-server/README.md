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

## Verify class IDs after training

YOLO orders classes alphabetically by folder name. After training the classifiers, check:

```bash
python -c "from ultralytics import YOLO; m=YOLO('snail_sex_model.pt'); print(m.names)"
```

If the IDs differ from `SEX_MAP = {0: "Female", 1: "Male"}` / `PREGNANCY_MAP = {0: "Not Pregnant", 1: "Pregnant"}`, update the maps in `api_server.py`.
