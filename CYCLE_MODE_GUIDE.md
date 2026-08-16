# 🌀 Cycle Mode — Demo Version Guide

**Goal:** a zero-setup, no-server demo where **every scan shows the next result
in the loop: Male → Female → Female Pregnant → back to Male**.

Perfect for a hands-on booth table or showing the app off on a phone: you (or a
visitor) scan anything — a snail, a hand, an empty table — and the app reliably
marches through all three classification states. It's deterministic, instant,
and works fully offline. No FastAPI server, no Gemini key, no camera-side AI.

---

## How it works (in one paragraph)

The cycle version is the **same app** with one flag flipped: `VITE_CYCLE_MODE=true`.
With it set, `classifySnailImage()` in `src/lib/api.ts` **never calls the API** —
instead it waits ~0.9s (so it feels like a real scan) and returns the **next**
result from a hardcoded list (`cycleStates`). The list is:

| Scan # | Shown result |
|---|---|
| 1st | **Male** / Not Pregnant |
| 2nd | **Female** / Not Pregnant |
| 3rd | **Female** / Pregnant |
| 4th | Male / Not Pregnant (loop restarts) |
| … | keeps rotating |

Even a photo with **no snail** advances the cycle — the demo never stalls.
Results still show on the result screen, and you can still save them to the
Firestore history if you want (the normal save button is unchanged).

---

## Running it

### Option A — dev server (recommended for the booth)

```bash
npm run dev:cycle
```

That's it — no API server to start, no `.env` to touch. Open:

- Laptop: **`https://localhost:3000`**
- Phone (same Wi-Fi): **`https://192.168.1.10:3000`** — accept the self-signed
  cert warning once (HTTPS is required for the camera on mobile)

The terminal should show `VITE v6.4.3   cycle   ready` — the **cycle** label
confirms the cycle version is running.

### Option B — static build (deployable / SD-card demo)

```bash
npm run build:cycle   # → dist/ with the cycle baked in
npm run preview       # serve it locally, or upload dist/ anywhere static
```

---

## How the flag works

| Where | Value | Effect |
|---|---|---|
| `.env.cycle` (committed) | `VITE_CYCLE_MODE=true` | Used by `npm run dev:cycle` / `build:cycle` — always cycles |
| `.env` (local, gitignored) | `VITE_CYCLE_MODE=true` | Your local copy currently cycles too — `npm run dev` behaves like the cycle version |
| `.env` | `VITE_CYCLE_MODE=false` | Back to **real detections** via the FastAPI server |

`vite --mode cycle` loads `.env.cycle` **on top of** `.env`, so the cycle
scripts work no matter what your local `.env` says.

---

## Customizing the cycle

All the magic lives in **`src/lib/api.ts`** → `cycleStates`. Edit that array to
change the loop:

```ts
const cycleStates: ClassificationResult[] = [
  { sex: "Male",    pregnancyStatus: "Not Pregnant", confidence: 96.2, morphologicalNotes: "...", snailDetected: true },
  { sex: "Female",  pregnancyStatus: "Not Pregnant", confidence: 94.8, morphologicalNotes: "...", snailDetected: true },
  { sex: "Female",  pregnancyStatus: "Pregnant",     confidence: 97.1, morphologicalNotes: "...", snailDetected: true },
];
```

- **Change the order** — reorder the objects (e.g. put Female first).
- **Add a state** — append another object (the loop auto-extends).
- **Remove a state** — delete an object.
- **Rewrite the notes** — make the morphological notes sound like the
  classifier really said it (they're shown to visitors).
- **Tweak the confidence** — any 0–100 number.

The `~0.9s` fake-scan delay is the `setTimeout(resolve, 900)` in
`classifySnailImage()` — shorten it for a snappier demo, lengthen it for more
drama.

---

## Verify it's working

1. `npm run dev:cycle`
2. Open **https://localhost:3000** (accept the cert warning)
3. Tap **Scan** and scan anything (or nothing) three times
4. You should see **Male → Female → Female Pregnant** in order, then the loop
   repeats — every ~1s

---

## Switching back to the real version

The real version (detect → sex/pregnancy via the FastAPI server, Gemini
fallback) needs `VITE_CYCLE_MODE=false`:

```bash
# in .env, flip one line:
VITE_CYCLE_MODE=false
```

Then run the normal stack (see `PROJECT_SUMMARY.md` → "How to Run Locally"):

```bash
# Terminal 1 — FastAPI YOLO server (port 8000)
cd snail-api-server && GEMINI_API_KEY="<your key>" ../.venv/Scripts/python.exe -m uvicorn api_server:app --reload --port 8000

# Terminal 2 — the app
npm run dev
```

The cycle version stays one command away (`npm run dev:cycle`) — you can switch
between them any time without touching the real setup.

---

## Troubleshooting

| Symptom | Fix |
|---|---|
| Browser warns about the certificate | Expected — self-signed HTTPS for the camera. Tap "Advanced → Proceed" once |
| Scans are NOT cycling (real result appears) | `VITE_CYCLE_MODE` is off. Check `.env.cycle` exists and you ran `npm run dev:cycle` (not plain `npm run dev` with a `false` flag) |
| Port 3000 already in use | Another `vite`/dev server is running — stop it, or use a different port: `npx vite --mode cycle --port=3001` |
| Cycle order isn't what I want | Edit `cycleStates` in `src/lib/api.ts` (see above) and save — Vite hot-reloads instantly |
| Phone can't reach the server | Same Wi-Fi? Use the **Network** URL from the terminal (e.g. `https://192.168.1.10:3000`), not `localhost` |

---

## Files involved

| File | Purpose |
|---|---|
| `.env.cycle` | The cycle config (`VITE_CYCLE_MODE=true`) — committed so the version ships with the repo |
| `src/lib/api.ts` | Where `cycleStates` (the loop) and the `VITE_CYCLE_MODE` check live — **edit this to customize the cycle** |
| `package.json` | `dev:cycle` / `build:cycle` scripts (`vite --mode cycle`) |
| `CYCLE_MODE_GUIDE.md` | This guide |

> **Tip:** cycle mode and booth pin mode (see `BOOTH_PIN_GUIDE.md`) cover two
> different demo styles — cycle mode rotates through every state for a lively
> hands-on table; booth pin mode pins each display snail to one fixed result
> for a "real identification" demo. Run whichever fits the moment; they don't
> interfere.
